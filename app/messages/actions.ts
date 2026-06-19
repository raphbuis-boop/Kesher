"use server";

import { Resend } from "resend";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Channel = "email" | "sms" | "whatsapp";

type Person = {
  id: string;
  first_name: string;
  last_name: string;
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

// ─── Email template ───────────────────────────────────────────────────────────

function buildEmailHtml(body: string): string {
  const paragraphs = body
    .split(/\n\n+/)
    .filter((p) => p.trim())
    .map((p) => {
      const lines = p
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      return `<p style="margin:0 0 16px;line-height:1.65;font-size:15px;color:#1a1a1a;">${lines.join("<br>")}</p>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;">
<div style="background:white;border-radius:8px;padding:40px;border:1px solid #e4e4e7;">
${paragraphs}
</div>
</div>
</body>
</html>`;
}

// ─── Recipient resolution ─────────────────────────────────────────────────────

async function getPeopleForAudience(audienceSlug: string): Promise<Person[]> {
  const isSystem = audienceSlug in SYSTEM_CATEGORY_MAP;

  if (isSystem) {
    const category = SYSTEM_CATEGORY_MAP[audienceSlug];
    const { data } = await supabase
      .from("people")
      .select("id, first_name, last_name, email, phone")
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
    .select("id, first_name, last_name, email, phone, person_tags ( tag_id )");

  const tagIdSet = new Set<string>(tagIds);
  return ((allPeople ?? []) as any[])
    .filter((p: any) =>
      p.person_tags?.some((pt: any) => tagIdSet.has(pt.tag_id))
    )
    .map((p: any) => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
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
  body: string,
  messageId: string,
  now: string
): Promise<{ inserts: RecipientInsert[]; sentCount: number; failedCount: number }> {
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const htmlBody = buildEmailHtml(body);
  const fromEmail = process.env.RESEND_FROM_EMAIL!;
  const eligible = recipients.filter((r) => r.email);

  let sentCount = 0;
  let failedCount = 0;
  const inserts: RecipientInsert[] = [];

  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE);
    const emails = batch.map((r) => ({
      from: fromEmail,
      to: r.email!,
      subject,
      html: htmlBody,
    }));

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
        if (providerId) sentCount++;
        else failedCount++;
      }
    }
  }

  return { inserts, sentCount, failedCount };
}

async function mockSendMessages(
  recipients: Person[],
  channel: "sms" | "whatsapp",
  messageId: string,
  now: string
): Promise<{ inserts: RecipientInsert[]; sentCount: number; failedCount: number }> {
  const eligible = recipients.filter((r) => r.phone);
  const inserts: RecipientInsert[] = eligible.map((r) => ({
    message_id: messageId,
    person_id: r.id,
    contact_value: r.phone!,
    name: `${r.first_name} ${r.last_name}`.trim(),
    status: "sent",
    provider_id: `mock_${channel}_${r.id.slice(0, 8)}`,
    sent_at: now,
  }));
  console.log(`[mock ${channel}] Would send to ${eligible.length} recipients. Connect a real provider to enable delivery.`);
  return { inserts, sentCount: eligible.length, failedCount: 0 };
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateEnv(channel: Channel): string | null {
  if (channel === "email") {
    if (!process.env.RESEND_API_KEY)
      return "Email service not configured. Add RESEND_API_KEY to your .env.local file.";
    if (!process.env.RESEND_FROM_EMAIL)
      return "From email not configured. Add RESEND_FROM_EMAIL to your .env.local file.";
  }
  // SMS and WhatsApp run in mock mode — no env validation needed yet
  return null;
}

// ─── Main action ──────────────────────────────────────────────────────────────

export async function sendMessage(
  audienceSlugs: string[],
  audienceLabel: string,
  channel: Channel,
  subject: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  const envError = validateEnv(channel);
  if (envError) return { success: false, error: envError };

  const trimmedSubject = subject.trim();
  const trimmedBody = body.trim();
  if (channel === "email" && !trimmedSubject)
    return { success: false, error: "Subject is required for email." };
  if (!trimmedBody)
    return { success: false, error: "Message body is required." };
  if (audienceSlugs.length === 0)
    return { success: false, error: "At least one audience is required." };

  // Resolve people across all audiences, deduplicate by person ID
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

  // Filter to only those with the required contact field
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

  // Store the primary slug (first selected) for legacy queries; label captures all
  const audienceSlug = audienceSlugs.join(",");

  // Create the message record
  const { data: messageRow, error: msgError } = await supabase
    .from("messages")
    .insert({
      subject: channel === "email" ? trimmedSubject : null,
      body: trimmedBody,
      channel,
      audience_slug: audienceSlug,
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
    const result = await sendEmailBatch(eligible, trimmedSubject, trimmedBody, messageId, now);
    sentCount = result.sentCount;
    failedCount = result.failedCount;
    inserts = result.inserts;
  } else {
    const result = await mockSendMessages(eligible, channel, messageId, now);
    sentCount = result.sentCount;
    failedCount = result.failedCount;
    inserts = result.inserts;
  }

  // Write recipient records and update message status in parallel
  await Promise.all([
    supabase.from("message_recipients").insert(inserts),
    supabase
      .from("messages")
      .update({
        sent_count: sentCount,
        failed_count: failedCount,
        status: "sent",
        sent_at: now,
      })
      .eq("id", messageId),
  ]);

  revalidatePath("/messages");

  return { success: true };
}
