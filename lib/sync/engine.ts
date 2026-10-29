/**
 * The sync engine — one set of rules for every source (file import, Google
 * Sheet, and later FACTS / Veracross / Blackbaud):
 *
 *   • Records are identified by (sync source, source ID). A record is never
 *     merged with another source record because they share an email/phone.
 *   • The first time a source sees someone who already exists in Kesher
 *     without a source (added by hand or by the old importer), it links to
 *     that contact by email → phone → exact name instead of duplicating them.
 *     The preview shows every such match.
 *   • Only fields the source actually provides are written. Kesher-only data
 *     (contact_preferences) is never touched.
 *   • New people are added directly or held in "Review new contacts",
 *     depending on the org's setting (default: review).
 *   • People missing from 3 consecutive syncs are archived (soft delete);
 *     message history stays. Being present again restores them.
 *
 * Takes a Supabase client so it runs with the user's session (uploads, Sync
 * now) or the service role (nightly cron) — every query is org-scoped.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { chunk, fetchAllRows } from "@/lib/supabase-paging";
import { phoneDigits } from "./mapping";
import type { PersonKind, SyncBatch, SyncKind, SyncPerson } from "./types";

export const ARCHIVE_AFTER_MISSING = 3;

export type NewContactsMode = "review" | "auto";

export type SyncSourceRow = {
  id: string;
  org_id: string;
  kind: SyncKind;
  name: string;
  mapping: Record<string, unknown>;
  config: Record<string, unknown>;
  auto_sync: boolean;
};

export type FieldChange = { field: string; from: string; to: string };

export type PersonDiff = {
  sourceId: string;
  kind: PersonKind;
  name: string;
  action: "new" | "update" | "unchanged" | "restore" | "skip_rejected";
  personId?: string;
  matchedBy?: "source_id" | "email" | "phone" | "name";
  changes?: FieldChange[];
  /** New person that goes to "Review new contacts" instead of straight in. */
  queued?: boolean;
  /** Existing record still waiting for review. */
  pending?: boolean;
};

export type MissingDiff = { personId: string; name: string; sourceId: string; missingCount: number; willArchive: boolean };

export type SyncStats = {
  new: number;
  queued: number;
  updated: number;
  unchanged: number;
  restored: number;
  missing: number;
  archived: number;
  skippedRejected: number;
  problems: number;
  householdsNew: number;
  linksAdded: number;
  linksRemoved: number;
};

export type SyncDiff = {
  people: PersonDiff[];
  missing: MissingDiff[];
  stats: SyncStats;
  /** Set when archiving was skipped because the source looked incomplete. */
  missingSkipped: boolean;
};

const KIND_CATEGORY: Record<PersonKind, string | null> = {
  guardian: "parent",
  student: "student",
  faculty: "faculty",
  staff: "staff",
  other: null,
};

type ExistingPerson = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  grade: string | null;
  graduation_year: number | null;
  categories: string[] | null;
  custom_fields: Record<string, unknown> | null;
  household_id: string | null;
  source_id: string | null;
  sync_source_id: string | null;
  status: "active" | "pending" | "archived" | "rejected";
  missing_sync_count: number;
};

const PERSON_COLS =
  "id, first_name, last_name, email, phone, whatsapp, grade, graduation_year, categories, custom_fields, household_id, source_id, sync_source_id, status, missing_sync_count";

type ExistingHousehold = { id: string; name: string; address: string | null; source_id: string | null; sync_source_id: string | null };

type Snapshot = {
  sourcePeople: ExistingPerson[];
  claimable: ExistingPerson[];
  households: ExistingHousehold[];
  /** Every family link in the org (synced and hand-made). */
  links: { id: string; guardian_id: string; student_id: string; sync_source_id: string | null }[];
};

async function loadSnapshot(supabase: SupabaseClient, orgId: string, sourceId: string): Promise<Snapshot> {
  const [sourcePeople, claimable, households, links] = await Promise.all([
    fetchAllRows<ExistingPerson>((from, to) =>
      supabase.from("people").select(PERSON_COLS).eq("org_id", orgId).eq("sync_source_id", sourceId).order("id").range(from, to)
    ),
    fetchAllRows<ExistingPerson>((from, to) =>
      supabase
        .from("people")
        .select(PERSON_COLS)
        .eq("org_id", orgId)
        .is("sync_source_id", null)
        .eq("status", "active")
        .order("id")
        .range(from, to)
    ),
    fetchAllRows<ExistingHousehold>((from, to) =>
      supabase
        .from("households")
        .select("id, name, address, source_id, sync_source_id")
        .eq("org_id", orgId)
        .or(`sync_source_id.eq.${sourceId},sync_source_id.is.null`)
        .order("id")
        .range(from, to)
    ),
    fetchAllRows<Snapshot["links"][number]>((from, to) =>
      supabase
        .from("guardian_students")
        .select("id, guardian_id, student_id, sync_source_id")
        .eq("org_id", orgId)
        .order("id")
        .range(from, to)
    ),
  ]);
  return { sourcePeople, claimable, households, links };
}

const fullName = (first: string, last: string) => `${first} ${last}`.trim();
const lc = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** Field-by-field changes the incoming record would make to an existing one. */
function personChanges(e: ExistingPerson, p: SyncPerson, householdName: (id: string | null) => string, newHouseholdId: string | null): FieldChange[] {
  const out: FieldChange[] = [];
  const push = (field: string, from: unknown, to: unknown) => out.push({ field, from: str(from), to: str(to) });

  if (p.firstName && p.firstName !== e.first_name) push("First name", e.first_name, p.firstName);
  if (p.lastName && p.lastName !== e.last_name) push("Last name", e.last_name, p.lastName);
  if (p.provided.includes("email") && lc(p.email) !== lc(e.email)) push("Email", e.email, p.email);
  if (p.provided.includes("phone") && phoneDigits(p.phone) !== phoneDigits(e.phone)) push("Phone", e.phone, p.phone);
  if (p.provided.includes("whatsapp") && phoneDigits(p.whatsapp) !== phoneDigits(e.whatsapp)) push("WhatsApp", e.whatsapp, p.whatsapp);
  if (p.provided.includes("grade") && p.grade !== null && str(p.grade) !== str(e.grade)) push("Grade", e.grade, p.grade);
  if (p.provided.includes("graduation_year") && p.graduationYear !== null && p.graduationYear !== e.graduation_year) {
    push("Graduation year", e.graduation_year, p.graduationYear);
  }
  const cat = KIND_CATEGORY[p.kind];
  if (cat && !(e.categories ?? []).includes(cat)) push("Audience", (e.categories ?? []).join(", "), `+ ${cat}`);
  for (const [k, v] of Object.entries(p.customFields)) {
    if (str(e.custom_fields?.[k]).trim() !== v) push(k, e.custom_fields?.[k], v);
  }
  if (newHouseholdId !== undefined && p.householdSourceId && newHouseholdId !== e.household_id) {
    push("Family", householdName(e.household_id), householdName(newHouseholdId) || "(new family)");
  }
  return out;
}

/**
 * Compares a batch with the database. Read-only: the preview shows this to
 * the admin, and applySync() recomputes it right before writing.
 */
export async function computeDiff(
  supabase: SupabaseClient,
  orgId: string,
  sourceId: string,
  batch: SyncBatch,
  mode: NewContactsMode,
  snapshot?: Snapshot
): Promise<{ diff: SyncDiff; snapshot: Snapshot; plan: Plan }> {
  const snap = snapshot ?? (await loadSnapshot(supabase, orgId, sourceId));

  // ── households ──
  const hhBySource = new Map(snap.households.filter((h) => h.sync_source_id === sourceId && h.source_id).map((h) => [h.source_id!, h]));
  const hhById = new Map(snap.households.map((h) => [h.id, h]));
  const householdName = (id: string | null) => (id ? hhById.get(id)?.name ?? "" : "");

  // ── people matching ──
  const bySource = new Map(snap.sourcePeople.filter((p) => p.source_id).map((p) => [p.source_id!, p]));
  const claimByEmail = new Map<string, ExistingPerson[]>();
  const claimByPhone = new Map<string, ExistingPerson[]>();
  const claimByName = new Map<string, ExistingPerson[]>();
  const index = (m: Map<string, ExistingPerson[]>, k: string, p: ExistingPerson) => {
    if (!k) return;
    const l = m.get(k) ?? [];
    l.push(p);
    m.set(k, l);
  };
  for (const c of snap.claimable) {
    index(claimByEmail, lc(c.email), c);
    const d = phoneDigits(c.phone);
    if (d.length >= 7) index(claimByPhone, d, c);
    index(claimByName, lc(fullName(c.first_name, c.last_name)), c);
  }
  const claimed = new Set<string>();
  const takeClaim = (list: ExistingPerson[] | undefined, kind: PersonKind) => {
    const cat = KIND_CATEGORY[kind];
    const candidates = (list ?? []).filter((c) => !claimed.has(c.id));
    const best = candidates.find((c) => cat && (c.categories ?? []).includes(cat)) ?? candidates[0];
    if (best) claimed.add(best.id);
    return best;
  };

  // Household each incoming household maps to (existing id, or null = create)
  const householdPlan = new Map<string, { id: string | null; name: string; address: string | null; changed: boolean; claim: boolean }>();
  for (const h of batch.households) {
    const e = hhBySource.get(h.sourceId);
    const nameChanged = !!e && !!h.name && h.name !== e.name;
    const addressChanged = !!e && h.address !== null && h.address !== e.address;
    householdPlan.set(h.sourceId, {
      id: e?.id ?? null,
      name: h.name || e?.name || "",
      address: h.address ?? e?.address ?? null,
      changed: nameChanged || addressChanged,
      claim: false,
    });
  }

  const people: PersonDiff[] = [];
  const planPeople: PlannedPerson[] = [];
  const seenSource = new Set<string>();

  for (const p of batch.people) {
    seenSource.add(p.sourceId);
    const name = fullName(p.firstName, p.lastName) || "(no name)";
    let e = bySource.get(p.sourceId);
    let matchedBy: PersonDiff["matchedBy"] = e ? "source_id" : undefined;

    if (!e) {
      const viaEmail = p.email ? takeClaim(claimByEmail.get(lc(p.email)), p.kind) : undefined;
      const d = phoneDigits(p.phone);
      const viaPhone = !viaEmail && d.length >= 7 ? takeClaim(claimByPhone.get(d), p.kind) : undefined;
      const viaName = !viaEmail && !viaPhone ? takeClaim(claimByName.get(lc(fullName(p.firstName, p.lastName))), p.kind) : undefined;
      e = viaEmail ?? viaPhone ?? viaName;
      matchedBy = viaEmail ? "email" : viaPhone ? "phone" : viaName ? "name" : undefined;
      // A claimed contact's unsourced household becomes this family's household
      if (e?.household_id && p.householdSourceId) {
        const hp = householdPlan.get(p.householdSourceId);
        const existingHh = hhById.get(e.household_id);
        if (hp && !hp.id && existingHh && !existingHh.sync_source_id) {
          hp.id = existingHh.id;
          hp.claim = true;
          hp.changed = true;
        }
      }
    }

    const targetHousehold = p.householdSourceId ? householdPlan.get(p.householdSourceId)?.id ?? null : undefined;

    if (!e) {
      people.push({ sourceId: p.sourceId, kind: p.kind, name, action: "new", queued: mode === "review" });
      planPeople.push({ incoming: p, existing: null, action: "new", status: mode === "review" ? "pending" : "active" });
      continue;
    }

    if (e.status === "rejected") {
      people.push({ sourceId: p.sourceId, kind: p.kind, name, action: "skip_rejected", personId: e.id });
      continue;
    }

    const changes = personChanges(e, p, householdName, targetHousehold === undefined ? null : targetHousehold);
    const action: PersonDiff["action"] = e.status === "archived" ? "restore" : changes.length > 0 || matchedBy !== "source_id" ? "update" : "unchanged";
    people.push({
      sourceId: p.sourceId,
      kind: p.kind,
      name,
      action,
      personId: e.id,
      matchedBy,
      changes,
      pending: e.status === "pending",
    });
    planPeople.push({ incoming: p, existing: e, action, status: e.status === "archived" ? "active" : e.status });
  }

  // ── missing from this run ──
  const activeInSource = snap.sourcePeople.filter((e) => e.status === "active");
  const missingPeople = activeInSource.filter((e) => e.source_id && !seenSource.has(e.source_id));
  // Safety: a source that suddenly lost most of its rows is more likely a
  // broken export than half the school leaving — don't count those as missing.
  const missingSkipped = activeInSource.length >= 10 && missingPeople.length > activeInSource.length / 2;
  const missing: MissingDiff[] = missingSkipped
    ? []
    : missingPeople.map((e) => {
        const n = e.missing_sync_count + 1;
        return {
          personId: e.id,
          name: fullName(e.first_name, e.last_name),
          sourceId: e.source_id!,
          missingCount: n,
          willArchive: n >= ARCHIVE_AFTER_MISSING,
        };
      });

  // ── links ──
  const personIdBySource = new Map<string, string>();
  for (const pp of planPeople) if (pp.existing) personIdBySource.set(pp.incoming.sourceId, pp.existing.id);
  const incomingPairs = new Set<string>();
  let linksAdded = 0;
  const existingPairs = new Set(snap.links.map((l) => `${l.guardian_id}→${l.student_id}`));
  for (const l of batch.links) {
    const g = personIdBySource.get(l.guardianSourceId);
    const s = personIdBySource.get(l.studentSourceId);
    if (g && s) {
      incomingPairs.add(`${g}→${s}`);
      if (!existingPairs.has(`${g}→${s}`)) linksAdded++;
    } else linksAdded++;
  }
  const linksRemoved = snap.links.filter(
    (l) => l.sync_source_id === sourceId && !incomingPairs.has(`${l.guardian_id}→${l.student_id}`)
  ).length;

  const count = (a: PersonDiff["action"]) => people.filter((p) => p.action === a).length;
  const stats: SyncStats = {
    new: count("new"),
    queued: people.filter((p) => p.action === "new" && p.queued).length,
    updated: count("update"),
    unchanged: count("unchanged"),
    restored: count("restore"),
    missing: missing.length,
    archived: missing.filter((m) => m.willArchive).length,
    skippedRejected: count("skip_rejected"),
    problems: batch.problems.length,
    householdsNew: [...householdPlan.values()].filter((h) => !h.id).length,
    linksAdded,
    linksRemoved,
  };

  return {
    diff: { people, missing, stats, missingSkipped },
    snapshot: snap,
    plan: { people: planPeople, households: householdPlan, missing },
  };
}

type PlannedPerson = {
  incoming: SyncPerson;
  existing: ExistingPerson | null;
  action: PersonDiff["action"];
  status: ExistingPerson["status"];
};

type Plan = {
  people: PlannedPerson[];
  households: Map<string, { id: string | null; name: string; address: string | null; changed: boolean; claim: boolean }>;
  missing: MissingDiff[];
};

/** The row written to people for an incoming record (merging into the existing row when there is one). */
function personRow(
  orgId: string,
  source: SyncSourceRow,
  pp: PlannedPerson,
  householdId: string | null | undefined,
  now: string
) {
  const p = pp.incoming;
  const e = pp.existing;
  const cat = KIND_CATEGORY[p.kind];
  const categories = [...new Set([...(e?.categories ?? []), ...(cat ? [cat] : [])])];
  const provided = (f: SyncPerson["provided"][number]) => p.provided.includes(f);
  return {
    ...(e ? { id: e.id } : {}),
    org_id: orgId,
    first_name: p.firstName || e?.first_name || "",
    last_name: p.lastName || e?.last_name || "",
    email: provided("email") ? p.email : e?.email ?? null,
    phone: provided("phone") ? p.phone : e?.phone ?? null,
    whatsapp: provided("whatsapp") ? p.whatsapp : e?.whatsapp ?? null,
    grade: provided("grade") && p.grade !== null ? p.grade : e?.grade ?? null,
    graduation_year: provided("graduation_year") && p.graduationYear !== null ? p.graduationYear : e?.graduation_year ?? null,
    categories,
    custom_fields: { ...(e?.custom_fields ?? {}), ...p.customFields },
    household_id: householdId === undefined ? e?.household_id ?? null : householdId,
    source_system: source.kind,
    source_id: p.sourceId,
    sync_source_id: source.id,
    status: pp.status,
    missing_sync_count: 0,
    last_synced_at: now,
    archived_at: null,
    updated_at: now,
  };
}

/** Inserts rows in chunks; if a chunk fails (e.g. a unique email index), retries row by row. */
type Row = Record<string, unknown>;

async function insertResilient(
  supabase: SupabaseClient,
  table: string,
  rows: Row[],
  select: string,
  label: (r: Row) => string,
  problems: string[]
): Promise<Row[]> {
  const out: Row[] = [];
  for (const part of chunk(rows, 300)) {
    const { data, error } = await supabase.from(table).insert(part).select(select);
    if (!error) {
      out.push(...((data ?? []) as unknown as Row[]));
      continue;
    }
    for (const row of part) {
      const res = await supabase.from(table).insert(row).select(select).single();
      if (res.error) problems.push(`${label(row)}: ${res.error.message}`);
      else out.push(res.data as unknown as Row);
    }
  }
  return out;
}

export type ApplyResult = { stats: SyncStats; diff: SyncDiff; problems: string[] };

/**
 * Applies a batch for a source: recomputes the diff against the current
 * database (a preview may be stale), then writes households, people,
 * archives and links. Idempotent — running the same batch twice changes
 * nothing the second time.
 */
export async function applySync(
  supabase: SupabaseClient,
  orgId: string,
  source: SyncSourceRow,
  batch: SyncBatch,
  mode: NewContactsMode
): Promise<ApplyResult> {
  const { diff, plan, snapshot } = await computeDiff(supabase, orgId, source.id, batch, mode);
  const now = new Date().toISOString();
  const problems: string[] = [];

  // ── households ──
  const householdIdBySource = new Map<string, string>();
  const newHouseholds: { sourceId: string; name: string; address: string | null }[] = [];
  for (const [sourceId, h] of plan.households) {
    if (h.id) {
      householdIdBySource.set(sourceId, h.id);
      if (h.changed) {
        const { error } = await supabase
          .from("households")
          .update({
            name: h.name,
            address: h.address,
            source_system: source.kind,
            source_id: sourceId,
            sync_source_id: source.id,
            last_synced_at: now,
            missing_sync_count: 0,
            status: "active",
            updated_at: now,
          })
          .eq("org_id", orgId)
          .eq("id", h.id);
        if (error) problems.push(`Family ${h.name}: ${error.message}`);
      }
    } else newHouseholds.push({ sourceId, name: h.name, address: h.address });
  }
  const insertedHh = await insertResilient(
    supabase,
    "households",
    newHouseholds.map((h) => ({
      org_id: orgId,
      name: h.name,
      address: h.address,
      source_system: source.kind,
      source_id: h.sourceId,
      sync_source_id: source.id,
      last_synced_at: now,
    })),
    "id, source_id",
    (r) => `Family ${String(r.name)}`,
    problems
  );
  for (const r of insertedHh) householdIdBySource.set(r.source_id as string, r.id as string);
  const hhFor = (p: SyncPerson) => (p.householdSourceId ? householdIdBySource.get(p.householdSourceId) ?? null : undefined);

  // ── people: changed rows (full-row upsert by id) ──
  const changedRows = plan.people
    .filter((pp) => pp.existing && (pp.action === "update" || pp.action === "restore"))
    .map((pp) => personRow(orgId, source, pp, hhFor(pp.incoming), now));
  for (const part of chunk(changedRows, 300)) {
    const { error } = await supabase.from("people").upsert(part, { onConflict: "id" });
    if (error) {
      for (const row of part) {
        const { error: rowErr } = await supabase.from("people").upsert(row, { onConflict: "id" });
        if (rowErr) problems.push(`${row.first_name} ${row.last_name}: ${rowErr.message}`);
      }
    }
  }

  // ── people: unchanged rows only need their sync bookkeeping reset ──
  const unchangedIds = plan.people.filter((pp) => pp.existing && pp.action === "unchanged").map((pp) => pp.existing!.id);
  for (const ids of chunk(unchangedIds, 300)) {
    const { error } = await supabase
      .from("people")
      .update({ missing_sync_count: 0, last_synced_at: now })
      .eq("org_id", orgId)
      .in("id", ids);
    if (error) problems.push(`Updating sync status: ${error.message}`);
  }

  // ── people: new ──
  const newRows = plan.people.filter((pp) => !pp.existing).map((pp) => personRow(orgId, source, pp, hhFor(pp.incoming) ?? null, now));
  const inserted = await insertResilient(
    supabase,
    "people",
    newRows,
    "id, source_id",
    (r) => `${String(r.first_name)} ${String(r.last_name)}`,
    problems
  );

  // ── missing / archive ──
  const byCount = new Map<number, string[]>();
  for (const m of plan.missing) {
    if (m.willArchive) continue;
    byCount.set(m.missingCount, [...(byCount.get(m.missingCount) ?? []), m.personId]);
  }
  for (const [n, ids] of byCount) {
    for (const part of chunk(ids, 300)) {
      await supabase.from("people").update({ missing_sync_count: n }).eq("org_id", orgId).in("id", part);
    }
  }
  const archiveIds = plan.missing.filter((m) => m.willArchive).map((m) => m.personId);
  for (const part of chunk(archiveIds, 300)) {
    const { error } = await supabase
      .from("people")
      .update({ status: "archived", archived_at: now, missing_sync_count: ARCHIVE_AFTER_MISSING, updated_at: now })
      .eq("org_id", orgId)
      .in("id", part);
    if (error) problems.push(`Archiving: ${error.message}`);
  }

  // ── links ──
  const idBySource = new Map<string, string>();
  for (const pp of plan.people) if (pp.existing) idBySource.set(pp.incoming.sourceId, pp.existing.id);
  for (const r of inserted) idBySource.set(r.source_id as string, r.id as string);

  const linkRows = batch.links
    .map((l) => ({ g: idBySource.get(l.guardianSourceId), s: idBySource.get(l.studentSourceId), l }))
    .filter((x): x is { g: string; s: string; l: (typeof batch.links)[number] } => !!x.g && !!x.s && x.g !== x.s)
    .map(({ g, s, l }) => ({
      org_id: orgId,
      guardian_id: g,
      student_id: s,
      relationship: l.relationship,
      custodial: l.custodial,
      receives_messages: l.receivesMessages,
      source_system: source.kind,
      sync_source_id: source.id,
    }));
  // Existing pairs keep their flags (a school may have turned off messages for
  // one parent) — only missing links are inserted.
  for (const part of chunk(linkRows, 300)) {
    const { error } = await supabase
      .from("guardian_students")
      .upsert(part, { onConflict: "guardian_id,student_id", ignoreDuplicates: true });
    if (error) problems.push(`Family links: ${error.message}`);
  }
  const keep = new Set(linkRows.map((r) => `${r.guardian_id}→${r.student_id}`));
  // Hand-made links the source now also has become synced (so the source can
  // remove them later); synced links the source no longer has are removed.
  const adopt = snapshot.links
    .filter((l) => !l.sync_source_id && keep.has(`${l.guardian_id}→${l.student_id}`))
    .map((l) => l.id);
  for (const part of chunk(adopt, 300)) {
    await supabase
      .from("guardian_students")
      .update({ sync_source_id: source.id, source_system: source.kind })
      .eq("org_id", orgId)
      .in("id", part);
  }
  const stale = snapshot.links
    .filter((l) => l.sync_source_id === source.id && !keep.has(`${l.guardian_id}→${l.student_id}`))
    .map((l) => l.id);
  for (const part of chunk(stale, 300)) {
    await supabase.from("guardian_students").delete().eq("org_id", orgId).in("id", part);
  }

  return { stats: diff.stats, diff, problems };
}

/** The org's "New contacts" setting: review queue (default) or add automatically. */
export async function getNewContactsMode(supabase: SupabaseClient, orgId: string): Promise<NewContactsMode> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("org_id", orgId)
    .eq("key", "new_contacts_mode")
    .maybeSingle();
  return data?.value === "auto" ? "auto" : "review";
}

/** Shrinks a diff for storage in sync_runs (keeps every change, caps unchanged rows). */
export function compactDiff(diff: SyncDiff): SyncDiff {
  const unchanged = diff.people.filter((p) => p.action === "unchanged").slice(0, 200);
  return { ...diff, people: [...diff.people.filter((p) => p.action !== "unchanged"), ...unchanged] };
}
