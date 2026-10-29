import type { SupabaseClient } from "@supabase/supabase-js";
import { getCustomFieldDefs } from "@/lib/customFields";
import type { RuleCatalog } from "@/lib/audienceRules";

/** Custom fields and tags a smart audience rule can use (org-scoped). */
export async function getRuleCatalog(supabase: SupabaseClient, orgId: string): Promise<RuleCatalog> {
  const [defs, tags] = await Promise.all([
    getCustomFieldDefs(supabase, orgId),
    supabase.from("tags").select("id, name").eq("org_id", orgId).order("name"),
  ]);
  return {
    customFields: defs.map((d) => ({ key: d.key, label: d.label, field_type: d.field_type, options: d.options })),
    tags: (tags.data ?? []) as { id: string; name: string }[],
  };
}
