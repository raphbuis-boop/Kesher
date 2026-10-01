export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { isDemoWorkspaceLoaded } from "@/lib/demoWorkspace";
import { DemoWorkspaceControl } from "@/app/components/DemoWorkspaceControl";
import { AdminOnly } from "@/app/components/AdminOnly";
import { resolveGroupMemberIds, type GroupRow } from "@/lib/audienceMembers";
import { getCategoryCounts } from "@/lib/categoryCounts";
import { AddGroupButton } from "@/app/groups/AddGroupButton";
import { Plus, Users, ArrowRight } from "lucide-react";

const SYSTEM_AUDIENCES = [
  { slug: "parents", label: "Parents", category: "parent" },
  { slug: "students", label: "Students", category: "student" },
  { slug: "grandparents", label: "Grandparents", category: "grandparent" },
  { slug: "alumni", label: "Alumni", category: "alumni" },
  { slug: "faculty", label: "Faculty", category: "faculty" },
  { slug: "staff", label: "Staff", category: "staff" },
  { slug: "board", label: "Board", category: "board" },
  { slug: "donors", label: "Donors", category: "donor" },
  { slug: "prospects", label: "Prospects", category: "prospect" },
] as const;

export default async function AudiencesPage() {
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();
  // Everything runs in parallel: category counts are computed in the DB, and
  // each group's member count is resolved as soon as the group list arrives
  // (same resolution the audience detail page and message sends use).
  const [categoryCounts, customAudiences, demoLoaded] = await Promise.all([
    getCategoryCounts(supabase, orgId),
    supabase
      .from("groups")
      .select("id, name, description, is_dynamic, filter_config, group_tags ( tag_id )")
      .eq("org_id", orgId)
      .order("name")
      .then(({ data }) =>
        Promise.all(
          ((data ?? []) as unknown as GroupRow[]).map(async (g) => ({
            ...g,
            count: (await resolveGroupMemberIds(supabase, orgId, g)).length,
          }))
        )
      ),
    isDemoWorkspaceLoaded(supabase, orgId),
  ]);

  const systemAudiences = SYSTEM_AUDIENCES.map((a) => ({
    ...a,
    count: categoryCounts.byCategory[a.category] ?? 0,
  }));

  const totalInSystem = categoryCounts.total;

  return (
    <div className="min-h-screen bg-canvas">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-line bg-card/95 backdrop-blur-sm px-6 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[13px] font-semibold text-ink">Audiences</h1>
            <p className="text-[11px] text-ink-3 mt-px">
              {SYSTEM_AUDIENCES.length} system · {customAudiences.length} custom
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {demoLoaded && <AdminOnly><DemoWorkspaceControl mode="remove" /></AdminOnly>}
            <Link
              href="/messages/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[12px] font-medium text-on-ink transition-colors duration-150 hover:bg-ink-hover active:bg-black"
            >
              <Plus size={12} strokeWidth={2.5} />
              Compose
            </Link>
          </div>
        </div>
      </header>

      <div className="px-6 py-6 space-y-6">
        {/* System Audiences */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">System audiences</h2>
            <span className="text-[11px] text-ink-3">{totalInSystem.toLocaleString()} total contacts</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-line bg-card shadow-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-muted-2 bg-canvas">
                  <th className="py-2.5 pl-4 pr-3 text-left text-[11px] font-semibold text-ink-3 uppercase tracking-wide">Audience</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-ink-3 uppercase tracking-wide">Members</th>
                  <th className="pl-3 pr-4 py-2.5 text-right text-[11px] font-semibold text-ink-3 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {systemAudiences.map((a, i) => {
                  const isLast = i === systemAudiences.length - 1;
                  return (
                    <tr
                      key={a.slug}
                      className={`group hover:bg-canvas transition-colors duration-100 ${!isLast ? "border-b border-muted" : ""}`}
                    >
                      <td className="py-3 pl-4 pr-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted border border-muted-2">
                            <Users size={11} className="text-ink-3" strokeWidth={1.75} />
                          </div>
                          <Link
                            href={`/audiences/${a.slug}`}
                            className="text-[13px] font-medium text-ink hover:text-ink-2 transition-colors"
                          >
                            {a.label}
                          </Link>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className={`text-[13px] tabular-nums font-medium ${a.count === 0 ? "text-line-strong" : "text-ink"}`}>
                          {a.count.toLocaleString()}
                        </span>
                      </td>
                      <td className="pl-3 pr-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/messages/new?audiences=${a.slug}`}
                            className="text-[11px] font-medium text-ink-3 hover:text-ink transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                          >
                            Message
                          </Link>
                          <Link
                            href={`/audiences/${a.slug}`}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-3 hover:text-ink-2 transition-colors"
                          >
                            View <ArrowRight size={10} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Custom Audiences */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">Custom audiences</h2>
            <AddGroupButton />
          </div>

          {customAudiences.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card border border-line mb-4">
                <Users size={18} className="text-line-strong" strokeWidth={1.5} />
              </div>
              <p className="text-[13px] font-semibold text-ink">No custom audiences</p>
              <p className="text-[12px] text-ink-3 mt-1 max-w-xs">
                Create tag-based or rule-based groups — dinner committees, graduating classes, volunteers.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line bg-card shadow-card">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-muted-2 bg-canvas">
                    <th className="py-2.5 pl-4 pr-3 text-left text-[11px] font-semibold text-ink-3 uppercase tracking-wide">Name</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-ink-3 uppercase tracking-wide">Description</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-ink-3 uppercase tracking-wide">Members</th>
                    <th className="pl-3 pr-4 py-2.5 text-right text-[11px] font-semibold text-ink-3 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customAudiences.map((g, i) => {
                    const isLast = i === customAudiences.length - 1;
                    return (
                      <tr
                        key={g.id}
                        className={`group hover:bg-canvas transition-colors duration-100 ${!isLast ? "border-b border-muted" : ""}`}
                      >
                        <td className="py-3 pl-4 pr-3">
                          <Link
                            href={`/audiences/${g.id}`}
                            className="text-[13px] font-medium text-ink hover:text-ink-2 transition-colors"
                          >
                            {g.name}
                          </Link>
                        </td>
                        <td className="px-3 py-3 max-w-xs">
                          {g.description ? (
                            <span className="text-[12px] text-ink-3 line-clamp-1">{g.description}</span>
                          ) : (
                            <span className="text-line-strong text-[12px]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className={`text-[13px] tabular-nums font-medium ${g.count === 0 ? "text-line-strong" : "text-ink"}`}>
                            {g.count.toLocaleString()}
                          </span>
                        </td>
                        <td className="pl-3 pr-4 py-3">
                          <div className="flex items-center justify-end gap-3">
                            <Link
                              href={`/messages/new?audiences=${g.id}`}
                              className="text-[11px] font-medium text-ink-3 hover:text-ink transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            >
                              Message
                            </Link>
                            <Link
                              href={`/audiences/${g.id}`}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-3 hover:text-ink-2 transition-colors"
                            >
                              View <ArrowRight size={10} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
