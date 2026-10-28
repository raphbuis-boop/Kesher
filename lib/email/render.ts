/**
 * Email rendering: HTML + plain-text parts, From header, greeting.
 *
 * Moved out of app/messages/actions.ts so the send engine, scheduled sends and
 * previews all produce the same email. Deliverability is unchanged: school
 * name + address + unsubscribe link in every footer, a real preheader,
 * multipart text, escaped user text. New: optional template colors/logo,
 * a "For Moshe (3rd)…" line, an "I've read this" button, and dir="auto" on
 * every paragraph so Hebrew and English paragraphs each align correctly.
 */

import type { BrandingSettings } from "@/lib/settings";

const EMAIL_IMAGE_RE = /\.(jpg|jpeg|png|gif|webp)$/i;
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/** Escapes user/school-provided text before it goes into the HTML template. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * RFC 5322 From header: quotes the display name when it contains characters
 * like "," or "." that would otherwise break parsing ("Heichal HaTorah, Inc.").
 */
export function formatFrom(name: string, email: string): string {
  if (!name) return email;
  const safe = /^[\p{L}\p{N} '!#$%&*+\-/=?^_`{|}~]+$/u.test(name) ? name : `"${name.replace(/["\\]/g, "\\$&")}"`;
  return `${safe} <${email}>`;
}

/**
 * Resolves a greeting template (e.g. "Hi {{first_name}},") into a final
 * greeting line, applying the fallback when the name is absent.
 */
export function resolveGreeting(template: string | null, firstName: string | null, fallback = "Hi,"): string | null {
  if (!template) return null;
  if (firstName) return template.replace("{{first_name}}", firstName);
  return template.replace(/\{\{first_name\}\},?/, "").trim() || fallback;
}

/** Branding after a template has been applied. */
export type EmailBranding = BrandingSettings & { backgroundColor: string };

export type EmailContent = {
  /** Already merge-token rendered body text. */
  body: string;
  greeting: string | null;
  /** "For Moshe (3rd) and Rivka (6th)" */
  familyLine?: string | null;
  attachmentUrls?: string[];
  unsubscribeUrl: string;
  /** Public "I've read this" link (works without login). */
  confirmUrl?: string | null;
  /** Link to this family's message archive (Phase 4.5) and preference center (4.2). */
  archiveUrl?: string | null;
  preferencesUrl?: string | null;
};

/** Each paragraph gets dir="auto" so a Hebrew paragraph is right-aligned and an English one left-aligned. */
function paragraphs(body: string): string[] {
  return body.trim().split(/\n\n+/).filter((p) => p.trim());
}

export function buildEmailText(c: EmailContent, branding: EmailBranding): string {
  const lines: string[] = [];
  if (c.greeting) lines.push(c.greeting, "");
  if (c.familyLine) lines.push(c.familyLine, "");
  lines.push(c.body.trim(), "");
  if (c.confirmUrl) lines.push(`Let the school know you've read this: ${c.confirmUrl}`, "");

  lines.push("---");
  if (branding.schoolName) lines.push(branding.schoolName);
  if (branding.footerText) lines.push(branding.footerText);
  if (branding.websiteUrl) lines.push(branding.websiteUrl);
  if (branding.replyToEmail) lines.push(branding.replyToEmail);
  lines.push("", `You're receiving this because you're on ${branding.schoolName || "this school"}'s contact list.`);
  if (c.preferencesUrl) lines.push(`Choose how you hear from us: ${c.preferencesUrl}`);
  if (c.archiveUrl) lines.push(`Find past messages: ${c.archiveUrl}`);
  lines.push(`Unsubscribe: ${c.unsubscribeUrl}`, "", "Sent with Kesher");
  return lines.join("\n");
}

export function buildEmailHtml(c: EmailContent, branding: EmailBranding): string {
  const primaryColor = branding.primaryColor || "#1e3a6e";
  const pageBg = branding.backgroundColor || "#eef0f3";
  const schoolName = escapeHtml(branding.schoolName || "");
  const footerText = escapeHtml(branding.footerText || "");
  const websiteUrl = branding.websiteUrl || "";
  const logoUrl = branding.logoUrl || "";
  const replyEmail = branding.replyToEmail || "";

  // ── Header: logo > initials circle + name > color bar only ──────────────
  const initials = escapeHtml(
    (branding.schoolName || "").split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
  );

  let headerContentHtml: string;
  if (logoUrl) {
    headerContentHtml = `<div style="display:inline-block;background:#ffffff;border-radius:12px;padding:14px 28px;">
        <img src="${escapeHtml(logoUrl)}" alt="${schoolName}" style="display:block;margin:0 auto;max-height:120px;max-width:300px;height:auto;width:auto;border:0;">
      </div>`;
  } else if (schoolName) {
    headerContentHtml = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
        <tr><td style="width:68px;height:68px;background:rgba(255,255,255,0.18);border-radius:50%;text-align:center;vertical-align:middle;font-size:24px;font-weight:700;color:#ffffff;font-family:${FONT};letter-spacing:-0.5px;">
          ${initials}
        </td></tr>
      </table>
      <h1 style="margin:18px 0 0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.4px;line-height:1.25;font-family:${FONT};">${schoolName}</h1>`;
  } else {
    headerContentHtml = "";
  }

  // ── Greeting / family line ───────────────────────────────────────────────
  const greetingHtml = c.greeting
    ? `<p dir="auto" style="margin:0 0 22px;font-size:16px;font-weight:600;color:#111827;line-height:1.5;font-family:${FONT};">${escapeHtml(c.greeting)}</p>`
    : "";
  const familyHtml = c.familyLine
    ? `<p dir="auto" style="margin:0 0 18px;font-size:13px;font-weight:600;color:${primaryColor};line-height:1.5;font-family:${FONT};">${escapeHtml(c.familyLine)}</p>`
    : "";

  // ── Body paragraphs ───────────────────────────────────────────────────────
  const paras = paragraphs(c.body);
  const paragraphsHtml = paras
    .map((p, i) => {
      const lines = p.split("\n").map((l) => escapeHtml(l.trim())).filter(Boolean);
      const isLast = i === paras.length - 1;
      return `<p dir="auto" style="margin:0${isLast ? "" : " 0 20px"};line-height:1.75;font-size:15px;color:#374151;font-family:${FONT};">${lines.join("<br>")}</p>`;
    })
    .join("\n");

  // ── "I've read this" button ──────────────────────────────────────────────
  const confirmHtml = c.confirmUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 0;"><tr><td style="border-radius:8px;background-color:${primaryColor};">
        <a href="${escapeHtml(c.confirmUrl)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;font-family:${FONT};">I&rsquo;ve read this</a>
      </td></tr></table>`
    : "";

  // ── Attachments ───────────────────────────────────────────────────────────
  let attachmentsHtml = "";
  const attachmentUrls = c.attachmentUrls ?? [];
  if (attachmentUrls.length > 0) {
    const images = attachmentUrls.filter((u) => EMAIL_IMAGE_RE.test(u));
    const docs = attachmentUrls.filter((u) => !EMAIL_IMAGE_RE.test(u));
    if (images.length > 0) {
      attachmentsHtml += `<div style="margin-top:28px;padding-top:24px;border-top:1px solid #f3f4f6;">
${images.map((u) => `<img src="${escapeHtml(u)}" alt="" style="display:block;max-width:100%;border-radius:10px;margin-bottom:12px;border:1px solid #e5e7eb;">`).join("")}
</div>`;
    }
    if (docs.length > 0) {
      attachmentsHtml += `<div style="margin-top:${images.length ? "12" : "28"}px;">
${docs
  .map((u) => {
    let name = "Attachment";
    try {
      name = decodeURIComponent(u.split("/").pop() ?? "Attachment");
    } catch {
      /* keep the generic name */
    }
    return `<a href="${escapeHtml(u)}" style="display:block;margin-bottom:8px;padding:13px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-weight:500;color:#374151;text-decoration:none;font-family:${FONT};">&#128206;&nbsp; ${escapeHtml(name)}</a>`;
  })
  .join("")}
</div>`;
    }
  }

  // ── Footer: school name + address + unsubscribe on every email ───────────
  const footerLines: string[] = [];
  if (schoolName) footerLines.push(`<p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#374151;font-family:${FONT};">${schoolName}</p>`);
  if (footerText) footerLines.push(`<p style="margin:0 0 6px;font-size:13px;color:#6b7280;line-height:1.65;font-family:${FONT};">${footerText.replace(/\n/g, "<br>")}</p>`);
  if (websiteUrl) {
    const display = websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    footerLines.push(`<p style="margin:0 0 4px;font-family:${FONT};"><a href="${escapeHtml(websiteUrl)}" style="font-size:13px;color:${primaryColor};text-decoration:none;">${escapeHtml(display)}</a></p>`);
  }
  if (replyEmail) {
    footerLines.push(`<p style="margin:0 0 4px;font-family:${FONT};"><a href="mailto:${escapeHtml(replyEmail)}" style="font-size:13px;color:#6b7280;text-decoration:none;">${escapeHtml(replyEmail)}</a></p>`);
  }
  const links = [
    c.preferencesUrl ? `<a href="${escapeHtml(c.preferencesUrl)}" style="color:#6b7280;text-decoration:underline;">Email preferences</a>` : "",
    c.archiveUrl ? `<a href="${escapeHtml(c.archiveUrl)}" style="color:#6b7280;text-decoration:underline;">Past messages</a>` : "",
    `<a href="${escapeHtml(c.unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>`,
  ].filter(Boolean);
  footerLines.push(
    `<p style="margin:14px 0 0;font-size:12px;color:#9ca3af;line-height:1.6;font-family:${FONT};">You&rsquo;re receiving this because you&rsquo;re on ${schoolName || "this school"}&rsquo;s contact list.<br>${links.join(" &nbsp;·&nbsp; ")}</p>`
  );

  // Inbox preview line: the start of the message
  const preheader = escapeHtml(c.body.trim().replace(/\s+/g, " ").slice(0, 110));

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml><![endif]-->
<style>
@media only screen and (max-width:620px){
  .em-container{width:100%!important}
  .em-header-td{padding:28px 24px 24px!important}
  .em-body-td{padding:32px 24px 28px!important}
  .em-footer-td{padding:24px 24px 20px!important}
}
</style>
</head>
<body style="margin:0;padding:0;background-color:${pageBg};">

<!-- Preheader: inbox preview text -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
${preheader}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${pageBg};">
<tr>
  <td align="center" style="padding:40px 16px 56px;">

    <table role="presentation" class="em-container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

      <!-- HEADER -->
      <tr>
        <td class="em-header-td" style="background-color:${primaryColor};border-radius:14px 14px 0 0;padding:${logoUrl ? "36px 56px 32px" : headerContentHtml ? "48px 56px 44px" : "20px 56px"};text-align:center;">
          ${headerContentHtml}
        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td class="em-body-td" style="background-color:#ffffff;padding:44px 56px 40px;border-left:1px solid #dde1e7;border-right:1px solid #dde1e7;">
          ${greetingHtml}
          ${familyHtml}
          ${paragraphsHtml}
          ${confirmHtml}
          ${attachmentsHtml}
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td class="em-footer-td" style="background-color:#f8f9fb;border:1px solid #dde1e7;border-top:none;border-radius:0 0 14px 14px;padding:28px 56px 24px;text-align:center;">
          ${footerLines.join("\n")}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="padding-top:20px;padding-bottom:16px;">
              <div style="height:1px;background-color:#e5e7eb;"></div>
            </td></tr>
          </table>
          <p style="margin:0;font-size:11px;color:#b0b7c3;font-family:${FONT};">
            Sent with <span style="color:#9ca3af;">Kesher</span>
          </p>
        </td>
      </tr>

    </table>

  </td>
</tr>
</table>

</body>
</html>`;
}
