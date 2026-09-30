export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { getGroup, getGroupMembers, getSystemAudienceMembers, type AudienceMember } from "@/lib/audienceMembers";
import { AddPersonButton } from "@/app/people/AddPersonButton";
import { AddContactsButton } from "./AddContactsButton";
import { RemoveFromGroupButton } from "./RemoveFromGroupButton";
import { ArrowLeft, Users, Search, Mail, Plus, Sparkles } from "lucide-react";

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
type PersonRow = AudienceMember;

export default async function AudiencePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; tag?: string; grade?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();

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
  let isDynamicGroup = false;

  // Started now, awaited below — runs in parallel with the member lookups.
  const allTagsPromise = supabase
    .from("tags")
    .select("id, name")
    .eq("org_id", orgId)
    .order("name");

  if (isSystem) {
    audienceLabel = systemConfig!.label;
    defaultCategory = systemConfig!.category;
    people = await getSystemAudienceMembers(supabase, orgId, systemConfig!.category);
  } else {
    const group = await getGroup(supabase, orgId, slug);
    if (!group) notFound();

    audienceLabel = group.name;
    audienceDescription = group.description ?? "";
    isDynamicGroup = group.is_dynamic;

    // Manual "Add Contacts" only makes sense for tag-based groups — a
    // dynamic group's membership is computed from its saved rule, not by
    // hand-picking people, so we don't bother loading candidates for it.
    // Members and candidates are fetched in parallel.
    const [members, allPeopleResult] = await Promise.all([
      getGroupMembers(supabase, orgId, group),
      isDynamicGroup
        ? null
        : supabase.from("people").select("id, first_name, last_name, email").eq("org_id", orgId),
    ]);
    people = members;

    if (allPeopleResult) {
      const { data: allPeopleData, error: allPeopleError } = allPeopleResult;
      if (allPeopleError) throw new Error(allPeopleError.message);

      const memberIds = new Set(people.map((p) => p.id));
      nonMembers = (allPeopleData ?? []).filter((p) => !memberIds.has(p.id));
    }
  }

  const allTags = ((await allTagsPromise).data ?? []) as Tag[];

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
    <div className="min-h-screen bg-canvas">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-line bg-card/95 backdrop-blur-sm">
        <div className="px-6 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/audiences"
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-3 hover:text-ink-2 transition-colors shrink-0"
              >
                <ArrowLeft size={13} strokeWidth={2} />
                Audiences
              </Link>
              <span className="text-line">/</span>
              <h1 className="text-[13px] font-semibold text-ink truncate">{audienceLabel}</h1>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-ink-2">
                {people.length.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!isSystem && !isDynamicGroup && (
                <AddContactsButton groupId={slug} nonMembers={nonMembers} />
              )}
              <Link
                href={`/messages/new?audiences=${slug}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[12px] font-medium text-on-ink transition-colors hover:bg-ink-hover"
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
            <p className="mt-1 text-[11px] text-ink-3 ml-[calc(13px+0.375rem+1.25rem)]">{audienceDescription}</p>
          )}
          {isDynamicGroup && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-3 ml-[calc(13px+0.375rem+1.25rem)]">
              <Sparkles size={11} strokeWidth={2} />
              Dynamic audience — membership updates automatically from its saved rule.
            </p>
          )}
        </div>

        {/* Search + filter row */}
        <div className="border-t border-muted-2 px-6 py-2.5">
          <div className="flex items-center gap-4">
            <form action={`/audiences/${slug}`} method="GET" className="relative max-w-xs flex-1">
              <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" strokeWidth={2} />
              <input
                type="text"
                name="q"
                defaultValue={q ?? ""}
                placeholder={`Search ${audienceLabel.toLowerCase()}…`}
                className="w-full rounded-lg border border-line bg-canvas py-1.5 pl-8 pr-3 text-[12px] text-ink placeholder-line-strong outline-none transition-all focus:border-ink-3 focus:bg-card"
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
                          ? "bg-ink text-on-ink"
                          : "bg-muted text-ink-2 hover:bg-line-2"
                      }`}
                    >
                      {tag.name}
                    </Link>
                  );
                })}

                {gradesInAudience.length > 0 && tagsInAudience.length > 0 && (
                  <span className="text-line select-none px-0.5">|</span>
                )}

                {gradesInAudience.map((grade) => {
                  const isActive = activeGrade === grade;
                  return (
                    <Link
                      key={grade}
                      href={isActive ? filterLink({ grade: null }) : filterLink({ grade })}
                      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        isActive
                          ? "bg-ink text-on-ink"
                          : "bg-muted text-ink-2 hover:bg-line-2"
                      }`}
                    >
                      Grade {grade}
                    </Link>
                  );
                })}

                {hasActiveFilter && (
                  <Link
                    href={`/audiences/${slug}`}
                    className="inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium text-ink-3 hover:text-ink-2 transition-colors"
                  >
                    Clear
                  </Link>
                )}
              </div>
            )}

            <span className="ml-auto shrink-0 text-[11px] tabular-nums text-ink-3">
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
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line py-24 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card border border-line mb-4">
              <Users size={18} className="text-line-strong" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-semibold text-ink">
              {hasActiveFilter
                ? "No contacts match your filters"
                : `No contacts in ${audienceLabel} yet`}
            </p>
            {hasActiveFilter ? (
              <Link
                href={`/audiences/${slug}`}
                className="mt-2 text-[12px] text-ink-3 hover:text-ink-2 transition-colors"
              >
                Clear filters
              </Link>
            ) : !isSystem && nonMembers.length > 0 ? (
              <p className="mt-1 text-[12px] text-ink-3">
                Use "Add Contacts" above to add people to this audience.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-line bg-card shadow-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-muted-2 bg-canvas">
                  <th className="py-2.5 pl-4 pr-3 text-left text-[11px] font-semibold text-ink-3 uppercase tracking-wide">Name</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-ink-3 uppercase tracking-wide">Email</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-ink-3 uppercase tracking-wide">Phone</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-ink-3 uppercase tracking-wide">Audiences</th>
                  <th className="pl-3 pr-4 py-2.5 text-left text-[11px] font-semibold text-ink-3 uppercase tracking-wide">Tags</th>
                  {!isSystem && !isDynamicGroup && <th className="pl-3 pr-4 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {filtered.map((person, i) => {
                  const isLast = i === filtered.length - 1;
                  return (
                    <tr
                      key={person.id}
                      className={`group hover:bg-canvas transition-colors duration-100 ${!isLast ? "border-b border-muted" : ""}`}
                    >
                      <td className="py-3 pl-4 pr-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted-2 text-[10px] font-semibold text-ink-2">
                            {`${person.first_name[0] ?? ""}${person.last_name[0] ?? ""}`.toUpperCase()}
                          </div>
                          <div>
                            <Link
                              href={`/people/${person.id}`}
                              className="text-[13px] font-medium text-ink hover:text-ink-2 transition-colors"
                            >
                              {person.first_name} {person.last_name}
                            </Link>
                            {person.grade && (
                              <div className="text-[10px] text-ink-3">Grade {person.grade}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {person.email ? (
                          <span className="text-[12px] text-ink-2">{person.email}</span>
                        ) : (
                          <span className="text-line-strong text-[12px]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {person.phone ? (
                          <span className="font-mono text-[12px] text-ink-2">{person.phone}</span>
                        ) : (
                          <span className="text-line-strong text-[12px]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {Array.isArray(person.categories) && person.categories.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {person.categories.map((cat) => (
                              <span
                                key={cat}
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[cat] ?? "bg-muted text-ink-2"}`}
                              >
                                {CATEGORY_LABELS[cat] ?? cat}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-line-strong text-[12px]">—</span>
                        )}
                      </td>
                      <td className="pl-3 pr-4 py-3">
                        {person.person_tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {person.person_tags.map((pt) => (
                              <span
                                key={pt.tag_id}
                                className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-ink-2"
                              >
                                {pt.tags.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-line-strong text-[12px]">—</span>
                        )}
                      </td>
                      {!isSystem && !isDynamicGroup && (
                        <td className="pl-3 pr-4 py-3 text-right">
                          <RemoveFromGroupButton
                            groupId={slug}
                            personId={person.id}
                            name={`${person.first_name} ${person.last_name}`.trim()}
                          />
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
