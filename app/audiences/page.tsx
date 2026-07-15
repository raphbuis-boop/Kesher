export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { AddGroupButton } from "@/app/groups/AddGroupButton";
import { Plus, Users, ArrowRight } from "lucide-react";

type PersonRow = { id: string; categories: string[] | null };
type PersonForGroup = { id: string; person_tags: Array<{ tag_id: string }> };
type Group = { id: string; name: string; description: string | null; group_tags: Array<{ tag_id: string }> };

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
  const [peopleResult, groupPeopleResult, groupsResult] = await Promise.all([
    supabase.from("people").select("id, categories").eq("org_id", orgId),
    supabase.from("people").select("id, person_tags ( tag_id )").eq("org_id", orgId),
    supabase.from("groups").select("id, name, description, group_tags ( tag_id )").eq("org_id", orgId).order("name"),
  ]);

  const people = (peopleResult.data ?? []) as unknown as PersonRow[];
  const groupPeople = (groupPeopleResult.data ?? []) as unknown as PersonForGroup[];
  const groups = (groupsResult.data ?? []) as unknown as Group[];

  const systemAudiences = SYSTEM_AUDIENCES.map((a) => ({
    ...a,
    count: people.filter((p) => Array.isArray(p.categories) && p.categories.includes(a.category)).length,
  }));

  const customAudiences = groups.map((g) => {
    const tagIds = new Set(g.group_tags.map((gt) => gt.tag_id));
    const count = tagIds.size === 0 ? 0 : groupPeople.filter((p) => p.person_tags.some((pt) => tagIds.has(pt.tag_id))).length;
    return { ...g, count };
  });

  const totalInSystem = people.length;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-[#e7e7e7] bg-white/95 backdrop-blur-sm px-6 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[13px] font-semibold text-[#0f0f0f]">Audiences</h1>
            <p className="text-[11px] text-[#a1a1aa] mt-px">
              {SYSTEM_AUDIENCES.length} system · {customAudiences.length} custom
            </p>
          </div>
          <Link
            href="/messages/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0f0f0f] px-3 py-1.5 text-[12px] font-medium text-white transition-colors duration-150 hover:bg-[#27272a] active:bg-black"
          >
            <Plus size={12} strokeWidth={2.5} />
            Compose
          </Link>
        </div>
      </header>

      <div className="px-6 py-6 space-y-6">
        {/* System Audiences */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider">System audiences</h2>
            <span className="text-[11px] text-[#a1a1aa]">{totalInSystem.toLocaleString()} total contacts</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-[#e7e7e7] bg-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
                  <th className="py-2.5 pl-4 pr-3 text-left text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Audience</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Members</th>
                  <th className="pl-3 pr-4 py-2.5 text-right text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {systemAudiences.map((a, i) => {
                  const isLast = i === systemAudiences.length - 1;
                  return (
                    <tr
                      key={a.slug}
                      className={`group hover:bg-[#fafafa] transition-colors duration-100 ${!isLast ? "border-b border-[#f5f5f5]" : ""}`}
                    >
                      <td className="py-3 pl-4 pr-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#f5f5f5] border border-[#f0f0f0]">
                            <Users size={11} className="text-[#a1a1aa]" strokeWidth={1.75} />
                          </div>
                          <Link
                            href={`/audiences/${a.slug}`}
                            className="text-[13px] font-medium text-[#0f0f0f] hover:text-[#71717a] transition-colors"
                          >
                            {a.label}
                          </Link>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className={`text-[13px] tabular-nums font-medium ${a.count === 0 ? "text-[#d4d4d8]" : "text-[#0f0f0f]"}`}>
                          {a.count.toLocaleString()}
                        </span>
                      </td>
                      <td className="pl-3 pr-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/messages/new?audiences=${a.slug}`}
                            className="text-[11px] font-medium text-[#a1a1aa] hover:text-[#0f0f0f] transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                          >
                            Message
                          </Link>
                          <Link
                            href={`/audiences/${a.slug}`}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#a1a1aa] hover:text-[#71717a] transition-colors"
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
            <h2 className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Custom audiences</h2>
            <AddGroupButton />
          </div>

          {customAudiences.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#e7e7e7] py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white border border-[#e7e7e7] mb-4">
                <Users size={18} className="text-[#d4d4d8]" strokeWidth={1.5} />
              </div>
              <p className="text-[13px] font-semibold text-[#0f0f0f]">No custom audiences</p>
              <p className="text-[12px] text-[#a1a1aa] mt-1 max-w-xs">
                Create tag-based or rule-based groups — dinner committees, graduating classes, volunteers.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#e7e7e7] bg-white">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
                    <th className="py-2.5 pl-4 pr-3 text-left text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Name</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Description</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Members</th>
                    <th className="pl-3 pr-4 py-2.5 text-right text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customAudiences.map((g, i) => {
                    const isLast = i === customAudiences.length - 1;
                    return (
                      <tr
                        key={g.id}
                        className={`group hover:bg-[#fafafa] transition-colors duration-100 ${!isLast ? "border-b border-[#f5f5f5]" : ""}`}
                      >
                        <td className="py-3 pl-4 pr-3">
                          <Link
                            href={`/audiences/${g.id}`}
                            className="text-[13px] font-medium text-[#0f0f0f] hover:text-[#71717a] transition-colors"
                          >
                            {g.name}
                          </Link>
                        </td>
                        <td className="px-3 py-3 max-w-xs">
                          {g.description ? (
                            <span className="text-[12px] text-[#a1a1aa] line-clamp-1">{g.description}</span>
                          ) : (
                            <span className="text-[#d4d4d8] text-[12px]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className={`text-[13px] tabular-nums font-medium ${g.count === 0 ? "text-[#d4d4d8]" : "text-[#0f0f0f]"}`}>
                            {g.count.toLocaleString()}
                          </span>
                        </td>
                        <td className="pl-3 pr-4 py-3">
                          <div className="flex items-center justify-end gap-3">
                            <Link
                              href={`/messages/new?audiences=${g.id}`}
                              className="text-[11px] font-medium text-[#a1a1aa] hover:text-[#0f0f0f] transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            >
                              Message
                            </Link>
                            <Link
                              href={`/audiences/${g.id}`}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#a1a1aa] hover:text-[#71717a] transition-colors"
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
