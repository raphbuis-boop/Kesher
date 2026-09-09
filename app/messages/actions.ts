"use server";

import { Resend } from "resend";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId, isDemoOrg } from "@/lib/org";
import { revalidatePath } from "next/cache";
import { renderTemplate } from "@/lib/template";
import { getBrandingSettings, type BrandingSettings } from "@/lib/settings";
import { getSmsProvider, getWhatsAppProvider, validateSmsEnv, validateMetaWhatsAppEnv } from "@/lib/sms-provider";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Channel = "email" | "sms" | "whatsapp";

type Person = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  salutation: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  graduation_year: number | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const BATCH_SIZE = 100;

const SYSTEM_CATEGORY_MAP: Record<string, string> = {
  parents: "parent",
  students: "student",
  grandparents: "grandparent",
  alumni: "alumni",
  faculty: "faculty",
  staff: "staff",
  board: "board",
  donors: "donor",
  prospects: "prospect",
};

// ─── Email HTML builder ───────────────────────────────────────────────────────

const EMAIL_IMAGE_RE = /\.(jpg|jpeg|png|gif|webp)$/i;

/**
 * Resolves a greeting template string (e.g. "Hi {{first_name}},") into a
 * final greeting line, applying the fallback when the name is absent.
 *
 * @param template  - e.g. "Hi {{first_name}}," | "Dear {{first_name}}," | null
 * @param firstName - recipient's first/preferred name, or null
 * @param fallback  - used when firstName is absent, e.g. "Hi,"
 * @returns resolved string like "Hi Sarah," or null when template is null
 */
function resolveGreeting(
  template: string | null,
  firstName: string | null,
  fallback = "Hi,"
): string | null {
  if (!template) return null;
  if (firstName) return template.replace("{{first_name}}", firstName);
  // Strip the name placeholder and use fallback
  return template.replace(/\{\{first_name\}\},?/, "").trim() || fallback;
}

/**
 * Build a plain-text fallback for multipart/alternative.
 * Strips basic formatting cues and returns clean readable text.
 */
function buildEmailText(
  body: string,
  branding: BrandingSettings,
  greetingTemplate: string | null,
  firstName: string | null
): string {
  const lines: string[] = [];

  const bodyTrimmed = body.trim();
  const greeting = resolveGreeting(greetingTemplate, firstName);
  if (greeting) lines.push(greeting, "");
  lines.push(bodyTrimmed, "");

  if (branding.footerText) lines.push("---", branding.footerText);
  if (branding.websiteUrl) lines.push(branding.websiteUrl);
  if (branding.replyToEmail) lines.push(branding.replyToEmail);
  lines.push("", "Sent with Kesher");

  return lines.join("\n");
}

function buildEmailHtml(
  body: string,
  branding: BrandingSettings,
  greetingTemplate: string | null,
  firstName: string | null,
  attachmentUrls?: string[]
): string {
  const primaryColor = branding.primaryColor || "#1e3a6e";
  const schoolName   = branding.schoolName   || "";
  const footerText   = branding.footerText   || "";
  const websiteUrl   = branding.websiteUrl   || "";
  const logoUrl      = branding.logoUrl      || "";
  const replyEmail   = branding.replyToEmail || "";

  // ── Header: logo > initials circle + name > color bar only ──────────────
  // Initials are derived from the real school name only — never a placeholder.
  const initials = schoolName
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  let headerContentHtml: string;
  if (logoUrl) {
    // Priority 1: school logo — white pill so it reads on any header color
    headerContentHtml = `<div style="display:inline-block;background:#ffffff;border-radius:12px;padding:14px 28px;">
        <img src="${logoUrl}" alt="${schoolName}" style="display:block;margin:0 auto;max-height:120px;max-width:300px;height:auto;width:auto;border:0;">
      </div>`;
  } else if (schoolName) {
    // Priority 2: initials circle + school name (original design fallback)
    headerContentHtml = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
        <tr><td style="width:68px;height:68px;background:rgba(255,255,255,0.18);border-radius:50%;text-align:center;vertical-align:middle;font-size:24px;font-weight:700;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;letter-spacing:-0.5px;">
          ${initials}
        </td></tr>
      </table>
      <h1 style="margin:18px 0 0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.4px;line-height:1.25;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${schoolName}</h1>`;
  } else {
    // Priority 3: nothing configured yet — slim color bar, no phantom text
    headerContentHtml = "";
  }

  // ── Greeting line (only injected when composer has it enabled) ───────────
  const bodyTrimmed = body.trim();
  const resolvedGreeting = resolveGreeting(greetingTemplate, firstName);
  const greetingHtml = resolvedGreeting
    ? `<p style="margin:0 0 22px;font-size:16px;font-weight:600;color:#111827;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${resolvedGreeting}</p>`
    : "";

  // ── Body paragraphs ───────────────────────────────────────────────────────
  const paragraphs = bodyTrimmed.split(/\n\n+/).filter((p) => p.trim());
  const paragraphsHtml = paragraphs
    .map((p, i) => {
      const lines = p.split("\n").map((l) => l.trim()).filter(Boolean);
      const isLast = i === paragraphs.length - 1;
      return `<p style="margin:0${isLast ? "" : " 0 20px"};line-height:1.75;font-size:15px;color:#374151;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${lines.join("<br>")}</p>`;
    })
    .join("\n");

  // ── Attachments ───────────────────────────────────────────────────────────
  let attachmentsHtml = "";
  if (attachmentUrls && attachmentUrls.length > 0) {
    const images = attachmentUrls.filter((u) => EMAIL_IMAGE_RE.test(u));
    const docs   = attachmentUrls.filter((u) => !EMAIL_IMAGE_RE.test(u));

    if (images.length > 0) {
      attachmentsHtml += `<div style="margin-top:28px;padding-top:24px;border-top:1px solid #f3f4f6;">
${images
  .map(
    (u) =>
      `<img src="${u}" alt="" style="display:block;max-width:100%;border-radius:10px;margin-bottom:12px;border:1px solid #e5e7eb;">`
  )
  .join("")}
</div>`;
    }
    if (docs.length > 0) {
      attachmentsHtml += `<div style="margin-top:${images.length ? "12" : "28"}px;">
${docs
  .map((u) => {
    const name = decodeURIComponent(u.split("/").pop() ?? "Attachment");
    return `<a href="${u}" style="display:block;margin-bottom:8px;padding:13px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-weight:500;color:#374151;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">&#128206;&nbsp; ${name}</a>`;
  })
  .join("")}
</div>`;
    }
  }

  // ── Footer blocks ─────────────────────────────────────────────────────────
  const footerLines: string[] = [];
  if (footerText) {
    footerLines.push(
      `<p style="margin:0 0 6px;font-size:13px;color:#6b7280;line-height:1.65;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${footerText}</p>`
    );
  }
  if (websiteUrl) {
    const display = websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    footerLines.push(
      `<p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;"><a href="${websiteUrl}" style="font-size:13px;color:${primaryColor};text-decoration:none;">${display}</a></p>`
    );
  }
  if (replyEmail) {
    footerLines.push(
      `<p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;"><a href="mailto:${replyEmail}" style="font-size:13px;color:#6b7280;text-decoration:none;">${replyEmail}</a></p>`
    );
  }
  const footerContentHtml = footerLines.length
    ? footerLines.join("\n")
    : schoolName
    ? `<p style="margin:0;font-size:13px;color:#9ca3af;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${schoolName}</p>`
    : "";

  // ── Full template ─────────────────────────────────────────────────────────
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

<!-- Invisible preheader spacer -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef0f3;">
<tr>
  <td align="center" style="padding:40px 16px 56px;">

    <table role="presentation" class="em-container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

      <!-- ━━ HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
      <tr>
        <td class="em-header-td" style="background-color:${primaryColor};border-radius:14px 14px 0 0;padding:${logoUrl ? "36px 56px 32px" : headerContentHtml ? "48px 56px 44px" : "20px 56px"};text-align:center;">
          ${headerContentHtml}
        </td>
      </tr>

      <!-- ━━ BODY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
      <tr>
        <td class="em-body-td" style="background-color:#ffffff;padding:44px 56px 40px;border-left:1px solid #dde1e7;border-right:1px solid #dde1e7;">
          ${greetingHtml}
          ${paragraphsHtml}
          ${attachmentsHtml}
        </td>
      </tr>

      <!-- ━━ FOOTER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
      <tr>
        <td class="em-footer-td" style="background-color:#f8f9fb;border:1px solid #dde1e7;border-top:none;border-radius:0 0 14px 14px;padding:28px 56px 24px;text-align:center;">
          ${footerContentHtml}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="padding-top:20px;padding-bottom:16px;">
              <div style="height:1px;background-color:#e5e7eb;"></div>
            </td></tr>
          </table>
          <p style="margin:0;font-size:11px;color:#b0b7c3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
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

// ─── Recipient resolution ─────────────────────────────────────────────────────

async function getPeopleForAudience(audienceSlug: string, orgId: string): Promise<Person[]> {
  const supabase = await createSupabaseServerClient();
  const isSystem = audienceSlug in SYSTEM_CATEGORY_MAP;

  if (isSystem) {
    const category = SYSTEM_CATEGORY_MAP[audienceSlug];
    const { data, error } = await supabase
      .from("people")
      .select("id, first_name, last_name, preferred_name, salutation, email, phone, whatsapp, graduation_year")
      .eq("org_id", orgId)
      .contains("categories", [category]);
    if (error) {
      console.error(
        `[getPeopleForAudience] system category query failed — slug=${audienceSlug} category=${category} org=${orgId}:`,
        error.message
      );
    }
    return (data ?? []) as Person[];
  }

  // Custom audience — resolve by group tags
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id, group_tags ( tag_id )")
    .eq("org_id", orgId)
    .eq("id", audienceSlug)
    .single();

  if (!group) {
    if (groupError) {
      console.warn(
        `[getPeopleForAudience] group lookup failed — slug=${audienceSlug} org=${orgId}:`,
        groupError.message
      );
    }
    return [];
  }

  const tagIds = (group as any).group_tags?.map((gt: any) => gt.tag_id) ?? [];
  if (tagIds.length === 0) return [];

  const { data: allPeople, error: peopleError } = await supabase
    .from("people")
    .select("id, first_name, last_name, preferred_name, salutation, email, phone, whatsapp, graduation_year, person_tags ( tag_id )")
    .eq("org_id", orgId);
  if (peopleError) {
    console.error(
      `[getPeopleForAudience] custom audience people query failed — slug=${audienceSlug} org=${orgId}:`,
      peopleError.message
    );
  }

  const tagIdSet = new Set<string>(tagIds);
  return ((allPeople ?? []) as any[])
    .filter((p: any) => p.person_tags?.some((pt: any) => tagIdSet.has(pt.tag_id)))
    .map((p: any) => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      preferred_name: p.preferred_name as string | null,
      salutation: p.salutation as string | null,
      email: p.email as string | null,
      phone: p.phone as string | null,
      whatsapp: p.whatsapp as string | null,
      graduation_year: (p.graduation_year as number | null) ?? null,
    }));
}

// ─── Channel senders ─────────────────────────────────────────────────────────

type RecipientInsert = {
  message_id: string;
  person_id: string;
  contact_value: string;
  name: string;
  status: string;
  provider_id: string | null;
  sent_at: string | null;
  error_detail: string | null;
};

async function sendEmailBatch(
  recipients: Person[],
  subject: string,
  bodyTemplate: string,
  messageId: string,
  now: string,
  branding: BrandingSettings,
  greetingTemplate: string | null,
  attachmentUrls?: string[]
): Promise<{ inserts: RecipientInsert[]; sentCount: number; failedCount: number; batchError: string | null }> {
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const fromEmail = branding.senderEmail || process.env.RESEND_FROM_EMAIL!;
  const senderName = branding.senderName || branding.schoolName || "";
  const from = senderName ? `${senderName} <${fromEmail}>` : fromEmail;
  const replyTo = branding.replyToEmail || undefined;

  const eligible = recipients.filter((r) => r.email);

  let sentCount = 0;
  let failedCount = 0;
  let batchError: string | null = null;
  const inserts: RecipientInsert[] = [];

  console.log(`[sendEmailBatch] from="${from}" replyTo="${replyTo ?? "none"}" recipients=${eligible.length}`);

  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE);
    const emails = batch.map((r) => {
      const rendered = renderTemplate(bodyTemplate, r);
      const firstName = r.preferred_name?.trim() || r.first_name?.trim() || null;
      const payload: Record<string, unknown> = {
        from,
        to: r.email!,
        subject,
        html: buildEmailHtml(rendered, branding, greetingTemplate, firstName, attachmentUrls),
        text: buildEmailText(rendered, branding, greetingTemplate, firstName),
        headers: {
          // Helps Gmail and Outlook route bulk mail correctly
          "Precedence": "bulk",
          // Unique per-recipient ID prevents duplicate-detection false positives
          "X-Entity-Ref-ID": `${messageId}-${r.id}`,
          // One-click unsubscribe — required by Gmail/Yahoo bulk sender guidelines (2024+)
          "List-Unsubscribe": `<mailto:${replyTo || fromEmail}?subject=Unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };
      if (replyTo) payload.replyTo = replyTo;
      return payload;
    });

    console.log(`[sendEmailBatch] sending batch of ${batch.length} to: ${batch.map((r) => r.email).join(", ")}`);

    const result = await resend.batch.send(emails as Parameters<typeof resend.batch.send>[0]);

    if (result.error || !result.data) {
      const errMsg = result.error
        ? `${result.error.name}: ${result.error.message}`
        : "No data returned from Resend";
      console.error(`[sendEmailBatch] Resend error:`, JSON.stringify(result.error, null, 2));
      batchError = errMsg;
      for (const r of batch) {
        inserts.push({
          message_id: messageId,
          person_id: r.id,
          contact_value: r.email!,
          name: `${r.first_name} ${r.last_name}`.trim(),
          status: "failed",
          provider_id: null,
          sent_at: null,
          error_detail: errMsg,
        });
        failedCount++;
      }
    } else {
      const ids = result.data.data;
      console.log(`[sendEmailBatch] Resend accepted batch — ids:`, ids.map((d: { id: string }) => d.id));
      for (let j = 0; j < batch.length; j++) {
        const r = batch[j];
        const providerId = ids[j]?.id ?? null;
        if (!providerId) {
          console.error(`[sendEmailBatch] No provider_id for ${r.email} at index ${j}`);
        }
        inserts.push({
          message_id: messageId,
          person_id: r.id,
          contact_value: r.email!,
          name: `${r.first_name} ${r.last_name}`.trim(),
          status: providerId ? "sent" : "failed",
          provider_id: providerId,
          sent_at: providerId ? now : null,
          error_detail: providerId ? null : "Resend did not return a message ID",
        });
        if (providerId) sentCount++; else failedCount++;
      }
    }
  }

  console.log(`[sendEmailBatch] done — sent=${sentCount} failed=${failedCount} error=${batchError ?? "none"}`);
  return { inserts, sentCount, failedCount, batchError };
}

// ─── Phone normalization ──────────────────────────────────────────────────────

/**
 * Normalize a US phone number to E.164 format (+1XXXXXXXXXX).
 * Handles:
 *   "9172468571"    (10 digits)          → "+19172468571"
 *   "19172468571"   (11 digits, starts 1) → "+19172468571"
 *   "+19172468571"  (already E.164)       → "+19172468571"
 *   "+12014095949"  (already E.164)       → "+12014095949"
 * Numbers that don't match a US pattern are returned as-is so international
 * numbers stored correctly are not corrupted.
 */
function normalizePhone(raw: string): string {
  // Strip all non-digit characters except a leading +
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");

  if (hasPlus) {
    // Already has a + prefix — trust the stored value
    return `+${digits}`;
  }
  if (digits.length === 10) {
    // 10-digit US number — prepend +1
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    // 11-digit with leading 1 — prepend +
    return `+${digits}`;
  }
  // Unrecognized format — return with + prepended so Sinch at least gets
  // a value with a country code indicator rather than a bare number.
  return `+${digits}`;
}

/**
 * Resolves the phone number a message actually goes to for a given channel.
 * WhatsApp sends target person.whatsapp when set (falling back to person.phone
 * for contacts that only have one number on file); SMS always targets
 * person.phone. Returns null when neither field is populated.
 */
function targetContactValue(r: Person, channel: "sms" | "whatsapp"): string | null {
  if (channel === "whatsapp") return r.whatsapp?.trim() || r.phone;
  return r.phone;
}

// ─── SMS / WhatsApp send ───────────────────────────────────────────────────────

// CTIA-required opt-out footer appended to every SMS.
// Carriers require that recipients always know how to stop messages.
const SMS_STOP_FOOTER = "\nReply STOP to opt out.";

async function sendViaSmsProvider(
  channel: "sms" | "whatsapp",
  recipients: Person[],
  bodyTemplate: string,
  messageId: string,
  now: string,
  attachmentUrls?: string[]
): Promise<{ inserts: RecipientInsert[]; sentCount: number; failedCount: number; batchError: string | null }> {
  // Route by channel: SMS → Sinch, WhatsApp → Meta Cloud API
  const provider = channel === "whatsapp" ? getWhatsAppProvider() : getSmsProvider();
  const providerName = channel === "whatsapp" ? "WhatsApp (Meta Cloud API)" : "SMS (Sinch)";

  if (!provider) {
    const errMsg = `${providerName} provider not configured`;
    const inserts: RecipientInsert[] = recipients
      .filter((r) => targetContactValue(r, channel))
      .map((r) => ({
        message_id: messageId,
        person_id: r.id,
        contact_value: targetContactValue(r, channel)!,
        name: `${r.first_name} ${r.last_name}`.trim(),
        status: "failed",
        provider_id: null,
        sent_at: null,
        error_detail: errMsg,
      }));
    return { inserts, sentCount: 0, failedCount: inserts.length, batchError: errMsg };
  }

  // fromNumber is used by Sinch for SMS_SENDER channel property. Meta Cloud API
  // identifies the sender by META_WHATSAPP_PHONE_NUMBER_ID baked into the request
  // URL — the OutboundSms.from field is ignored by MetaWhatsAppProvider.
  const fromNumber = channel === "sms" ? (process.env.SINCH_SMS_SENDER ?? "") : "";

  const MEDIA_RE = /\.(jpg|jpeg|png|gif|webp|pdf)$/i;
  const firstMediaUrl = attachmentUrls?.find((u) => MEDIA_RE.test(u));
  const withPhone = recipients.filter((r) => targetContactValue(r, channel));

  // ── Suppress opted-out recipients ────────────────────────────────────────
  // Check for any prior STOP / opted_out status on these phone numbers.
  // This guards against re-contacting people who opted out of a previous campaign.
  // Carriers also block at the network level, but we filter proactively to keep
  // analytics clean and avoid failed send attempts.
  const supabase = await createSupabaseServerClient();
  const phones = withPhone.map((r) => normalizePhone(targetContactValue(r, channel)!));
  const { data: optedOutRows } = await supabase
    .from("message_recipients")
    .select("contact_value")
    .in("contact_value", phones)
    .eq("status", "opted_out")
    .limit(phones.length);

  const optedOutPhones = new Set((optedOutRows ?? []).map((r) => r.contact_value));
  const eligible = withPhone.filter((r) => !optedOutPhones.has(normalizePhone(targetContactValue(r, channel)!)));

  if (optedOutPhones.size > 0) {
    console.log(
      `[sendViaSmsProvider] Suppressed ${optedOutPhones.size} opted-out recipient(s) from message ${messageId}`
    );
  }

  let sentCount = 0;
  let failedCount = 0;
  const inserts: RecipientInsert[] = [];

  for (const r of eligible) {
    const rendered = renderTemplate(bodyTemplate, r);
    // CTIA requires opt-out instruction in every SMS. WhatsApp is exempt from
    // carrier 10DLC rules but we include it for consistency.
    const body = channel === "sms" ? rendered + SMS_STOP_FOOTER : rendered;

    const toNumber = normalizePhone(targetContactValue(r, channel)!);
    const result = await provider.send(channel, {
      to: toNumber,
      from: fromNumber,
      body,
      mediaUrl: firstMediaUrl,
    });

    inserts.push({
      message_id: messageId,
      person_id: r.id,
      contact_value: toNumber,
      name: `${r.first_name} ${r.last_name}`.trim(),
      status: result.success ? "sent" : "failed",
      provider_id: result.providerId,
      sent_at: result.success ? now : null,
      error_detail: result.success ? null : (result.error ?? "Unknown send error"),
    });

    if (result.success) sentCount++; else failedCount++;
  }

  // Surface the first failure reason as the batch-level error so sendMessage
  // can return it to the UI (mirrors the batchError pattern in sendEmailBatch).
  const batchError = sentCount === 0 && inserts.length > 0
    ? (inserts.find((i) => i.error_detail)?.error_detail ?? "All SMS sends failed")
    : null;

  return { inserts, sentCount, failedCount, batchError };
}

// ─── Demo-mode simulated send ──────────────────────────────────────────────────

/**
 * Simulates a send for demo-mode orgs: no Resend/Sinch/Meta API call is made,
 * every eligible recipient is recorded as "sent" with a synthetic provider_id,
 * and the normal message/message_recipients rows are written exactly as a real
 * send would write them — so Message History, the dashboard, and the campaign
 * detail page all look and behave identically to a real campaign.
 */
function simulateSend(
  recipients: Person[],
  channel: Channel,
  messageId: string,
  now: string
): { inserts: RecipientInsert[]; sentCount: number; failedCount: number; batchError: string | null } {
  const eligible =
    channel === "email"
      ? recipients.filter((r) => r.email)
      : recipients.filter((r) => targetContactValue(r, channel as "sms" | "whatsapp"));

  const inserts: RecipientInsert[] = eligible.map((r) => ({
    message_id: messageId,
    person_id: r.id,
    contact_value:
      channel === "email"
        ? r.email!
        : normalizePhone(targetContactValue(r, channel as "sms" | "whatsapp")!),
    name: `${r.first_name} ${r.last_name}`.trim(),
    status: "sent",
    provider_id: `demo-${crypto.randomUUID()}`,
    sent_at: now,
    error_detail: null,
  }));

  return { inserts, sentCount: inserts.length, failedCount: 0, batchError: null };
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateEnv(channel: Channel): string | null {
  if (channel === "email") {
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL)
      return "Email delivery is not configured for this account. Contact your administrator.";
  }
  if (channel === "sms") return validateSmsEnv("sms");
  if (channel === "whatsapp") return validateMetaWhatsAppEnv();
  return null;
}

// ─── Main action ──────────────────────────────────────────────────────────────

export async function sendMessage(
  audienceSlugs: string[],
  audienceLabel: string,
  channel: Channel,
  subject: string,
  body: string,
  attachmentUrls?: string[],
  greetingTemplate?: string | null,
  excludePersonIds?: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();
  const demoMode = await isDemoOrg(orgId);

  // Demo tenants never touch a real provider — env credentials aren't required.
  const envError = demoMode ? null : validateEnv(channel);
  if (envError) return { success: false, error: envError };

  // Fetch branding for email template (no-op for SMS/WhatsApp)
  const branding = channel === "email" ? await getBrandingSettings() : ({} as BrandingSettings);

  const trimmedSubject = subject.trim();
  const trimmedBody = body.trim();
  if (channel === "email" && !trimmedSubject)
    return { success: false, error: "Subject is required for email." };
  if (!trimmedBody)
    return { success: false, error: "Message body is required." };
  if (audienceSlugs.length === 0)
    return { success: false, error: "At least one audience is required." };

  // Resolve & deduplicate recipients
  const peopleArrays = await Promise.all(audienceSlugs.map((slug) => getPeopleForAudience(slug, orgId)));
  const seenIds = new Set<string>();
  const allPeople: Person[] = [];
  for (const batch of peopleArrays) {
    for (const p of batch) {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        allPeople.push(p);
      }
    }
  }

  // Apply per-send exclusions (recipients removed from the confirm dialog)
  const excludeSet = new Set(excludePersonIds ?? []);
  const filtered = excludeSet.size > 0 ? allPeople.filter((p) => !excludeSet.has(p.id)) : allPeople;

  const eligible =
    channel === "email"
      ? filtered.filter((p) => p.email)
      : filtered.filter((p) => targetContactValue(p, channel));

  if (eligible.length === 0) {
    const field = channel === "email" ? "email addresses" : "phone numbers";
    return {
      success: false,
      error: `No contacts with ${field} found in the selected audience${audienceSlugs.length > 1 ? "s" : ""}.`,
    };
  }

  // Create the message record
  const { data: messageRow, error: msgError } = await supabase
    .from("messages")
    .insert({
      org_id: orgId,
      subject: channel === "email" ? trimmedSubject : null,
      body: trimmedBody,
      channel,
      audience_slug: audienceSlugs.join(","),
      audience_label: audienceLabel,
      recipient_count: eligible.length,
      status: "sending",
    })
    .select("id")
    .single();

  if (msgError || !messageRow) {
    return {
      success: false,
      error: msgError?.message ?? "Failed to create message record.",
    };
  }

  const messageId = messageRow.id;
  const now = new Date().toISOString();

  let sentCount = 0;
  let failedCount = 0;
  let inserts: RecipientInsert[] = [];

  let batchError: string | null = null;

  // ── AUDIT LOG: log every recipient email before sending ──────────────────
  if (channel === "email") {
    console.log(`[sendMessage] RECIPIENT AUDIT — message ${messageId} — ${eligible.length} recipients:`);
    for (const r of eligible) {
      console.log(`  [sendMessage]   → ${r.email} (${r.first_name} ${r.last_name})`);
    }
  } else {
    console.log(`[sendMessage] RECIPIENT AUDIT — message ${messageId} — ${eligible.length} recipients:`);
    for (const r of eligible) {
      console.log(`  [sendMessage]   → ${r.phone} (${r.first_name} ${r.last_name})`);
    }
  }

  if (demoMode) {
    const result = simulateSend(eligible, channel, messageId, now);
    sentCount = result.sentCount;
    failedCount = result.failedCount;
    inserts = result.inserts;
    batchError = result.batchError;
  } else if (channel === "email") {
    const result = await sendEmailBatch(eligible, trimmedSubject, trimmedBody, messageId, now, branding, greetingTemplate ?? null, attachmentUrls);
    sentCount = result.sentCount;
    failedCount = result.failedCount;
    inserts = result.inserts;
    batchError = result.batchError;
  } else {
    // SMS or WhatsApp via provider abstraction (currently Sinch)
    const result = await sendViaSmsProvider(channel as "sms" | "whatsapp", eligible, trimmedBody, messageId, now, attachmentUrls);
    sentCount = result.sentCount;
    failedCount = result.failedCount;
    inserts = result.inserts;
    batchError = result.batchError;
  }

  const finalStatus = sentCount === 0 ? "failed" : "sent";

  // Collect the most representative error for the campaign row
  const campaignError: string | null =
    sentCount === 0
      ? (batchError ?? inserts.find((i) => i.error_detail)?.error_detail ?? "All sends failed")
      : null;

  await Promise.all([
    inserts.length > 0 ? supabase.from("message_recipients").insert(inserts) : Promise.resolve(),
    supabase
      .from("messages")
      .update({
        sent_count: sentCount,
        failed_count: failedCount,
        status: finalStatus,
        sent_at: now,
        ...(campaignError ? { error_detail: campaignError } : {}),
      })
      .eq("id", messageId),
  ]);

  revalidatePath("/messages");

  if (sentCount === 0 && batchError) {
    return { success: false, error: batchError };
  }
  return { success: true };
  } catch (err: unknown) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error("[sendMessage] UNCAUGHT EXCEPTION:", e.message, e.stack);
    return { success: false, error: `Server error: ${e.message}` };
  }
}

// ─── Full recipient resolution (pre-send audit) ───────────────────────────────

export type ResolvedRecipient = {
  personId: string;
  name: string;
  contactValue: string; // email or phone (E.164 for phone)
};

/**
 * Resolves the exact set of recipients that will receive a send.
 * Called BEFORE sendMessage so the user can confirm who will receive the message.
 * Also used server-side to audit the recipient list before calling Resend.
 */
export async function resolveAllRecipients(
  audienceSlugs: string[],
  channel: Channel
): Promise<ResolvedRecipient[]> {
  if (audienceSlugs.length === 0) return [];

  const orgId = await getOrgId();
  const peopleArrays = await Promise.all(audienceSlugs.map((slug) => getPeopleForAudience(slug, orgId)));
  const seenIds = new Set<string>();
  const allPeople: Person[] = [];
  for (const batch of peopleArrays) {
    for (const p of batch) {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        allPeople.push(p);
      }
    }
  }

  const eligible =
    channel === "email"
      ? allPeople.filter((p) => p.email)
      : allPeople.filter((p) => targetContactValue(p, channel));

  return eligible.map((r) => ({
    personId: r.id,
    name:
      [r.first_name, r.last_name].filter(Boolean).join(" ") ||
      (channel === "email" ? r.email ?? "" : targetContactValue(r, channel) ?? ""),
    contactValue: channel === "email" ? (r.email ?? "") : normalizePhone(targetContactValue(r, channel) ?? ""),
  }));
}

// ─── Per-recipient preview ────────────────────────────────────────────────────

export type RecipientPreview = {
  name: string;
  contactValue: string;
  rendered: string;
};

export async function previewRecipients(
  audienceSlugs: string[],
  channel: Channel,
  bodyTemplate: string,
  limit = 8
): Promise<{ previews: RecipientPreview[]; totalCount: number }> {
  if (!bodyTemplate.trim() || audienceSlugs.length === 0) {
    return { previews: [], totalCount: 0 };
  }

  const orgId = await getOrgId();
  const peopleArrays = await Promise.all(audienceSlugs.map((slug) => getPeopleForAudience(slug, orgId)));
  const seenIds = new Set<string>();
  const allPeople: Person[] = [];
  for (const batch of peopleArrays) {
    for (const p of batch) {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        allPeople.push(p);
      }
    }
  }

  const eligible =
    channel === "email"
      ? allPeople.filter((p) => p.email)
      : allPeople.filter((p) => targetContactValue(p, channel));

  const sample = eligible.slice(0, limit);
  const previews: RecipientPreview[] = sample.map((r) => ({
    name: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email || "Unknown",
    contactValue: channel === "email" ? (r.email ?? "") : (targetContactValue(r, channel) ?? ""),
    rendered: renderTemplate(bodyTemplate, r),
  }));

  return { previews, totalCount: eligible.length };
}
