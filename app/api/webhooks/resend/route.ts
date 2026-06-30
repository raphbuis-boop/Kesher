import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// ─── Resend webhook event types ───────────────────────────────────────────────
// Resend uses svix for webhook delivery. Signature headers:
//   svix-id        unique message ID
//   svix-timestamp unix timestamp (seconds)
//   svix-signature v1,<base64-hmac-sha256>
//
// Message to sign: "{svix-id}.{svix-timestamp}.{raw-body}"
// Secret format:   "whsec_{base64-encoded-secret}"
//
// Set RESEND_WEBHOOK_SECRET in Vercel env vars after creating the webhook
// endpoint in the Resend dashboard (Webhooks → Add Endpoint).
// Enable these events: email.delivered, email.bounced, email.complained,
//                      email.opened, email.clicked

type ResendEvent =
  | "email.sent"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.complained"
  | "email.bounced"
  | "email.opened"
  | "email.clicked";

type ResendWebhookPayload = {
  type: ResendEvent;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject?: string;
    bounce?: {
      type?: "soft" | "hard";
      message?: string;
    };
  };
};

// ─── Signature verification ───────────────────────────────────────────────────

async function verifySignature(
  rawBody: string,
  headers: Headers
): Promise<boolean> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    // No secret configured — skip verification in development but log warning.
    // In production you must set RESEND_WEBHOOK_SECRET.
    console.warn("[resend-webhook] RESEND_WEBHOOK_SECRET not set — skipping signature verification");
    return true;
  }

  const svixId        = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return false;
  }

  // Reject stale webhooks (>5 minutes old)
  const ts = parseInt(svixTimestamp, 10);
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return false;
  }

  try {
    // Secret is "whsec_<base64>" — strip prefix and decode
    const secretBase64 = secret.startsWith("whsec_")
      ? secret.slice("whsec_".length)
      : secret;
    const secretBytes = Uint8Array.from(atob(secretBase64), (c) => c.charCodeAt(0));

    const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
    const key = await crypto.subtle.importKey(
      "raw",
      secretBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(toSign));
    const computed = "v1," + btoa(String.fromCharCode(...new Uint8Array(sig)));

    // svix-signature may contain multiple space-separated signatures
    const provided = svixSignature.split(" ");
    return provided.some((s) => s === computed);
  } catch (err) {
    console.error("[resend-webhook] Signature verification error:", err);
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

  let payload: ResendWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as ResendWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, created_at, data } = payload;
  const emailId = data.email_id;

  if (!emailId) {
    return NextResponse.json({ ok: true }); // nothing to update
  }

  console.log(`[resend-webhook] ${type} — email_id=${emailId}`);

  // Map event type to the column we want to set.
  // We only update if the column is not already set (don't overwrite first open, etc.)
  const columnMap: Partial<Record<ResendEvent, string>> = {
    "email.delivered":  "delivered_at",
    "email.opened":     "opened_at",
    "email.clicked":    "clicked_at",
    "email.bounced":    "bounced_at",
    "email.complained": "complained_at",
  };

  const column = columnMap[type];
  if (!column) {
    // event we don't track (email.sent, email.delivery_delayed) — acknowledge
    return NextResponse.json({ ok: true });
  }

  // Webhooks arrive with no user session — use service-role client to bypass RLS
  const supabase = createSupabaseAdminClient();

  // Build the update payload
  const update: Record<string, string | null> = {
    [column]: created_at,
  };

  // For bounces, also record the bounce type
  if (type === "email.bounced" && data.bounce?.type) {
    update["bounce_type"] = data.bounce.type;
    // Hard bounce = permanent failure → mark status as failed
    if (data.bounce.type === "hard") {
      update["status"] = "failed";
    }
  }

  const { error } = await supabase
    .from("message_recipients")
    .update(update)
    .eq("provider_id", emailId)
    .is(column, null); // only set once — don't overwrite first open/click

  if (error) {
    console.error(`[resend-webhook] DB update failed for ${emailId}:`, error.message);
    // Return 200 so Resend doesn't retry — DB errors shouldn't cause redelivery
  }

  return NextResponse.json({ ok: true });
}
