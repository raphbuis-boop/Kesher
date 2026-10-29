/**
 * Smart audience evaluation. Resolves a saved rule (groups.filter_config —
 * see lib/audienceRules.ts) to the people who match RIGHT NOW, so membership
 * is always current whenever a message is composed or sent.
 *
 * Reads every active person in the org (paged past PostgREST's 1,000-row
 * cap) and applies the rule in memory — fine at school scale, and it lets a
 * rule use any field including custom fields and tags.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { fetchAllRows } from "@/lib/supabase-paging";
import { matchesRule, ruleTagIds, type FilterNode, type RulePerson } from "@/lib/audienceRules";

export type { FilterNode } from "@/lib/audienceRules";

const RULE_COLUMNS = "id, categories, grade, graduation_year, email, phone, whatsapp, custom_fields";

/** People (active only) matching a rule. Org-scoped; works with a user session or the service role. */
export async function resolveFilterPeople(supabase: SupabaseClient, orgId: string, filter: FilterNode): Promise<RulePerson[]> {
  const people = await fetchAllRows<RulePerson>((from, to) =>
    supabase.from("people").select(RULE_COLUMNS).eq("org_id", orgId).eq("status", "active").order("id").range(from, to)
  );

  const tagIds = ruleTagIds(filter);
  let tagsByPerson: Map<string, Set<string>> | undefined;
  if (tagIds.length > 0) {
    tagsByPerson = new Map();
    const rows = await fetchAllRows<{ person_id: string; tag_id: string }>((from, to) =>
      supabase.from("person_tags").select("person_id, tag_id").in("tag_id", tagIds).order("person_id").order("tag_id").range(from, to)
    );
    for (const r of rows) {
      const set = tagsByPerson.get(r.person_id) ?? new Set<string>();
      set.add(r.tag_id);
      tagsByPerson.set(r.person_id, set);
    }
  }
  return people.filter((p) => matchesRule(p, filter, tagsByPerson));
}

export async function resolveFilterIds(supabase: SupabaseClient, orgId: string, filter: FilterNode): Promise<string[]> {
  return (await resolveFilterPeople(supabase, orgId, filter)).map((p) => p.id);
}

/** Session-based convenience wrappers (kept for existing callers). */
export async function resolveAudience(filterConfig: FilterNode, knownOrgId?: string): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  return resolveFilterIds(supabase, knownOrgId ?? (await getOrgId()), filterConfig);
}

export async function countAudience(filterConfig: FilterNode): Promise<number> {
  return (await resolveAudience(filterConfig)).length;
}
