import type { SupabaseClient } from "@supabase/supabase-js";
import { getGroup, getGroupMembers, getSystemAudienceMembers } from "@/lib/audienceMembers";
import type { Person } from "./types";

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
