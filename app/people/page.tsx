export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AddPersonButton, type Tag } from "./AddPersonButton";

type PersonWithTags = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  categories: string[] | null;
  created_at: string;
  person_tags: Array<{
    tag_id: string;
    tags: Tag;
  }>;
};

const CATEGORY_LABELS: Record<string, string> = {
  parent: "Parent",
  student: "Student",
  grandparent: "Grandparent",
  alumni: "Alumni",
  faculty: "Faculty",
  staff: "Staff",
  board: "Board",
  donor: "Donor",
  prospect: "Prospect",
};

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; q?: string }>;
}) {
  const { tag: activeTag, q } = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [peopleResult, tagsResult] = await Promise.all([
    supabase
      .from("people")
      .select(
        "id, first_name, last_name, email, phone, categories, created_at, person_tags ( tag_id, tags ( id, name ) )"
      )
      .order("last_name"),
    supabase.from("tags").select("id, name").order("name"),
  ]);

  if (peopleResult.error) {
    throw new Error(`Failed to load people: ${peopleResult.error.message}`);
  }

  const allPeople = (peopleResult.data ?? []) as unknown as PersonWithTags[];
  const allTags = (tagsResult.data ?? []) as Tag[];

  let filtered = activeTag
    ? allPeople.filter((p) => p.person_tags.some((pt) => pt.tags?.name === activeTag))
    : allPeople;

  if (q) {
    const lq = q.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.first_name.toLowerCase().includes(lq) ||
        p.last_name.toLowerCase().includes(lq) ||
        (p.email?.toLowerCase().includes(lq) ?? false)
    );
  }

  const tagCounts: Record<string, number> = {};
  for (const tag of allTags) {
    tagCounts[tag.name] = allPeople.filter((p) =>
      p.person_tags.some((pt) => pt.tags?.name === tag.name)
    ).length;
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-zinc-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-zinc-900">People</h1>
            <p className="mt-0.5 text-xs text-zinc-400">
              {allPeople.length.toLocaleString()} contacts
            </p>
          </div>
          <AddPersonButton tags={allTags} />
        </div>
      </header>

      {/* Toolbar */}
      <div className="border-b border-zinc-100 px-6 py-3">
        <div className="flex items-center gap-4">
          <form action="/people" method="GET" className="flex-1 max-w-xs">
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Search by name or email…"
                className="w-full rounded-md border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 transition-colors"
              />
              {activeTag && <input type="hidden" name="tag" value={activeTag} />}
            </div>
          </form>

          {/* Tag filters */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <a
                href="/people"
                className={
                  "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors " +
                  (!activeTag
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800")
                }
              >
                All
                <span className="tabular-nums opacity-60">{allPeople.length}</span>
              </a>
              {allTags.map((tag) => {
                const isActive = activeTag === tag.name;
                return (
                  <a
                    key={tag.id}
                    href={`/people?tag=${encodeURIComponent(tag.name)}`}
                    className={
                      "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors " +
                      (isActive
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800")
                    }
                  >
                    {tag.name}
                    <span className="tabular-nums opacity-60">{tagCounts[tag.name] ?? 0}</span>
                  </a>
                );
              })}
            </div>
          )}

          <span className="ml-auto shrink-0 text-xs text-zinc-400 tabular-nums">
            {filtered.length === 0
              ? "No records"
              : `${filtered.length.toLocaleString()} ${filtered.length === 1 ? "person" : "people"}`}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="px-6 py-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 py-20 text-center">
            <p className="text-sm font-medium text-zinc-500">
              {activeTag ? `No contacts tagged "${activeTag}"` : "No contacts found"}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              {activeTag ? "Try a different filter." : "Add your first contact to get started."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="py-2.5 pl-4 pr-3 text-left text-xs font-medium text-zinc-400">Name</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-400">Role</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-400">Email</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-400">Phone</th>
                  <th className="pl-3 pr-4 py-2.5 text-left text-xs font-medium text-zinc-400">Tags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.map((person) => (
                  <tr key={person.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="py-3 pl-4 pr-3">
                      <Link
                        href={`/people/${person.id}`}
                        className="text-sm font-medium text-zinc-900 hover:text-zinc-600 transition-colors"
                      >
                        {person.first_name} {person.last_name}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      {Array.isArray(person.categories) && person.categories.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {person.categories.map((cat) => (
                            <span
                              key={cat}
                              className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-zinc-100 text-zinc-600"
                            >
                              {CATEGORY_LABELS[cat] ?? cat}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {person.email ? (
                        <span className="text-xs text-zinc-600">{person.email}</span>
                      ) : (
                        <span className="text-zinc-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {person.phone ? (
                        <span className="text-xs text-zinc-600">{person.phone}</span>
                      ) : (
                        <span className="text-zinc-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="pl-3 pr-4 py-3">
                      {person.person_tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {person.person_tags.map((pt) => (
                            <span
                              key={pt.tag_id}
                              className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-zinc-100 text-zinc-600"
                            >
                              {pt.tags.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
