"use server";

import { Resend } from "resend";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId, sendsAreSimulated } from "@/lib/org";
import { getGroup, getGroupMembers, getSystemAudienceMembers } from "@/lib/audienceMembers";
import { revalidatePath } from "next/cache";
import { renderTemplate } from "@/lib/template";
import { getBrandingSettings } from "@/lib/settings";
import { buildEmailHtml, buildEmailText, formatFrom, resolveGreeting, type EmailBranding } from "@/lib/email/render";
import { applyTemplate, getTemplate } from "@/lib/templates";
import { FUNDRAISING_WHATSAPP_NOTE, looksLikeFundraising } from "@/lib/fundraising";
import { getSmsProvider, getWhatsAppProvider, validateSmsEnv, validateMetaWhatsAppEnv } from "@/lib/sms-provider";
import { buildUnsubscribeUrls, validateUnsubscribeEnv } from "@/lib/unsubscribe";

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

// ─── Recipient resolution ─────────────────────────────────────────────────────

/**
 * Resolves the real recipient list for an audience — system category or
 * custom group (tag-based OR dynamic/filter_config-based; both resolve
 * identically here and everywhere else via lib/audienceMembers.ts, so a
 * "Dynamic rules" audience actually receives messages instead of silently
 * sending to nobody).
 */
async function getPeopleForAudience(audienceSlug: string, orgId: string): Promise<Person[]> {
  const supabase = await createSupabaseServerClient();
  const isSystem = audienceSlug in SYSTEM_CATEGORY_MAP;

  if (isSystem) {
    const members = await getSystemAudienceMembers(supabase, orgId, SYSTEM_CATEGORY_MAP[audienceSlug]);
    return members;
  }

  const group = await getGroup(supabase, orgId, audienceSlug);
  if (!group) {
    console.warn(`[getPeopleForAudience] group not found — slug=${audienceSlug} org=${orgId}`);
    return [];
  }

  return getGroupMembers(supabase, orgId, group);
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

/** Lowercased domain part of an email address. */
function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).trim().toLowerCase();
}

async function sendEmailBatch(
  recipients: Person[],
  subject: string,
  bodyTemplate: string,
  messageId: string,
  now: string,
  branding: EmailBranding,
  greetingTemplate: string | null,
  recipientRowIds: Map<string, string>,
  attachmentUrls?: string[]
): Promise<{ inserts: RecipientInsert[]; sentCount: number; failedCount: number; batchError: string | null }> {
  const resend = new Resend(process.env.RESEND_API_KEY!);

  // Only send From an address on the verified Resend domain (RESEND_FROM_EMAIL's
  // domain) so SPF/DKIM align with DMARC. A school address set as Sender Email
  // on another domain is used as the reply-to instead.
  const defaultFrom = process.env.RESEND_FROM_EMAIL!;
  const senderOnVerifiedDomain =
    !!branding.senderEmail && emailDomain(branding.senderEmail) === emailDomain(defaultFrom);
  const fromEmail = senderOnVerifiedDomain ? branding.senderEmail : defaultFrom;
  const replyTo =
    branding.replyToEmail ||
    (branding.senderEmail && !senderOnVerifiedDomain ? branding.senderEmail : "") ||
    undefined;

  // Display name is the school, never the platform name
  const configuredName = branding.senderName?.trim().toLowerCase() === "kesher" ? "" : branding.senderName;
  const senderName = configuredName || branding.schoolName || "";
  const from = formatFrom(senderName, fromEmail);
  if (!senderName) {
    console.warn(`[sendEmailBatch] No School Name / Sender Name set — sending from bare address ${fromEmail}`);
  }

  const withEmail = recipients.filter((r) => r.email);

  // ── Suppress unsubscribed addresses ──────────────────────────────────────
  // Same opt-out store as SMS STOP: message_recipients rows with
  // status='opted_out' (set by /unsubscribe). RLS scopes this to the org.
  // Checked in chunks to keep the PostgREST query URL short.
  const supabase = await createSupabaseServerClient();
  const optedOutEmails = new Set<string>();
  for (let i = 0; i < withEmail.length; i += BATCH_SIZE) {
    const chunk = withEmail.slice(i, i + BATCH_SIZE).map((r) => r.email!);
    const { data: optedOutRows, error: optOutError } = await supabase
      .from("message_recipients")
      .select("contact_value")
      .in("contact_value", chunk)
      .eq("status", "opted_out");
    if (optOutError) {
      console.error(`[sendEmailBatch] Opt-out lookup failed:`, optOutError.message);
    }
    for (const row of optedOutRows ?? []) optedOutEmails.add(row.contact_value as string);
  }
  const eligible = withEmail.filter((r) => !optedOutEmails.has(r.email!));
  if (optedOutEmails.size > 0) {
    console.log(`[sendEmailBatch] Suppressed ${optedOutEmails.size} unsubscribed recipient(s) from message ${messageId}`);
  }

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
      const unsubscribe = buildUnsubscribeUrls(recipientRowIds.get(r.id)!);
      const payload: Record<string, unknown> = {
        from,
        to: r.email!,
        subject,
        html: buildEmailHtml({ body: rendered, greeting: resolveGreeting(greetingTemplate, firstName), attachmentUrls, unsubscribeUrl: unsubscribe.page }, branding),
        text: buildEmailText({ body: rendered, greeting: resolveGreeting(greetingTemplate, firstName), unsubscribeUrl: unsubscribe.page }, branding),
        headers: {
          // Helps Gmail and Outlook route bulk mail correctly
          "Precedence": "bulk",
          // Unique per-recipient ID prevents duplicate-detection false positives
          "X-Entity-Ref-ID": `${messageId}-${r.id}`,
          // RFC 8058 one-click unsubscribe — required by Gmail/Yahoo bulk sender
          // rules. Must be an https URL that accepts POST (see /api/unsubscribe).
          "List-Unsubscribe": `<${unsubscribe.oneClick}>`,
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
    return validateUnsubscribeEnv();
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
  excludePersonIds?: string[],
  options?: { templateId?: string | null; isFundraising?: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();
  const simulated = await sendsAreSimulated(orgId);

  // Simulated-send tenants never touch a real provider — env credentials aren't required.
  const envError = simulated ? null : validateEnv(channel);
  if (envError) return { success: false, error: envError };

  // Email look: school branding with the chosen template laid over it
  const template = channel === "email" ? await getTemplate(supabase, orgId, options?.templateId) : null;
  const branding: EmailBranding = applyTemplate(channel === "email" ? await getBrandingSettings() : ({} as Awaited<ReturnType<typeof getBrandingSettings>>), template);
  const isFundraising = !!options?.isFundraising;

  const trimmedSubject = subject.trim();
  const trimmedBody = body.trim();
  if (channel === "email" && !trimmedSubject)
    return { success: false, error: "Subject is required for email." };
  if (!trimmedBody)
    return { success: false, error: "Message body is required." };
  // Meta blocks marketing-style templates to US numbers: fundraising is email / SMS only
  if (channel === "whatsapp" && (isFundraising || looksLikeFundraising(trimmedBody))) {
    return {
      success: false,
      error: isFundraising
        ? FUNDRAISING_WHATSAPP_NOTE
        : "This reads like a fundraising message, which WhatsApp doesn't allow. Send it by email or text instead, or remove the donation wording.",
    };
  }
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
      template_id: template?.id ?? null,
      is_fundraising: isFundraising,
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

  // ── Save the recipient list BEFORE sending ──────────────────────────────
  // If these rows can't be written, nothing is sent: otherwise the message
  // would go out and show as "sent" with an empty recipient list on the
  // detail page. Rows start as "failed" so an interrupted send never reads
  // as delivered; they're overwritten with real results after the send.
  const { data: savedRows, error: saveError } = await supabase
    .from("message_recipients")
    .insert(
      eligible.map((r) => ({
        message_id: messageId,
        person_id: r.id,
        contact_value:
          channel === "email" ? r.email! : normalizePhone(targetContactValue(r, channel)!),
        name: `${r.first_name} ${r.last_name}`.trim(),
        status: "failed",
        provider_id: null,
        sent_at: null,
        error_detail: "Send did not complete",
      }))
    )
    .select("id, person_id");

  if (saveError || !savedRows) {
    console.error(
      `[sendMessage] Failed to save recipients for message ${messageId} — nothing was sent:`,
      saveError
    );
    const saveErrMsg = "Couldn't save the recipient list, so nothing was sent. Please try again.";
    const { error: markError } = await supabase
      .from("messages")
      .update({ status: "failed", sent_count: 0, failed_count: 0, error_detail: saveErrMsg })
      .eq("id", messageId);
    if (markError) console.error(`[sendMessage] Failed to mark message ${messageId} as failed:`, markError);
    revalidatePath("/messages");
    return { success: false, error: saveErrMsg };
  }

  const savedRowIdByPerson = new Map(savedRows.map((row) => [row.person_id as string, row.id as string]));

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

  if (simulated) {
    const result = simulateSend(eligible, channel, messageId, now);
    sentCount = result.sentCount;
    failedCount = result.failedCount;
    inserts = result.inserts;
    batchError = result.batchError;
  } else if (channel === "email") {
    const result = await sendEmailBatch(eligible, trimmedSubject, trimmedBody, messageId, now, branding, greetingTemplate ?? null, savedRowIdByPerson, attachmentUrls);
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

  // Overwrite the pre-saved rows with real send results (matched by row id).
  // Anyone who got no result (e.g. suppressed as opted-out) is removed so the
  // recipient list matches exactly who was attempted, as before.
  const resultRows = inserts.map((i) => ({ id: savedRowIdByPerson.get(i.person_id)!, ...i }));
  const attemptedPersonIds = new Set(inserts.map((i) => i.person_id));
  const unattemptedRowIds = savedRows
    .filter((row) => !attemptedPersonIds.has(row.person_id as string))
    .map((row) => row.id as string);

  const [resultsWrite, unattemptedDelete, messageUpdate] = await Promise.all([
    resultRows.length > 0
      ? supabase.from("message_recipients").upsert(resultRows)
      : Promise.resolve({ error: null }),
    unattemptedRowIds.length > 0
      ? supabase.from("message_recipients").delete().in("id", unattemptedRowIds)
      : Promise.resolve({ error: null }),
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

  if (resultsWrite.error)
    console.error(`[sendMessage] Failed to save send results for message ${messageId}:`, resultsWrite.error);
  if (unattemptedDelete.error)
    console.error(`[sendMessage] Failed to remove unattempted recipients for message ${messageId}:`, unattemptedDelete.error);
  if (messageUpdate.error)
    console.error(`[sendMessage] Failed to update message ${messageId}:`, messageUpdate.error);

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
