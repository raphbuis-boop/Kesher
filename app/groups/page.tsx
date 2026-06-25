export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AddGroupButton, type Tag } from "./AddGroupButton";

type GroupWithTags = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  group_tags: Array<{ tag_id: string }>;
};

type PersonWithTags = {
  id: string;
  person_tags: Array<{ tag_id: string }>;
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function countMatchingPeople(group: GroupWithTags, people: PersonWithTags[]): number {
  const groupTagIds = new Set(group.group_tags.map((gt) => gt.tag_id));
  if (groupTagIds.size === 0) return 0;
  return people.filter((p) => p.person_tags.some((pt) => groupTagIds.has(pt.tag_id))).length;
}

export default async function GroupsPage() {
  const supabase = await createSupabaseServerClient();
  const [groupsResult, peopleResult, tagsResult] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, description, created_at, group_tags ( tag_id )")
      .order("created_at", { ascending: false }),
    supabase.from("people").select("id, person_tags ( tag_id )"),
    supabase.from("tags").select("id, name").order("name"),
  ]);

  if (groupsResult.error) {
    throw new Error(`Failed to load custom audiences: ${groupsResult.error.message}`);
  }

  const groups = (groupsResult.data ?? []) as unknown as GroupWithTags[];
  const people = (peopleResult.data ?? []) as unknown as PersonWithTags[];
  const tags = (tagsResult.data ?? []) as Tag[];

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-zinc-200">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
                Custom Audiences
              </h1>
              <p className="mt-0.5 text-sm text-zinc-500">
                Tag-based groups you define — committees, classes, or any custom segment.
              </p>
            </div>
            <AddGroupButton />
          </div>
        </div>
      </div>

      <div className="border-b border-zinc-100 bg-zinc-50">
        <div className="mx-auto max-w-6xl px-6 py-3">
          <p className="text-xs text-zinc-500">
            <span className="font-medium text-zinc-700">System audiences</span> like Parents and Faculty are built in.{" "}
            <span className="font-medium text-zinc-700">Custom audiences</span> are groups you create — Dinner Committee, Class of 2025, Volunteers, etc.{" "}
            <Link href="/" className="text-zinc-500 underline underline-offset-2 hover:text-zinc-700 transition-colors">
              View system audiences →
            </Link>
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-4">
        <span className="text-sm text-zinc-400">
          {groups.length === 0
            ? "No custom audiences"
            : `${groups.length} custom ${groups.length === 1 ? "audience" : "audiences"}`}
        </span>
      </div>

      <div className="mx-auto max-w-6xl px-6 pb-16">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 py-24 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100">
              <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium text-zinc-900">No custom audiences yet</p>
            <p className="mt-1 max-w-xs text-sm text-zinc-400">
              Create your first — for example, &ldquo;Dinner Committee&rdquo; or &ldquo;Class of 2025&rdquo;.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="py-3 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Name</th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Description</th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Tags</th>
                  <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">Contacts</th>
                  <th className="pl-3 pr-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Created</th>
                  <th className="pl-3 pr-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {groups.map((group) => {
                  const count = countMatchingPeople(group, people);
                  return (
                    <tr key={group.id} className="transition-colors hover:bg-zinc-50">
                      <td className="py-3.5 pl-4 pr-3">
                        <Link
                          href={`/audiences/${group.id}`}
                          className="font-medium text-zinc-900 transition-colors hover:text-zinc-600"
                        >
                          {group.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3.5 max-w-xs">
                        {group.description ? (
                          <span className="text-zinc-600 line-clamp-2">{group.description}</span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        {group.group_tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {group.group_tags.map((gt) => {
                              const tag = tags.find((t) => t.id === gt.tag_id);
                              return tag ? (
                                <span key={gt.tag_id} className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                                  {tag.name}
                                </span>
                              ) : null;
                            })}
                          </div>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <span className="tabular-nums font-medium text-zinc-900">{count.toLocaleString()}</span>
                      </td>
                      <td className="pl-3 pr-4 py-3.5">
                        <span className="tabular-nums text-zinc-400">{formatDate(group.created_at)}</span>
                      </td>
                      <td className="pl-3 pr-4 py-3.5 text-right">
                        <Link
                          href={`/messages/new?audiences=${group.id}`}
                          className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700"
                        >
                          Message
                        </Link>
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
