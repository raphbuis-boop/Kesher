/**
 * Sinch Conversation API webhook handler.
 *
 * Signature verification:
 *   Sinch sends x-sinch-webhook-secret header containing the shared secret
 *   configured in Sinch Dashboard → Conversation → Apps → your app → Webhooks.
 *   We compare it against SINCH_WEBHOOK_SECRET env var.
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
 *   Secret: set SINCH_WEBHOOK_SECRET to the value you enter in the dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// ─── CTIA-required keyword constants ──────────────────────────────────────────

// Carriers handle STOP at the network level, but we must also update our DB
// so analytics stay consistent and we never attempt to re-send to opted-out numbers.
const STOP_KEYWORDS   = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);
const UNSTOP_KEYWORDS = new Set(["UNSTOP", "START"]);
const HELP_KEYWORDS   = new Set(["HELP", "INFO"]);

// CTIA-required auto-response templates.
// Must include: program name, confirmation, opt-out / opt-in instruction.
const STOP_CONFIRMATION =
  "Kesher: You have been unsubscribed from school notifications. " +
  "No further messages will be sent. Reply UNSTOP to re-subscribe. " +
  "Questions? contact@kesherhq.co";

const UNSTOP_CONFIRMATION =
  "Kesher: You have been re-subscribed to school notifications. " +
  "Reply STOP at any time to opt out. Msg & Data rates may apply.";

const HELP_RESPONSE =
  "Kesher School Communications. " +
  "Reply STOP to opt out. Reply UNSTOP to re-subscribe. " +
  "Msg & Data rates may apply. Support: contact@kesherhq.co | kesherhq.co/sms-terms";

// ─── Send auto-response via Sinch Conversation API ───────────────────────────

async function sendAutoResponse(to: string, text: string): Promise<void> {
  const projectId    = process.env.SINCH_PROJECT_ID;
  const appId        = process.env.SINCH_APP_ID;
  const accessKey    = process.env.SINCH_ACCESS_KEY;
  const accessSecret = process.env.SINCH_ACCESS_SECRET;
  const region       = process.env.SINCH_REGION ?? "us";

  if (!projectId || !appId || !accessKey || !accessSecret) {
    console.warn("[sinch-webhook] Cannot send auto-response — Sinch credentials not configured");
    return;
  }

  const credentials = Buffer.from(`${accessKey}:${accessSecret}`).toString("base64");
  const url = `https://${region}.conversation.api.sinch.com/v1/projects/${projectId}/messages:send`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization:  `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: appId,
        recipient: {
          identified_by: {
            channel_identities: [{ channel: "SMS", identity: to }],
          },
        },
        message: { text_message: { text } },
        channel_priority_order: ["SMS"],
      }),
    });
    if (!res.ok) {
      console.error(`[sinch-webhook] Auto-response failed to=${to} status=${res.status}`);
    } else {
      console.log(`[sinch-webhook] Auto-response sent to=${to}`);
    }
  } catch (err) {
    console.error("[sinch-webhook] Auto-response exception:", err);
  }
}

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

function verifySecret(headers: Headers): boolean {
  const webhookSecret = process.env.SINCH_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // Not configured — log a warning but allow through (same as Telnyx fallback).
    // Set SINCH_WEBHOOK_SECRET in production to enforce verification.
    console.warn(
      "[sinch-webhook] SINCH_WEBHOOK_SECRET not set — skipping signature verification"
    );
    return true;
  }

  const incoming = headers.get("x-sinch-webhook-secret");
  if (!incoming) return false;

  // Constant-time comparison to prevent timing attacks
  if (incoming.length !== webhookSecret.length) return false;
  let mismatch = 0;
  for (let i = 0; i < incoming.length; i++) {
    mismatch |= incoming.charCodeAt(i) ^ webhookSecret.charCodeAt(i);
  }
  return mismatch === 0;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifySecret(req.headers)) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
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

    if (status === "DELIVERED") {
      const { error } = await supabase
        .from("message_recipients")
        .update({ status: "delivered", delivered_at: eventTime })
        .eq("provider_id", messageId)
        .is("delivered_at", null); // idempotent — only set once

      if (error) {
        console.error(
          `[sinch-webhook] DB update failed (delivered) messageId=${messageId}:`,
          error.message
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (status === "FAILED") {
      const reasonCode = report.reason?.code ?? null;
      const update: Record<string, string | null> = { status: "failed" };
      if (reasonCode) update.bounce_type = reasonCode;

      const { error } = await supabase
        .from("message_recipients")
        .update(update)
        .eq("provider_id", messageId);

      if (error) {
        console.error(
          `[sinch-webhook] DB update failed (failed) messageId=${messageId}:`,
          error.message
        );
      }
      return NextResponse.json({ ok: true });
    }

    // QUEUED_ON_CHANNEL, SWITCHING_CHANNEL, UNKNOWN — no DB update needed
    return NextResponse.json({ ok: true });
  }

  // ── INBOUND_MESSAGE (reply) ───────────────────────────────────────────────
  if (payload.message) {
    const msg         = payload.message;
    const sinchId     = msg.id;

    if (!sinchId) {
      console.warn("[sinch-webhook] inbound message missing id — skipping");
      return NextResponse.json({ ok: true });
    }

    const fromNumber  = msg.channel_identity.identity;
    const toNumber    = process.env.SINCH_SMS_SENDER ?? "";
    const channel     = msg.channel_identity.channel === "WHATSAPP" ? "whatsapp" : "sms";
    const bodyText    =
      msg.contact_message?.text_message?.text ??
      msg.contact_message?.media_message?.url ??
      null;

    console.log(
      `[sinch-webhook] inbound messageId=${sinchId} from=${fromNumber} channel=${channel}`
    );

    // ── CTIA-required keyword handling ──────────────────────────────────────
    // Carriers handle STOP at the network level, but we must mirror it in our
    // DB so analytics stay accurate and we never try to re-send to opted-out numbers.
    // HELP must return an auto-response containing program name + support info.
    const keyword = bodyText?.trim().toUpperCase() ?? "";

    if (STOP_KEYWORDS.has(keyword)) {
      console.log(`[sinch-webhook] STOP received from=${fromNumber} — marking opted out`);
      // Mark all outbound recipients for this number as opted-out
      await supabase
        .from("message_recipients")
        .update({ status: "opted_out" })
        .eq("contact_value", fromNumber)
        .not("status", "eq", "opted_out");
      // CTIA requires a single confirmation message — carrier may also send one
      // at network level, but we send ours to ensure it's received.
      await sendAutoResponse(fromNumber, STOP_CONFIRMATION);
      return NextResponse.json({ ok: true });
    }

    if (UNSTOP_KEYWORDS.has(keyword)) {
      console.log(`[sinch-webhook] UNSTOP received from=${fromNumber}`);
      await sendAutoResponse(fromNumber, UNSTOP_CONFIRMATION);
      return NextResponse.json({ ok: true });
    }

    if (HELP_KEYWORDS.has(keyword)) {
      console.log(`[sinch-webhook] HELP received from=${fromNumber}`);
      await sendAutoResponse(fromNumber, HELP_RESPONSE);
      // Still fall through to log the inbound message — don't return early
    }

    // ── Regular reply — Find the most recent outbound recipient ──────────────
    const { data: matched } = await supabase
      .from("message_recipients")
      .select("id")
      .eq("contact_value", fromNumber)
      .is("replied_at", null)
      .order("sent_at", { ascending: false })
      .limit(1);

    const recipientId = matched?.[0]?.id ?? null;

    if (recipientId) {
      const { error: replyError } = await supabase
        .from("message_recipients")
        .update({ replied_at: eventTime })
        .eq("id", recipientId);

      if (replyError) {
        console.error(
          `[sinch-webhook] Failed to set replied_at for recipient ${recipientId}:`,
          replyError.message
        );
      }
    }

    // Persist the raw inbound message. telnyx_id column stores the Sinch message
    // ID for deduplication — the column name is an internal DB detail.
    const { error: insertError } = await supabase
      .from("inbound_messages")
      .insert({
        channel,
        from_number:          fromNumber,
        to_number:            toNumber,
        body:                 bodyText,
        received_at:          eventTime,
        message_recipient_id: recipientId,
        telnyx_id:            sinchId, // dedup key — stores Sinch message ID
        raw_payload:          msg,
      })
      .select()
      .single();

    if (insertError && insertError.code !== "23505") {
      // 23505 = unique_violation (duplicate sinchId) — safe to ignore
      console.error(
        `[sinch-webhook] Failed to insert inbound_message id=${sinchId}:`,
        insertError.message
      );
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
