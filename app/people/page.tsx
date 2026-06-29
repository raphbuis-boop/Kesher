export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AddPersonButton, type Tag } from "./AddPersonButton";
import { Search, UserX } from "lucide-react";

type PersonWithTags = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  categories: string[] | null;
  created_at: string;
  person_tags: Array<{ tag_id: string; tags: Tag }>;
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

const CATEGORY_COLORS: Record<string, string> = {
  parent: "bg-violet-50 text-violet-700",
  student: "bg-blue-50 text-blue-700",
  faculty: "bg-amber-50 text-amber-700",
  alumni: "bg-teal-50 text-teal-700",
  donor: "bg-emerald-50 text-emerald-700",
  board: "bg-rose-50 text-rose-700",
  staff: "bg-orange-50 text-orange-700",
  grandparent: "bg-purple-50 text-purple-700",
  prospect: "bg-zinc-100 text-zinc-600",
};

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

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
      .select("id, first_name, last_name, email, phone, categories, created_at, person_tags ( tag_id, tags ( id, name ) )")
      .order("last_name"),
    supabase.from("tags").select("id, name").order("name"),
  ]);

  if (peopleResult.error) throw new Error(peopleResult.error.message);

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
    <div className="min-h-screen bg-[#fafafa]">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-[#e7e7e7] bg-white/95 backdrop-blur-sm px-6 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[13px] font-semibold text-[#0f0f0f]">People</h1>
            <p className="text-[11px] text-[#a1a1aa] mt-px">{allPeople.length.toLocaleString()} contacts</p>
          </div>
          <AddPersonButton tags={allTags} />
        </div>
      </header>

      {/* Toolbar */}
      <div className="border-b border-[#e7e7e7] bg-white px-6 py-2.5">
        <div className="flex items-center gap-3">
          {/* Search */}
          <form action="/people" method="GET" className="flex-1 max-w-[280px]">
            <div className="relative">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a1a1aa]" strokeWidth={2} />
              <input
                type="text"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Search by name or email…"
                className="w-full rounded-md border border-[#e7e7e7] bg-[#fafafa] py-1.5 pl-7 pr-3 text-[12px] text-[#0f0f0f] placeholder-[#a1a1aa] outline-none focus:border-[#a1a1aa] focus:bg-white transition-all duration-150"
              />
              {activeTag && <input type="hidden" name="tag" value={activeTag} />}
            </div>
          </form>

          {/* Tag filters */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <a
                href="/people"
                className={[
                  "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-100",
                  !activeTag
                    ? "bg-[#0f0f0f] text-white"
                    : "text-[#71717a] hover:bg-[#f5f5f5] hover:text-[#0f0f0f]",
                ].join(" ")}
              >
                All
                <span className={`tabular-nums text-[10px] ${!activeTag ? "opacity-60" : "text-[#a1a1aa]"}`}>
                  {allPeople.length}
                </span>
              </a>
              {allTags.map((tag) => {
                const isActive = activeTag === tag.name;
                return (
                  <a
                    key={tag.id}
                    href={`/people?tag=${encodeURIComponent(tag.name)}`}
                    className={[
                      "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-100",
                      isActive
                        ? "bg-[#0f0f0f] text-white"
                        : "text-[#71717a] hover:bg-[#f5f5f5] hover:text-[#0f0f0f]",
                    ].join(" ")}
                  >
                    {tag.name}
                    <span className={`tabular-nums text-[10px] ${isActive ? "opacity-60" : "text-[#a1a1aa]"}`}>
                      {tagCounts[tag.name] ?? 0}
                    </span>
                  </a>
                );
              })}
            </div>
          )}

          <span className="ml-auto shrink-0 text-[11px] tabular-nums text-[#a1a1aa]">
            {filtered.length === allPeople.length
              ? `${filtered.length.toLocaleString()} ${filtered.length === 1 ? "person" : "people"}`
              : `${filtered.length.toLocaleString()} of ${allPeople.length.toLocaleString()}`}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="px-6 py-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#e7e7e7] py-24 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white border border-[#e7e7e7] mb-4">
              <UserX size={18} className="text-[#d4d4d8]" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-semibold text-[#0f0f0f]">
              {activeTag ? `No contacts tagged "${activeTag}"` : q ? "No results found" : "No contacts yet"}
            </p>
            <p className="text-[12px] text-[#a1a1aa] mt-1">
              {activeTag || q ? "Try adjusting your search or filters." : "Add your first contact to get started."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#e7e7e7] bg-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
                  <th className="py-2.5 pl-4 pr-3 text-left text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Name</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Role</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Email</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Phone</th>
                  <th className="pl-3 pr-4 py-2.5 text-left text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Tags</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((person, i) => {
                  const isLast = i === filtered.length - 1;
                  return (
                    <tr
                      key={person.id}
                      className={`group hover:bg-[#fafafa] transition-colors duration-100 ${!isLast ? "border-b border-[#f5f5f5]" : ""}`}
                    >
                      <td className="py-3 pl-4 pr-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f0f0f0] text-[10px] font-semibold text-[#71717a]">
                            {initials(person.first_name, person.last_name)}
                          </div>
                          <Link
                            href={`/people/${person.id}`}
                            className="text-[13px] font-medium text-[#0f0f0f] hover:text-[#71717a] transition-colors"
                          >
                            {person.first_name} {person.last_name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {Array.isArray(person.categories) && person.categories.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {person.categories.map((cat) => (
                              <span
                                key={cat}
                                className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${CATEGORY_COLORS[cat] ?? "bg-zinc-100 text-zinc-600"}`}
                              >
                                {CATEGORY_LABELS[cat] ?? cat}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[#d4d4d8] text-[12px]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {person.email ? (
                          <span className="text-[12px] text-[#71717a]">{person.email}</span>
                        ) : (
                          <span className="text-[#d4d4d8] text-[12px]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {person.phone ? (
                          <span className="text-[12px] font-mono text-[#71717a]">{person.phone}</span>
                        ) : (
                          <span className="text-[#d4d4d8] text-[12px]">—</span>
                        )}
                      </td>
                      <td className="pl-3 pr-4 py-3">
                        {person.person_tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {person.person_tags.map((pt) => (
                              <span
                                key={pt.tag_id}
                                className="inline-flex items-center rounded-md bg-[#f5f5f5] px-1.5 py-0.5 text-[11px] font-medium text-[#71717a]"
                              >
                                {pt.tags.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[#d4d4d8] text-[12px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
