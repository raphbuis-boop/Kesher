/**
 * Telnyx SMS/WhatsApp provider implementation.
 *
 * Telnyx REST API v2:
 *   POST https://api.telnyx.com/v2/messages
 *   Authorization: Bearer {TELNYX_API_KEY}
 *
 * Response: { data: { id, type, to, from, text, ... } }
 * Errors:   { errors: [{ code, title, detail }] }
 *
 * Webhook delivery receipts:
 *   Telnyx POSTs to your webhook URL with event_type:
 *     "message.finalized"  — terminal state (delivered / failed / undeliverable)
 *     "message.sent"       — accepted by carrier
 *   Signature: X-Telnyx-Signature-Ed25519 (Ed25519, not HMAC)
 *   Verification: see /api/webhooks/telnyx/route.ts (not yet wired)
 */

import type { SmsProvider, SmsChannel, OutboundSms, SmsResult } from "./sms-provider";

const TELNYX_API = "https://api.telnyx.com/v2/messages";

export class TelnyxProvider implements SmsProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(channel: SmsChannel, msg: OutboundSms): Promise<SmsResult> {
    const body: Record<string, unknown> = {
      from: msg.from,
      to: msg.to,
      text: msg.body,
      messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID,
    };

    // Attach media for MMS or WhatsApp image messages
    if (msg.mediaUrl) {
      body.media_urls = [msg.mediaUrl];
    }

    // Telnyx uses the same endpoint for SMS and WhatsApp;
    // routing is determined by the messaging profile and from-number configuration.

    try {
      const res = await fetch(TELNYX_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const json = await res.json() as { data?: { id?: string }; errors?: { detail?: string }[] };

      if (!res.ok || !json.data?.id) {
        const detail = json.errors?.[0]?.detail ?? `HTTP ${res.status}`;
        console.error(`[telnyx] send failed to=${msg.to} channel=${channel}: ${detail}`);
        return { providerId: null, success: false, error: detail };
      }

      return { providerId: json.data.id, success: true };
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Network error";
      console.error(`[telnyx] send exception to=${msg.to} channel=${channel}:`, detail);
      return { providerId: null, success: false, error: detail };
    }
  }
}
