/**
 * Twilio Messages API provider — WhatsApp only.
 *
 * SMS stays on Sinch. WhatsApp campaigns route here.
 *
 * API reference:
 *   POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json
 *   Authorization: Basic base64("{AccountSid}:{AuthToken}")
 *   Content-Type: application/x-www-form-urlencoded
 *
 * Required environment variables:
 *   TWILIO_ACCOUNT_SID            — Account SID (starts with "AC")
 *   TWILIO_AUTH_TOKEN             — Auth Token
 *   TWILIO_WHATSAPP_FROM          — E.164 sender number, e.g. "+14155238886"
 *                                   Automatically prefixed with "whatsapp:"
 *
 * Optional environment variables:
 *   TWILIO_WHATSAPP_SANDBOX       — Set to "true" to use Twilio's WhatsApp sandbox.
 *                                   Sandbox allows freeform text without a Meta-approved
 *                                   template. Use this for testing before go-live.
 *   TWILIO_WHATSAPP_TEMPLATE_SID  — Content Template SID (starts with "HX") for
 *                                   production sends. Required when sandbox is off.
 *                                   The template must contain {{1}} where the rendered
 *                                   message body will be injected as a variable.
 *
 * Template flow:
 *   Sandbox on  → Body field with freeform text (+ optional MediaUrl)
 *   Sandbox off → ContentSid + ContentVariables: {"1": "<rendered body>"}
 *
 * Webhooks (for delivery status):
 *   Configure a StatusCallback URL in Twilio Console or per-message.
 *   URL: https://www.kesherhq.co/api/webhooks/twilio
 *   (webhook handler not yet implemented — add when needed)
 */

import type { SmsProvider, SmsChannel, OutboundSms, SmsResult } from "./sms-provider";

export class TwilioWhatsAppProvider implements SmsProvider {
  private accountSid:  string;
  private authHeader:  string;
  private from:        string; // "whatsapp:+<number>"
  private sandbox:     boolean;
  private templateSid: string | undefined;

  constructor(
    accountSid:   string,
    authToken:    string,
    fromNumber:   string, // E.164, e.g. "+14155238886"
    sandbox       = false,
    templateSid?: string,
  ) {
    this.accountSid  = accountSid;
    this.from        = `whatsapp:${fromNumber}`;
    this.sandbox     = sandbox;
    this.templateSid = templateSid;

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    this.authHeader = `Basic ${credentials}`;
  }

  async send(_channel: SmsChannel, msg: OutboundSms): Promise<SmsResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const to  = `whatsapp:${msg.to}`;

    // Twilio Messages API uses application/x-www-form-urlencoded, not JSON.
    const params = new URLSearchParams();
    params.set("To",   to);
    params.set("From", this.from);

    if (this.sandbox || !this.templateSid) {
      // Sandbox or no template configured: send freeform text.
      // Sandbox recipients must have opted in via the Twilio sandbox join flow.
      params.set("Body", msg.body);
      if (msg.mediaUrl) params.set("MediaUrl", msg.mediaUrl);
    } else {
      // Production: send via Meta-approved Content Template.
      // The template SID references a template containing {{1}}.
      // We inject the full rendered message body as variable 1.
      params.set("ContentSid", this.templateSid);
      params.set("ContentVariables", JSON.stringify({ "1": msg.body }));
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization:  this.authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      // Twilio always returns JSON — 2xx has sid/status, 4xx/5xx has code/message.
      const json = await res.json() as {
        sid?:           string;
        status?:        string;
        error_code?:    number | null;
        error_message?: string | null;
        message?:       string; // top-level on some 4xx shapes
        code?:          number; // some error shapes use "code" not "error_code"
      };

      if (!res.ok || !json.sid) {
        const detail =
          json.error_message ??
          json.message ??
          `HTTP ${res.status}${json.error_code ? ` (code ${json.error_code})` : ""}`;
        console.error(
          `[twilio] send failed to=${msg.to}: ${detail}`,
          json.error_code ? `error_code=${json.error_code}` : "",
        );
        return { providerId: null, success: false, error: detail };
      }

      console.log(`[twilio] sent to=${msg.to} sid=${json.sid} status=${json.status} sandbox=${this.sandbox}`);
      return { providerId: json.sid, success: true };
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Network error";
      console.error(`[twilio] send exception to=${msg.to}:`, detail);
      return { providerId: null, success: false, error: detail };
    }
  }
}
