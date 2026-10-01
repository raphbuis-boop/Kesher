export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { isDemoWorkspaceLoaded } from "@/lib/demoWorkspace";
import { getCategoryCounts } from "@/lib/categoryCounts";
import { DemoWorkspaceControl } from "@/app/components/DemoWorkspaceControl";
import { AdminOnly } from "@/app/components/AdminOnly";
import { AddPersonButton, type Tag } from "./AddPersonButton";
import { PeopleClient } from "./PeopleClient";
import { listPeople, parsePeopleQuery } from "./query";

export type PersonRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  grade: string | null;
  categories: string[] | null;
  created_at: string;
  person_tags: Array<{ tag_id: string; tags: Tag }>;
};

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = parsePeopleQuery(await searchParams);
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();

  // Tags are needed to resolve tag-name search, so the people page query
  // chains off them; counts and the demo check run alongside.
  const tagsPromise = supabase.from("tags").select("id, name").eq("org_id", orgId).order("name");
  const [tagsResult, peopleResult, counts, demoLoaded] = await Promise.all([
    tagsPromise,
    tagsPromise.then(({ data }) => listPeople(supabase, orgId, (data ?? []) as Tag[], query)),
    getCategoryCounts(supabase, orgId),
    isDemoWorkspaceLoaded(supabase, orgId),
  ]);

  if (peopleResult.error) throw new Error(peopleResult.error.message);

  const people = (peopleResult.data ?? []) as unknown as PersonRow[];
  const tags = (tagsResult.data ?? []) as Tag[];

  return (
    <div className="min-h-screen bg-canvas">
      {/* Sticky page header */}
      <header className="sticky top-0 z-10 border-b border-line bg-card/95 backdrop-blur-sm px-6 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[13px] font-semibold text-ink">People</h1>
            <p className="text-[11px] text-ink-3 mt-px">
              {counts.total.toLocaleString()} contacts
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {demoLoaded && <AdminOnly><DemoWorkspaceControl mode="remove" /></AdminOnly>}
            <AddPersonButton tags={tags} />
          </div>
        </div>
      </header>

      <PeopleClient
        people={people}
        matchCount={peopleResult.count ?? people.length}
        counts={counts}
        query={query}
      />
    </div>
  );
}
