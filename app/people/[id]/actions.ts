"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { isValidEmail } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type UpdatePersonState = {
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

export async function updatePerson(
  _prevState: UpdatePersonState,
  formData: FormData
): Promise<UpdatePersonState> {
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();
  const id = (formData.get("person_id") as string | null)?.trim() ?? "";
  const firstName = (formData.get("first_name") as string | null)?.trim() ?? "";
  const lastName = (formData.get("last_name") as string | null)?.trim() ?? "";
  const email = (formData.get("email") as string | null)?.trim() || null;
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const whatsapp = (formData.get("whatsapp") as string | null)?.trim() || null;
  const address = (formData.get("address") as string | null)?.trim() || null;
  const grade = (formData.get("grade") as string | null)?.trim() || null;
  const graduationYearRaw = (formData.get("graduation_year") as string | null)?.trim();
  const graduationYear = graduationYearRaw ? parseInt(graduationYearRaw, 10) : null;
  const organization = (formData.get("organization") as string | null)?.trim() || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;
  const tagIds = formData.getAll("tag_ids") as string[];
  const categories = (formData.getAll("categories") as string[]).filter((c) =>
    VALID_CATEGORIES.includes(c)
  );

  if (!id) {
    return { success: false, error: "Person ID is missing." };
  }
  if (!firstName) {
    return { success: false, error: "First name is required." };
  }
  if (!lastName) {
    return { success: false, error: "Last name is required." };
  }
  if (graduationYear !== null && isNaN(graduationYear)) {
    return { success: false, error: "Graduation year must be a valid number." };
  }
  if (email && !isValidEmail(email)) {
    return { success: false, error: "Enter a valid email address." };
  }
  if (email) {
    const { data: existing } = await supabase
      .from("people")
      .select("id, first_name, last_name")
      .eq("org_id", orgId)
      .eq("email", email)
      .neq("id", id)
      .maybeSingle();
    if (existing) {
      return {
        success: false,
        error: `Another contact already uses this email: ${existing.first_name} ${existing.last_name}.`,
      };
    }
  }

  const { error: updateError } = await supabase
    .from("people")
    .update({
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      whatsapp,
      address,
      grade,
      graduation_year: graduationYear,
      organization,
      notes,
      categories,
    })
    .eq("id", id)
    .eq("org_id", orgId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Replace tags: delete all then re-insert selected. If the re-insert
  // fails, restore the previous tags instead of leaving the contact
  // silently detagged — the old code left a person with zero tags and no
  // way to recover them whenever the second call failed.
  const { data: previousTagRows } = await supabase
    .from("person_tags")
    .select("tag_id")
    .eq("person_id", id);
  const previousTagIds = (previousTagRows ?? []).map((r) => r.tag_id as string);

  const { error: deleteError } = await supabase
    .from("person_tags")
    .delete()
    .eq("person_id", id);

  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  if (tagIds.length > 0) {
    const { error: insertError } = await supabase
      .from("person_tags")
      .insert(tagIds.map((tag_id) => ({ person_id: id, tag_id })));

    if (insertError) {
      if (previousTagIds.length > 0) {
        await supabase
          .from("person_tags")
          .insert(previousTagIds.map((tag_id) => ({ person_id: id, tag_id })));
      }
      return { success: false, error: insertError.message };
    }
  }

  revalidatePath("/");
  revalidatePath(`/people/${id}`);
  revalidatePath("/people");
  return { success: true, error: null };
}

// ─── Relationships ────────────────────────────────────────────────────────────

export type AddRelationshipState = {
  success: boolean;
  error: string | null;
};

const VALID_RELATIONSHIP_TYPES = [
  "Parent",
  "Mother",
  "Father",
  "Grandparent",
  "Student",
  "Sibling",
  "Spouse",
  "Child",
  "Faculty",
];

export async function addRelationship(
  _prevState: AddRelationshipState,
  formData: FormData
): Promise<AddRelationshipState> {
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();
  const personId = (formData.get("person_id") as string | null)?.trim() ?? "";
  const relatedPersonId =
    (formData.get("related_person_id") as string | null)?.trim() ?? "";
  const relationshipType =
    (formData.get("relationship_type") as string | null)?.trim() ?? "";

  if (!personId) {
    return { success: false, error: "Person ID is missing." };
  }
  if (!relatedPersonId) {
    return { success: false, error: "Please select a person." };
  }
  if (!VALID_RELATIONSHIP_TYPES.includes(relationshipType)) {
    return { success: false, error: "Please select a relationship type." };
  }
  if (personId === relatedPersonId) {
    return {
      success: false,
      error: "A person cannot be related to themselves.",
    };
  }

  const { error } = await supabase.from("relationships").insert({
    org_id: orgId,
    person_id: personId,
    related_person_id: relatedPersonId,
    relationship_type: relationshipType,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/people/${personId}`);
  return { success: true, error: null };
}
