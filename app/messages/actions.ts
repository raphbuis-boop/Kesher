"use server";

import { Resend } from "resend";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { renderTemplate } from "@/lib/template";
import { getBrandingSettings, type BrandingSettings } from "@/lib/settings";

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
// Patterns that indicate the user already opened with a salutation
const GREETING_START_RE = /^(hi|hello|dear|shalom|good\s+morning|good\s+afternoon|gut\s+shabbos|shana\s+tova|greetings|to\s+whom)/i;

function buildEmailHtml(
  body: string,
  branding: BrandingSettings,
  firstName: string | null,
  attachmentUrls?: string[]
): string {
  const primaryColor = branding.primaryColor || "#1e3a6e";
  const schoolName   = branding.schoolName   || "School Office";
  const footerText   = branding.footerText   || "";
  const websiteUrl   = branding.websiteUrl   || "";
  const logoUrl      = branding.logoUrl      || "";
  const replyEmail   = branding.replyToEmail || "";

  // ── Initials fallback when no logo ───────────────────────────────────────
  const initials = schoolName
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${schoolName}" style="display:block;margin:0 auto;max-height:96px;max-width:280px;height:auto;width:auto;border:0;">`
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
        <tr><td style="width:68px;height:68px;background:rgba(255,255,255,0.18);border-radius:50%;text-align:center;vertical-align:middle;font-size:24px;font-weight:700;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;letter-spacing:-0.5px;">
          ${initials}
        </td></tr>
      </table>`;

  // ── Greeting line (auto-injected if body doesn't already open with one) ──
  const bodyTrimmed = body.trim();
  const greetingHtml =
    firstName && !GREETING_START_RE.test(bodyTrimmed)
      ? `<p style="margin:0 0 22px;font-size:16px;font-weight:600;color:#111827;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Hi ${firstName},</p>`
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
    : `<p style="margin:0;font-size:13px;color:#9ca3af;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${schoolName}</p>`;

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
        <td class="em-header-td" style="background-color:${primaryColor};border-radius:14px 14px 0 0;padding:48px 56px 44px;text-align:center;">
          ${logoHtml}
          ${logoUrl ? "" : `<h1 style="margin:18px 0 0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.4px;line-height:1.25;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${schoolName}</h1>`}
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

async function getPeopleForAudience(audienceSlug: string): Promise<Person[]> {
  const supabase = await createSupabaseServerClient();
  const isSystem = audienceSlug in SYSTEM_CATEGORY_MAP;

  if (isSystem) {
    const category = SYSTEM_CATEGORY_MAP[audienceSlug];
    const { data } = await supabase
      .from("people")
      .select("id, first_name, last_name, preferred_name, salutation, email, phone")
      .contains("categories", [category]);
    return (data ?? []) as Person[];
  }

  // Custom audience — resolve by group tags
  const { data: group } = await supabase
    .from("groups")
    .select("id, group_tags ( tag_id )")
    .eq("id", audienceSlug)
    .single();

  if (!group) return [];

  const tagIds = (group as any).group_tags?.map((gt: any) => gt.tag_id) ?? [];
  if (tagIds.length === 0) return [];

  const { data: allPeople } = await supabase
    .from("people")
    .select("id, first_name, last_name, preferred_name, salutation, email, phone, person_tags ( tag_id )");

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
};

async function sendEmailBatch(
  recipients: Person[],
  subject: string,
  bodyTemplate: string,
  messageId: string,
  now: string,
  branding: BrandingSettings,
  attachmentUrls?: string[]
): Promise<{ inserts: RecipientInsert[]; sentCount: number; failedCount: number }> {
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const fromEmail = process.env.RESEND_FROM_EMAIL!;
  const senderName = branding.senderName || branding.schoolName || "";
  const from = senderName ? `${senderName} <${fromEmail}>` : fromEmail;
  const replyTo = branding.replyToEmail || undefined;

  const eligible = recipients.filter((r) => r.email);

  let sentCount = 0;
  let failedCount = 0;
  const inserts: RecipientInsert[] = [];

  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE);
    const emails = batch.map((r) => {
      const rendered = renderTemplate(bodyTemplate, r);
      const firstName = r.preferred_name?.trim() || r.first_name?.trim() || null;
      const email: Record<string, unknown> = {
        from,
        to: r.email!,
        subject,
        html: buildEmailHtml(rendered, branding, firstName, attachmentUrls),
      };
      if (replyTo) email.reply_to = replyTo;
      return email;
    });

    const result = await resend.batch.send(emails);

    if (result.error || !result.data) {
      for (const r of batch) {
        inserts.push({
          message_id: messageId,
          person_id: r.id,
          contact_value: r.email!,
          name: `${r.first_name} ${r.last_name}`.trim(),
          status: "failed",
          provider_id: null,
          sent_at: null,
        });
        failedCount++;
      }
    } else {
      const ids = result.data.data;
      for (let j = 0; j < batch.length; j++) {
        const r = batch[j];
        const providerId = ids[j]?.id ?? null;
        inserts.push({
          message_id: messageId,
          person_id: r.id,
          contact_value: r.email!,
          name: `${r.first_name} ${r.last_name}`.trim(),
          status: providerId ? "sent" : "failed",
          provider_id: providerId,
          sent_at: providerId ? now : null,
        });
        if (providerId) sentCount++; else failedCount++;
      }
    }
  }

  return { inserts, sentCount, failedCount };
}

// ─── Twilio send (SMS + WhatsApp) ─────────────────────────────────────────────

async function sendViaTwilio(
  channel: "sms" | "whatsapp",
  recipients: Person[],
  bodyTemplate: string,
  messageId: string,
  now: string,
  attachmentUrls?: string[]
): Promise<{ inserts: RecipientInsert[]; sentCount: number; failedCount: number }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;

  // WhatsApp uses sandbox number; SMS uses TWILIO_SMS_FROM
  const fromNumber =
    channel === "whatsapp"
      ? (process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886")
      : process.env.TWILIO_SMS_FROM!;

  const eligible = recipients.filter((r) => r.phone);
  const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp)$/i;
  const firstImageUrl = attachmentUrls?.find((u) => IMAGE_RE.test(u));

  let sentCount = 0;
  let failedCount = 0;
  const inserts: RecipientInsert[] = [];

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  for (const r of eligible) {
    const rendered = renderTemplate(bodyTemplate, r);

    // WhatsApp requires "whatsapp:+1..." prefix; SMS uses bare E.164
    const rawPhone = r.phone!;
    const toNumber =
      channel === "whatsapp"
        ? (rawPhone.startsWith("whatsapp:") ? rawPhone : `whatsapp:${rawPhone}`)
        : rawPhone;

    const params = new URLSearchParams({
      From: fromNumber,
      To: toNumber,
      Body: rendered,
    });
    if (channel === "whatsapp" && firstImageUrl) {
      params.append("MediaUrl", firstImageUrl);
    }

    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        }
      );

      const json = await res.json();
      const sid: string | null = json.sid ?? null;

      inserts.push({
        message_id: messageId,
        person_id: r.id,
        contact_value: r.phone!,
        name: `${r.first_name} ${r.last_name}`.trim(),
        status: sid ? "sent" : "failed",
        provider_id: sid,
        sent_at: sid ? now : null,
      });

      if (sid) sentCount++; else failedCount++;
    } catch {
      inserts.push({
        message_id: messageId,
        person_id: r.id,
        contact_value: r.phone!,
        name: `${r.first_name} ${r.last_name}`.trim(),
        status: "failed",
        provider_id: null,
        sent_at: null,
      });
      failedCount++;
    }
  }

  return { inserts, sentCount, failedCount };
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateEnv(channel: Channel): string | null {
  if (channel === "email") {
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL)
      return "Email delivery is not configured for this account. Contact your administrator.";
  }
  if (channel === "sms" || channel === "whatsapp") {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN)
      return `${channel === "sms" ? "SMS" : "WhatsApp"} delivery is not configured for this account. Contact your administrator.`;
  }
  return null;
}

// ─── Main action ──────────────────────────────────────────────────────────────

export async function sendMessage(
  audienceSlugs: string[],
  audienceLabel: string,
  channel: Channel,
  subject: string,
  body: string,
  attachmentUrls?: string[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const envError = validateEnv(channel);
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
  const peopleArrays = await Promise.all(audienceSlugs.map(getPeopleForAudience));
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
      : allPeople.filter((p) => p.phone);

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

  if (channel === "email") {
    const result = await sendEmailBatch(eligible, trimmedSubject, trimmedBody, messageId, now, branding, attachmentUrls);
    sentCount = result.sentCount;
    failedCount = result.failedCount;
    inserts = result.inserts;
  } else {
    // SMS or WhatsApp via Twilio (credentials validated above)
    const result = await sendViaTwilio(channel as "sms" | "whatsapp", eligible, trimmedBody, messageId, now, attachmentUrls);
    sentCount = result.sentCount;
    failedCount = result.failedCount;
    inserts = result.inserts;
  }

  await Promise.all([
    supabase.from("message_recipients").insert(inserts),
    supabase
      .from("messages")
      .update({ sent_count: sentCount, failed_count: failedCount, status: "sent", sent_at: now })
      .eq("id", messageId),
  ]);

  revalidatePath("/messages");
  return { success: true };
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

  const peopleArrays = await Promise.all(audienceSlugs.map(getPeopleForAudience));
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
      : allPeople.filter((p) => p.phone);

  const sample = eligible.slice(0, limit);
  const previews: RecipientPreview[] = sample.map((r) => ({
    name: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email || "Unknown",
    contactValue: channel === "email" ? (r.email ?? "") : (r.phone ?? ""),
    rendered: renderTemplate(bodyTemplate, r),
  }));

  return { previews, totalCount: eligible.length };
}
