"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { RELATIONSHIPS } from "@/lib/family";
import { getCustomFieldDefs } from "@/lib/customFields";
import { LANGUAGES } from "@/lib/preferences";

export type FamilyResult = { ok: true } | { ok: false; error: string };

/** Both people must exist in the caller's org — never trust ids from the client. */
async function assertSameOrg(ids: string[]) {
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();
  const { data } = await supabase.from("people").select("id").eq("org_id", orgId).in("id", ids);
  if ((data ?? []).length !== new Set(ids).size) throw new Error("Contact not found.");
  return { supabase, orgId };
}

function done(personIds: string[]): FamilyResult {
  for (const id of personIds) revalidatePath(`/people/${id}`);
  return { ok: true };
}

/** Links a guardian to a student (either direction from the person page). */
export async function linkFamilyMember(
  guardianId: string,
  studentId: string,
  relationship: string
): Promise<FamilyResult> {
  if (guardianId === studentId) return { ok: false, error: "A person can't be their own guardian." };
  if (!(RELATIONSHIPS as readonly string[]).includes(relationship)) return { ok: false, error: "Pick a relationship." };
  try {
    const { supabase, orgId } = await assertSameOrg([guardianId, studentId]);
    const isGrandparent = relationship === "grandparent";
    const { error } = await supabase.from("guardian_students").upsert(
      {
        org_id: orgId,
        guardian_id: guardianId,
        student_id: studentId,
        relationship,
        custodial: !isGrandparent,
        receives_messages: !isGrandparent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "guardian_id,student_id" }
    );
    if (error) return { ok: false, error: error.message };

    // A student without a household joins the guardian's
    const { data: pair } = await supabase
      .from("people")
      .select("id, household_id")
      .eq("org_id", orgId)
      .in("id", [guardianId, studentId]);
    const guardianHh = pair?.find((p) => p.id === guardianId)?.household_id;
    const studentHh = pair?.find((p) => p.id === studentId)?.household_id;
    if (guardianHh && !studentHh) {
      await supabase.from("people").update({ household_id: guardianHh }).eq("org_id", orgId).eq("id", studentId);
    }
    return done([guardianId, studentId]);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not link." };
  }
}

export async function updateFamilyLink(
  linkId: string,
  patch: { custodial?: boolean; receives_messages?: boolean; relationship?: string }
): Promise<FamilyResult> {
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof patch.custodial === "boolean") update.custodial = patch.custodial;
  if (typeof patch.receives_messages === "boolean") update.receives_messages = patch.receives_messages;
  if (patch.relationship && (RELATIONSHIPS as readonly string[]).includes(patch.relationship)) update.relationship = patch.relationship;

  const { data, error } = await supabase
    .from("guardian_students")
    .update(update)
    .eq("org_id", orgId)
    .eq("id", linkId)
    .select("guardian_id, student_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Link not found." };
  return done([data.guardian_id as string, data.student_id as string]);
}

export async function removeFamilyLink(linkId: string): Promise<FamilyResult> {
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();
  const { data, error } = await supabase
    .from("guardian_students")
    .delete()
    .eq("org_id", orgId)
    .eq("id", linkId)
    .select("guardian_id, student_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Link not found." };
  return done([data.guardian_id as string, data.student_id as string]);
}

/** Renames the household, or creates one for a person who has none. */
export async function saveHousehold(personId: string, name: string, address: string): Promise<FamilyResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Household name is required." };
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();

  const { data: person } = await supabase
    .from("people")
    .select("id, household_id")
    .eq("org_id", orgId)
    .eq("id", personId)
    .maybeSingle();
  if (!person) return { ok: false, error: "Contact not found." };

  if (person.household_id) {
    const { error } = await supabase
      .from("households")
      .update({ name: trimmed, address: address.trim() || null, updated_at: new Date().toISOString() })
      .eq("org_id", orgId)
      .eq("id", person.household_id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data: hh, error } = await supabase
      .from("households")
      .insert({ org_id: orgId, name: trimmed, address: address.trim() || null })
      .select("id")
      .single();
    if (error || !hh) return { ok: false, error: error?.message ?? "Could not create household." };
    await supabase.from("people").update({ household_id: hh.id }).eq("org_id", orgId).eq("id", personId);
  }
  return done([personId]);
}

/** Saves this person's custom field values; only keys defined for the org are kept. */
export async function saveCustomFieldValues(personId: string, values: Record<string, string>): Promise<FamilyResult> {
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();
  const defs = await getCustomFieldDefs(supabase, orgId);

  const { data: person } = await supabase
    .from("people")
    .select("custom_fields")
    .eq("org_id", orgId)
    .eq("id", personId)
    .maybeSingle();
  if (!person) return { ok: false, error: "Contact not found." };

  const next: Record<string, unknown> = { ...((person.custom_fields as Record<string, unknown>) ?? {}) };
  for (const def of defs) {
    if (!(def.key in values)) continue;
    const raw = (values[def.key] ?? "").trim();
    if (!raw) {
      delete next[def.key];
    } else if (def.field_type === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n)) return { ok: false, error: `${def.label} must be a number.` };
      next[def.key] = n;
    } else if (def.field_type === "select" && def.options.length > 0 && !def.options.includes(raw)) {
      return { ok: false, error: `${def.label} must be one of: ${def.options.join(", ")}.` };
    } else {
      next[def.key] = raw;
    }
  }

  const { error } = await supabase
    .from("people")
    .update({ custom_fields: next, updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("id", personId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/people");
  return done([personId]);
}

export type PreferencesInput = {
  whatsapp_opt_in: boolean | null;
  language: string | null;
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  preferred_channel: "whatsapp" | "sms" | "email" | null;
  emergency_only: boolean;
};

/** Kesher-only preferences (contact_preferences) — never touched by a sync. */
export async function savePreferences(personId: string, input: PreferencesInput): Promise<FamilyResult> {
  const { supabase, orgId } = await assertSameOrg([personId]).catch(() => ({ supabase: null, orgId: "" }));
  if (!supabase) return { ok: false, error: "Contact not found." };
  if (input.language && !LANGUAGES.some((l) => l.value === input.language)) return { ok: false, error: "Unknown language." };
  if (input.preferred_channel && !["whatsapp", "sms", "email"].includes(input.preferred_channel)) {
    return { ok: false, error: "Unknown channel." };
  }

  const { error } = await supabase.from("contact_preferences").upsert(
    {
      person_id: personId,
      org_id: orgId,
      whatsapp_opt_in: input.whatsapp_opt_in,
      language: input.language,
      email_enabled: input.email_enabled,
      sms_enabled: input.sms_enabled,
      whatsapp_enabled: input.whatsapp_enabled,
      preferred_channel: input.preferred_channel,
      emergency_only: input.emergency_only,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "person_id" }
  );
  if (error) return { ok: false, error: error.message };
  return done([personId]);
}
