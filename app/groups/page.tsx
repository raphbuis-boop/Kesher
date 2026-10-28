export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { AddGroupButton, type Tag } from "./AddGroupButton";
import { Users } from "lucide-react";

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
  const orgId = await getOrgId();
  const [groupsResult, peopleResult, tagsResult] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, description, created_at, group_tags ( tag_id )")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabase.from("people").select("id, person_tags ( tag_id )").eq("org_id", orgId),
    supabase.from("tags").select("id, name").eq("org_id", orgId).order("name"),
  ]);

  if (groupsResult.error) {
    throw new Error(`Failed to load custom audiences: ${groupsResult.error.message}`);
  }

  const groups = (groupsResult.data ?? []) as unknown as GroupWithTags[];
  const people = (peopleResult.data ?? []) as unknown as PersonWithTags[];
  const tags = (tagsResult.data ?? []) as Tag[];

  return (
    <div className="min-h-screen bg-canvas">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-line bg-card/95 backdrop-blur-sm px-6 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[13px] font-semibold text-ink">Custom Audiences</h1>
            <p className="text-[11px] text-ink-3 mt-px">
              Tag-based groups — committees, classes, or any custom segment.
            </p>
          </div>
          <AddGroupButton />
        </div>
      </header>

      <div className="px-6 py-4">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line py-24 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card border border-line mb-4">
              <Users size={18} className="text-line-strong" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-semibold text-ink">No custom audiences yet</p>
            <p className="mt-1 max-w-xs text-[12px] text-ink-3">
              Create your first — for example, &ldquo;Dinner Committee&rdquo; or &ldquo;Class of 2025&rdquo;.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-line bg-card shadow-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-muted-2 bg-canvas">
                  <th className="py-2.5 pl-4 pr-3 text-left text-[10px] font-semibold text-ink-3 uppercase tracking-wide">Name</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-ink-3 uppercase tracking-wide">Description</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-ink-3 uppercase tracking-wide">Tags</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-ink-3 uppercase tracking-wide">Contacts</th>
                  <th className="pl-3 pr-4 py-2.5 text-left text-[10px] font-semibold text-ink-3 uppercase tracking-wide">Created</th>
                  <th className="pl-3 pr-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {groups.map((group, i) => {
                  const count = countMatchingPeople(group, people);
                  const isLast = i === groups.length - 1;
                  return (
                    <tr
                      key={group.id}
                      className={`group hover:bg-canvas transition-colors duration-100 ${!isLast ? "border-b border-muted" : ""}`}
                    >
                      <td className="py-3.5 pl-4 pr-3">
                        <Link
                          href={`/audiences/${group.id}`}
                          className="text-[13px] font-medium text-ink transition-colors hover:text-ink-2"
                        >
                          {group.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3.5 max-w-xs">
                        {group.description ? (
                          <span className="text-[12px] text-ink-2 line-clamp-2">{group.description}</span>
                        ) : (
                          <span className="text-[12px] text-line-strong">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        {group.group_tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {group.group_tags.map((gt) => {
                              const tag = tags.find((t) => t.id === gt.tag_id);
                              return tag ? (
                                <span key={gt.tag_id} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-ink-2">
                                  {tag.name}
                                </span>
                              ) : null;
                            })}
                          </div>
                        ) : (
                          <span className="text-[12px] text-line-strong">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <span className="tabular-nums text-[13px] font-medium text-ink">{count.toLocaleString()}</span>
                      </td>
                      <td className="pl-3 pr-4 py-3.5">
                        <span className="tabular-nums text-[12px] text-ink-3">{formatDate(group.created_at)}</span>
                      </td>
                      <td className="pl-3 pr-4 py-3.5 text-right">
                        <Link
                          href={`/messages/new?audiences=${group.id}`}
                          className="inline-flex items-center gap-1 rounded-md bg-ink px-2.5 py-1.5 text-[11px] font-medium text-on-ink transition-colors hover:bg-ink-hover"
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
