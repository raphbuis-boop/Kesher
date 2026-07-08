export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AddPersonButton } from "@/app/people/AddPersonButton";
import { AddContactsButton } from "./AddContactsButton";
import { removeContactFromGroup } from "@/app/groups/actions";
import { ArrowLeft, Users, Search, Mail, Plus } from "lucide-react";

const SYSTEM_AUDIENCES = {
  parents: { label: "Parents", category: "parent" },
  students: { label: "Students", category: "student" },
  grandparents: { label: "Grandparents", category: "grandparent" },
  alumni: { label: "Alumni", category: "alumni" },
  faculty: { label: "Faculty", category: "faculty" },
  staff: { label: "Staff", category: "staff" },
  board: { label: "Board", category: "board" },
  donors: { label: "Donors", category: "donor" },
  prospects: { label: "Prospects", category: "prospect" },
} as const;

const CATEGORY_LABELS: Record<string, string> = {
  parent: "Parents",
  student: "Students",
  grandparent: "Grandparents",
  alumni: "Alumni",
  faculty: "Faculty",
  staff: "Staff",
  board: "Board",
  donor: "Donors",
  prospect: "Prospects",
};

const CATEGORY_COLORS: Record<string, string> = {
  parent: "bg-violet-50 text-violet-700",
  student: "bg-blue-50 text-blue-700",
  grandparent: "bg-purple-50 text-purple-700",
  alumni: "bg-indigo-50 text-indigo-700",
  faculty: "bg-amber-50 text-amber-700",
  staff: "bg-orange-50 text-orange-700",
  board: "bg-rose-50 text-rose-700",
  donor: "bg-emerald-50 text-emerald-700",
  prospect: "bg-teal-50 text-teal-700",
};

type Tag = { id: string; name: string };

type PersonRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  categories: string[] | null;
  grade: string | null;
  person_tags: Array<{ tag_id: string; tags: Tag }>;
};

type Group = {
  id: string;
  name: string;
  description: string | null;
  group_tags: Array<{ tag_id: string }>;
};

export default async function AudiencePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; tag?: string; grade?: string }>;
}) {
  const supabase = await createSupabaseServerClient();

  const { slug } = await params;
  const { q, tag: activeTag, grade: activeGrade } = await searchParams;

  const isSystem = slug in SYSTEM_AUDIENCES;
  const systemConfig = isSystem
    ? SYSTEM_AUDIENCES[slug as keyof typeof SYSTEM_AUDIENCES]
    : null;

  let audienceLabel = "";
  let audienceDescription = "";
  let defaultCategory: string | null = null;
  let people: PersonRow[] = [];
  let nonMembers: { id: string; first_name: string; last_name: string; email: string | null }[] = [];

  const { data: allTagsData } = await supabase
    .from("tags")
    .select("id, name")
    .order("name");
  const allTags = (allTagsData ?? []) as Tag[];

  if (isSystem) {
    audienceLabel = systemConfig!.label;
    defaultCategory = systemConfig!.category;

    const { data, error } = await supabase
      .from("people")
      .select(
        "id, first_name, last_name, email, phone, categories, grade, person_tags ( tag_id, tags ( id, name ) )"
      )
      .contains("categories", [systemConfig!.category])
      .order("last_name");

    if (error) throw new Error(error.message);
    people = (data ?? []) as unknown as PersonRow[];
  } else {
    const { data: group, error: groupError } = await supabase
      .from("groups")
      .select("id, name, description, group_tags ( tag_id )")
      .eq("id", slug)
      .single();

    if (groupError || !group) notFound();

    const typedGroup = group as unknown as Group;
    audienceLabel = typedGroup.name;
    audienceDescription = typedGroup.description ?? "";

    const tagIds = typedGroup.group_tags.map((gt) => gt.tag_id);

    const { data, error } = await supabase
      .from("people")
      .select(
        "id, first_name, last_name, email, phone, categories, grade, person_tags ( tag_id, tags ( id, name ) )"
      )
      .order("last_name");

    if (error) throw new Error(error.message);

    const allPeople = (data ?? []) as unknown as PersonRow[];

    if (tagIds.length > 0) {
      const tagIdSet = new Set(tagIds);
      people = allPeople.filter((p) =>
        p.person_tags.some((pt) => tagIdSet.has(pt.tag_id))
      );
    }

    const memberIds = new Set(people.map((p) => p.id));
    nonMembers = allPeople
      .filter((p) => !memberIds.has(p.id))
      .map((p) => ({ id: p.id, first_name: p.first_name, last_name: p.last_name, email: p.email }));
  }

  let filtered = people;

  if (q) {
    const lq = q.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.first_name.toLowerCase().includes(lq) ||
        p.last_name.toLowerCase().includes(lq) ||
        (p.email?.toLowerCase().includes(lq) ?? false)
    );
  }

  if (activeTag) {
    filtered = filtered.filter((p) =>
      p.person_tags.some((pt) => pt.tags?.name === activeTag)
    );
  }

  if (activeGrade) {
    filtered = filtered.filter((p) => p.grade === activeGrade);
  }

  const tagsInAudience: Tag[] = [];
  const seenTagIds = new Set<string>();
  for (const person of people) {
    for (const pt of person.person_tags) {
      if (pt.tags && !seenTagIds.has(pt.tags.id)) {
        seenTagIds.add(pt.tags.id);
        tagsInAudience.push(pt.tags);
      }
    }
  }
  tagsInAudience.sort((a, b) => a.name.localeCompare(b.name));

  const gradesInAudience = [
    ...new Set(
      people.map((p) => p.grade).filter((g): g is string => g !== null && g !== "")
    ),
  ].sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

  const hasActiveFilter = !!(q || activeTag || activeGrade);

  function filterLink(overrides: {
    q?: string | null;
    tag?: string | null;
    grade?: string | null;
  }) {
    const sp = new URLSearchParams();
    const qVal = "q" in overrides ? overrides.q : q;
    const tagVal = "tag" in overrides ? overrides.tag : activeTag;
    const gradeVal = "grade" in overrides ? overrides.grade : activeGrade;
    if (qVal) sp.set("q", qVal);
    if (tagVal) sp.set("tag", tagVal);
    if (gradeVal) sp.set("grade", gradeVal);
    const qs = sp.toString();
    return `/audiences/${slug}${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-[#e7e7e7] bg-white/95 backdrop-blur-sm">
        <div className="px-6 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/audiences"
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#a1a1aa] hover:text-[#71717a] transition-colors shrink-0"
              >
                <ArrowLeft size={13} strokeWidth={2} />
                Audiences
              </Link>
              <span className="text-[#e7e7e7]">/</span>
              <h1 className="text-[13px] font-semibold text-[#0f0f0f] truncate">{audienceLabel}</h1>
              <span className="shrink-0 rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[#71717a]">
                {people.length.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!isSystem && (
                <AddContactsButton groupId={slug} nonMembers={nonMembers} />
              )}
              <Link
                href={`/messages/new?audiences=${slug}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#0f0f0f] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#27272a]"
              >
                <Mail size={11} strokeWidth={2} />
                Message
              </Link>
              {isSystem && (
                <AddPersonButton
                  tags={allTags}
                  defaultCategories={defaultCategory ? [defaultCategory] : []}
                />
              )}
            </div>
          </div>
          {audienceDescription && (
            <p className="mt-1 text-[11px] text-[#a1a1aa] ml-[calc(13px+0.375rem+1.25rem)]">{audienceDescription}</p>
          )}
        </div>

        {/* Search + filter row */}
        <div className="border-t border-[#f0f0f0] px-6 py-2.5">
          <div className="flex items-center gap-4">
            <form action={`/audiences/${slug}`} method="GET" className="relative max-w-xs flex-1">
              <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]" strokeWidth={2} />
              <input
                type="text"
                name="q"
                defaultValue={q ?? ""}
                placeholder={`Search ${audienceLabel.toLowerCase()}…`}
                className="w-full rounded-lg border border-[#e7e7e7] bg-[#fafafa] py-1.5 pl-8 pr-3 text-[12px] text-[#0f0f0f] placeholder-[#d4d4d8] outline-none transition-all focus:border-[#a1a1aa] focus:bg-white"
              />
              {activeTag && <input type="hidden" name="tag" value={activeTag} />}
              {activeGrade && <input type="hidden" name="grade" value={activeGrade} />}
            </form>

            {(tagsInAudience.length > 0 || gradesInAudience.length > 0) && (
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {tagsInAudience.map((tag) => {
                  const isActive = activeTag === tag.name;
                  return (
                    <Link
                      key={tag.id}
                      href={isActive ? filterLink({ tag: null }) : filterLink({ tag: tag.name })}
                      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        isActive
                          ? "bg-[#0f0f0f] text-white"
                          : "bg-[#f5f5f5] text-[#71717a] hover:bg-[#ebebeb]"
                      }`}
                    >
                      {tag.name}
                    </Link>
                  );
                })}

                {gradesInAudience.length > 0 && tagsInAudience.length > 0 && (
                  <span className="text-[#e7e7e7] select-none px-0.5">|</span>
                )}

                {gradesInAudience.map((grade) => {
                  const isActive = activeGrade === grade;
                  return (
                    <Link
                      key={grade}
                      href={isActive ? filterLink({ grade: null }) : filterLink({ grade })}
                      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        isActive
                          ? "bg-[#0f0f0f] text-white"
                          : "bg-[#f5f5f5] text-[#71717a] hover:bg-[#ebebeb]"
                      }`}
                    >
                      Grade {grade}
                    </Link>
                  );
                })}

                {hasActiveFilter && (
                  <Link
                    href={`/audiences/${slug}`}
                    className="inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium text-[#a1a1aa] hover:text-[#71717a] transition-colors"
                  >
                    Clear
                  </Link>
                )}
              </div>
            )}

            <span className="ml-auto shrink-0 text-[11px] tabular-nums text-[#a1a1aa]">
              {filtered.length === people.length
                ? `${people.length.toLocaleString()} contacts`
                : `${filtered.length.toLocaleString()} of ${people.length.toLocaleString()}`}
            </span>
          </div>
        </div>
      </header>

      {/* Table */}
      <div className="px-6 py-4 pb-16">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#e7e7e7] py-24 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white border border-[#e7e7e7] mb-4">
              <Users size={18} className="text-[#d4d4d8]" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-semibold text-[#0f0f0f]">
              {hasActiveFilter
                ? "No contacts match your filters"
                : `No contacts in ${audienceLabel} yet`}
            </p>
            {hasActiveFilter ? (
              <Link
                href={`/audiences/${slug}`}
                className="mt-2 text-[12px] text-[#a1a1aa] hover:text-[#71717a] transition-colors"
              >
                Clear filters
              </Link>
            ) : !isSystem && nonMembers.length > 0 ? (
              <p className="mt-1 text-[12px] text-[#a1a1aa]">
                Use "Add Contacts" above to add people to this audience.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#e7e7e7] bg-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
                  <th className="py-2.5 pl-4 pr-3 text-left text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Name</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Email</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Phone</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Audiences</th>
                  <th className="pl-3 pr-4 py-2.5 text-left text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Tags</th>
                  {!isSystem && <th className="pl-3 pr-4 py-2.5" />}
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
                            {`${person.first_name[0] ?? ""}${person.last_name[0] ?? ""}`.toUpperCase()}
                          </div>
                          <div>
                            <Link
                              href={`/people/${person.id}`}
                              className="text-[13px] font-medium text-[#0f0f0f] hover:text-[#71717a] transition-colors"
                            >
                              {person.first_name} {person.last_name}
                            </Link>
                            {person.grade && (
                              <div className="text-[10px] text-[#a1a1aa]">Grade {person.grade}</div>
                            )}
                          </div>
                        </div>
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
                          <span className="font-mono text-[12px] text-[#71717a]">{person.phone}</span>
                        ) : (
                          <span className="text-[#d4d4d8] text-[12px]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {Array.isArray(person.categories) && person.categories.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {person.categories.map((cat) => (
                              <span
                                key={cat}
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[cat] ?? "bg-[#f5f5f5] text-[#71717a]"}`}
                              >
                                {CATEGORY_LABELS[cat] ?? cat}
                              </span>
                            ))}
                          </div>
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
                                className="inline-flex items-center rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[10px] font-medium text-[#71717a]"
                              >
                                {pt.tags.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[#d4d4d8] text-[12px]">—</span>
                        )}
                      </td>
                      {!isSystem && (
                        <td className="pl-3 pr-4 py-3 text-right">
                          <form action={removeContactFromGroup.bind(null, slug, person.id)}>
                            <button
                              type="submit"
                              className="rounded px-2 py-1 text-[11px] font-medium text-[#a1a1aa] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all hover:bg-red-50 hover:text-red-600"
                            >
                              Remove
                            </button>
                          </form>
                        </td>
                      )}
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
