export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";

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

function AudienceCard({
  slug,
  label,
  count,
  type,
  description,
}: {
  slug: string;
  label: string;
  count: number;
  type: "system" | "custom";
  description?: string | null;
}) {
  const href = `/audiences/${slug}`;
  const messageHref = `/messages/new?audiences=${slug}`;

  return (
    <div className="group relative flex flex-col rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-zinc-300 hover:shadow-sm">
      {/* Type badge */}
      <div className="mb-3 flex items-center justify-between">
        <span
          className={
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
            (type === "system"
              ? "bg-zinc-100 text-zinc-500"
              : "bg-indigo-50 text-indigo-600")
          }
        >
          {type === "system" ? "System" : "Custom"}
        </span>
      </div>

      {/* Audience name + count */}
      <Link href={href} className="flex-1">
        <h3 className="text-sm font-semibold text-zinc-900 group-hover:text-zinc-700 transition-colors">
          {label}
        </h3>
        <div
          className={
            "mt-2 text-3xl font-bold tabular-nums " +
            (count === 0 ? "text-zinc-200" : "text-zinc-900")
          }
        >
          {count.toLocaleString()}
        </div>
        <div className="mt-0.5 text-xs text-zinc-400">
          {count === 1 ? "contact" : "contacts"}
        </div>
        {description && (
          <p className="mt-2 text-xs text-zinc-400 line-clamp-1">{description}</p>
        )}
      </Link>

      {/* Action row */}
      <div className="mt-4 flex items-center gap-2 border-t border-zinc-100 pt-4">
        <Link
          href={messageHref}
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
          </svg>
          Message
        </Link>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-700"
        >
          View
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

export default async function HomePage() {
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

  const systemAudiences = SYSTEM_AUDIENCES.map((audience) => ({
    ...audience,
    count: people.filter(
      (p) => Array.isArray(p.categories) && p.categories.includes(audience.category)
    ).length,
  }));

  const totalContacts = people.length;

  const customAudiences = groups.map((group) => {
    const groupTagIds = new Set(group.group_tags.map((gt) => gt.tag_id));
    const count =
      groupTagIds.size === 0
        ? 0
        : groupPeople.filter((p) =>
            p.person_tags.some((pt) => groupTagIds.has(pt.tag_id))
          ).length;
    return { ...group, count };
  });

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
                Audiences
              </h1>
              <p className="mt-0.5 text-sm text-zinc-500">
                {totalContacts.toLocaleString()}{" "}
                {totalContacts === 1 ? "contact" : "contacts"} in your directory
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/messages/new"
                className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Compose
              </Link>
              <Link
                href="/people"
                className="rounded-md border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                All Contacts
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* System Audiences */}
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            System Audiences
          </p>
          <p className="text-xs text-zinc-400">
            Built-in groups based on contact role
          </p>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {systemAudiences.map((audience) => (
            <AudienceCard
              key={audience.slug}
              slug={audience.slug}
              label={audience.label}
              count={audience.count}
              type="system"
            />
          ))}
        </div>

        {/* Custom Audiences */}
        <div className="mt-10">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Custom Audiences
            </p>
            <Link
              href="/groups"
              className="text-xs text-zinc-400 transition-colors hover:text-zinc-700"
            >
              Manage →
            </Link>
          </div>

          {customAudiences.length === 0 ? (
            <div className="mt-3 flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 py-12 text-center">
              <p className="text-sm font-medium text-zinc-500">No custom audiences yet</p>
              <p className="mt-1 text-xs text-zinc-400">
                Create tag-based groups for committees, classes, or any custom segment.
              </p>
              <Link
                href="/groups"
                className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
              >
                Create Custom Audience
              </Link>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {customAudiences.map((audience) => (
                <AudienceCard
                  key={audience.id}
                  slug={audience.id}
                  label={audience.name}
                  count={audience.count}
                  type="custom"
                  description={audience.description}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
