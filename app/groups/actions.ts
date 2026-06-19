"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export type AddGroupState = {
  success: boolean;
  error: string | null;
};

export async function addGroup(
  _prevState: AddGroupState,
  formData: FormData
): Promise<AddGroupState> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() || null;
  const tagIds = formData.getAll("tag_ids") as string[];

  if (!name) {
    return { success: false, error: "Group name is required." };
  }

  const { data: newGroup, error } = await supabase
    .from("groups")
    .insert({ name, description })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  if (tagIds.length > 0) {
    const { error: tagError } = await supabase
      .from("group_tags")
      .insert(tagIds.map((tag_id) => ({ group_id: newGroup.id, tag_id })));

    if (tagError) {
      return { success: false, error: tagError.message };
    }
  }

  revalidatePath("/groups");
  return { success: true, error: null };
}
