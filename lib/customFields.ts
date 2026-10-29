import type { SupabaseClient } from "@supabase/supabase-js";

/** A per-org custom field (class, division, team, bus route…). Values live in people.custom_fields. */
export type CustomFieldDef = {
  id: string;
  key: string;
  label: string;
  field_type: "text" | "number" | "select";
  options: string[];
  applies_to: "student" | "guardian" | "any";
  sort_order: number;
};

/** Common fields offered as one-click suggestions in Settings → Data. */
export const SUGGESTED_FIELDS: { label: string; applies_to: CustomFieldDef["applies_to"] }[] = [
  { label: "Class", applies_to: "student" },
  { label: "Division", applies_to: "student" },
  { label: "Team", applies_to: "student" },
  { label: "Bus route", applies_to: "student" },
  { label: "Homeroom", applies_to: "student" },
  { label: "Campus", applies_to: "any" },
];

export async function getCustomFieldDefs(supabase: SupabaseClient, orgId: string): Promise<CustomFieldDef[]> {
  const { data } = await supabase
    .from("custom_field_defs")
    .select("id, key, label, field_type, options, applies_to, sort_order")
    .eq("org_id", orgId)
    .order("sort_order")
    .order("label");
  return (data ?? []) as CustomFieldDef[];
}

/** "Bus route" → "bus_route" (matches the DB check on custom_field_defs.key). */
export function fieldKeyFromLabel(label: string): string {
  const key = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return /^[a-z]/.test(key) ? key : `f_${key}`.slice(0, 40);
}

/** Reads a custom field value as a trimmed string ("" when unset). */
export function customValue(fields: Record<string, unknown> | null | undefined, key: string): string {
  const v = fields?.[key];
  return v === null || v === undefined ? "" : String(v).trim();
}
