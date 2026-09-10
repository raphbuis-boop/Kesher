"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { revalidatePath } from "next/cache";
import type { FilterNode } from "@/lib/resolveAudience";

export type AddGroupState = {
  success: boolean;
  error: string | null;
};

export async function addGroup(
  _prevState: AddGroupState,
  formData: FormData
): Promise<AddGroupState> {
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() || null;
  const tagIds = formData.getAll("tag_ids") as string[];
  const filterConfigRaw = formData.get("filter_config") as string | null;
  const isDynamic = filterConfigRaw !== null && filterConfigRaw !== "";

  if (!name) {
    return { success: false, error: "Group name is required." };
  }

  let filterConfig: FilterNode | null = null;
  if (isDynamic && filterConfigRaw) {
    try {
      filterConfig = JSON.parse(filterConfigRaw) as FilterNode;
    } catch {
      return { success: false, error: "Invalid filter configuration." };
    }
  }

  const { data: newGroup, error } = await supabase
    .from("groups")
    .insert({
      org_id: orgId,
      name,
      description,
      is_dynamic: isDynamic,
      filter_config: filterConfig,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  if (!isDynamic) {
    const setupError = await attachTagsToNewGroup(supabase, orgId, newGroup.id, name, tagIds);
    if (setupError) {
      // Compensating rollback — otherwise a failed tag setup left a
      // permanently-empty group behind despite the UI reporting an error.
      await supabase.from("groups").delete().eq("id", newGroup.id);
      return { success: false, error: setupError };
    }
  }

  revalidatePath("/audiences");
  revalidatePath("/groups");
  revalidatePath("/");
  return { success: true, error: null };
}

/** Friendlier message for the known "tag name already taken" collision (see migrate_tags_org_scoped_unique.sql). */
function describeTagError(error: { code?: string; message: string }, name: string): string {
  if (error.code === "23505") {
    return `A tag named "${name}" already exists. Rename the audience, or add contacts to the existing tag instead.`;
  }
  return error.message;
}

/** Links tags to a freshly-created group — reused by addGroup's auto-tag path. */
async function attachTagsToNewGroup(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  orgId: string,
  groupId: string,
  fallbackTagName: string,
  tagIds: string[]
): Promise<string | null> {
  if (tagIds.length > 0) {
    const { error } = await supabase
      .from("group_tags")
      .insert(tagIds.map((tag_id) => ({ group_id: groupId, tag_id })));
    return error ? error.message : null;
  }

  // No tags chosen — auto-create a tag named after the group so contacts
  // can be added from the audience page without understanding tags.
  const { data: newTag, error: tagError } = await supabase
    .from("tags")
    .insert({ org_id: orgId, name: fallbackTagName })
    .select("id")
    .single();
  if (tagError || !newTag) {
    return tagError ? describeTagError(tagError, fallbackTagName) : "Could not set up audience.";
  }

  const { error: linkError } = await supabase
    .from("group_tags")
    .insert({ group_id: groupId, tag_id: newTag.id });
  if (linkError) {
    await supabase.from("tags").delete().eq("id", newTag.id);
    return linkError.message;
  }
  return null;
}

// ─── Add contacts to a custom audience ───────────────────────────────────────

export async function addContactsToGroup(
  groupId: string,
  personIds: string[]
): Promise<{ success: boolean; error: string | null }> {
  if (personIds.length === 0) return { success: true, error: null };
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();

  // Look up the group scoped to this org — never trust a bare groupId from
  // the client. Also guards against manually adding contacts to a dynamic
  // group, whose membership is meant to come from its rule, not hand-picks.
  const { data: group } = await supabase
    .from("groups")
    .select("id, name, is_dynamic, group_tags ( tag_id )")
    .eq("org_id", orgId)
    .eq("id", groupId)
    .maybeSingle();
  if (!group) return { success: false, error: "Audience not found." };
  if (group.is_dynamic) {
    return { success: false, error: "This is a dynamic audience — its membership is computed automatically and can't be edited by hand." };
  }

  let tagIds = (group.group_tags ?? []).map((gt: any) => gt.tag_id as string);

  // Edge case: group has no tags yet — auto-create one
  if (tagIds.length === 0) {
    const { data: newTag, error: tagError } = await supabase
      .from("tags")
      .insert({ org_id: orgId, name: group.name })
      .select("id")
      .single();
    if (tagError || !newTag) {
      return { success: false, error: tagError ? describeTagError(tagError, group.name) : "Could not set up audience." };
    }

    const { error: linkError } = await supabase.from("group_tags").insert({ group_id: groupId, tag_id: newTag.id });
    if (linkError) {
      await supabase.from("tags").delete().eq("id", newTag.id);
      return { success: false, error: linkError.message };
    }
    tagIds = [newTag.id];
  }

  // Fetch existing person_tags to skip duplicates
  const { data: existing } = await supabase
    .from("person_tags")
    .select("person_id, tag_id")
    .in("person_id", personIds)
    .in("tag_id", tagIds);

  const existingSet = new Set(
    (existing ?? []).map((r: any) => `${r.person_id}:${r.tag_id}`)
  );

  const toInsert: { person_id: string; tag_id: string }[] = [];
  for (const pid of personIds) {
    for (const tid of tagIds) {
      if (!existingSet.has(`${pid}:${tid}`)) {
        toInsert.push({ person_id: pid, tag_id: tid });
      }
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("person_tags").insert(toInsert);
    if (error) return { success: false, error: "Failed to add contacts." };
  }

  revalidatePath(`/audiences/${groupId}`);
  revalidatePath("/groups");
  revalidatePath("/");
  return { success: true, error: null };
}

// ─── Remove a contact from a custom audience ──────────────────────────────────

export async function removeContactFromGroup(
  groupId: string,
  personId: string,
  _formData: FormData
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  // Every other action in this file (and the rest of the app) explicitly
  // scopes by org_id as defense-in-depth on top of RLS — this one didn't.
  const orgId = await getOrgId();

  const { data: group } = await supabase
    .from("groups")
    .select("id, group_tags ( tag_id )")
    .eq("org_id", orgId)
    .eq("id", groupId)
    .maybeSingle();
  if (!group) return;

  const tagIds = (group.group_tags ?? []).map((gt: any) => gt.tag_id as string);
  if (tagIds.length > 0) {
    await supabase
      .from("person_tags")
      .delete()
      .eq("person_id", personId)
      .in("tag_id", tagIds);
  }

  revalidatePath(`/audiences/${groupId}`);
  revalidatePath("/groups");
  revalidatePath("/");
}
