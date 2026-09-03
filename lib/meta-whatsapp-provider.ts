/**
 * Meta WhatsApp Cloud API provider — WhatsApp only.
 *
 * SMS stays on Sinch. WhatsApp campaigns route here (replaces the Twilio
 * WhatsApp path — see lib/twilio-provider.ts, kept in the repo but no longer
 * referenced by lib/sms-provider.ts).
 *
 * API reference:
 *   POST https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages
 *   Authorization: Bearer {ACCESS_TOKEN}
 *   Content-Type: application/json
 *
 * Required environment variables:
 *   META_WHATSAPP_PHONE_NUMBER_ID — WhatsApp Business phone number ID (Meta Business Suite)
 *   META_WHATSAPP_ACCESS_TOKEN    — System user access token with whatsapp_business_messaging
 *   META_WHATSAPP_TEMPLATE_NAME   — Name of the Meta-approved message template to send
 *   META_WHATSAPP_TEMPLATE_LANG   — Template language code, e.g. "en_US"
 *
 * Template flow:
 *   Business-initiated WhatsApp messages MUST use a pre-approved template outside
 *   the 24-hour customer-service window. There is no freeform/sandbox mode here
 *   (unlike Twilio) — every send is a template message. The rendered campaign body
 *   is injected as the template's {{1}} body variable.
 *
 *   Media attachments are not sent through the template body parameter — only
 *   text is supported here. A template with a media header would need a separate
 *   header component; out of scope for now.
 *
 * Webhooks:
 *   Not implemented. Meta requires a webhook for delivery status / inbound replies,
 *   but that is out of scope for this change (see lib/sms-provider.ts doc comment).
 */

import type { SmsProvider, SmsChannel, OutboundSms, SmsResult } from "./sms-provider";

export class MetaWhatsAppProvider implements SmsProvider {
  private phoneNumberId: string;
  private accessToken:   string;
  private templateName:  string;
  private templateLang:  string;

  constructor(
    phoneNumberId: string,
    accessToken:   string,
    templateName:  string,
    templateLang:  string,
  ) {
    this.phoneNumberId = phoneNumberId;
    this.accessToken   = accessToken;
    this.templateName  = templateName;
    this.templateLang  = templateLang;
  }

  async send(_channel: SmsChannel, msg: OutboundSms): Promise<SmsResult> {
    const url = `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`;

    // WhatsApp numbers on the Graph API are digits only — no "+", spaces, dashes,
    // or parentheses. people.whatsapp is hand-entered (e.g. "(845) 580-4298"), so
    // strip everything but digits rather than assuming E.164 input.
    const to = msg.to.replace(/\D/g, "");

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: this.templateName,
        language: { code: this.templateLang },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: msg.body }],
          },
        ],
      },
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization:  `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // Meta always returns JSON — 2xx has messages[0].id, 4xx/5xx has error.message.
      const rawBody = await res.text();
      let json: {
        messages?: { id?: string }[];
        error?: {
          message?: string;
          type?: string;
          code?: number;
          error_subcode?: number;
          error_data?: { details?: string };
          fbtrace_id?: string;
        };
      };
      try {
        json = JSON.parse(rawBody);
      } catch {
        // Non-JSON response (e.g. 502 HTML from a proxy/gateway)
        console.error(`[meta-whatsapp] non-JSON response HTTP ${res.status}: ${rawBody.slice(0, 200)}`);
        return { providerId: null, success: false, error: `HTTP ${res.status} — non-JSON response` };
      }

      const providerId = json.messages?.[0]?.id ?? null;

      if (!res.ok || !providerId) {
        const detail = json.error?.message ?? `HTTP ${res.status}`;
        console.error(`[meta-whatsapp] send failed to=${msg.to}: ${detail}`);
        // TEMP DEBUG — remove once the send failure is diagnosed. Logs the full
        // Graph API error object (message, code, error_data.details, fbtrace_id).
        console.error(`[meta-whatsapp] TEMP DEBUG full error object:`, JSON.stringify(json.error, null, 2));
        return { providerId: null, success: false, error: detail };
      }

      console.log(`[meta-whatsapp] sent to=${msg.to} messageId=${providerId}`);
      return { providerId, success: true };
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Network error";
      console.error(`[meta-whatsapp] send exception to=${msg.to}:`, detail);
      return { providerId: null, success: false, error: detail };
    }
  }
}
