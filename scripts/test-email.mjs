#!/usr/bin/env node
/**
 * Standalone email deliverability test.
 * Reads branding from Supabase, builds the full email template,
 * and sends via Resend — same code path as production.
 *
 * Usage:
 *   node scripts/test-email.mjs recipient1@gmail.com recipient2@gmail.com
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ──────────────────────────────────────────────────────────
const envPath = resolve(__dirname, "../.env.local");
const envLines = readFileSync(envPath, "utf8").split("\n");
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
  process.env[key] = val;
}

const RESEND_API_KEY   = process.env.RESEND_API_KEY;
const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const RESEND_FROM      = process.env.RESEND_FROM_EMAIL ?? "hello@kesherhq.co";

if (!RESEND_API_KEY) { console.error("Missing RESEND_API_KEY"); process.exit(1); }
if (!SUPABASE_URL)   { console.error("Missing NEXT_PUBLIC_SUPABASE_URL"); process.exit(1); }

const recipients = process.argv.slice(2);
if (recipients.length === 0) {
  console.error("Usage: node scripts/test-email.mjs email1@gmail.com email2@gmail.com");
  process.exit(1);
}

// ── Fetch branding from Supabase ─────────────────────────────────────────────
async function getBranding() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/settings?select=key,value`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
  });

  const defaults = {
    schoolName:   "",
    logoUrl:      "",
    primaryColor: "#1e3a6e",
    websiteUrl:   "",
    footerText:   "",
    replyToEmail: "",
    senderName:   "",
    senderEmail:  RESEND_FROM,
  };

  if (!res.ok) {
    console.warn("Could not fetch settings from Supabase — using defaults");
    return defaults;
  }

  const rows = await res.json();
  const map = {
    school_name:    "schoolName",
    school_logo_url:"logoUrl",
    primary_color:  "primaryColor",
    website_url:    "websiteUrl",
    footer_text:    "footerText",
    reply_to_email: "replyToEmail",
    sender_name:    "senderName",
    sender_email:   "senderEmail",
  };

  const result = { ...defaults };
  for (const { key, value } of rows) {
    const field = map[key];
    if (field && value?.trim()) result[field] = value.trim();
  }
  return result;
}

// ── Build email HTML (mirrors production buildEmailHtml) ─────────────────────
function buildEmailHtml(body, branding, firstName) {
  const primaryColor = branding.primaryColor || "#1e3a6e";
  const schoolName   = branding.schoolName   || "";
  const footerText   = branding.footerText   || "";
  const websiteUrl   = branding.websiteUrl   || "";
  const logoUrl      = branding.logoUrl      || "";
  const replyEmail   = branding.replyToEmail || "";

  const initials = schoolName
    .split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  let headerContentHtml;
  if (logoUrl) {
    headerContentHtml = `<img src="${logoUrl}" alt="${schoolName}" style="display:block;margin:0 auto;max-height:96px;max-width:280px;height:auto;width:auto;border:0;">`;
  } else if (schoolName) {
    headerContentHtml = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
        <tr><td style="width:68px;height:68px;background:rgba(255,255,255,0.18);border-radius:50%;text-align:center;vertical-align:middle;font-size:24px;font-weight:700;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;letter-spacing:-0.5px;">
          ${initials}
        </td></tr>
      </table>
      <h1 style="margin:18px 0 0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.4px;line-height:1.25;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${schoolName}</h1>`;
  } else {
    headerContentHtml = "";
  }

  const GREETING_RE = /^(hi|hello|dear|shalom|good\s+morning|good\s+afternoon|gut\s+shabbos|shana\s+tova|greetings|to\s+whom)/i;
  const bodyTrimmed = body.trim();
  const greetingHtml = firstName && !GREETING_RE.test(bodyTrimmed)
    ? `<p style="margin:0 0 22px;font-size:16px;font-weight:600;color:#111827;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Hi ${firstName},</p>`
    : "";

  const paragraphsHtml = bodyTrimmed.split(/\n\n+/).filter(p => p.trim())
    .map((p, i, arr) => {
      const lines = p.split("\n").map(l => l.trim()).filter(Boolean);
      return `<p style="margin:0${i < arr.length - 1 ? " 0 20px" : ""};line-height:1.75;font-size:15px;color:#374151;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${lines.join("<br>")}</p>`;
    }).join("\n");

  const footerLines = [];
  if (footerText) footerLines.push(`<p style="margin:0 0 6px;font-size:13px;color:#6b7280;line-height:1.65;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${footerText}</p>`);
  if (websiteUrl) {
    const display = websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    footerLines.push(`<p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;"><a href="${websiteUrl}" style="font-size:13px;color:${primaryColor};text-decoration:none;">${display}</a></p>`);
  }
  if (replyEmail) footerLines.push(`<p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;"><a href="mailto:${replyEmail}" style="font-size:13px;color:#6b7280;text-decoration:none;">${replyEmail}</a></p>`);

  const footerContentHtml = footerLines.length
    ? footerLines.join("\n")
    : schoolName
    ? `<p style="margin:0;font-size:13px;color:#9ca3af;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${schoolName}</p>`
    : "";

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
<body style="margin:0;padding:0;background-color:#eef0f3;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef0f3;">
<tr><td align="center" style="padding:40px 16px 56px;">
  <table role="presentation" class="em-container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
    <tr>
      <td class="em-header-td" style="background-color:${primaryColor};border-radius:14px 14px 0 0;padding:${headerContentHtml ? "48px 56px 44px" : "20px 56px"};text-align:center;">
        ${headerContentHtml}
      </td>
    </tr>
    <tr>
      <td class="em-body-td" style="background-color:#ffffff;padding:44px 56px 40px;border-left:1px solid #dde1e7;border-right:1px solid #dde1e7;">
        ${greetingHtml}
        ${paragraphsHtml}
      </td>
    </tr>
    <tr>
      <td class="em-footer-td" style="background-color:#f8f9fb;border:1px solid #dde1e7;border-top:none;border-radius:0 0 14px 14px;padding:28px 56px 24px;text-align:center;">
        ${footerContentHtml}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding-top:20px;padding-bottom:16px;"><div style="height:1px;background-color:#e5e7eb;"></div></td></tr>
        </table>
        <p style="margin:0;font-size:11px;color:#b0b7c3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
          Sent with <span style="color:#9ca3af;">Kesher</span>
        </p>
      </td>
    </tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

function buildEmailText(body, branding, firstName) {
  const GREETING_RE = /^(hi|hello|dear|shalom|good\s+morning|good\s+afternoon|gut\s+shabbos|shana\s+tova|greetings|to\s+whom)/i;
  const lines = [];
  const bodyTrimmed = body.trim();
  if (firstName && !GREETING_RE.test(bodyTrimmed)) lines.push(`Hi ${firstName},`, "");
  lines.push(bodyTrimmed, "");
  if (branding.footerText) lines.push("---", branding.footerText);
  if (branding.websiteUrl) lines.push(branding.websiteUrl);
  if (branding.replyToEmail) lines.push(branding.replyToEmail);
  lines.push("", "Sent with Kesher");
  return lines.join("\n");
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log("Fetching branding from Supabase...");
  const branding = await getBranding();

  console.log("\nBranding loaded:");
  console.log("  School name:  ", branding.schoolName  || "(not set)");
  console.log("  Logo URL:     ", branding.logoUrl     || "(not set)");
  console.log("  Primary color:", branding.primaryColor);
  console.log("  Sender name:  ", branding.senderName  || "(not set)");
  console.log("  Sender email: ", branding.senderEmail);
  console.log("  Reply-to:     ", branding.replyToEmail || "(not set)");
  console.log("  Footer text:  ", branding.footerText  || "(not set)");
  console.log("  Website:      ", branding.websiteUrl  || "(not set)");

  const subject = "✉️ Kesher Email Deliverability Test";
  const body = `This is a production test email from Kesher.

We are verifying that all three email authentication checks pass in Gmail:
• SPF — validates the sending server
• DKIM — verifies the message signature
• DMARC — enforces domain policy

To confirm, open this email in Gmail → click the three-dot menu → "Show original" and look for:

  SPF: PASS
  DKIM: PASS
  DMARC: PASS

If all three show PASS, email deliverability is fully configured and production-ready.`;

  const fromEmail   = branding.senderEmail || RESEND_FROM;
  const senderName  = branding.senderName  || branding.schoolName || "";
  const from        = senderName ? `${senderName} <${fromEmail}>` : fromEmail;
  const replyTo     = branding.replyToEmail || undefined;

  console.log(`\nSending from: ${from}`);
  if (replyTo) console.log(`Reply-to:     ${replyTo}`);
  console.log(`Recipients:   ${recipients.join(", ")}`);
  console.log(`Logo in email: ${branding.logoUrl ? "YES — " + branding.logoUrl : "NO (will show initials fallback)"}`);

  const emails = recipients.map((to, i) => ({
    from,
    to,
    subject,
    html: buildEmailHtml(body, branding, null),
    text: buildEmailText(body, branding, null),
    headers: {
      "Precedence": "bulk",
      "X-Entity-Ref-ID": `deliverability-test-${i}-${Date.now()}`,
      "List-Unsubscribe": `<mailto:${replyTo || fromEmail}?subject=Unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    ...(replyTo ? { replyTo } : {}),
  }));

  console.log("\nSending via Resend...");
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emails),
  });

  const result = await res.json();

  if (!res.ok || result.error) {
    console.error("\n❌ Send failed:");
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.log("\n✅ Emails sent successfully!");
  for (const item of (result.data ?? [])) {
    console.log(`  Resend ID: ${item.id}`);
  }

  console.log("\n─────────────────────────────────────────────");
  console.log("Next steps:");
  console.log("  1. Open the email in Gmail");
  console.log("  2. Click ⋮ → 'Show original'");
  console.log("  3. Confirm at the top:");
  console.log("       SPF:   PASS");
  console.log("       DKIM:  PASS");
  console.log("       DMARC: PASS");
  console.log("─────────────────────────────────────────────");
})();
