import crypto from "crypto";
import { Resend } from "resend";
import { getAbsoluteBaseUrl } from "@/lib/site-url";

/**
 * Team invite helpers. The raw token only ever exists in the invite link;
 * the database stores its SHA-256 hash (org_invites.token_hash), so a leaked
 * table can't be used to accept invites. 32 random bytes = 256 bits, so
 * tokens can't be guessed.
 */

export const INVITE_ROLES = ["admin", "member"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

export function newInviteToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInviteToken(token) };
}

export function hashInviteToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function inviteExpiry(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** RFC 5322 display name, quoted when it contains special characters. */
function formatFrom(name: string, email: string): string {
  if (!name) return email;
  const safe = /^[\p{L}\p{N} '!#$%&*+\-/=?^_`{|}~]+$/u.test(name) ? name : `"${name.replace(/["\\]/g, "\\$&")}"`;
  return `${safe} <${email}>`;
}

/**
 * Emails the invite link via the existing Resend setup, from the school's
 * sender name (sender name → school name → bare address).
 */
export async function sendInviteEmail(opts: {
  to: string;
  token: string;
  schoolName: string;
  senderName: string;
  inviterName: string;
  inviterEmail: string;
  role: InviteRole;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const base = getAbsoluteBaseUrl();
  if (!apiKey || !fromEmail) return { ok: false, error: "Email isn't configured, so the invite couldn't be sent." };
  if (!base) return { ok: false, error: "NEXT_PUBLIC_SITE_URL isn't set, so the invite link can't be built." };

  const link = `${base}/invite/${encodeURIComponent(opts.token)}`;
  const school = opts.schoolName || "your school";
  const who = opts.inviterName || opts.inviterEmail || "Someone";
  const roleLabel = opts.role === "admin" ? "an admin" : "a team member";
  const subject = `${who} invited you to join ${school} on Kesher`;

  const text = [
    `${who} invited you to join ${school} on Kesher as ${roleLabel}.`,
    "",
    `Accept the invite: ${link}`,
    "",
    "This link expires in 7 days and can only be used once.",
    "If you weren't expecting this, you can ignore this email.",
  ].join("\n");

  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;background:#ffffff;border:1px solid #e7e7e7;border-radius:12px;">
<tr><td style="padding:32px 32px 8px;font-family:${font};">
<p style="margin:0 0 16px;font-size:18px;font-weight:600;color:#0f0f0f;">Join ${escapeHtml(school)} on Kesher</p>
<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#3f3f46;">${escapeHtml(who)} invited you to join <strong>${escapeHtml(school)}</strong> as ${roleLabel}.</p>
<a href="${escapeHtml(link)}" style="display:inline-block;background:#0f0f0f;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:8px;">Accept invite</a>
<p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#71717a;">Or paste this link into your browser:<br><a href="${escapeHtml(link)}" style="color:#71717a;word-break:break-all;">${escapeHtml(link)}</a></p>
</td></tr>
<tr><td style="padding:16px 32px 28px;font-family:${font};font-size:12px;line-height:1.6;color:#a1a1aa;">This link expires in 7 days and can only be used once. If you weren't expecting this, you can ignore this email.</td></tr>
</table></td></tr></table></body></html>`;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: formatFrom(opts.senderName || opts.schoolName, fromEmail),
    to: opts.to,
    subject,
    html,
    text,
    ...(opts.inviterEmail ? { replyTo: opts.inviterEmail } : {}),
  });
  if (error) return { ok: false, error: `The invite email couldn't be sent (${error.message}).` };
  return { ok: true };
}
