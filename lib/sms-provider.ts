/**
 * Provider-agnostic SMS/WhatsApp interface.
 *
 * All channel senders in actions.ts call through this interface.
 * Swap providers by implementing a new class and changing getSmsProvider().
 *
 * Current implementation: Telnyx (see lib/telnyx-provider.ts)
 * Previous implementation: Twilio (removed — see git history)
 *
 * Required environment variables (Telnyx):
 *   TELNYX_API_KEY                  — API key from telnyx.com/account/keys
 *   TELNYX_SMS_FROM                 — E.164 number purchased in Telnyx portal
 *   TELNYX_WHATSAPP_FROM            — WhatsApp-enabled number or sender ID
 *   TELNYX_MESSAGING_PROFILE_ID     — messaging profile UUID (required by Telnyx)
 *
 * Required environment variables (webhook delivery receipts):
 *   TELNYX_WEBHOOK_SECRET           — used to verify inbound webhook signatures
 */

export type SmsChannel = "sms" | "whatsapp";

export type OutboundSms = {
  to: string;       // E.164 format, e.g. "+12125551234"
  from: string;     // E.164 sender number
  body: string;     // message text
  mediaUrl?: string; // optional image URL (MMS / WhatsApp)
};

export type SmsResult = {
  providerId: string | null;  // provider's message ID for status callbacks
  success: boolean;
  error?: string;
};

export interface SmsProvider {
  send(channel: SmsChannel, msg: OutboundSms): Promise<SmsResult>;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function getSmsProvider(): SmsProvider | null {
  if (!process.env.TELNYX_API_KEY) return null;
  // Import here to keep the provider file tree-shakeable
  const { TelnyxProvider } = require("./telnyx-provider") as typeof import("./telnyx-provider");
  return new TelnyxProvider(process.env.TELNYX_API_KEY);
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateSmsEnv(channel: SmsChannel): string | null {
  if (!process.env.TELNYX_API_KEY) {
    const ch = channel === "sms" ? "SMS" : "WhatsApp";
    return `${ch} delivery is not configured for this account. Contact your administrator.`;
  }
  if (channel === "sms" && !process.env.TELNYX_SMS_FROM) {
    return "SMS sender number is not configured. Contact your administrator.";
  }
  if (channel === "whatsapp" && !process.env.TELNYX_WHATSAPP_FROM) {
    return "WhatsApp sender is not configured. Contact your administrator.";
  }
  return null;
}
