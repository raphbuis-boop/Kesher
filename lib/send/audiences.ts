import type { SupabaseClient } from "@supabase/supabase-js";
import { getGroup, getGroupMembers, getSystemAudienceMembers } from "@/lib/audienceMembers";
import type { Person } from "./types";
import { chunk } from "@/lib/supabase-paging";
import { parsePeopleSlug } from "./peopleSlug";

export const SYSTEM_CATEGORY_MAP: Record<string, string> = {
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

/**
 * Who is in an audience right now — a system audience (by category) or a
 * custom one (hand-picked or smart; smart rules are evaluated here, at send
 * time). Active people only. Works with a user session or the service role.
 */
export async function getPeopleForAudience(supabase: SupabaseClient, orgId: string, slug: string): Promise<Person[]> {
  const picked = parsePeopleSlug(slug);
  if (picked) {
    const rows: Person[] = [];
    for (const part of chunk(picked, 150)) {
      const { data, error } = await supabase
        .from("people")
        .select("id, first_name, last_name, preferred_name, salutation, email, phone, whatsapp, categories, grade, graduation_year, custom_fields")
        .eq("org_id", orgId)
        .eq("status", "active")
        .in("id", part);
      if (error) throw new Error(`Could not load people: ${error.message}`);
      rows.push(...((data ?? []) as unknown as Person[]));
    }
    return rows;
  }
  if (slug in SYSTEM_CATEGORY_MAP) {
    return (await getSystemAudienceMembers(supabase, orgId, SYSTEM_CATEGORY_MAP[slug])) as unknown as Person[];
  }
  const group = await getGroup(supabase, orgId, slug);
  if (!group) {
    console.warn(`[getPeopleForAudience] audience not found — slug=${slug} org=${orgId}`);
    return [];
  }
  return (await getGroupMembers(supabase, orgId, group)) as unknown as Person[];
}
