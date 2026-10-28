/**
 * Recipient resolution for a send:
 *
 *   audience(s) → people → students → the parents/guardians who receive
 *   messages → each parent's channel addresses → de-duplicated
 *
 * A family with three kids in the audience gets ONE message per parent (the
 * two parents of separate households each get their own), optionally
 * prefixed "For Moshe (3rd) and Rivka (6th)". Adults in an audience are
 * messaged directly. Each guardian's channel preferences, "emergency only"
 * setting and opt-outs are respected.
 *
 * Pure with respect to the database apart from reads, so previews, the
 * confirm dialog, scheduled sends and webhook fallbacks all use the same
 * rules. Works with a user session or the service role (always org-scoped).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { chunk } from "@/lib/supabase-paging";
import { toE164 } from "@/lib/phone";
import { isValidEmail } from "@/lib/validation";
import { DEFAULT_PREFERENCES, getPreferencesMap, type ContactPreferences } from "@/lib/preferences";
import { getPeopleForAudience } from "./audiences";
import { CHANNELS, type Channel, type Child, type ExcludedReason, type MessageInput, type Person, type Resolution, type ResolvedRecipient } from "./types";

const PERSON_COLUMNS =
  "id, first_name, last_name, preferred_name, salutation, email, phone, whatsapp, grade, graduation_year, categories, custom_fields";

export type ResolveOptions = Pick<
  MessageInput,
  "audienceSlugs" | "channels" | "channelMode" | "isEmergency" | "studentsDirect" | "excludePersonIds" | "onlyPersonIds" | "familyPrefix"
> & {
  /** Channels the school can actually send on (configured + allowed for this message). */
  available: Record<Channel, boolean>;
};

const isStudent = (p: Person) => (p.categories ?? []).includes("student");

/** The address a person is reached at on a channel (null if none / invalid). */
export function addressFor(p: Person, channel: Channel): string | null {
  if (channel === "email") {
    const e = p.email?.trim().toLowerCase();
    return e && isValidEmail(e) ? e : null;
  }
  if (channel === "sms") return toE164(p.phone);
  return toE164(p.whatsapp?.trim() || p.phone);
}

function prefAllows(prefs: ContactPreferences, channel: Channel): boolean {
  if (channel === "email") return prefs.email_enabled;
  if (channel === "sms") return prefs.sms_enabled;
  return prefs.whatsapp_enabled && prefs.whatsapp_opt_in !== false;
}

/** Addresses this school has unsubscribed / STOPped (the existing opt-out store). */
export async function loadSuppressed(supabase: SupabaseClient, orgId: string, values: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  const unique = [...new Set(values.flatMap((v) => (v === v.toLowerCase() ? [v] : [v, v.toLowerCase()])))];
  for (const part of chunk(unique, 120)) {
    const { data, error } = await supabase
      .from("message_recipients")
      .select("contact_value, messages!inner(org_id)")
      .eq("messages.org_id", orgId)
      .eq("status", "opted_out")
      .in("contact_value", part);
    if (error) throw new Error(`Opt-out lookup failed: ${error.message}`);
    for (const row of (data ?? []) as { contact_value: string }[]) out.add(row.contact_value.toLowerCase());
  }
  return out;
}

async function loadPeople(supabase: SupabaseClient, orgId: string, ids: string[]): Promise<Person[]> {
  const rows: Person[] = [];
  for (const part of chunk([...new Set(ids)], 150)) {
    const { data, error } = await supabase.from("people").select(PERSON_COLUMNS).eq("org_id", orgId).eq("status", "active").in("id", part);
    if (error) throw new Error(`Could not load people: ${error.message}`);
    rows.push(...((data ?? []) as Person[]));
  }
  return rows;
}

type Link = { guardian_id: string; student_id: string };

async function loadLinks(supabase: SupabaseClient, orgId: string, column: "student_id" | "guardian_id", ids: string[], onlyReceiving: boolean): Promise<Link[]> {
  const rows: Link[] = [];
  for (const part of chunk([...new Set(ids)], 120)) {
    let q = supabase.from("guardian_students").select("guardian_id, student_id").eq("org_id", orgId).in(column, part);
    if (onlyReceiving) q = q.eq("receives_messages", true);
    const { data, error } = await q;
    if (error) throw new Error(`Could not load family links: ${error.message}`);
    rows.push(...((data ?? []) as Link[]));
  }
  return rows;
}

const toChild = (p: Person): Child => ({ id: p.id, first_name: p.first_name, last_name: p.last_name, grade: p.grade, custom_fields: p.custom_fields });

export async function resolveRecipients(supabase: SupabaseClient, orgId: string, opts: ResolveOptions): Promise<Resolution> {
  const excludedIds = new Set(opts.excludePersonIds);
  const excluded: Record<ExcludedReason, number> = { opted_out: 0, preference: 0, no_address: 0, duplicate_address: 0, emergency_only: 0, whatsapp_unavailable: 0 };
  const unreachable: Resolution["unreachable"] = [];

  // ── 1. Audience members (and which audiences each came through) ──────────
  const members = new Map<string, Person>();
  const via = new Map<string, Set<string>>();
  for (const slug of opts.audienceSlugs) {
    for (const p of await getPeopleForAudience(supabase, orgId, slug)) {
      if (excludedIds.has(p.id)) continue;
      members.set(p.id, p);
      via.set(p.id, (via.get(p.id) ?? new Set()).add(slug));
    }
  }

  // ── 2. Students → their receiving parents; adults directly ───────────────
  const students = [...members.values()].filter(isStudent);
  const adults = [...members.values()].filter((p) => !isStudent(p));
  const links = students.length ? await loadLinks(supabase, orgId, "student_id", students.map((s) => s.id), true) : [];
  const guardianIdsFromStudents = [...new Set(links.map((l) => l.guardian_id))];
  const guardianPeople = new Map((await loadPeople(supabase, orgId, guardianIdsFromStudents)).map((p) => [p.id, p]));

  // guardian id → students (in this audience) they're reached through
  const childrenViaStudents = new Map<string, Child[]>();
  const viaSlugs = new Map<string, Set<string>>();
  const studentsWithParent = new Set<string>();
  for (const l of links) {
    const g = guardianPeople.get(l.guardian_id);
    const s = members.get(l.student_id);
    if (!g || !s) continue;
    studentsWithParent.add(s.id);
    childrenViaStudents.set(g.id, [...(childrenViaStudents.get(g.id) ?? []), toChild(s)]);
    const set = viaSlugs.get(g.id) ?? new Set<string>();
    for (const slug of via.get(s.id) ?? []) set.add(slug);
    viaSlugs.set(g.id, set);
  }

  let studentsWithoutParent = 0;
  const recipientsBase = new Map<string, Person>();
  const addRecipient = (p: Person, slugs?: Set<string>) => {
    if (excludedIds.has(p.id)) return;
    recipientsBase.set(p.id, p);
    if (slugs) viaSlugs.set(p.id, new Set([...(viaSlugs.get(p.id) ?? []), ...slugs]));
  };
  for (const a of adults) addRecipient(a, via.get(a.id));
  for (const g of guardianPeople.values()) addRecipient(g);
  for (const s of students) {
    if (!studentsWithParent.has(s.id)) {
      studentsWithoutParent++;
      // Nobody receives for this student: reach them directly if they have contact info
      if (addressFor(s, "email") || addressFor(s, "sms") || addressFor(s, "whatsapp")) addRecipient(s, via.get(s.id));
    } else if (opts.studentsDirect) {
      addRecipient(s, via.get(s.id));
    }
  }

  // ── 3. Children list for the "For Moshe (3rd)…" line ──────────────────────
  const childrenOf = new Map<string, Child[]>(childrenViaStudents);
  if (opts.familyPrefix) {
    const needAll = [...recipientsBase.keys()].filter((id) => !childrenOf.has(id));
    if (needAll.length) {
      const kidLinks = await loadLinks(supabase, orgId, "guardian_id", needAll, false);
      const kids = new Map((await loadPeople(supabase, orgId, kidLinks.map((l) => l.student_id))).map((p) => [p.id, p]));
      for (const l of kidLinks) {
        const k = kids.get(l.student_id);
        if (k) childrenOf.set(l.guardian_id, [...(childrenOf.get(l.guardian_id) ?? []), toChild(k)]);
      }
    }
  }

  // ── 4. Restrict (resend) ──────────────────────────────────────────────────
  let candidates = [...recipientsBase.values()];
  if (opts.onlyPersonIds) {
    const only = new Set(opts.onlyPersonIds);
    candidates = candidates.filter((p) => only.has(p.id));
  }

  // ── 5. Preferences + opt-outs ─────────────────────────────────────────────
  const prefs = await getPreferencesMap(supabase, orgId, candidates.map((p) => p.id));
  const wanted = opts.channels.filter((c) => CHANNELS.includes(c));
  const addresses = new Map<string, Partial<Record<Channel, string>>>();
  for (const p of candidates) {
    const a: Partial<Record<Channel, string>> = {};
    for (const c of wanted) {
      const addr = addressFor(p, c);
      if (addr) a[c] = addr;
    }
    addresses.set(p.id, a);
  }
  const suppressed = await loadSuppressed(
    supabase,
    orgId,
    [...addresses.values()].flatMap((a) => Object.values(a).filter((x): x is string => !!x))
  );

  const ordered: ResolvedRecipient[] = [];
  const seenAddress = new Map<string, ResolvedRecipient>();
  const reachedPeople = new Set<string>();

  for (const p of candidates) {
    const pref = prefs.get(p.id) ?? DEFAULT_PREFERENCES;
    const addr = addresses.get(p.id) ?? {};
    const reasons: string[] = [];

    // "Emergency only" parents skip everything that isn't an emergency; muted audiences are skipped too
    if (!opts.isEmergency) {
      if (pref.emergency_only) {
        excluded.emergency_only++;
        unreachable.push({ person: p, reason: "Chose emergency messages only" });
        continue;
      }
      const slugs = viaSlugs.get(p.id);
      if (slugs && slugs.size > 0 && pref.muted_group_ids.length > 0 && [...slugs].every((s) => pref.muted_group_ids.includes(s))) {
        excluded.preference++;
        unreachable.push({ person: p, reason: "Muted this audience" });
        continue;
      }
    }

    const usable: Channel[] = [];
    for (const c of wanted) {
      if (!opts.available[c]) continue;
      const a = addr[c];
      if (!a) {
        reasons.push(c === "email" ? "no email" : c === "sms" ? "no phone" : "no WhatsApp/phone");
        continue;
      }
      // Preferences can switch a channel off — emergencies still use every channel they have an address for
      if (!opts.isEmergency && !prefAllows(pref, c)) {
        excluded.preference++;
        reasons.push(`${c} turned off`);
        continue;
      }
      // Hard opt-outs (STOP / unsubscribe) always win, even for emergencies
      if (suppressed.has(a.toLowerCase())) {
        excluded.opted_out++;
        reasons.push(`${c} opted out`);
        continue;
      }
      usable.push(c);
    }

    if (usable.length === 0) {
      if (Object.keys(addr).length === 0) excluded.no_address++;
      unreachable.push({ person: p, reason: reasons.length ? reasons.join(", ") : "No way to reach them on the selected channels" });
      continue;
    }

    // Best channel: preferred, then WhatsApp → SMS → email, with the rest as fallbacks
    let chosen: Channel[] = usable;
    let fallbacks: Channel[] = [];
    if (opts.channelMode === "best") {
      const order = [...(pref.preferred_channel && usable.includes(pref.preferred_channel) ? [pref.preferred_channel] : []), "whatsapp", "sms", "email"] as Channel[];
      const ranked = [...new Set(order)].filter((c) => usable.includes(c));
      chosen = ranked.slice(0, 1);
      fallbacks = ranked.slice(1);
    }

    const children = childrenOf.get(p.id) ?? [];
    for (const c of chosen) {
      const address = addr[c]!;
      const key = `${c}:${address.toLowerCase()}`;
      const existing = seenAddress.get(key);
      if (existing) {
        // Two parents sharing one address (e.g. a family email): one message, both families' children named
        for (const ch of children) if (!existing.children.some((x) => x.id === ch.id)) existing.children.push(ch);
        excluded.duplicate_address++;
        continue;
      }
      const rr: ResolvedRecipient = { person: p, channel: c, address, children: [...children], fallbackChannels: fallbacks };
      seenAddress.set(key, rr);
      ordered.push(rr);
      reachedPeople.add(p.id);
    }
  }

  const perChannel: Record<Channel, number> = { email: 0, sms: 0, whatsapp: 0 };
  for (const r of ordered) perChannel[r.channel]++;

  return { recipients: ordered, people: reachedPeople.size, perChannel, excluded, unreachable, studentsWithoutParent };
}

/** "For Moshe (3rd) and Rivka (6th)" */
export { childrenLabel } from "@/lib/family";
