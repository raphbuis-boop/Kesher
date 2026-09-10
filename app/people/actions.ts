"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { isValidEmail } from "@/lib/validation";
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
  if (email && !isValidEmail(email)) {
    return { success: false, error: "Enter a valid email address." };
  }

  // Guard against silent duplicates: the CSV import path already dedupes by
  // email within an org, but this manual form previously didn't — two adds
  // with the same email produced two separate contacts.
  if (email) {
    const { data: existing } = await supabase
      .from("people")
      .select("id, first_name, last_name")
      .eq("org_id", orgId)
      .eq("email", email)
      .maybeSingle();
    if (existing) {
      return {
        success: false,
        error: `A contact with this email already exists: ${existing.first_name} ${existing.last_name}.`,
      };
    }
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
      // Compensating rollback — without this, a failed tag insert left a
      // real, untagged contact behind even though the UI reported an error.
      await supabase.from("people").delete().eq("id", newPerson.id);
      return { success: false, error: tagError.message };
    }
  }

  revalidatePath("/");
  revalidatePath("/people");
  return { success: true, error: null };
}
