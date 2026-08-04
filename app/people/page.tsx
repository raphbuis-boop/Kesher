export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { AddPersonButton, type Tag } from "./AddPersonButton";
import { PeopleClient } from "./PeopleClient";

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

export default async function PeoplePage() {
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();

  const [peopleResult, tagsResult] = await Promise.all([
    supabase
      .from("people")
      .select(
        "id, first_name, last_name, email, phone, whatsapp, grade, categories, created_at, person_tags ( tag_id, tags ( id, name ) )"
      )
      .eq("org_id", orgId)
      .order("last_name"),
    supabase.from("tags").select("id, name").eq("org_id", orgId).order("name"),
  ]);

  if (peopleResult.error) throw new Error(peopleResult.error.message);

  const people = (peopleResult.data ?? []) as unknown as PersonRow[];
  const tags = (tagsResult.data ?? []) as Tag[];

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Sticky page header */}
      <header className="sticky top-0 z-10 border-b border-[#e7e7e7] bg-white/95 backdrop-blur-sm px-6 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[13px] font-semibold text-[#0f0f0f]">People</h1>
            <p className="text-[11px] text-[#a1a1aa] mt-px">
              {people.length.toLocaleString()} contacts
            </p>
          </div>
          <AddPersonButton tags={tags} />
        </div>
      </header>

      <PeopleClient people={people} tags={tags} />
    </div>
  );
}
