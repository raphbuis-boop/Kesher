/**
 * Year-end rollover: promote every student one grade, graduate the top grade
 * (archive — never delete, so message history stays), and optionally archive
 * parents who have no student left. The plan is computed from current data
 * on the server for the preview AND again at apply time; a hash ties the two
 * together so you can't apply a plan you didn't see.
 *
 * Class / homeroom style custom fields are NOT touched (they usually change
 * differently per school) — update them in your next import or sync.
 */

import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows, chunk } from "@/lib/supabase-paging";
import { GRADE_ORDER, gradeFromRank, gradeRank } from "@/lib/grades";

export type RolloverPerson = { id: string; name: string };
export type RolloverChange =
  | { id: string; kind: "promote"; from: string; to: string }
  | { id: string; kind: "graduate"; from: string }
  | { id: string; kind: "archive_parent" };

export type RolloverPlan = {
  topGrade: string;
  archiveParents: boolean;
  byGrade: { from: string; to: string; count: number }[];
  /** `raw` is the grade exactly as stored (so undo can restore it). */
  promotions: (RolloverPerson & { from: string; to: string; raw: string })[];
  graduates: (RolloverPerson & { from: string })[];
  parents: RolloverPerson[];
  skipped: (RolloverPerson & { reason: string })[];
  /** Students whose grade comes from a synced list — the next sync may set it back. */
  syncedStudents: number;
  hash: string;
};

type StudentRow = { id: string; first_name: string; last_name: string; grade: string | null; sync_source_id: string | null };

const nameOf = (p: { first_name: string; last_name: string }) => `${p.first_name} ${p.last_name}`.trim() || "(no name)";

/** School year label for today: Jul–Dec 2026 → "2026–27", Jan–Jun 2027 → "2026–27". */
export function schoolYearLabel(now = new Date()): string {
  const y = now.getFullYear();
  const start = now.getMonth() >= 6 ? y : y - 1;
  return `${start}–${String((start + 1) % 100).padStart(2, "0")}`;
}

/** The highest grade among active students — the likely "top grade" (capped to a real grade). */
export function guessTopGrade(grades: (string | null)[]): string {
  const ranks = grades.map(gradeRank).filter((r): r is number => r !== null);
  return ranks.length ? gradeFromRank(Math.max(...ranks)) : "12";
}

export async function computeRolloverPlan(
  supabase: SupabaseClient,
  orgId: string,
  topGrade: string,
  archiveParents: boolean
): Promise<RolloverPlan> {
  const topRank = gradeRank(topGrade);
  if (topRank === null) throw new Error("Pick the last grade at your school.");

  const students = await fetchAllRows<StudentRow>((from, to) =>
    supabase
      .from("people")
      .select("id, first_name, last_name, grade, sync_source_id")
      .eq("org_id", orgId)
      .eq("status", "active")
      .contains("categories", ["student"])
      .order("id")
      .range(from, to)
  );

  const promotions: RolloverPlan["promotions"] = [];
  const graduates: RolloverPlan["graduates"] = [];
  const skipped: RolloverPlan["skipped"] = [];
  const counts = new Map<string, { from: string; to: string; count: number }>();

  for (const s of students) {
    const rank = gradeRank(s.grade);
    if (!s.grade?.trim()) {
      skipped.push({ id: s.id, name: nameOf(s), reason: "No grade on file" });
    } else if (rank === null) {
      skipped.push({ id: s.id, name: nameOf(s), reason: `Grade "${s.grade}" isn't a standard grade` });
    } else if (rank > topRank) {
      skipped.push({ id: s.id, name: nameOf(s), reason: `Above the last grade (${topGrade})` });
    } else if (rank === topRank) {
      graduates.push({ id: s.id, name: nameOf(s), from: gradeFromRank(rank) });
    } else {
      const from = gradeFromRank(rank);
      const to = gradeFromRank(rank + 1);
      promotions.push({ id: s.id, name: nameOf(s), from, to, raw: s.grade ?? from });
      const key = from;
      const c = counts.get(key) ?? { from, to, count: 0 };
      c.count++;
      counts.set(key, c);
    }
  }
  const byGrade = [...counts.values()].sort((a, b) => (gradeRank(a.from) ?? 0) - (gradeRank(b.from) ?? 0));
  if (graduates.length > 0) byGrade.push({ from: gradeFromRank(topRank), to: "Graduates (archived)", count: graduates.length });

  // Parents with nobody left at the school
  let parents: RolloverPerson[] = [];
  if (archiveParents && graduates.length > 0) {
    const graduatingIds = new Set(graduates.map((g) => g.id));
    const links = await fetchAllRows<{ guardian_id: string; student_id: string }>((from, to) =>
      supabase.from("guardian_students").select("guardian_id, student_id").eq("org_id", orgId).order("id").range(from, to)
    );
    const staying = new Set(students.filter((s) => !graduatingIds.has(s.id)).map((s) => s.id));
    const studentsByGuardian = new Map<string, string[]>();
    for (const l of links) studentsByGuardian.set(l.guardian_id, [...(studentsByGuardian.get(l.guardian_id) ?? []), l.student_id]);

    const candidateIds = [...studentsByGuardian.entries()]
      .filter(([, kids]) => kids.some((k) => graduatingIds.has(k)) && !kids.some((k) => staying.has(k)))
      .map(([g]) => g);
    for (const ids of chunk(candidateIds, 150)) {
      const { data } = await supabase
        .from("people")
        .select("id, first_name, last_name, categories")
        .eq("org_id", orgId)
        .eq("status", "active")
        .in("id", ids);
      for (const p of (data ?? []) as { id: string; first_name: string; last_name: string; categories: string[] | null }[]) {
        // Only people who are parents and nothing else (not also faculty, board, donor…)
        const cats = (p.categories ?? []).filter((c) => c !== "parent" && c !== "grandparent");
        if (cats.length === 0) parents.push({ id: p.id, name: nameOf(p) });
      }
    }
    parents = parents.sort((a, b) => a.name.localeCompare(b.name));
  }

  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify([topGrade, archiveParents, promotions.map((p) => [p.id, p.raw]), graduates.map((g) => g.id), parents.map((p) => p.id)]))
    .digest("hex")
    .slice(0, 24);

  return {
    topGrade,
    archiveParents,
    byGrade,
    promotions,
    graduates,
    parents,
    skipped,
    syncedStudents: students.filter((s) => s.sync_source_id).length,
    hash,
  };
}

export function planToChanges(plan: RolloverPlan): RolloverChange[] {
  return [
    ...plan.promotions.map<RolloverChange>((p) => ({ id: p.id, kind: "promote", from: p.raw, to: p.to })),
    ...plan.graduates.map<RolloverChange>((g) => ({ id: g.id, kind: "graduate", from: g.from })),
    ...plan.parents.map<RolloverChange>((p) => ({ id: p.id, kind: "archive_parent" })),
  ];
}

export const ROLLOVER_GRADES = GRADE_ORDER;
