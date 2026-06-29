/**
 * Telnyx webhook handler — delivery receipts and inbound SMS/WhatsApp.
 *
 * Signature verification:
 *   Algorithm : Ed25519 (NOT HMAC-SHA256)
 *   Headers   : telnyx-signature-ed25519 (base64), telnyx-timestamp (unix seconds)
 *   Signed    : "{telnyx-timestamp}|{raw-body}"
 *   Public key: TELNYX_PUBLIC_KEY env var (portal → API Keys → Ed25519 Public Key)
 *
 * Event types handled:
 *   message.delivered  — update recipient status + delivered_at
 *   message.failed     — update recipient status to failed + error code
 *   message.received   — inbound message (logged; Inbox is Phase 2)
 *   message.sent       — acknowledged, no DB update
 *   message.finalized  — acknowledged, no DB update
 *
 * Required env vars:
 *   TELNYX_PUBLIC_KEY  — Ed25519 public key from Telnyx portal → API Keys
 *
 * Configure in Telnyx portal:
 *   Messaging → Messaging Profiles → your profile → Webhooks
 *   URL: https://kesherhq.co/api/webhooks/telnyx
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// ─── Types ────────────────────────────────────────────────────────────────────

type TelnyxEventType =
  | "message.received"
  | "message.sent"
  | "message.delivered"
  | "message.failed"
  | "message.finalized";

type TelnyxWebhookPayload = {
  data: {
    event_type: TelnyxEventType;
    occurred_at: string;
    payload: {
      id: string; // Telnyx message UUID — matches provider_id in message_recipients
      direction: "outbound" | "inbound";
      type: "SMS" | "MMS" | "WhatsApp";
      from: { phone_number: string };
      to: { phone_number: string; status?: string }[];
      text?: string;
      errors?: { code: string; title: string; detail?: string }[];
    };
  };
};

// ─── Signature verification ───────────────────────────────────────────────────

async function verifySignature(
  rawBody: string,
  headers: Headers
): Promise<boolean> {
  const publicKeyB64 = process.env.TELNYX_PUBLIC_KEY;
  if (!publicKeyB64) {
    // No key configured — skip verification in development but log warning.
    // In production you must set TELNYX_PUBLIC_KEY.
    console.warn(
      "[telnyx-webhook] TELNYX_PUBLIC_KEY not set — skipping signature verification"
    );
    return true;
  }

  const timestamp = headers.get("telnyx-timestamp");
  const signatureB64 = headers.get("telnyx-signature-ed25519");

  if (!timestamp || !signatureB64) return false;

  // Reject stale webhooks (>5 minutes)
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  try {
    // Telnyx provides the key as base64-encoded SPKI (44 bytes) or raw (32 bytes)
    const keyBytes = Uint8Array.from(
      atob(publicKeyB64.replace(/\s/g, "")),
      (c) => c.charCodeAt(0)
    );
    const format: "raw" | "spki" = keyBytes.length === 32 ? "raw" : "spki";

    const key = await crypto.subtle.importKey(
      format,
      keyBytes,
      { name: "Ed25519" },
      false,
      ["verify"]
    );

    const signatureBytes = Uint8Array.from(
      atob(signatureB64),
      (c) => c.charCodeAt(0)
    );
    const message = new TextEncoder().encode(`${timestamp}|${rawBody}`);

    return await crypto.subtle.verify("Ed25519", key, signatureBytes, message);
  } catch (err) {
    console.error("[telnyx-webhook] Signature verification error:", err);
    return false;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const valid = await verifySignature(rawBody, req.headers);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: TelnyxWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as TelnyxWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event_type, occurred_at, payload: msg } = payload.data;
  const telnyxId = msg.id;

  console.log(
    `[telnyx-webhook] ${event_type} — id=${telnyxId} direction=${msg.direction} type=${msg.type}`
  );

  // ── Inbound messages ──────────────────────────────────────────────────────
  // Logged for now; Inbox feature (Phase 2) will persist these.
  if (event_type === "message.received" || msg.direction === "inbound") {
    console.log(
      `[telnyx-webhook] Inbound ${msg.type} from ${msg.from.phone_number}: "${msg.text ?? ""}"`
    );
    return NextResponse.json({ ok: true });
  }

  // ── Outbound delivery receipts ────────────────────────────────────────────
  if (!telnyxId) {
    return NextResponse.json({ ok: true });
  }

  const supabase = await createSupabaseServerClient();

  if (event_type === "message.delivered") {
    const { error } = await supabase
      .from("message_recipients")
      .update({ status: "delivered", delivered_at: occurred_at })
      .eq("provider_id", telnyxId)
      .neq("status", "delivered"); // idempotent — don't re-write if already delivered

    if (error) {
      console.error(
        `[telnyx-webhook] DB update failed (delivered) id=${telnyxId}:`,
        error.message
      );
    }
  } else if (event_type === "message.failed") {
    const errorCode = msg.errors?.[0]?.code ?? null;
    const update: Record<string, string | null> = { status: "failed" };
    if (errorCode) update.bounce_type = errorCode; // reuse email bounce_type column for SMS error code

    const { error } = await supabase
      .from("message_recipients")
      .update(update)
      .eq("provider_id", telnyxId);

    if (error) {
      console.error(
        `[telnyx-webhook] DB update failed (failed) id=${telnyxId}:`,
        error.message
      );
    }
  }
  // message.sent, message.finalized — no DB action needed

  // Always return 200 — prevents Telnyx from retrying on DB errors
  return NextResponse.json({ ok: true });
}
