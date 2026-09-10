/**
 * Single source of truth for "who is in this audience."
 *
 * Before this file existed, three call sites (the audiences list page, the
 * audience detail page, and the message-send path in app/messages/actions.ts)
 * each re-implemented "fetch every person in the org, then filter by tag in
 * JS" independently — and none of them handled dynamic (filter_config-based)
 * groups, so a "Dynamic rules" audience matched contacts in the live builder
 * preview but sent to zero people and showed zero members everywhere else.
 *
 * Every consumer of group/system-audience membership should go through
 * getAudienceMembers() so system audiences, tag-based groups, and dynamic
 * groups all resolve the same way everywhere.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAudience, type FilterNode } from "@/lib/resolveAudience";

export type AudienceMember = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  salutation: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  categories: string[] | null;
  grade: string | null;
  graduation_year: number | null;
  person_tags: Array<{ tag_id: string; tags: { id: string; name: string } }>;
};

const MEMBER_COLUMNS =
  "id, first_name, last_name, preferred_name, salutation, email, phone, whatsapp, categories, grade, graduation_year, person_tags ( tag_id, tags ( id, name ) )";

export type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  is_dynamic: boolean;
  filter_config: FilterNode | null;
  group_tags: Array<{ tag_id: string }>;
};

/** Loads a group scoped to the org, or null if it doesn't exist / isn't yours. */
export async function getGroup(
  supabase: SupabaseClient,
  orgId: string,
  groupId: string
): Promise<GroupRow | null> {
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, description, is_dynamic, filter_config, group_tags ( tag_id )")
    .eq("org_id", orgId)
    .eq("id", groupId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as GroupRow;
}

/**
 * Resolves a group's member IDs — via filter_config for dynamic groups, via
 * group_tags → person_tags for tag-based ones. Both paths push the filtering
 * into SQL (no "fetch the whole org and filter in JS").
 */
export async function resolveGroupMemberIds(
  supabase: SupabaseClient,
  orgId: string,
  group: GroupRow
): Promise<string[]> {
  if (group.is_dynamic) {
    if (!group.filter_config) return [];
    return resolveAudience(group.filter_config, orgId);
  }

  const tagIds = group.group_tags.map((gt) => gt.tag_id);
  if (tagIds.length === 0) return [];

  const { data, error } = await supabase
    .from("person_tags")
    .select("person_id")
    .in("tag_id", tagIds);
  if (error || !data) return [];

  return [...new Set(data.map((r) => r.person_id as string))];
}

/** Full member rows for a system (category-based) audience. */
export async function getSystemAudienceMembers(
  supabase: SupabaseClient,
  orgId: string,
  category: string
): Promise<AudienceMember[]> {
  const { data, error } = await supabase
    .from("people")
    .select(MEMBER_COLUMNS)
    .eq("org_id", orgId)
    .contains("categories", [category])
    .order("last_name");
  if (error) throw new Error(`getSystemAudienceMembers(${category}): ${error.message}`);
  return (data ?? []) as unknown as AudienceMember[];
}

/** Full member rows for a custom group — dynamic or tag-based, resolved identically everywhere. */
export async function getGroupMembers(
  supabase: SupabaseClient,
  orgId: string,
  group: GroupRow
): Promise<AudienceMember[]> {
  const ids = await resolveGroupMemberIds(supabase, orgId, group);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("people")
    .select(MEMBER_COLUMNS)
    .eq("org_id", orgId)
    .in("id", ids)
    .order("last_name");
  if (error) throw new Error(`getGroupMembers(${group.id}): ${error.message}`);
  return (data ?? []) as unknown as AudienceMember[];
}
