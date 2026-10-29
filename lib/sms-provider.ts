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
 *   SINCH_SMS_SENDER       — default sender (schools set their own in Settings → Channels)
 *   SINCH_WEBHOOK_SECRET   — Shared secret for webhook verification
 *   SINCH_REGION           — "us" (default) or "eu"
 *
 * ─── Meta WhatsApp Cloud API (WhatsApp) ────────────────────────────────────────
 * Per-school settings (lib/channels.ts): phone number ID, WABA ID, display
 * name, template name / language / variable count, and the school's own
 * encrypted access token. Schools that existed before per-school config fall
 * back to these env vars:
 *   META_WHATSAPP_PHONE_NUMBER_ID, META_WHATSAPP_ACCESS_TOKEN,
 *   META_WHATSAPP_TEMPLATE_NAME, META_WHATSAPP_TEMPLATE_LANG, META_WHATSAPP_WABA_ID
 * Platform-wide:
 *   WHATSAPP_WEBHOOK_VERIFY_TOKEN   — Arbitrary string you choose; entered in Meta
 *     App Dashboard → WhatsApp → Configuration → Webhooks when registering the
 *     callback URL. Verified by app/api/webhooks/meta-whatsapp/route.ts (GET).
 */

import { SinchProvider } from "./sinch-provider";
import { MetaWhatsAppProvider } from "./meta-whatsapp-provider";
import type { WhatsAppConfig } from "./channels";

export type SmsChannel = "sms" | "whatsapp";

export type OutboundSms = {
  to: string;        // E.164 format, e.g. "+12125551234"
  from: string;      // E.164 sender number
  body: string;      // message text
  mediaUrl?: string; // optional image URL (MMS / WhatsApp)
  /** School or group name — the {{1}} variable of a two-variable WhatsApp template. */
  label?: string;
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

  return new SinchProvider(projectId, appId, accessKey, accessSecret, process.env.SINCH_REGION ?? "us");
}

// ─── WhatsApp factory (Meta Cloud API) ─────────────────────────────────────────

/** A provider bound to one school's WhatsApp number, token and template. */
export function getWhatsAppProvider(cfg: WhatsAppConfig): MetaWhatsAppProvider {
  return new MetaWhatsAppProvider(cfg.phoneNumberId, cfg.accessToken, cfg.templateName, cfg.templateLang, cfg.templateVars);
}
