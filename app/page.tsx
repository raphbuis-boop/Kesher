export const dynamic = "force-dynamic";

import Link from "next/link";
import { supabase } from "@/lib/supabase";

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

export default async function HomePage() {
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
      <div className="bg-white border-b border-zinc-200">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
                Audiences
              </h1>
              <p className="mt-0.5 text-sm text-zinc-500">
                {totalContacts.toLocaleString()}{" "}
                {totalContacts === 1 ? "contact" : "contacts"} in your
                directory
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {systemAudiences.map((audience) => (
            <Link
              key={audience.slug}
              href={`/audiences/${audience.slug}`}
              className="group block rounded-xl border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-zinc-900">
                  {audience.label}
                </span>
                <svg
                  className="h-4 w-4 text-zinc-300 transition-colors group-hover:text-zinc-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                  />
                </svg>
              </div>
              <div
                className={
                  "text-3xl font-bold tabular-nums " +
                  (audience.count === 0 ? "text-zinc-300" : "text-zinc-900")
                }
              >
                {audience.count.toLocaleString()}
              </div>
              <div className="mt-1 text-sm text-zinc-400">Contacts</div>
            </Link>
          ))}
        </div>

        {/* Custom Audiences */}
        {customAudiences.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Custom Audiences
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {customAudiences.map((audience) => (
                <Link
                  key={audience.id}
                  href={`/audiences/${audience.id}`}
                  className="group block rounded-xl border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold text-zinc-900">
                      {audience.name}
                    </span>
                    <svg
                      className="h-4 w-4 text-zinc-300 transition-colors group-hover:text-zinc-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                      />
                    </svg>
                  </div>
                  <div
                    className={
                      "text-3xl font-bold tabular-nums " +
                      (audience.count === 0 ? "text-zinc-300" : "text-zinc-900")
                    }
                  >
                    {audience.count.toLocaleString()}
                  </div>
                  <div className="mt-1 text-sm text-zinc-400">Contacts</div>
                  {audience.description && (
                    <p className="mt-2 text-xs text-zinc-400 line-clamp-1">
                      {audience.description}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
