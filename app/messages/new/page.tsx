export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase-server";
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

  // Fetch all people once — compute all counts in one pass
  const { data: allPeople } = await supabase
    .from("people")
    .select("id, categories, email, phone");

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

  // Custom audiences (groups with tag-based membership)
  const [groupsResult, personTagsResult] = await Promise.all([
    supabase.from("groups").select("id, name, group_tags ( tag_id )").order("name"),
    supabase.from("person_tags").select("person_id, tag_id"),
  ]);

  const groups = (groupsResult.data ?? []) as {
    id: string;
    name: string;
    group_tags: { tag_id: string }[];
  }[];

  const personTags = (personTagsResult.data ?? []) as {
    person_id: string;
    tag_id: string;
  }[];

  const personById = new Map(people.map((p) => [p.id, p]));

  const customAudiences: AudienceOption[] = groups.map((g) => {
    const tagIdSet = new Set(g.group_tags.map((gt) => gt.tag_id));
    const memberIds = new Set(
      personTags
        .filter((pt) => tagIdSet.has(pt.tag_id))
        .map((pt) => pt.person_id)
    );
    const members = [...memberIds].map((id) => personById.get(id)).filter(Boolean) as typeof people;
    return {
      slug: g.id,
      label: g.name,
      totalCount: memberIds.size,
      emailCount: members.filter((p) => p.email).length,
      phoneCount: members.filter((p) => p.phone).length,
    };
  });

  const audiences = [...systemAudiences, ...customAudiences];
  const attachmentsEnabled = !!process.env.BLOB_READ_WRITE_TOKEN;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-900">New Message</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Compose and send to your school community.
          </p>
        </div>
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
