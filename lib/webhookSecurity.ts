import crypto from "crypto";

/**
 * Webhook signature checks and the "is this configured?" status shown in
 * Settings → Channels. Server-only (node crypto).
 */

/**
 * Meta signs every webhook POST with X-Hub-Signature-256: "sha256=" + hex HMAC-SHA256
 * of the raw body, keyed with the App Secret. META_APP_SECRET may hold several
 * secrets separated by commas (schools that registered the webhook in their own Meta app).
 */
export function metaAppSecrets(): string[] {
  return (process.env.META_APP_SECRET ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function verifyMetaSignature(rawBody: Buffer, header: string | null, secrets: string[] = metaAppSecrets()): boolean {
  if (!header || !header.startsWith("sha256=")) return false;
  const given = Buffer.from(header.slice("sha256=".length), "hex");
  if (given.length !== 32) return false;
  return secrets.some((secret) => {
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest();
    return crypto.timingSafeEqual(expected, given);
  });
}

export type WebhookSecretStatus = { key: string; label: string; set: boolean; effect: string };

/** Which webhook secrets are missing, and what that means, for the Settings warning. */
export function webhookSecretStatus(): WebhookSecretStatus[] {
  return [
    {
      key: "META_APP_SECRET",
      label: "WhatsApp (Meta) app secret",
      set: metaAppSecrets().length > 0,
      effect: "WhatsApp delivery updates and parent replies are being rejected until it is set.",
    },
    {
      key: "RESEND_WEBHOOK_SECRET",
      label: "Resend webhook signing secret",
      set: !!process.env.RESEND_WEBHOOK_SECRET,
      effect: "Email delivery, bounce and open events are accepted without a signature check.",
    },
    {
      key: "SINCH_WEBHOOK_SECRET",
      label: "Sinch app secret",
      set: !!process.env.SINCH_WEBHOOK_SECRET,
      effect: "Text delivery reports and replies are accepted without a signature check.",
    },
  ];
}
