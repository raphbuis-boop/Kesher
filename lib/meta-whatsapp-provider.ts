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
 * Configuration comes from the school's channel settings (lib/channels.ts):
 * phone number ID, access token, template name / language, and how many
 * variables the template has.
 *
 * Template flow:
 *   Business-initiated WhatsApp messages MUST use a pre-approved template outside
 *   the 24-hour customer-service window. There is no freeform/sandbox mode here
 *   (unlike Twilio) — every send is a template message. ONE approved UTILITY
 *   template serves every group: with a two-variable template {{1}} is the
 *   school/group name and {{2}} the message body; with a one-variable
 *   template the body is {{1}}. Meta rejects template variables that contain
 *   line breaks, tabs or 4+ spaces, so those are flattened (see paramText).
 *
 *   Media attachments are not sent through the template body parameter — only
 *   text is supported here. A template with a media header would need a separate
 *   header component; out of scope for now.
 *
 * Webhooks:
 *   Delivery status callbacks land in app/api/webhooks/meta-whatsapp/route.ts.
 *   Diagnostics (number status, WABA subscription, template): /api/admin/whatsapp-diagnostics.
 */

import type { SmsProvider, SmsChannel, OutboundSms, SmsResult } from "./sms-provider";

// Graph API base used for every Meta call (sends + /api/admin/whatsapp-diagnostics).
export const META_GRAPH_BASE = "https://graph.facebook.com/v21.0";

/**
 * Template variables can't contain line breaks, tabs or runs of 4+ spaces
 * (Meta error 132018) and are limited in length, so message text is flattened:
 * paragraph/line breaks become " | ".
 */
export function paramText(text: string, max = 1000): string {
  const flat = text
    .replace(/\s*[\r\n]+\s*/g, " | ")
    .replace(/\t+/g, " ")
    .replace(/ {4,}/g, "   ")
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export class MetaWhatsAppProvider implements SmsProvider {
  private phoneNumberId: string;
  private accessToken:   string;
  private templateName:  string;
  private templateLang:  string;
  private templateVars:  1 | 2;

  constructor(
    phoneNumberId: string,
    accessToken:   string,
    templateName:  string,
    templateLang:  string,
    templateVars:  1 | 2 = 1,
  ) {
    this.phoneNumberId = phoneNumberId;
    this.accessToken   = accessToken;
    this.templateName  = templateName;
    this.templateLang  = templateLang;
    this.templateVars  = templateVars;
  }

  /**
   * A free-form (non-template) reply. WhatsApp only allows these within 24 hours
   * of the person's last message to the school — outside that, Meta rejects it
   * (error 131047) and only a template can start the conversation again.
   */
  async sendText(toNumber: string, body: string): Promise<SmsResult> {
    const to = toNumber.replace(/\D/g, "");
    try {
      const res = await fetch(`${META_GRAPH_BASE}/${this.phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body, preview_url: false } }),
      });
      const raw = await res.text();
      let json: { messages?: { id?: string }[]; error?: { message?: string; code?: number } };
      try {
        json = JSON.parse(raw);
      } catch {
        return { providerId: null, success: false, error: `HTTP ${res.status} — non-JSON response` };
      }
      const providerId = json.messages?.[0]?.id ?? null;
      console.log(`[meta-send-text] to=${to} http=${res.status} wamid=${providerId ?? "none"} error=${json.error ? JSON.stringify(json.error) : "none"}`);
      if (!res.ok || !providerId) return { providerId: null, success: false, error: json.error?.message ?? `HTTP ${res.status}` };
      return { providerId, success: true };
    } catch (err) {
      return { providerId: null, success: false, error: err instanceof Error ? err.message : "Network error" };
    }
  }

  async send(_channel: SmsChannel, msg: OutboundSms): Promise<SmsResult> {
    const url = `${META_GRAPH_BASE}/${this.phoneNumberId}/messages`;

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
            parameters:
              this.templateVars === 2
                ? [
                    { type: "text", text: paramText(msg.label || "Your school", 60) },
                    { type: "text", text: paramText(msg.body) },
                  ]
                : [{ type: "text", text: paramText(msg.body) }],
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
        error?: { message?: string; type?: string; code?: number; error_subcode?: number };
      };
      try {
        json = JSON.parse(rawBody);
      } catch {
        // Non-JSON response (e.g. 502 HTML from a proxy/gateway)
        console.error(`[meta-send] to=${to} http=${res.status} non-JSON body=${rawBody.slice(0, 500)}`);
        return { providerId: null, success: false, error: `HTTP ${res.status} — non-JSON response` };
      }

      const providerId = json.messages?.[0]?.id ?? null;

      // Full Meta response for every send — the body never contains the access
      // token (it only travels in our request's Authorization header).
      console.log(
        `[meta-send] to=${to} http=${res.status} wamid=${providerId ?? "none"} ` +
        `phone_number_id=${this.phoneNumberId} template=${this.templateName}/${this.templateLang} ` +
        `error=${json.error ? JSON.stringify(json.error) : "none"} response=${rawBody}`
      );

      if (!res.ok || !providerId) {
        const detail = json.error?.message ?? `HTTP ${res.status}`;
        console.error(`[meta-whatsapp] send failed to=${msg.to}: ${detail}`);
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
