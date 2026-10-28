import type { SupabaseClient } from "@supabase/supabase-js";

/** The nine system audience categories stored in people.categories. */
export const PERSON_CATEGORIES = [
  "parent",
  "student",
  "grandparent",
  "alumni",
  "faculty",
  "staff",
  "board",
  "donor",
  "prospect",
] as const;

export type CategoryCounts = {
  total: number;
  uncategorized: number;
  byCategory: Record<string, number>;
};

/**
 * Contact counts per system category, computed in the database with parallel
 * head-only COUNT queries instead of downloading every person row and
 * counting in JS (which was slow and silently capped at 1,000 rows by
 * PostgREST). Org-scoped like every other people query.
 */
export async function getCategoryCounts(supabase: SupabaseClient, orgId: string): Promise<CategoryCounts> {
  const countPeople = () =>
    supabase.from("people").select("id", { count: "exact", head: true }).eq("org_id", orgId);

  const [total, uncategorized, ...perCategory] = await Promise.all([
    countPeople(),
    countPeople().or("categories.is.null,categories.eq.{}"),
    ...PERSON_CATEGORIES.map((c) => countPeople().contains("categories", [c])),
  ]);

  const byCategory: Record<string, number> = {};
  PERSON_CATEGORIES.forEach((c, i) => {
    byCategory[c] = perCategory[i].count ?? 0;
  });

  return { total: total.count ?? 0, uncategorized: uncategorized.count ?? 0, byCategory };
}
