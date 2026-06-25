"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
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
    if (tagIds.length > 0) {
      // User picked existing tags — link them
      const { error: tagError } = await supabase
        .from("group_tags")
        .insert(tagIds.map((tag_id) => ({ group_id: newGroup.id, tag_id })));
      if (tagError) return { success: false, error: tagError.message };
    } else {
      // No tags chosen — auto-create a tag named after the group so contacts
      // can be added from the audience page without understanding tags.
      const { data: newTag, error: tagError } = await supabase
        .from("tags")
        .insert({ name })
        .select("id")
        .single();
      if (tagError || !newTag) return { success: false, error: "Could not set up audience." };
      await supabase.from("group_tags").insert({ group_id: newGroup.id, tag_id: newTag.id });
    }
  }

  revalidatePath("/groups");
  revalidatePath("/");
  return { success: true, error: null };
}

// ─── Add contacts to a custom audience ───────────────────────────────────────

export async function addContactsToGroup(
  groupId: string,
  personIds: string[]
): Promise<{ success: boolean; error: string | null }> {
  if (personIds.length === 0) return { success: true, error: null };
  const supabase = await createSupabaseServerClient();

  // Resolve the group's tag(s)
  const { data: groupTagRows } = await supabase
    .from("group_tags")
    .select("tag_id")
    .eq("group_id", groupId);

  let tagIds = (groupTagRows ?? []).map((gt: any) => gt.tag_id as string);

  // Edge case: group has no tags yet (e.g. dynamic group re-used) — auto-create one
  if (tagIds.length === 0) {
    const { data: group } = await supabase
      .from("groups")
      .select("name")
      .eq("id", groupId)
      .single();
    if (!group) return { success: false, error: "Audience not found." };

    const { data: newTag, error: tagError } = await supabase
      .from("tags")
      .insert({ name: (group as any).name })
      .select("id")
      .single();
    if (tagError || !newTag) return { success: false, error: "Could not set up audience." };

    await supabase.from("group_tags").insert({ group_id: groupId, tag_id: newTag.id });
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
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createSupabaseServerClient();

  const { data: groupTagRows } = await supabase
    .from("group_tags")
    .select("tag_id")
    .eq("group_id", groupId);

  const tagIds = (groupTagRows ?? []).map((gt: any) => gt.tag_id as string);
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
  return { success: true, error: null };
}
