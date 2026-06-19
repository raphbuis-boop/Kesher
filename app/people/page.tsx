export const dynamic = "force-dynamic";

import Link from "next/link";
import { supabase } from "@/lib/supabase";
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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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

  let filteredPeople = activeTag
    ? allPeople.filter((p) =>
        p.person_tags.some((pt) => pt.tags?.name === activeTag)
      )
    : allPeople;

  if (q) {
    const lq = q.toLowerCase();
    filteredPeople = filteredPeople.filter(
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
    <div className="min-h-screen bg-white">
      {/* Page header */}
      <div className="border-b border-zinc-200">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
                People
              </h1>
              <p className="mt-0.5 text-sm text-zinc-500">
                Manage contacts across the organization
              </p>
            </div>
            <AddPersonButton tags={allTags} />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mx-auto max-w-6xl px-6 py-4">
        <form action="/people" method="GET" className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
            <input
              type="text"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search by name or email…"
              className="w-full rounded-md border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 focus:ring-0"
            />
            {activeTag && <input type="hidden" name="tag" value={activeTag} />}
          </div>

          <span className="text-sm text-zinc-400">
            {filteredPeople.length === 0
              ? "No records"
              : `${filteredPeople.length} ${filteredPeople.length === 1 ? "person" : "people"}`}
          </span>
        </form>
      </div>

      {/* Filter bar */}
      {allTags.length > 0 && (
        <div className="mx-auto max-w-6xl px-6 pb-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <a
              href="/people"
              className={
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors " +
                (!activeTag
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200")
              }
            >
              All
              <span
                className={
                  "text-xs tabular-nums " +
                  (!activeTag ? "text-zinc-400" : "text-zinc-400")
                }
              >
                {allPeople.length}
              </span>
            </a>
            {allTags.map((tag) => {
              const isActive = activeTag === tag.name;
              const count = tagCounts[tag.name] ?? 0;
              return (
                <a
                  key={tag.id}
                  href={`/people?tag=${encodeURIComponent(tag.name)}`}
                  className={
                    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors " +
                    (isActive
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200")
                  }
                >
                  {tag.name}
                  <span
                    className={
                      "text-xs tabular-nums " +
                      (isActive ? "text-zinc-400" : "text-zinc-400")
                    }
                  >
                    {count}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="mx-auto max-w-6xl px-6 pb-16">
        {filteredPeople.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 py-24 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100">
              <svg
                className="h-5 w-5 text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium text-zinc-900">
              {activeTag ? `No people tagged "${activeTag}"` : "No people found"}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {activeTag
                ? "Try a different filter."
                : "Add your first contact to get started."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="py-3 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Name
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Role
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Email
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Phone
                  </th>
                  <th className="pl-3 pr-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Tags
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {filteredPeople.map((person) => (
                  <tr
                    key={person.id}
                    className="transition-colors hover:bg-zinc-50"
                  >
                    <td className="py-3.5 pl-4 pr-3">
                      <Link
                        href={`/people/${person.id}`}
                        className="font-medium text-zinc-900 hover:text-zinc-600 transition-colors"
                      >
                        {person.first_name} {person.last_name}
                      </Link>
                    </td>
                    <td className="px-3 py-3.5">
                      {Array.isArray(person.categories) && person.categories.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {person.categories.map((cat) => (
                            <span
                              key={cat}
                              className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
                            >
                              {CATEGORY_LABELS[cat] ?? cat}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5">
                      {person.email ? (
                        <span className="text-zinc-600">{person.email}</span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5">
                      {person.phone ? (
                        <span className="text-zinc-600">{person.phone}</span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="pl-3 pr-4 py-3.5">
                      {person.person_tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {person.person_tags.map((pt) => (
                            <span
                              key={pt.tag_id}
                              className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700"
                            >
                              {pt.tags.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-300">—</span>
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
