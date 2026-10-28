import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows, chunk } from "@/lib/supabase-paging";
import { toE164 } from "@/lib/phone";
import { isValidEmail } from "@/lib/validation";

/**
 * "Who can't we reach?" — the people a message will silently miss, and why.
 * Everything is org-scoped and computed live from the directory, so it's
 * always the current picture rather than a snapshot from send time.
 */

export type ContactGap = {
  personId: string;
  name: string;
  reason: "no_contact" | "invalid_email" | "invalid_phone" | "bounced_email" | "no_parent";
  detail: string;
  grade: string | null;
  categories: string[];
};

export const GAP_LABELS: Record<ContactGap["reason"], string> = {
  no_contact: "No email or phone",
  invalid_email: "Email address isn't valid",
  invalid_phone: "Phone number isn't valid",
  bounced_email: "Email keeps bouncing",
  no_parent: "Student with no parent receiving messages",
};

type PersonRow = { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; whatsapp: string | null; grade: string | null; categories: string[] | null };

export async function findContactGaps(supabase: SupabaseClient, orgId: string): Promise<ContactGap[]> {
  const people = await fetchAllRows<PersonRow>((from, to) =>
    supabase.from("people").select("id, first_name, last_name, email, phone, whatsapp, grade, categories").eq("org_id", orgId).eq("status", "active").order("id").range(from, to)
  );
  const links = await fetchAllRows<{ student_id: string; guardian_id: string }>((from, to) =>
    supabase.from("guardian_students").select("student_id, guardian_id").eq("org_id", orgId).eq("receives_messages", true).order("id").range(from, to)
  );
  const activeIds = new Set(people.map((p) => p.id));
  const covered = new Set(links.filter((l) => activeIds.has(l.guardian_id)).map((l) => l.student_id));

  // Addresses that hard-bounced recently: the person's current email matches one of them
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString();
  const bounces = await fetchAllRows<{ contact_value: string }>((from, to) =>
    supabase.from("message_recipients").select("contact_value, messages!inner(org_id)").eq("messages.org_id", orgId).eq("bounce_type", "hard").gte("bounced_at", since).order("id").range(from, to)
  );
  const bounced = new Set(bounces.map((b) => b.contact_value.trim().toLowerCase()));

  const gaps: ContactGap[] = [];
  for (const p of people) {
    const name = `${p.first_name} ${p.last_name}`.trim();
    const categories = p.categories ?? [];
    const base = { personId: p.id, name, grade: p.grade, categories };
    const isStudent = categories.includes("student");
    const email = p.email?.trim() ?? "";
    const phones = [p.phone, p.whatsapp].filter((x): x is string => !!x && !!x.trim());

    if (isStudent) {
      // Students are reached through their parents
      if (!covered.has(p.id) && !email && phones.length === 0) gaps.push({ ...base, reason: "no_parent", detail: "No parent is set to receive this student's messages" });
      continue;
    }
    if (!email && phones.length === 0) {
      gaps.push({ ...base, reason: "no_contact", detail: "Add an email address or phone number" });
      continue;
    }
    if (email && !isValidEmail(email)) gaps.push({ ...base, reason: "invalid_email", detail: email });
    else if (email && bounced.has(email.toLowerCase())) gaps.push({ ...base, reason: "bounced_email", detail: email });
    const badPhone = phones.find((ph) => !toE164(ph));
    if (badPhone) gaps.push({ ...base, reason: "invalid_phone", detail: badPhone });
  }
  return gaps;
}

export type DeliveryFailure = {
  rowId: string;
  personId: string;
  name: string;
  channel: string;
  contact: string;
  reason: string;
  messageId: string;
  messageTitle: string;
  at: string | null;
};

type FailRow = {
  id: string;
  person_id: string;
  name: string;
  channel: string | null;
  contact_value: string;
  status: string;
  bounce_type: string | null;
  error_detail: string | null;
  bounced_at: string | null;
  sent_at: string | null;
  messages: { id: string; org_id: string; channel: string; subject: string | null; body: string; created_at: string };
};

/** Messages that didn't arrive (failed or bounced, and not rescued by another channel) in the last 60 days. */
export async function findDeliveryFailures(supabase: SupabaseClient, orgId: string, opts: { messageId?: string } = {}): Promise<DeliveryFailure[]> {
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const cols = "id, person_id, name, channel, contact_value, status, bounce_type, error_detail, bounced_at, sent_at, messages!inner(id, org_id, channel, subject, body, created_at)";
  const rows = await fetchAllRows<FailRow>((from, to) => {
    let q = supabase.from("message_recipients").select(cols).eq("messages.org_id", orgId).gte("messages.created_at", since).or("status.eq.failed,bounced_at.not.is.null");
    if (opts.messageId) q = q.eq("message_id", opts.messageId);
    return q.order("id").range(from, to);
  });
  if (rows.length === 0) return [];

  // Rows that were retried on another channel aren't failures
  const retried = new Set<string>();
  for (const part of chunk(rows.map((r) => r.id), 150)) {
    const { data } = await supabase.from("message_recipients").select("fallback_of").in("fallback_of", part);
    for (const r of (data ?? []) as { fallback_of: string }[]) retried.add(r.fallback_of);
  }

  return rows
    .filter((r) => !retried.has(r.id))
    .map((r) => ({
      rowId: r.id,
      personId: r.person_id,
      name: r.name,
      channel: r.channel ?? r.messages.channel,
      contact: r.contact_value,
      reason: r.bounce_type === "hard" ? "Address doesn't exist or doesn't accept mail" : r.bounce_type === "soft" ? "Temporary delivery problem (inbox full or server down)" : (r.error_detail ?? "Couldn't be delivered"),
      messageId: r.messages.id,
      messageTitle: r.messages.subject?.trim() || r.messages.body.slice(0, 60),
      at: r.bounced_at ?? r.sent_at,
    }))
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
}
