import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isLikelyScannerClick, SCANNER_CLICK_MS } from "@/lib/tracking";
import { addSuppression } from "@/lib/suppressions";

// ─── Resend webhook event types ───────────────────────────────────────────────
// Resend uses standardwebhooks for delivery. Signature headers:
//   svix-id        unique message ID
//   svix-timestamp unix timestamp (seconds)
//   svix-signature v1,<base64-hmac-sha256>
//
// Set RESEND_WEBHOOK_SECRET in Vercel env vars after creating the webhook
// endpoint in the Resend dashboard (Webhooks → Add Endpoint → signing secret,
// starts with "whsec_"). While it is unset, events are accepted unverified.
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

  // Resend's svix-style payload, verified when RESEND_WEBHOOK_SECRET is set. Without it,
  // events are accepted unverified (and Settings → Channels shows a warning) rather
  // than every delivery/bounce/open being silently dropped.
  let payload: { type: string; created_at?: string; data: unknown };
  if (!secret) {
    console.warn("[resend-webhook] RESEND_WEBHOOK_SECRET not set — accepting WITHOUT signature verification (see DEPLOYMENT.md)");
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (!payload || typeof payload.type !== "string" || !payload.data) return NextResponse.json({ ok: true });
  } else {
    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error("[resend-webhook] Missing svix-* headers", { svixId, svixTimestamp, svixSignature: !!svixSignature });
      return NextResponse.json({ error: "Missing signature headers" }, { status: 400 });
    }

    // ── Signature verification via Resend SDK ────────────────────────────────
    // Uses standardwebhooks under the hood: HMAC-SHA256 of "{id}.{timestamp}.{body}"
    const resend = new Resend(process.env.RESEND_API_KEY);
    try {
      payload = resend.webhooks.verify({
        payload: rawBody,
        headers: {
          id:        svixId,
          timestamp: svixTimestamp,
          signature: svixSignature,
        },
        webhookSecret: secret,
      }) as unknown as typeof payload;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[resend-webhook] Signature verification failed:", message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  // ── Event routing ──────────────────────────────────────────────────────────
  const type    = payload.type as ResendEvent;
  const emailId = (payload.data as { email_id?: string }).email_id;
  const created_at = payload.created_at ?? new Date().toISOString();

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

  // Mail security scanners click every link the moment a message lands. A click
  // within seconds of delivery is a scanner, not a parent, so it isn't recorded.
  if (type === "email.clicked") {
    const { data: row } = await supabase.from("message_recipients").select("delivered_at, sent_at").eq("provider_id", emailId).maybeSingle();
    if (row && isLikelyScannerClick(created_at, row.delivered_at as string | null, row.sent_at as string | null)) {
      console.log(`[resend-webhook] ignoring click within ${SCANNER_CLICK_MS}ms of delivery (link scanner) — email_id=${emailId}`);
      return NextResponse.json({ ok: true });
    }
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

  // A spam complaint or a permanent bounce means this address must not be emailed again by this school
  if (type === "email.complained" || (type === "email.bounced" && bounceData?.type === "hard")) {
    const { data: row } = await supabase.from("message_recipients").select("person_id, contact_value, messages!inner(org_id)").eq("provider_id", emailId).maybeSingle();
    if (row) {
      const orgId = (row as unknown as { messages: { org_id: string } }).messages.org_id;
      try {
        await addSuppression(supabase, {
          orgId,
          channel: "email",
          address: row.contact_value as string,
          personId: row.person_id as string,
          reason: type === "email.complained" ? "complaint" : "bounce",
          source: "resend_webhook",
        });
      } catch (err) {
        console.error(`[resend-webhook] couldn't suppress after ${type} for ${emailId}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
