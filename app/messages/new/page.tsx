export const dynamic = "force-dynamic";
// Sending runs inside the server action; give it the full function time
export const maxDuration = 60;

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMembership, isAdminRole } from "@/lib/org";
import { getCategoryCounts } from "@/lib/categoryCounts";
import { resolveGroupMemberIds, type GroupRow } from "@/lib/audienceMembers";
import { getAudienceTemplateMap, listTemplates } from "@/lib/templates";
import { getCustomFieldDefs } from "@/lib/customFields";
import { redirect } from "next/navigation";
import { ComposeFlow, type AudienceOption, type ComposeInitial } from "./ComposeFlow";
import { getRequireApproval, getSchoolTimezone, localDateString, localTimeString, validClockRule } from "@/lib/schoolTime";
import { getDispatcherHealth } from "@/lib/send/health";
import { linksConfigured } from "@/lib/links";
import type { MessageInput } from "@/lib/send/types";

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

const EDITABLE = ["draft", "pending_approval", "scheduled", "rejected", "cancelled"];
const MEMBER_EDITABLE = ["draft", "pending_approval", "rejected"];

export default async function NewMessagePage({ searchParams }: { searchParams: Promise<{ audiences?: string; edit?: string; recurring?: string }> }) {
  const { audiences: audiencesParam, edit, recurring } = await searchParams;
  const initialAudienceSlugs = audiencesParam ? audiencesParam.split(",") : undefined;
  const supabase = await createSupabaseServerClient();
  const { orgId, role, userId } = await getMembership();
  const admin = isAdminRole(role);

  const [timezone, requireApproval, health] = await Promise.all([getSchoolTimezone(supabase, orgId), getRequireApproval(supabase, orgId), getDispatcherHealth(supabase)]);

  // Editing a draft / scheduled / waiting message, or a repeating send
  let initial: ComposeInitial | undefined;
  if (edit) {
    const { data: m } = await supabase.from("messages").select("id, status, created_by, payload, scheduled_for, rejection_reason").eq("org_id", orgId).eq("id", edit).maybeSingle();
    const row = m as { id: string; status: string; created_by: string | null; payload: MessageInput | null; scheduled_for: string | null; rejection_reason: string | null } | null;
    if (!row || !row.payload || !(admin ? EDITABLE : MEMBER_EDITABLE).includes(row.status) || (!admin && row.created_by !== userId)) redirect("/messages");
    initial = {
      messageId: row.id,
      recurringId: null,
      status: row.status,
      rejectionReason: row.rejection_reason,
      input: row.payload,
      when: row.scheduled_for ? { date: localDateString(new Date(row.scheduled_for), timezone), time: localTimeString(new Date(row.scheduled_for), timezone) } : null,
      repeatWeeks: null,
    };
  } else if (recurring && admin) {
    const { data: r } = await supabase.from("recurring_sends").select("id, payload, rule, next_run_at").eq("org_id", orgId).eq("id", recurring).maybeSingle();
    const rec = r as { id: string; payload: MessageInput; rule: unknown; next_run_at: string | null } | null;
    if (!rec || !validClockRule(rec.rule)) redirect("/messages");
    const next = rec.next_run_at ? new Date(rec.next_run_at) : null;
    initial = {
      messageId: null,
      recurringId: rec.id,
      status: null,
      rejectionReason: null,
      input: rec.payload,
      when: next ? { date: localDateString(next, timezone), time: localTimeString(next, timezone) } : null,
      repeatWeeks: rec.rule.everyWeeks,
    };
  }

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
          <h1 className="text-[13px] font-semibold text-ink">{initial ? "Edit message" : "New Message"}</h1>
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
          canEmergency={admin}
          schoolTimezone={timezone}
          confirmLinksReady={linksConfigured()}
          schedulerHealthy={health.healthy}
          isAdmin={admin}
          requireApproval={requireApproval}
          initial={initial}
          key={initial?.messageId ?? initial?.recurringId ?? "new"}
        />
      </div>
    </div>
  );
}
