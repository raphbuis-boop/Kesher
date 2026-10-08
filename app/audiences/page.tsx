export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { isDemoWorkspaceLoaded } from "@/lib/demoWorkspace";
import { DemoWorkspaceControl } from "@/app/components/DemoWorkspaceControl";
import { resolveGroupMemberIds, type GroupRow } from "@/lib/audienceMembers";
import { AddGroupButton } from "@/app/groups/AddGroupButton";
import { Plus, Users } from "lucide-react";

type PersonRow = { id: string; categories: string[] | null };

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
  const [peopleResult, groupsResult, demoLoaded] = await Promise.all([
    supabase.from("people").select("id, categories").eq("org_id", orgId),
    supabase
      .from("groups")
      .select("id, name, description, is_dynamic, filter_config, group_tags ( tag_id )")
      .eq("org_id", orgId)
      .order("name"),
    isDemoWorkspaceLoaded(supabase, orgId),
  ]);

  const people = (peopleResult.data ?? []) as unknown as PersonRow[];
  const groups = (groupsResult.data ?? []) as unknown as GroupRow[];

  const systemAudiences = SYSTEM_AUDIENCES.map((a) => ({
    ...a,
    count: people.filter((p) => Array.isArray(p.categories) && p.categories.includes(a.category)).length,
  }));

  // Real counts for every group, dynamic or tag-based — resolved the same
  // way the audience detail page and message sends resolve them.
  const customAudiences = await Promise.all(
    groups.map(async (g) => ({
      ...g,
      count: (await resolveGroupMemberIds(supabase, orgId, g)).length,
    }))
  );

  const totalInSystem = people.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur-sm px-6 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[13px] font-semibold text-text-primary">Audiences</h1>
            <p className="text-[11px] text-text-subtle mt-px">
              {SYSTEM_AUDIENCES.length} system · {customAudiences.length} custom
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {demoLoaded && <DemoWorkspaceControl mode="badge" />}
            <Link
              href="/messages/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-fg transition-colors duration-150 hover:bg-primary-hover active:bg-primary-hover"
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
            <h2 className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider">System audiences</h2>
            <span className="text-[11px] text-text-subtle">{totalInSystem.toLocaleString()} total contacts</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle bg-background">
                  <th className="py-2.5 pl-4 pr-3 text-left text-[11px] font-semibold text-text-subtle uppercase tracking-wide">Audience</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-text-subtle uppercase tracking-wide">Members</th>
                  <th className="pl-3 pr-4 py-2.5 text-right text-[11px] font-semibold text-text-subtle uppercase tracking-wide"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {systemAudiences.map((a, i) => {
                  const isLast = i === systemAudiences.length - 1;
                  return (
                    <tr
                      key={a.slug}
                      className={`group hover:bg-surface-hover transition-colors duration-100 ${!isLast ? "border-b border-border-subtle" : ""}`}
                    >
                      <td className="py-3 pl-4 pr-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-2 border border-border-subtle">
                            <Users size={11} className="text-text-subtle" strokeWidth={1.75} />
                          </div>
                          <Link
                            href={`/audiences/${a.slug}`}
                            className="text-[13px] font-medium text-text-primary hover:underline underline-offset-2"
                          >
                            {a.label}
                          </Link>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className={`text-[13px] tabular-nums font-medium ${a.count === 0 ? "text-text-subtle" : "text-text-primary"}`}>
                          {a.count.toLocaleString()}
                        </span>
                      </td>
                      <td className="pl-3 pr-4 py-3">
                        <div className="flex items-center justify-end">
                          <Link
                            href={`/messages/new?audiences=${a.slug}`}
                            className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-text-secondary hover:border-border-strong hover:text-text-primary transition-colors"
                          >
                            Message<span className="sr-only"> {a.label}</span>
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
            <h2 className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider">Custom audiences</h2>
            <AddGroupButton />
          </div>

          {customAudiences.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface border border-border mb-4">
                <Users size={18} className="text-text-faint" strokeWidth={1.5} />
              </div>
              <p className="text-[13px] font-semibold text-text-primary">No custom audiences</p>
              <p className="text-[12px] text-text-subtle mt-1 max-w-xs">
                Create tag-based or rule-based groups — dinner committees, graduating classes, volunteers.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-subtle bg-background">
                    <th className="py-2.5 pl-4 pr-3 text-left text-[11px] font-semibold text-text-subtle uppercase tracking-wide">Name</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-text-subtle uppercase tracking-wide">Description</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-text-subtle uppercase tracking-wide">Members</th>
                    <th className="pl-3 pr-4 py-2.5 text-right text-[11px] font-semibold text-text-subtle uppercase tracking-wide"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {customAudiences.map((g, i) => {
                    const isLast = i === customAudiences.length - 1;
                    return (
                      <tr
                        key={g.id}
                        className={`group hover:bg-surface-hover transition-colors duration-100 ${!isLast ? "border-b border-border-subtle" : ""}`}
                      >
                        <td className="py-3 pl-4 pr-3">
                          <Link
                            href={`/audiences/${g.id}`}
                            className="text-[13px] font-medium text-text-primary hover:underline underline-offset-2"
                          >
                            {g.name}
                          </Link>
                        </td>
                        <td className="px-3 py-3 max-w-xs">
                          {g.description ? (
                            <span className="text-[12px] text-text-subtle line-clamp-1">{g.description}</span>
                          ) : (
                            <span className="text-text-subtle text-[12px]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className={`text-[13px] tabular-nums font-medium ${g.count === 0 ? "text-text-subtle" : "text-text-primary"}`}>
                            {g.count.toLocaleString()}
                          </span>
                        </td>
                        <td className="pl-3 pr-4 py-3">
                          <div className="flex items-center justify-end">
                            <Link
                              href={`/messages/new?audiences=${g.id}`}
                              className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-text-secondary hover:border-border-strong hover:text-text-primary transition-colors"
                            >
                              Message<span className="sr-only"> {g.name}</span>
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
