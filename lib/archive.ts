import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { loadBrandingSettings } from "@/lib/settings";
import { getHebrewDateStyle, type HebrewDateStyle } from "@/lib/hebrewDate";
import { getSchoolTimezone } from "@/lib/schoolTime";
import { renderTemplate } from "@/lib/template";
import { chunk } from "@/lib/supabase-paging";

/**
 * Past messages for a family, behind a signed link (no login): everything the
 * school actually sent to any of the family's adults, each message once even if
 * it went out on two channels or to both parents. A family is the guardian, the
 * other guardians of the same children, and the adults in the same household.
 */

export const ARCHIVE_PAGE_SIZE = 15;

export type ArchiveMessage = {
  id: string;
  title: string;
  /** Body with this guardian's name filled in */
  text: string;
  sentAt: string;
  channels: ("email" | "sms" | "whatsapp")[];
  attachments: string[];
  emergency: boolean;
};

export type ArchiveView = {
  personId: string;
  orgId: string;
  firstName: string;
  schoolName: string;
  logoUrl: string;
  timezone: string;
  hebrewStyle: HebrewDateStyle;
  enabled: boolean;
  total: number;
  page: number;
  messages: ArchiveMessage[];
};

/** The adults whose messages make up this family's archive (always includes the person). */
export async function familyAdultIds(admin: SupabaseClient, orgId: string, personId: string): Promise<string[]> {
  const ids = new Set<string>([personId]);

  const { data: me } = await admin.from("people").select("household_id").eq("org_id", orgId).eq("id", personId).maybeSingle();
  const { data: kidLinks } = await admin.from("guardian_students").select("student_id").eq("org_id", orgId).eq("guardian_id", personId);
  const kids = ((kidLinks ?? []) as { student_id: string }[]).map((l) => l.student_id);
  if (kids.length) {
    for (const part of chunk(kids, 100)) {
      const { data } = await admin.from("guardian_students").select("guardian_id").eq("org_id", orgId).in("student_id", part);
      for (const g of (data ?? []) as { guardian_id: string }[]) ids.add(g.guardian_id);
    }
  }
  if (me?.household_id) {
    const { data } = await admin.from("people").select("id, categories").eq("org_id", orgId).eq("household_id", me.household_id as string).eq("status", "active");
    for (const p of (data ?? []) as { id: string; categories: string[] | null }[]) if (!(p.categories ?? []).includes("student")) ids.add(p.id);
  }
  return [...ids];
}

export async function getArchive(personId: string, page: number, client?: SupabaseClient): Promise<ArchiveView | null> {
  const admin = client ?? createSupabaseAdminClient();
  const { data: person } = await admin
    .from("people")
    .select("id, org_id, first_name, last_name, preferred_name, salutation, email, status")
    .eq("id", personId)
    .maybeSingle();
  if (!person || person.status === "rejected") return null;
  const orgId = person.org_id as string;

  const [branding, timezone, hebrewStyle, { data: flag }] = await Promise.all([
    loadBrandingSettings(admin, orgId),
    getSchoolTimezone(admin, orgId),
    getHebrewDateStyle(admin, orgId),
    admin.from("settings").select("value").eq("org_id", orgId).eq("key", "family_archive").maybeSingle(),
  ]);
  const enabled = flag?.value !== "false";
  const base = { personId, orgId, firstName: person.first_name as string, schoolName: branding.schoolName, logoUrl: branding.logoUrl, timezone, hebrewStyle, enabled, page };
  if (!enabled) return { ...base, total: 0, messages: [] };

  const adults = await familyAdultIds(admin, orgId, personId);
  type Row = { message_id: string; channel: string | null; sent_at: string | null; messages: { id: string; org_id: string; status: string; channel: string; sent_at: string | null; created_at: string } };
  const rows: Row[] = [];
  for (const part of chunk(adults, 50)) {
    for (let from = 0; ; from += 1000) {
      const { data } = await admin
        .from("message_recipients")
        .select("message_id, channel, sent_at, messages!inner(id, org_id, status, channel, sent_at, created_at)")
        .in("person_id", part)
        .in("status", ["sent", "delivered"])
        .eq("messages.org_id", orgId)
        .order("id")
        .range(from, from + 999);
      rows.push(...((data ?? []) as unknown as Row[]));
      if (!data || data.length < 1000) break;
    }
  }

  // One entry per message, newest first
  const byMessage = new Map<string, { at: string; channels: Set<string> }>();
  for (const r of rows) {
    const at = new Date(r.messages.sent_at ?? r.sent_at ?? r.messages.created_at).toISOString();
    const entry = byMessage.get(r.message_id) ?? { at, channels: new Set<string>() };
    entry.channels.add(r.channel ?? (r.messages.channel === "multi" ? "email" : r.messages.channel));
    byMessage.set(r.message_id, entry);
  }
  const ordered = [...byMessage.entries()].sort((a, b) => b[1].at.localeCompare(a[1].at));
  const pageIds = ordered.slice((page - 1) * ARCHIVE_PAGE_SIZE, page * ARCHIVE_PAGE_SIZE);

  const messages: ArchiveMessage[] = [];
  if (pageIds.length) {
    const { data } = await admin
      .from("messages")
      .select("id, subject, body, is_emergency, payload")
      .eq("org_id", orgId)
      .in("id", pageIds.map(([id]) => id));
    const info = new Map(((data ?? []) as { id: string; subject: string | null; body: string; is_emergency: boolean; payload: { attachmentUrls?: string[] } | null }[]).map((m) => [m.id, m]));
    for (const [id, meta] of pageIds) {
      const m = info.get(id);
      if (!m) continue;
      const personCtx = { first_name: person.first_name as string, last_name: person.last_name as string, preferred_name: person.preferred_name as string | null, salutation: person.salutation as string | null, email: person.email as string | null };
      const text = renderTemplate(m.body, personCtx);
      messages.push({
        id,
        title: renderTemplate(m.subject ?? "", personCtx).trim() || text.replace(/\s+/g, " ").slice(0, 70),
        text,
        sentAt: meta.at,
        channels: [...meta.channels].filter((c): c is "email" | "sms" | "whatsapp" => c === "email" || c === "sms" || c === "whatsapp"),
        attachments: (m.payload?.attachmentUrls ?? []).filter((u) => /^https:\/\//.test(u)),
        emergency: !!m.is_emergency,
      });
    }
  }
  return { ...base, total: ordered.length, messages };
}
