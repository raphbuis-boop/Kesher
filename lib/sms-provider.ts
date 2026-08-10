/**
 * Provider-agnostic SMS/WhatsApp interface.
 *
 * Routing:
 *   SMS     → Sinch Conversation API  (lib/sinch-provider.ts)
 *   WhatsApp → Twilio Messages API    (lib/twilio-provider.ts)
 *
 * Previous implementations: Telnyx (lib/telnyx-provider.ts — kept for reference)
 *
 * ─── Sinch (SMS) ──────────────────────────────────────────────────────────────
 * Required env vars:
 *   SINCH_PROJECT_ID       — Project ID from Sinch Dashboard → Settings
 *   SINCH_APP_ID           — Conversation App ID
 *   SINCH_ACCESS_KEY       — Access Key ID
 *   SINCH_ACCESS_SECRET    — Access Secret
 *   SINCH_SMS_SENDER       — E.164 sender number, e.g. "+12125551234"
 *   SINCH_WEBHOOK_SECRET   — Shared secret for webhook verification
 *   SINCH_REGION           — "us" (default) or "eu"
 *
 * ─── Twilio (WhatsApp) ────────────────────────────────────────────────────────
 * Required env vars:
 *   TWILIO_ACCOUNT_SID            — Account SID (starts with "AC")
 *   TWILIO_AUTH_TOKEN             — Auth Token
 *   TWILIO_WHATSAPP_FROM          — E.164 sender, e.g. "+14155238886"
 *
 * Optional env vars:
 *   TWILIO_WHATSAPP_SANDBOX       — "true" → sandbox mode (freeform, no template)
 *   TWILIO_WHATSAPP_TEMPLATE_SID  — Content Template SID (HXxxxxxxxx) for production
 */

export type SmsChannel = "sms" | "whatsapp";

export type OutboundSms = {
  to: string;        // E.164 format, e.g. "+12125551234"
  from: string;      // E.164 sender number
  body: string;      // message text
  mediaUrl?: string; // optional image URL (MMS / WhatsApp)
};

export type SmsResult = {
  providerId: string | null; // provider's message ID for status callbacks
  success: boolean;
  error?: string;
};

export interface SmsProvider {
  send(channel: SmsChannel, msg: OutboundSms): Promise<SmsResult>;
}

// ─── SMS factory (Sinch) ──────────────────────────────────────────────────────

export function getSmsProvider(): SmsProvider | null {
  const projectId    = process.env.SINCH_PROJECT_ID;
  const appId        = process.env.SINCH_APP_ID;
  const accessKey    = process.env.SINCH_ACCESS_KEY;
  const accessSecret = process.env.SINCH_ACCESS_SECRET;

  if (!projectId || !appId || !accessKey || !accessSecret) {
    const missing = [
      !projectId    && "SINCH_PROJECT_ID",
      !appId        && "SINCH_APP_ID",
      !accessKey    && "SINCH_ACCESS_KEY",
      !accessSecret && "SINCH_ACCESS_SECRET",
    ].filter(Boolean).join(", ");
    console.warn(`[sinch] getSmsProvider: missing env vars: ${missing}`);
    return null;
  }

  const { SinchProvider } = require("./sinch-provider") as typeof import("./sinch-provider");
  return new SinchProvider(
    projectId,
    appId,
    accessKey,
    accessSecret,
    process.env.SINCH_REGION ?? "us"
  );
}

// ─── WhatsApp factory (Twilio) ────────────────────────────────────────────────

export function getWhatsAppProvider(): SmsProvider | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const from       = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    const missing = [
      !accountSid && "TWILIO_ACCOUNT_SID",
      !authToken  && "TWILIO_AUTH_TOKEN",
      !from       && "TWILIO_WHATSAPP_FROM",
    ].filter(Boolean).join(", ");
    console.warn(`[twilio] getWhatsAppProvider: missing env vars: ${missing}`);
    return null;
  }

  const sandbox     = process.env.TWILIO_WHATSAPP_SANDBOX === "true";
  const templateSid = process.env.TWILIO_WHATSAPP_TEMPLATE_SID || undefined;

  const { TwilioWhatsAppProvider } = require("./twilio-provider") as typeof import("./twilio-provider");
  return new TwilioWhatsAppProvider(accountSid, authToken, from, sandbox, templateSid);
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateSmsEnv(channel: "sms"): string | null {
  const hasCredentials =
    process.env.SINCH_PROJECT_ID &&
    process.env.SINCH_APP_ID &&
    process.env.SINCH_ACCESS_KEY &&
    process.env.SINCH_ACCESS_SECRET;

  if (!hasCredentials)
    return "SMS delivery is not configured for this account. Contact your administrator.";

  if (!process.env.SINCH_SMS_SENDER)
    return "SMS sender number is not configured. Contact your administrator.";

  return null;
}

export function validateWhatsAppEnv(): string | null {
  const hasCredentials =
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_FROM;

  if (!hasCredentials)
    return "WhatsApp delivery is not configured for this account. Contact your administrator.";

  const sandbox = process.env.TWILIO_WHATSAPP_SANDBOX === "true";
  if (!sandbox && !process.env.TWILIO_WHATSAPP_TEMPLATE_SID)
    return "WhatsApp template is not configured. Set TWILIO_WHATSAPP_TEMPLATE_SID or enable sandbox mode.";

  return null;
}
