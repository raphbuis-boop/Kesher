/**
 * Dynamic audience filter engine.
 *
 * Evaluates a JSONB FilterNode tree against the people table and returns
 * matching person IDs. Runs entirely server-side; safe to call from Server
 * Components and Server Actions.
 *
 * Filter schema (stored in groups.filter_config):
 *   { type: "and" | "or", filters: FilterNode[] }
 *   { type: "category", value: string }
 *   { type: "grad_year_eq", value: number }
 *   { type: "grad_year_range", min: number, max: number }
 */

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";

export type FilterNode =
  | { type: "and"; filters: FilterNode[] }
  | { type: "or"; filters: FilterNode[] }
  | { type: "category"; value: string }
  | { type: "grad_year_eq"; value: number }
  | { type: "grad_year_range"; min: number; max: number };

type PersonRow = {
  id: string;
  categories: string[] | null;
  graduation_year: number | null;
};

function matchesNode(person: PersonRow, node: FilterNode): boolean {
  switch (node.type) {
    case "and":
      return node.filters.every((f) => matchesNode(person, f));
    case "or":
      return node.filters.some((f) => matchesNode(person, f));
    case "category":
      return (
        Array.isArray(person.categories) && person.categories.includes(node.value)
      );
    case "grad_year_eq":
      return person.graduation_year === node.value;
    case "grad_year_range":
      return (
        person.graduation_year !== null &&
        person.graduation_year >= node.min &&
        person.graduation_year <= node.max
      );
  }
}

export async function resolveAudience(filterConfig: FilterNode): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();
  const { data } = await supabase
    .from("people")
    .select("id, categories, graduation_year")
    .eq("org_id", orgId);

  const people = (data ?? []) as PersonRow[];
  return people.filter((p) => matchesNode(p, filterConfig)).map((p) => p.id);
}

export async function countAudience(filterConfig: FilterNode): Promise<number> {
  const ids = await resolveAudience(filterConfig);
  return ids.length;
}
