"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ADMIN_ROLES, PermissionError, requireRole } from "@/lib/org";
import { fieldKeyFromLabel, type CustomFieldDef } from "@/lib/customFields";

export type DataResult = { ok: true; message?: string } | { ok: false; error: string };

async function adminOrg(): Promise<{ orgId: string; userId: string } | DataResult> {
  try {
    const { orgId, userId } = await requireRole(ADMIN_ROLES);
    return { orgId, userId };
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    throw err;
  }
}

// ─── Custom fields ────────────────────────────────────────────────────────────

export async function addCustomField(input: {
  label: string;
  field_type: CustomFieldDef["field_type"];
  applies_to: CustomFieldDef["applies_to"];
  options: string[];
}): Promise<DataResult> {
  const gate = await adminOrg();
  if ("ok" in gate) return gate;
  const label = input.label.trim();
  if (!label) return { ok: false, error: "Field name is required." };
  if (!["text", "number", "select"].includes(input.field_type)) return { ok: false, error: "Unknown field type." };
  if (!["student", "guardian", "any"].includes(input.applies_to)) return { ok: false, error: "Unknown option." };

  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("custom_field_defs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", gate.orgId);

  const { error } = await supabase.from("custom_field_defs").insert({
    org_id: gate.orgId,
    key: fieldKeyFromLabel(label),
    label,
    field_type: input.field_type,
    applies_to: input.applies_to,
    options: input.field_type === "select" ? input.options.map((o) => o.trim()).filter(Boolean).slice(0, 100) : [],
    sort_order: count ?? 0,
  });
  if (error) {
    return { ok: false, error: error.code === "23505" ? `A field called "${label}" already exists.` : error.message };
  }
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateCustomField(id: string, input: { label: string; options: string[] }): Promise<DataResult> {
  const gate = await adminOrg();
  if ("ok" in gate) return gate;
  const label = input.label.trim();
  if (!label) return { ok: false, error: "Field name is required." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("custom_field_defs")
    .update({ label, options: input.options.map((o) => o.trim()).filter(Boolean).slice(0, 100) })
    .eq("org_id", gate.orgId)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

/** Removes the definition. Values stay in people.custom_fields so re-adding the field brings them back. */
export async function deleteCustomField(id: string): Promise<DataResult> {
  const gate = await adminOrg();
  if ("ok" in gate) return gate;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("custom_field_defs").delete().eq("org_id", gate.orgId).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}
