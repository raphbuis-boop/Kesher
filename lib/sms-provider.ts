/**
 * Provider-agnostic SMS/WhatsApp interface.
 *
 * All channel senders in actions.ts call through this interface.
 * Swap providers by implementing a new class and changing getSmsProvider().
 *
 * Current implementation: Sinch Conversation API (see lib/sinch-provider.ts)
 * Previous implementation: Telnyx (see lib/telnyx-provider.ts — kept for reference)
 *
 * Required environment variables (Sinch):
 *   SINCH_PROJECT_ID       — Project ID from Sinch Dashboard → Settings
 *   SINCH_APP_ID           — Conversation App ID
 *   SINCH_ACCESS_KEY       — Access Key ID
 *   SINCH_ACCESS_SECRET    — Access Secret
 *   SINCH_SMS_SENDER       — E.164 sender number for SMS, e.g. "+12125551234"
 *   SINCH_WHATSAPP_SENDER  — WhatsApp sender ID (when WhatsApp is enabled)
 *   SINCH_WEBHOOK_SECRET   — Shared secret for webhook verification
 *   SINCH_REGION           — "us" (default) or "eu"
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

// ─── Factory ──────────────────────────────────────────────────────────────────

export function getSmsProvider(): SmsProvider | null {
  const projectId    = process.env.SINCH_PROJECT_ID;
  const appId        = process.env.SINCH_APP_ID;
  const accessKey    = process.env.SINCH_ACCESS_KEY;
  const accessSecret = process.env.SINCH_ACCESS_SECRET;

  if (!projectId || !appId || !accessKey || !accessSecret) return null;

  const { SinchProvider } = require("./sinch-provider") as typeof import("./sinch-provider");
  return new SinchProvider(
    projectId,
    appId,
    accessKey,
    accessSecret,
    process.env.SINCH_REGION ?? "us"
  );
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateSmsEnv(channel: SmsChannel): string | null {
  const hasCredentials =
    process.env.SINCH_PROJECT_ID &&
    process.env.SINCH_APP_ID &&
    process.env.SINCH_ACCESS_KEY &&
    process.env.SINCH_ACCESS_SECRET;

  if (!hasCredentials) {
    const ch = channel === "sms" ? "SMS" : "WhatsApp";
    return `${ch} delivery is not configured for this account. Contact your administrator.`;
  }

  if (channel === "sms" && !process.env.SINCH_SMS_SENDER) {
    return "SMS sender number is not configured. Contact your administrator.";
  }

  if (channel === "whatsapp" && !process.env.SINCH_WHATSAPP_SENDER) {
    return "WhatsApp sender is not configured. Contact your administrator.";
  }

  return null;
}
