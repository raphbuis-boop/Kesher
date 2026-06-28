/**
 * Telnyx SMS/WhatsApp provider implementation.
 *
 * Telnyx REST API v2:
 *   POST https://api.telnyx.com/v2/messages
 *   Authorization: Bearer {TELNYX_API_KEY}
 *
 * Response: { data: { id, ... } }
 * Errors:   { errors: [{ code, title, detail }] }
 *
 * WhatsApp routing:
 *   Both `from` and `to` must be prefixed with "whatsapp:" for WhatsApp.
 *   The same number can serve both SMS and WhatsApp depending on provisioning.
 *   TELNYX_SMS_FROM    — bare E.164, e.g. "+12125551234"
 *   TELNYX_WHATSAPP_FROM — bare E.164 (we add "whatsapp:" prefix in code)
 *
 * Webhook delivery receipts:
 *   Telnyx uses Ed25519 public-key signatures (NOT HMAC-SHA256).
 *   Headers: telnyx-signature-ed25519, telnyx-timestamp
 *   Signed string: "{telnyx-timestamp}|{raw-body}"
 *   Public key: TELNYX_PUBLIC_KEY env var (from portal → API Keys → Public Key)
 *   Event types: message.received, message.sent, message.delivered,
 *                message.failed, message.finalized
 *   See /api/webhooks/telnyx/route.ts (not yet implemented — Phase 2)
 */

import type { SmsProvider, SmsChannel, OutboundSms, SmsResult } from "./sms-provider";

const TELNYX_API = "https://api.telnyx.com/v2/messages";

// Add "whatsapp:" prefix to a bare E.164 number if not already present.
function whatsappNumber(phone: string): string {
  return phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`;
}

export class TelnyxProvider implements SmsProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(channel: SmsChannel, msg: OutboundSms): Promise<SmsResult> {
    // WhatsApp requires "whatsapp:" prefix on both from and to.
    const from = channel === "whatsapp" ? whatsappNumber(msg.from) : msg.from;
    const to   = channel === "whatsapp" ? whatsappNumber(msg.to)   : msg.to;

    const body: Record<string, unknown> = {
      from,
      to,
      text: msg.body,
      messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID,
    };

    // Attach media for MMS or WhatsApp image messages
    if (msg.mediaUrl) {
      body.media_urls = [msg.mediaUrl];
    }

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
        console.error(`[telnyx] send failed to=${to} channel=${channel}: ${detail}`);
        return { providerId: null, success: false, error: detail };
      }

      return { providerId: json.data.id, success: true };
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Network error";
      console.error(`[telnyx] send exception to=${to} channel=${channel}:`, detail);
      return { providerId: null, success: false, error: detail };
    }
  }
}
