/**
 * Sinch Conversation API provider implementation.
 *
 * API reference:
 *   POST https://us.conversation.api.sinch.com/v1/projects/{projectId}/messages:send
 *   Authorization: Basic base64("{accessKey}:{accessSecret}")
 *
 * Required environment variables:
 *   SINCH_PROJECT_ID     — Project ID from Sinch Dashboard → Settings
 *   SINCH_APP_ID         — Conversation App ID
 *   SINCH_ACCESS_KEY     — Access Key ID
 *   SINCH_ACCESS_SECRET  — Access Secret
 *   SINCH_SMS_SENDER     — E.164 sender number for SMS, e.g. "+12125551234"
 *   SINCH_WHATSAPP_SENDER — WhatsApp sender ID (when WhatsApp is enabled)
 *   SINCH_WEBHOOK_SECRET — Shared secret configured in Sinch App → Webhooks
 *
 * Webhooks:
 *   See /api/webhooks/sinch/route.ts
 *   Configure in Sinch Dashboard → Conversation → Apps → your app → Webhooks
 *   URL: https://www.kesherhq.co/api/webhooks/sinch
 *   Triggers: MESSAGE_DELIVERY_REPORT, INBOUND_MESSAGE
 *
 * WhatsApp:
 *   Not enabled today. Structure preserves it — channel="whatsapp" routes through
 *   WHATSAPP channel on the same Conversation App. Enable by provisioning a
 *   WhatsApp-capable channel in the Sinch App and setting SINCH_WHATSAPP_SENDER.
 *
 * Region:
 *   Defaults to US. Set SINCH_REGION=eu to use EU data residency.
 */

import type { SmsProvider, SmsChannel, OutboundSms, SmsResult } from "./sms-provider";

// Sinch channel names (Conversation API enum values)
const SINCH_CHANNEL: Record<SmsChannel, "SMS" | "WHATSAPP"> = {
  sms:      "SMS",
  whatsapp: "WHATSAPP",
};

export class SinchProvider implements SmsProvider {
  private projectId:  string;
  private appId:      string;
  private authHeader: string;
  private baseUrl:    string;

  constructor(
    projectId:    string,
    appId:        string,
    accessKey:    string,
    accessSecret: string,
    region = "us"
  ) {
    this.projectId  = projectId;
    this.appId      = appId;
    this.baseUrl    = `https://${region}.conversation.api.sinch.com/v1`;

    // Basic auth: base64("{accessKey}:{accessSecret}")
    const credentials = Buffer.from(`${accessKey}:${accessSecret}`).toString("base64");
    this.authHeader = `Basic ${credentials}`;
  }

  async send(channel: SmsChannel, msg: OutboundSms): Promise<SmsResult> {
    const url     = `${this.baseUrl}/projects/${this.projectId}/messages:send`;
    const sinchCh = SINCH_CHANNEL[channel];

    // Build message content.
    // SMS + media → MMS: send as media_message with the body as a caption so
    // the text is not lost. Caption is supported by the Sinch Conversation API
    // for SMS/MMS; carrier delivery of captions varies but is widely supported.
    // Plain SMS (no media) → text_message as before.
    const message: Record<string, unknown> = msg.mediaUrl
      ? { media_message: { url: msg.mediaUrl, ...(msg.body ? { caption: msg.body } : {}) } }
      : { text_message: { text: msg.body } };

    // channel_properties lets us override the sender number per-request.
    // Without this, Sinch falls back to whatever default is configured on
    // the channel — which may be empty or wrong (shows as "100" in logs).
    // SMS_SENDER must be E.164 (+1XXXXXXXXXX). WhatsApp uses a separate
    // sender configured in the Sinch App; we pass it the same way.
    const channelProperties: Record<string, string> = msg.from
      ? { SMS_SENDER: msg.from }
      : {};

    const payload = {
      app_id: this.appId,
      recipient: {
        identified_by: {
          channel_identities: [
            { channel: sinchCh, identity: msg.to },
          ],
        },
      },
      message,
      channel_priority_order: [sinchCh],
      ...(Object.keys(channelProperties).length > 0 && { channel_properties: channelProperties }),
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization:  this.authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // Sinch errors may be nested under .error OR at the root level depending
      // on API version and error type — handle both shapes.
      const json = await res.json() as {
        message_id?: string;
        error?: { message?: string; code?: number; status?: string };
        message?: string; // some error responses put message at root
        status?: string;  // e.g. "INVALID_ARGUMENT"
      };

      if (!res.ok || !json.message_id) {
        const detail =
          json.error?.message ?? json.message ?? `HTTP ${res.status} ${json.status ?? ""}`.trim();
        console.error(`[sinch] send failed to=${msg.to} channel=${channel}: ${detail}`);
        return { providerId: null, success: false, error: detail };
      }

      console.log(`[sinch] sent from=${msg.from} to=${msg.to} channel=${channel} messageId=${json.message_id}`);
      return { providerId: json.message_id, success: true };
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Network error";
      console.error(`[sinch] send exception to=${msg.to} channel=${channel}:`, detail);
      return { providerId: null, success: false, error: detail };
    }
  }
}
