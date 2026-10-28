export const dynamic = "force-dynamic";
// Sending runs inside the server action; give it the full function time
export const maxDuration = 60;

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMembership, isAdminRole } from "@/lib/org";
import { getCategoryCounts } from "@/lib/categoryCounts";
import { resolveGroupMemberIds, type GroupRow } from "@/lib/audienceMembers";
import { getAudienceTemplateMap, listTemplates } from "@/lib/templates";
import { getCustomFieldDefs } from "@/lib/customFields";
import { ComposeFlow, type AudienceOption } from "./ComposeFlow";

const SYSTEM_AUDIENCES: { slug: string; label: string; category: string }[] = [
  { slug: "parents", label: "Parents", category: "parent" },
  { slug: "students", label: "Students", category: "student" },
  { slug: "grandparents", label: "Grandparents", category: "grandparent" },
  { slug: "alumni", label: "Alumni", category: "alumni" },
  { slug: "faculty", label: "Faculty", category: "faculty" },
  { slug: "staff", label: "Staff", category: "staff" },
  { slug: "board", label: "Board", category: "board" },
  { slug: "donors", label: "Donors", category: "donor" },
  { slug: "prospects", label: "Prospects", category: "prospect" },
];

export default async function NewMessagePage({ searchParams }: { searchParams: Promise<{ audiences?: string }> }) {
  const { audiences: audiencesParam } = await searchParams;
  const initialAudienceSlugs = audiencesParam ? audiencesParam.split(",") : undefined;
  const supabase = await createSupabaseServerClient();
  const { orgId, role } = await getMembership();

  const [counts, groupsRes, templates, audienceTemplates, fieldDefs] = await Promise.all([
    getCategoryCounts(supabase, orgId),
    supabase.from("groups").select("id, name, is_dynamic, filter_config, group_tags ( tag_id )").eq("org_id", orgId).order("name"),
    listTemplates(supabase, orgId),
    getAudienceTemplateMap(supabase, orgId),
    getCustomFieldDefs(supabase, orgId),
  ]);

  const systemAudiences: AudienceOption[] = SYSTEM_AUDIENCES.map(({ slug, label, category }) => ({
    slug,
    label,
    totalCount: counts.byCategory[category] ?? 0,
  }));

  // Custom audiences (hand-picked and smart) resolve through the same function a send uses,
  // so the number shown here is the number of people the send starts from.
  const groups = (groupsRes.data ?? []) as unknown as GroupRow[];
  const customAudiences: AudienceOption[] = await Promise.all(
    groups.map(async (g) => {
      let n = 0;
      try {
        n = (await resolveGroupMemberIds(supabase, orgId, g)).length;
      } catch (err) {
        console.error(`[NewMessagePage] Failed to resolve members for audience ${g.id}:`, err);
      }
      return { slug: g.id, label: g.name, totalCount: n };
    })
  );

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 border-b border-line bg-card/95 backdrop-blur-sm px-6 py-3.5">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-[13px] font-semibold text-ink">New Message</h1>
          <p className="text-[11px] text-ink-3 mt-px">Compose once, reach every family on the channel they read.</p>
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-6 py-6">
        <ComposeFlow
          audiences={[...systemAudiences, ...customAudiences]}
          initialAudienceSlugs={initialAudienceSlugs}
          attachmentsEnabled={!!process.env.BLOB_READ_WRITE_TOKEN}
          templates={templates.map((t) => ({ id: t.id, name: t.name, defaultSubject: t.default_subject }))}
          audienceTemplates={audienceTemplates}
          customTokens={fieldDefs.map((d) => ({ token: `{{${d.key}}}`, label: d.label }))}
          canEmergency={isAdminRole(role)}
        />
      </div>
    </div>
  );
}
