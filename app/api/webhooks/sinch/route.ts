/**
 * Sinch Conversation API webhook handler.
 *
 * Signature verification:
 *   Sinch sends three headers for HMAC-SHA256 validation:
 *     x-sinch-webhook-signature           — base64(HMAC-SHA256(key, body.nonce.timestamp))
 *     x-sinch-webhook-signature-nonce     — random nonce (replay protection)
 *     x-sinch-webhook-signature-timestamp — unix timestamp of the request
 *   The signing key is the Sinch Conversation App Secret, stored in SINCH_WEBHOOK_SECRET.
 *   Set SINCH_WEBHOOK_SECRET to the App Secret shown in Sinch Dashboard →
 *   Conversation → Apps → your app → Show Credentials → App Secret.
 *
 * Triggers handled:
 *   MESSAGE_DELIVERY_REPORT — delivery status updates (DELIVERED, FAILED, etc.)
 *   INBOUND_MESSAGE         — inbound SMS or reply from a recipient
 *   MESSAGE_SUBMIT_RESPONSE — Sinch accepted the message (acknowledged, no DB update)
 *
 * Delivery status values:
 *   QUEUED_ON_CHANNEL    — handed to carrier, not yet delivered
 *   DELIVERED            — carrier confirmed delivery to handset
 *   FAILED               — could not deliver (reason.code has details)
 *   SWITCHING_CHANNEL    — retrying on alternate channel (not used for SMS-only)
 *   UNKNOWN_DELIVERY_STATUS — no final status from carrier
 *
 * Idempotency:
 *   Delivery updates use .is("delivered_at", null) / .is("read_at", null) guards.
 *   Inbound messages deduplicate on inbound_messages.telnyx_id (stores Sinch message
 *   ID — column name is an internal DB detail, schema unchanged per design policy).
 *
 * Configure in Sinch Dashboard:
 *   Conversation → Apps → your app → Webhooks → Add Webhook
 *   URL: https://www.kesherhq.co/api/webhooks/sinch
 *   Triggers: MESSAGE_DELIVERY_REPORT, INBOUND_MESSAGE
 *   (No "secret" field in the Sinch webhook form — auth is via App Secret HMAC)
 */

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { fallbackForFailedRow } from "@/lib/send/engine";
import { processInbound } from "@/lib/inbound";
import { updateThreadMessageStatus } from "@/lib/inbox";

// ─── Sinch payload types ──────────────────────────────────────────────────────

type SinchDeliveryStatus =
  | "QUEUED_ON_CHANNEL"
  | "DELIVERED"
  | "FAILED"
  | "SWITCHING_CHANNEL"
  | "UNKNOWN_DELIVERY_STATUS";

type SinchChannel = "SMS" | "WHATSAPP" | "RCS" | string;

type SinchChannelIdentity = {
  channel:  SinchChannel;
  identity: string; // phone number (E.164)
  app_id?:  string;
};

type SinchDeliveryReport = {
  message_id:       string;
  conversation_id?: string;
  status:           SinchDeliveryStatus;
  channel_identity: SinchChannelIdentity;
  contact_id?:      string;
  reason?: {
    code:        string;
    description: string;
    sub_code?:   string;
  } | null;
  metadata?: string;
};

type SinchInboundMessage = {
  id:               string;
  direction:        "TO_APP";
  contact_message?: {
    text_message?: { text: string };
    media_message?: { url: string };
  };
  channel_identity: SinchChannelIdentity;
  contact_id?:      string;
  conversation_id?: string;
  accept_time?:     string;
};

type SinchWebhookPayload = {
  app_id?:                  string;
  project_id?:              string;
  accepted_time?:           string;
  event_time?:              string;
  // Exactly one of these will be present per event type:
  message_delivery_report?: SinchDeliveryReport;
  message?:                 SinchInboundMessage;
  message_submit_response?: { message_id: string };
};

// ─── Signature verification ───────────────────────────────────────────────────

// Sinch Conversation API signs every webhook with HMAC-SHA256 using the App Secret.
// Signed payload = rawBody + "." + nonce + "." + timestamp
// Signature      = base64(HMAC-SHA256(key=appSecret_raw_utf8, data=signedPayload))
// The App Secret is used RAW (UTF-8 string) as the HMAC key — NOT base64-decoded.
// Docs: https://developers.sinch.com/docs/conversation/callbacks
function verifySignature(headers: Headers, rawBody: string): boolean {
  const appSecret = process.env.SINCH_WEBHOOK_SECRET;
  if (!appSecret) {
    console.error(
      "[sinch-webhook] SINCH_WEBHOOK_SECRET is not set — rejecting request. " +
      "Set this to the App Secret from Sinch Dashboard → Conversation → Apps → Show Credentials."
    );
    return false;
  }

  const signature = headers.get("x-sinch-webhook-signature");
  const nonce     = headers.get("x-sinch-webhook-signature-nonce");
  const timestamp = headers.get("x-sinch-webhook-signature-timestamp");

  if (!signature || !nonce || !timestamp) {
    console.error(
      "[sinch-webhook] Missing signature headers — got: " +
      `signature=${signature} nonce=${nonce} timestamp=${timestamp}`
    );
    return false;
  }

  // The App Secret is used raw (UTF-8) as the HMAC key per Sinch Conversation API docs.
  // Signed payload: rawBody + "." + nonce + "." + timestamp
  const signedData = `${rawBody}.${nonce}.${timestamp}`;
  const expected   = crypto.createHmac("sha256", appSecret).update(signedData).digest("base64");

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    // timingSafeEqual throws if buffer lengths differ — means definite mismatch
    return false;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifySignature(req.headers, rawBody)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: SinchWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as SinchWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventTime = payload.event_time ?? payload.accepted_time ?? new Date().toISOString();

  // Webhooks have no user session — service-role client bypasses RLS
  const supabase = createSupabaseAdminClient();

  // ── MESSAGE_DELIVERY_REPORT ──────────────────────────────────────────────────
  if (payload.message_delivery_report) {
    const report    = payload.message_delivery_report;
    const messageId = report.message_id;
    const status    = report.status;

    if (!messageId) {
      console.warn("[sinch-webhook] delivery_report missing message_id — skipping");
      return NextResponse.json({ ok: true });
    }
    const channel   = report.channel_identity.channel === "WHATSAPP" ? "whatsapp" : "sms";

    console.log(
      `[sinch-webhook] delivery_report messageId=${messageId} status=${status} channel=${channel}`
    );

    // Replies sent from the inbox are tracked on the conversation too
    if (status === "DELIVERED") await updateThreadMessageStatus(supabase, messageId, "delivered").catch(() => undefined);
    if (status === "FAILED") await updateThreadMessageStatus(supabase, messageId, "failed", report.reason?.description ?? undefined).catch(() => undefined);

    if (status === "DELIVERED") {
      const { data: updated, error } = await supabase
        .from("message_recipients")
        .update({ status: "delivered", delivered_at: eventTime })
        .eq("provider_id", messageId)
        .is("delivered_at", null) // idempotent — only set once
        .select("id");

      if (error) {
        console.error(
          `[sinch-webhook] DB update failed (delivered) messageId=${messageId}:`,
          error.message
        );
      } else if (!updated || updated.length === 0) {
        console.warn(
          `[sinch-webhook] DELIVERED matched no recipient for messageId=${messageId} — already set or provider_id mismatch`
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (status === "FAILED") {
      const reasonCode = report.reason?.code ?? null;
      const update: Record<string, string | null> = { status: "failed" };
      if (reasonCode) update.bounce_type = reasonCode;

      const { data: updated, error } = await supabase
        .from("message_recipients")
        .update(update)
        .eq("provider_id", messageId)
        .select("id");

      if (error) {
        console.error(
          `[sinch-webhook] DB update failed (failed) messageId=${messageId}:`,
          error.message
        );
      } else if (!updated || updated.length === 0) {
        console.warn(
          `[sinch-webhook] FAILED matched no recipient for messageId=${messageId} — provider_id mismatch`
        );
      } else {
        // Best-channel messages try the next channel (email) for this parent
        for (const row of updated) {
          try {
            await fallbackForFailedRow(supabase, row.id as string, report.reason?.description ?? "Text message failed");
          } catch (fbErr) {
            console.error(`[sinch-webhook] fallback failed for row ${row.id}:`, fbErr instanceof Error ? fbErr.message : fbErr);
          }
        }
      }
      return NextResponse.json({ ok: true });
    }

    // QUEUED_ON_CHANNEL, SWITCHING_CHANNEL, UNKNOWN — no DB update needed
    return NextResponse.json({ ok: true });
  }

  // ── INBOUND_MESSAGE (reply) ───────────────────────────────────────────────
  // STOP and its synonyms (English, Hebrew, Yiddish), START and HELP are handled in
  // lib/inbound.ts per school: the opt-out goes on that school's suppression list and
  // the parent gets one confirmation from the school's own number.
  if (payload.message) {
    const msg     = payload.message;
    const sinchId = msg.id;

    if (!sinchId) {
      console.warn("[sinch-webhook] inbound message missing id — skipping");
      return NextResponse.json({ ok: true });
    }

    const channel  = msg.channel_identity.channel === "WHATSAPP" ? "whatsapp" : "sms";
    const bodyText = msg.contact_message?.text_message?.text ?? msg.contact_message?.media_message?.url ?? null;
    console.log(`[sinch-webhook] inbound messageId=${sinchId} channel=${channel}`);

    try {
      await processInbound(supabase, {
        channel,
        from: msg.channel_identity.identity,
        to: null,
        body: bodyText,
        providerMessageId: sinchId,
        receivedAt: eventTime,
        raw: msg,
      });
    } catch (err) {
      console.error(`[sinch-webhook] inbound processing failed id=${sinchId}:`, err instanceof Error ? err.message : err);
      // Not a 5xx: Sinch would retry and we'd risk a second confirmation text
    }
    return NextResponse.json({ ok: true });
  }

  // ── MESSAGE_SUBMIT_RESPONSE (accepted by Sinch) ──────────────────────────
  // Sinch has accepted the message for delivery — no DB update needed here.
  // The provider_id is already set from the send() response.
  if (payload.message_submit_response) {
    console.log(
      `[sinch-webhook] submit_response messageId=${payload.message_submit_response.message_id}`
    );
    return NextResponse.json({ ok: true });
  }

  // Unknown event type — acknowledge to prevent Sinch retrying
  return NextResponse.json({ ok: true });
}
