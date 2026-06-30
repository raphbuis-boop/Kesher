/**
 * Telnyx webhook handler — delivery receipts, read receipts, and inbound replies.
 *
 * Signature verification:
 *   Algorithm : Ed25519 (NOT HMAC-SHA256)
 *   Headers   : telnyx-signature-ed25519 (base64), telnyx-timestamp (unix seconds)
 *   Signed    : "{telnyx-timestamp}|{raw-body}"
 *   Public key: TELNYX_PUBLIC_KEY env var (portal → API Keys → Ed25519 Public Key)
 *
 * Event types handled:
 *   message.sent          — acknowledged, no DB update
 *   message.delivered     — outbound delivery confirmed → delivered_at
 *   message.finalized     — final status with substatus (delivered / delivery_failed)
 *   message.failed        — outbound delivery failed → status=failed
 *   message.read          — WhatsApp read receipt → read_at
 *   message.received      — inbound reply (SMS or WhatsApp)
 *                           → saves to inbound_messages table
 *                           → sets replied_at on the matching outbound recipient
 *
 * Required env vars:
 *   TELNYX_PUBLIC_KEY  — Ed25519 public key from Telnyx portal → API Keys
 *
 * Configure in Telnyx portal:
 *   Messaging → Messaging Profiles → your profile → Webhooks
 *   URL: https://www.kesherhq.co/api/webhooks/telnyx
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// ─── Types ────────────────────────────────────────────────────────────────────

type TelnyxEventType =
  | "message.received"
  | "message.sent"
  | "message.delivered"
  | "message.finalized"
  | "message.read"
  | "message.failed";

type TelnyxWebhookPayload = {
  data: {
    event_type: TelnyxEventType;
    occurred_at: string;
    payload: {
      id: string; // Telnyx message UUID
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
  const telnyxId   = msg.id;
  const channel    = msg.type === "WhatsApp" ? "whatsapp" : "sms";
  const fromNumber = msg.from.phone_number;
  const toNumber   = msg.to?.[0]?.phone_number ?? "";

  console.log(
    `[telnyx-webhook] ${event_type} — id=${telnyxId} dir=${msg.direction} type=${msg.type}`
  );

  // Webhooks arrive with no user session — use service-role client to bypass RLS
  const supabase = createSupabaseAdminClient();

  // ── Inbound message (reply) ────────────────────────────────────────────────
  // Fires when someone texts or WhatsApps our number.
  // 1. Find the most recent outbound message_recipient with this phone number.
  // 2. Set replied_at on that recipient (first reply wins — idempotent after that).
  // 3. Always persist the raw message in inbound_messages for the future inbox.
  if (event_type === "message.received" || msg.direction === "inbound") {
    const { data: matchedRecipients } = await supabase
      .from("message_recipients")
      .select("id")
      .eq("contact_value", fromNumber)
      .is("replied_at", null)
      .order("sent_at", { ascending: false })
      .limit(1);

    const matchedRecipientId = matchedRecipients?.[0]?.id ?? null;

    if (matchedRecipientId) {
      const { error: replyError } = await supabase
        .from("message_recipients")
        .update({ replied_at: occurred_at })
        .eq("id", matchedRecipientId);

      if (replyError) {
        console.error(
          `[telnyx-webhook] Failed to set replied_at for recipient ${matchedRecipientId}:`,
          replyError.message
        );
      }
    }

    const { error: insertError } = await supabase
      .from("inbound_messages")
      .insert({
        channel,
        from_number:          fromNumber,
        to_number:            toNumber,
        body:                 msg.text ?? null,
        received_at:          occurred_at,
        message_recipient_id: matchedRecipientId,
        telnyx_id:            telnyxId,
        raw_payload:          msg,
      })
      .select()
      .single();

    if (insertError && insertError.code !== "23505") {
      // 23505 = unique_violation (duplicate telnyx_id) — safe to ignore
      console.error(
        `[telnyx-webhook] Failed to insert inbound_message id=${telnyxId}:`,
        insertError.message
      );
    }

    return NextResponse.json({ ok: true });
  }

  // ── Outbound delivery events ───────────────────────────────────────────────
  if (!telnyxId) {
    return NextResponse.json({ ok: true });
  }

  // message.delivered — carrier confirmed delivery to the handset
  if (event_type === "message.delivered") {
    const { error } = await supabase
      .from("message_recipients")
      .update({ status: "delivered", delivered_at: occurred_at })
      .eq("provider_id", telnyxId)
      .is("delivered_at", null); // idempotent

    if (error) {
      console.error(
        `[telnyx-webhook] DB update failed (delivered) id=${telnyxId}:`,
        error.message
      );
    }
    return NextResponse.json({ ok: true });
  }

  // message.finalized — final status with substatus
  // Substatus values: "delivered" | "delivery_failed" | "delivery_unconfirmed"
  if (event_type === "message.finalized") {
    const substatus = msg.to?.[0]?.status;

    if (substatus === "delivered") {
      const { error } = await supabase
        .from("message_recipients")
        .update({ status: "delivered", delivered_at: occurred_at })
        .eq("provider_id", telnyxId)
        .is("delivered_at", null);

      if (error) {
        console.error(
          `[telnyx-webhook] DB update failed (finalized/delivered) id=${telnyxId}:`,
          error.message
        );
      }
    } else if (substatus === "delivery_failed") {
      const errorCode = msg.errors?.[0]?.code ?? null;
      const update: Record<string, string | null> = { status: "failed" };
      if (errorCode) update.bounce_type = errorCode;

      const { error } = await supabase
        .from("message_recipients")
        .update(update)
        .eq("provider_id", telnyxId);

      if (error) {
        console.error(
          `[telnyx-webhook] DB update failed (finalized/delivery_failed) id=${telnyxId}:`,
          error.message
        );
      }
    }
    // delivery_unconfirmed — no action, not a definitive state

    return NextResponse.json({ ok: true });
  }

  // message.read — WhatsApp read receipt (recipient opened the message)
  if (event_type === "message.read") {
    const { error } = await supabase
      .from("message_recipients")
      .update({ read_at: occurred_at })
      .eq("provider_id", telnyxId)
      .is("read_at", null); // first read only

    if (error) {
      console.error(
        `[telnyx-webhook] DB update failed (read) id=${telnyxId}:`,
        error.message
      );
    }
    return NextResponse.json({ ok: true });
  }

  // message.failed — outbound message failed before leaving Telnyx
  if (event_type === "message.failed") {
    const errorCode = msg.errors?.[0]?.code ?? null;
    const update: Record<string, string | null> = { status: "failed" };
    if (errorCode) update.bounce_type = errorCode;

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
    return NextResponse.json({ ok: true });
  }

  // message.sent — acknowledged, nothing to update
  return NextResponse.json({ ok: true });
}
