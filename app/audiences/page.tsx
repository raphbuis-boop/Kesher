export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AddGroupButton } from "@/app/groups/AddGroupButton";

type PersonRow = {
  id: string;
  categories: string[] | null;
};

type PersonForGroup = {
  id: string;
  person_tags: Array<{ tag_id: string }>;
};

type Group = {
  id: string;
  name: string;
  description: string | null;
  group_tags: Array<{ tag_id: string }>;
};

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
  const [peopleResult, groupPeopleResult, groupsResult] = await Promise.all([
    supabase.from("people").select("id, categories"),
    supabase.from("people").select("id, person_tags ( tag_id )"),
    supabase
      .from("groups")
      .select("id, name, description, group_tags ( tag_id )")
      .order("name"),
  ]);

  const people = (peopleResult.data ?? []) as unknown as PersonRow[];
  const groupPeople = (groupPeopleResult.data ?? []) as unknown as PersonForGroup[];
  const groups = (groupsResult.data ?? []) as unknown as Group[];

  const systemAudiences = SYSTEM_AUDIENCES.map((a) => ({
    ...a,
    count: people.filter(
      (p) => Array.isArray(p.categories) && p.categories.includes(a.category)
    ).length,
  }));

  const customAudiences = groups.map((g) => {
    const tagIds = new Set(g.group_tags.map((gt) => gt.tag_id));
    const count =
      tagIds.size === 0
        ? 0
        : groupPeople.filter((p) =>
            p.person_tags.some((pt) => tagIds.has(pt.tag_id))
          ).length;
    return { ...g, count };
  });

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-zinc-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-zinc-900">Audiences</h1>
            <p className="mt-0.5 text-xs text-zinc-400">
              {SYSTEM_AUDIENCES.length} system · {customAudiences.length} custom
            </p>
          </div>
          <Link
            href="/messages/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Compose
          </Link>
        </div>
      </header>

      <div className="px-6 py-6 space-y-8">
        {/* System Audiences */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">System audiences</h2>
          </div>
          <div className="rounded-lg border border-zinc-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="py-2.5 pl-4 pr-3 text-left text-xs font-medium text-zinc-400">Name</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-zinc-400">Members</th>
                  <th className="pl-3 pr-4 py-2.5 text-right text-xs font-medium text-zinc-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {systemAudiences.map((a) => (
                  <tr key={a.slug} className="hover:bg-zinc-50 transition-colors">
                    <td className="py-3 pl-4 pr-3">
                      <Link
                        href={`/audiences/${a.slug}`}
                        className="text-sm font-medium text-zinc-900 hover:text-zinc-600 transition-colors"
                      >
                        {a.label}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-sm tabular-nums text-zinc-600">
                        {a.count.toLocaleString()}
                      </span>
                    </td>
                    <td className="pl-3 pr-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/messages/new?audiences=${a.slug}`}
                          className="text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
                        >
                          Message
                        </Link>
                        <Link
                          href={`/audiences/${a.slug}`}
                          className="text-xs font-medium text-zinc-400 hover:text-zinc-700 transition-colors"
                        >
                          View →
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Custom Audiences */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Custom audiences</h2>
            <AddGroupButton />
          </div>

          {customAudiences.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 py-14 text-center">
              <p className="text-sm font-medium text-zinc-500">No custom audiences</p>
              <p className="mt-1 text-xs text-zinc-400 max-w-xs">
                Create tag-based or rule-based groups — committees, classes, volunteers, etc.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="py-2.5 pl-4 pr-3 text-left text-xs font-medium text-zinc-400">Name</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-400">Description</th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-zinc-400">Members</th>
                    <th className="pl-3 pr-4 py-2.5 text-right text-xs font-medium text-zinc-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {customAudiences.map((g) => (
                    <tr key={g.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="py-3 pl-4 pr-3">
                        <Link
                          href={`/audiences/${g.id}`}
                          className="text-sm font-medium text-zinc-900 hover:text-zinc-600 transition-colors"
                        >
                          {g.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3 max-w-xs">
                        {g.description ? (
                          <span className="text-xs text-zinc-400 line-clamp-1">{g.description}</span>
                        ) : (
                          <span className="text-zinc-200 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-sm tabular-nums text-zinc-600">
                          {g.count.toLocaleString()}
                        </span>
                      </td>
                      <td className="pl-3 pr-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/messages/new?audiences=${g.id}`}
                            className="text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
                          >
                            Message
                          </Link>
                          <Link
                            href={`/audiences/${g.id}`}
                            className="text-xs font-medium text-zinc-400 hover:text-zinc-700 transition-colors"
                          >
                            View →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
