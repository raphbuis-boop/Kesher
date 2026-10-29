import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { resolveFilterPeople } from "@/lib/resolveAudience";
import { reachSummary } from "@/lib/family";
import type { FilterNode } from "@/lib/audienceRules";

export const dynamic = "force-dynamic";

/**
 * POST /api/audiences/preview { filter } → live member count, the first few
 * matching people, and who a message would reach (parents of matched
 * students counted once). Session-based and org-scoped.
 */
export async function POST(req: Request) {
  let orgId: string;
  try {
    orgId = await getOrgId();
  } catch {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  let filter: FilterNode | null = null;
  try {
    filter = ((await req.json()) as { filter?: FilterNode | null }).filter ?? null;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!filter) return NextResponse.json({ count: 0, sample: [], reach: null });

  try {
    const supabase = await createSupabaseServerClient();
    const matched = await resolveFilterPeople(supabase, orgId, filter);
    const ids = matched.slice(0, 8).map((m) => m.id);
    const { data } = ids.length
      ? await supabase.from("people").select("id, first_name, last_name, grade, categories").eq("org_id", orgId).in("id", ids)
      : { data: [] };
    const sample = ((data ?? []) as { id: string; first_name: string; last_name: string; grade: string | null; categories: string[] | null }[]).map((p) => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`.trim(),
      detail: [p.categories?.includes("student") ? "Student" : p.categories?.includes("parent") ? "Parent" : null, p.grade ? `Grade ${p.grade}` : null].filter(Boolean).join(" · "),
    }));
    const reach = await reachSummary(supabase, orgId, matched);
    return NextResponse.json({ count: matched.length, sample, reach });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Preview failed" }, { status: 500 });
  }
}
