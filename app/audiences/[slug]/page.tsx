export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AddPersonButton } from "@/app/people/AddPersonButton";

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

  // Fetch tags for the AddPersonButton (always needed)
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
    // Custom audience — look up by group ID
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

    if (tagIds.length > 0) {
      const { data, error } = await supabase
        .from("people")
        .select(
          "id, first_name, last_name, email, phone, categories, grade, person_tags ( tag_id, tags ( id, name ) )"
        )
        .order("last_name");

      if (error) throw new Error(error.message);

      const tagIdSet = new Set(tagIds);
      people = ((data ?? []) as unknown as PersonRow[]).filter((p) =>
        p.person_tags.some((pt) => tagIdSet.has(pt.tag_id))
      );
    }
  }

  // Apply search + filter in Node (all server-side, no client JS needed)
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

  // Collect unique tags across this audience (for filter bar)
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

  // Collect unique grades
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
    <div className="min-h-screen bg-white">
      {/* Page header */}
      <div className="border-b border-zinc-200">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <Link
            href="/"
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-700"
          >
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
              />
            </svg>
            Audiences
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
                {audienceLabel}
              </h1>
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-sm font-medium tabular-nums text-zinc-600">
                {people.length.toLocaleString()}
              </span>
            </div>
            <AddPersonButton
              tags={allTags}
              defaultCategories={defaultCategory ? [defaultCategory] : []}
            />
          </div>
          {audienceDescription && (
            <p className="mt-1 text-sm text-zinc-500">{audienceDescription}</p>
          )}
        </div>
      </div>

      {/* Search toolbar */}
      <div className="border-b border-zinc-100">
        <div className="mx-auto max-w-6xl px-6 py-3">
          <form action={`/audiences/${slug}`} method="GET">
            <div className="flex items-center gap-3">
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
                  placeholder={`Search ${audienceLabel.toLowerCase()}…`}
                  className="w-full rounded-md border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400"
                />
                {activeTag && (
                  <input type="hidden" name="tag" value={activeTag} />
                )}
                {activeGrade && (
                  <input type="hidden" name="grade" value={activeGrade} />
                )}
              </div>
              <span className="text-sm tabular-nums text-zinc-400">
                {filtered.length === people.length
                  ? `${people.length.toLocaleString()} contacts`
                  : `${filtered.length.toLocaleString()} of ${people.length.toLocaleString()}`}
              </span>
            </div>
          </form>
        </div>
      </div>

      {/* Filter pills */}
      {(tagsInAudience.length > 0 || gradesInAudience.length > 0) && (
        <div className="border-b border-zinc-100">
          <div className="mx-auto max-w-6xl px-6 py-2.5">
            <div className="flex items-center gap-2 overflow-x-auto">
              {tagsInAudience.map((tag) => {
                const isActive = activeTag === tag.name;
                return (
                  <Link
                    key={tag.id}
                    href={isActive ? filterLink({ tag: null }) : filterLink({ tag: tag.name })}
                    className={
                      "inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors " +
                      (isActive
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200")
                    }
                  >
                    {tag.name}
                  </Link>
                );
              })}

              {gradesInAudience.length > 0 && tagsInAudience.length > 0 && (
                <span className="text-zinc-200 select-none">|</span>
              )}

              {gradesInAudience.map((grade) => {
                const isActive = activeGrade === grade;
                return (
                  <Link
                    key={grade}
                    href={
                      isActive
                        ? filterLink({ grade: null })
                        : filterLink({ grade })
                    }
                    className={
                      "inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors " +
                      (isActive
                        ? "bg-indigo-600 text-white"
                        : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100")
                    }
                  >
                    Grade {grade}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="mx-auto max-w-6xl px-6 py-6 pb-16">
        {filtered.length === 0 ? (
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
              {hasActiveFilter
                ? "No contacts match your filters"
                : `No contacts in ${audienceLabel} yet`}
            </p>
            {hasActiveFilter && (
              <Link
                href={`/audiences/${slug}`}
                className="mt-2 text-sm text-zinc-500 transition-colors hover:text-zinc-700"
              >
                Clear filters
              </Link>
            )}
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
                    Email
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Phone
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Audiences
                  </th>
                  <th className="pl-3 pr-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Tags
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {filtered.map((person) => (
                  <tr
                    key={person.id}
                    className="transition-colors hover:bg-zinc-50"
                  >
                    <td className="py-3.5 pl-4 pr-3">
                      <Link
                        href={`/people/${person.id}`}
                        className="font-medium text-zinc-900 transition-colors hover:text-zinc-600"
                      >
                        {person.first_name} {person.last_name}
                      </Link>
                      {person.grade && (
                        <div className="mt-0.5 text-xs text-zinc-400">
                          Grade {person.grade}
                        </div>
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
                    <td className="px-3 py-3.5">
                      {Array.isArray(person.categories) &&
                      person.categories.length > 0 ? (
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
