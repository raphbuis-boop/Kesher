import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// ─── Resend webhook event types ───────────────────────────────────────────────
// Resend uses standardwebhooks for delivery. Signature headers:
//   svix-id        unique message ID
//   svix-timestamp unix timestamp (seconds)
//   svix-signature v1,<base64-hmac-sha256>
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
  | "email.failed"
  | "email.suppressed"
  | "email.opened"
  | "email.clicked";

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // ── Diagnostic logging ─────────────────────────────────────────────────────
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const svixId        = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  console.log("[resend-webhook] incoming request", {
    secretPresent: !!secret,
    secretPrefix: secret ? secret.slice(0, 6) : "MISSING",
    "svix-id":        svixId,
    "svix-timestamp": svixTimestamp,
    "svix-signature": svixSignature ? svixSignature.slice(0, 20) + "…" : null,
    rawBodyLength: rawBody.length,
  });

  if (!secret) {
    console.warn("[resend-webhook] RESEND_WEBHOOK_SECRET not set — rejecting request");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error("[resend-webhook] Missing svix-* headers", { svixId, svixTimestamp, svixSignature: !!svixSignature });
    return NextResponse.json({ error: "Missing signature headers" }, { status: 400 });
  }

  // ── Signature verification via Resend SDK ──────────────────────────────────
  // Uses standardwebhooks under the hood: HMAC-SHA256 of "{id}.{timestamp}.{body}"
  const resend = new Resend(process.env.RESEND_API_KEY);

  let payload: ReturnType<typeof resend.webhooks.verify>;
  try {
    payload = resend.webhooks.verify({
      payload: rawBody,
      headers: {
        id:        svixId,
        timestamp: svixTimestamp,
        signature: svixSignature,
      },
      webhookSecret: secret,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[resend-webhook] Signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // ── Event routing ──────────────────────────────────────────────────────────
  const type    = payload.type as ResendEvent;
  const emailId = (payload.data as { email_id?: string }).email_id;
  const created_at = (payload as unknown as { created_at: string }).created_at;

  if (!emailId) {
    return NextResponse.json({ ok: true });
  }

  console.log(`[resend-webhook] ${type} — email_id=${emailId}`);

  // Webhooks arrive with no user session — use service-role client to bypass RLS
  const supabase = createSupabaseAdminClient();

  // ── email.failed / email.suppressed — mark recipient as failed ─────────────
  // These events indicate the message could not be sent or was suppressed at the
  // Resend level (suppression list). No timestamp column — just flip the status.
  if (type === "email.failed" || type === "email.suppressed") {
    const { error } = await supabase
      .from("message_recipients")
      .update({ status: "failed" })
      .eq("provider_id", emailId)
      .neq("status", "failed"); // idempotent

    if (error) {
      console.error(`[resend-webhook] DB update failed (${type}) for ${emailId}:`, error.message);
    }
    return NextResponse.json({ ok: true });
  }

  // ── Timestamp-mapped events ────────────────────────────────────────────────
  const columnMap: Partial<Record<ResendEvent, string>> = {
    "email.delivered":  "delivered_at",
    "email.opened":     "opened_at",
    "email.clicked":    "clicked_at",
    "email.bounced":    "bounced_at",
    "email.complained": "complained_at",
  };

  const column = columnMap[type];
  if (!column) {
    // email.sent, email.delivery_delayed, email.scheduled — no DB action needed
    return NextResponse.json({ ok: true });
  }

  const update: Record<string, string | null> = {
    [column]: created_at,
  };

  // For bounces, also record the bounce type
  const bounceData = (payload.data as { bounce?: { type?: "soft" | "hard" } }).bounce;
  if (type === "email.bounced" && bounceData?.type) {
    update["bounce_type"] = bounceData.type;
    // Hard bounce = permanent failure → mark status as failed
    if (bounceData.type === "hard") {
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
