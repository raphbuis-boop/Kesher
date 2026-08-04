"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { revalidatePath } from "next/cache";

export type AddPersonState = {
  success: boolean;
  error: string | null;
};

const VALID_CATEGORIES = [
  "parent",
  "student",
  "grandparent",
  "alumni",
  "faculty",
  "staff",
  "board",
  "donor",
  "prospect",
];

export async function addPerson(
  _prevState: AddPersonState,
  formData: FormData
): Promise<AddPersonState> {
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();
  const firstName = (formData.get("first_name") as string | null)?.trim() ?? "";
  const lastName = (formData.get("last_name") as string | null)?.trim() ?? "";
  const email = (formData.get("email") as string | null)?.trim() || null;
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const grade = (formData.get("grade") as string | null)?.trim() || null;
  const tagIds = formData.getAll("tag_ids") as string[];
  const categories = (formData.getAll("categories") as string[]).filter((c) =>
    VALID_CATEGORIES.includes(c)
  );

  if (!firstName) {
    return { success: false, error: "First name is required." };
  }
  if (!lastName) {
    return { success: false, error: "Last name is required." };
  }

  const { data: newPerson, error } = await supabase
    .from("people")
    .insert({ org_id: orgId, first_name: firstName, last_name: lastName, email, phone, grade, categories })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  if (tagIds.length > 0) {
    const { error: tagError } = await supabase
      .from("person_tags")
      .insert(tagIds.map((tag_id) => ({ person_id: newPerson.id, tag_id })));

    if (tagError) {
      return { success: false, error: tagError.message };
    }
  }

  revalidatePath("/");
  revalidatePath("/people");
  return { success: true, error: null };
}
