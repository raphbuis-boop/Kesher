/**
 * Provider-agnostic SMS/WhatsApp interface.
 *
 * Routing:
 *   SMS      → Sinch Conversation API      (lib/sinch-provider.ts)
 *   WhatsApp → Meta WhatsApp Cloud API      (lib/meta-whatsapp-provider.ts)
 *
 * Previous implementations:
 *   Telnyx (lib/telnyx-provider.ts — kept for reference)
 *   Twilio WhatsApp (lib/twilio-provider.ts — kept for reference, no longer
 *     referenced by getWhatsAppProvider() below; replaced by Meta Cloud API)
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
 * ─── Meta WhatsApp Cloud API (WhatsApp) ────────────────────────────────────────
 * Required env vars:
 *   META_WHATSAPP_PHONE_NUMBER_ID — WhatsApp Business phone number ID
 *   META_WHATSAPP_ACCESS_TOKEN    — System user access token
 *   META_WHATSAPP_TEMPLATE_NAME   — Approved message template name
 *
 * Optional env vars:
 *   META_WHATSAPP_TEMPLATE_LANG   — Template language code (default "en_US")
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

// ─── WhatsApp factory (Meta Cloud API) ─────────────────────────────────────────

export function getWhatsAppProvider(): SmsProvider | null {
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const accessToken   = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const templateName  = process.env.META_WHATSAPP_TEMPLATE_NAME;

  if (!phoneNumberId || !accessToken || !templateName) {
    const missing = [
      !phoneNumberId && "META_WHATSAPP_PHONE_NUMBER_ID",
      !accessToken   && "META_WHATSAPP_ACCESS_TOKEN",
      !templateName  && "META_WHATSAPP_TEMPLATE_NAME",
    ].filter(Boolean).join(", ");
    console.warn(`[meta-whatsapp] getWhatsAppProvider: missing env vars: ${missing}`);
    return null;
  }

  const templateLang = process.env.META_WHATSAPP_TEMPLATE_LANG || "en_US";

  const { MetaWhatsAppProvider } = require("./meta-whatsapp-provider") as typeof import("./meta-whatsapp-provider");
  return new MetaWhatsAppProvider(phoneNumberId, accessToken, templateName, templateLang);
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

export function validateMetaWhatsAppEnv(): string | null {
  const hasCredentials =
    process.env.META_WHATSAPP_PHONE_NUMBER_ID &&
    process.env.META_WHATSAPP_ACCESS_TOKEN;

  if (!hasCredentials)
    return "WhatsApp delivery is not configured for this account. Contact your administrator.";

  if (!process.env.META_WHATSAPP_TEMPLATE_NAME)
    return "WhatsApp template is not configured. Set META_WHATSAPP_TEMPLATE_NAME.";

  return null;
}
