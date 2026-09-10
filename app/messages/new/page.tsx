export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { resolveGroupMemberIds, type GroupRow } from "@/lib/audienceMembers";
import { ComposeFlow, type AudienceOption } from "./ComposeFlow";

const SYSTEM_AUDIENCES: { slug: string; label: string; category: string }[] = [
  { slug: "parents", label: "Parents", category: "parent" },
  { slug: "students", label: "Students", category: "student" },
  { slug: "grandparents", label: "Grandparents", category: "grandparent" },
  { slug: "alumni", label: "Alumni", category: "alumni" },
  { slug: "faculty", label: "Faculty", category: "faculty" },
  { slug: "staff", label: "Staff", category: "staff" },
  { slug: "board", label: "Board", category: "board" },
  { slug: "donors", label: "Donors", category: "donor" },
  { slug: "prospects", label: "Prospects", category: "prospect" },
];

export default async function NewMessagePage({
  searchParams,
}: {
  searchParams: Promise<{ audiences?: string }>;
}) {
  const { audiences: audiencesParam } = await searchParams;
  const initialAudienceSlugs = audiencesParam ? audiencesParam.split(",") : undefined;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "";
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();

  // Fetch all people once — compute all counts in one pass
  const { data: allPeople } = await supabase
    .from("people")
    .select("id, categories, email, phone")
    .eq("org_id", orgId);

  const people = (allPeople ?? []) as {
    id: string;
    categories: string[] | null;
    email: string | null;
    phone: string | null;
  }[];

  // System audiences
  const systemAudiences: AudienceOption[] = SYSTEM_AUDIENCES.map(
    ({ slug, label, category }) => {
      const members = people.filter(
        (p) => Array.isArray(p.categories) && p.categories.includes(category)
      );
      return {
        slug,
        label,
        totalCount: members.length,
        emailCount: members.filter((p) => p.email).length,
        phoneCount: members.filter((p) => p.phone).length,
      };
    }
  );

  // Custom audiences — tag-based groups are counted from the batch fetch
  // below; dynamic (filter_config) groups are resolved the same way the
  // audiences pages and the actual send path resolve them (see
  // lib/audienceMembers.ts), so this picker's counts never lie about who a
  // send will actually reach.
  const [groupsResult, personTagsResult] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, is_dynamic, filter_config, group_tags ( tag_id )")
      .eq("org_id", orgId)
      .order("name"),
    supabase.from("person_tags").select("person_id, tag_id"),
  ]);

  const groups = (groupsResult.data ?? []) as unknown as GroupRow[];

  const personTags = (personTagsResult.data ?? []) as {
    person_id: string;
    tag_id: string;
  }[];

  const personById = new Map(people.map((p) => [p.id, p]));

  const customAudiences: AudienceOption[] = await Promise.all(
    groups.map(async (g) => {
      let memberIds: string[];
      if (g.is_dynamic) {
        memberIds = await resolveGroupMemberIds(supabase, orgId, g);
      } else {
        const tagIdSet = new Set(g.group_tags.map((gt) => gt.tag_id));
        memberIds = [...new Set(personTags.filter((pt) => tagIdSet.has(pt.tag_id)).map((pt) => pt.person_id))];
      }
      const members = memberIds.map((id) => personById.get(id)).filter(Boolean) as typeof people;
      return {
        slug: g.id,
        label: g.name,
        totalCount: memberIds.length,
        emailCount: members.filter((p) => p.email).length,
        phoneCount: members.filter((p) => p.phone).length,
      };
    })
  );

  const audiences = [...systemAudiences, ...customAudiences];
  const attachmentsEnabled = !!process.env.BLOB_READ_WRITE_TOKEN;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-10 border-b border-[#e7e7e7] bg-white/95 backdrop-blur-sm px-6 py-3.5">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-[13px] font-semibold text-[#0f0f0f]">New Message</h1>
          <p className="text-[11px] text-[#a1a1aa] mt-px">Compose and send to your school community.</p>
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-6 py-6">
        <ComposeFlow
          audiences={audiences}
          fromEmail={fromEmail}
          initialAudienceSlugs={initialAudienceSlugs}
          attachmentsEnabled={attachmentsEnabled}
        />
      </div>
    </div>
  );
}
