export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { getGroupMembers, type GroupRow } from "@/lib/audienceMembers";
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

  // People (for system-audience counts) and groups are fetched in parallel.
  // Fetch all people once — compute system-audience counts in one pass
  const [{ data: allPeople }, { data: groupsData }] = await Promise.all([
    supabase
      .from("people")
      .select("id, categories, email, phone, whatsapp")
      .eq("org_id", orgId),
    supabase
      .from("groups")
      .select("id, name, is_dynamic, filter_config, group_tags ( tag_id )")
      .eq("org_id", orgId)
      .order("name"),
  ]);

  const people = (allPeople ?? []) as {
    id: string;
    categories: string[] | null;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
  }[];

  // Channel counts use the same "is this person reachable?" rules as
  // sendMessage: email needs an email, SMS needs a phone, WhatsApp targets the
  // whatsapp number and falls back to phone.
  function channelCounts(members: typeof people) {
    return {
      emailCount: members.filter((p) => p.email).length,
      phoneCount: members.filter((p) => p.phone).length,
      whatsappCount: members.filter((p) => p.whatsapp?.trim() || p.phone).length,
    };
  }

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
        ...channelCounts(members),
      };
    }
  );

  // Custom audiences — members are resolved with getGroupMembers, the exact
  // function sendMessage uses (tag-based and dynamic groups, org_id-scoped),
  // so this picker's counts never lie about who a send will actually reach.
  const groups = (groupsData ?? []) as unknown as GroupRow[];

  const customAudiences: AudienceOption[] = await Promise.all(
    groups.map(async (g) => {
      let members: typeof people = [];
      try {
        members = await getGroupMembers(supabase, orgId, g);
      } catch (err) {
        console.error(`[NewMessagePage] Failed to resolve members for group ${g.id}:`, err);
      }
      return {
        slug: g.id,
        label: g.name,
        totalCount: members.length,
        ...channelCounts(members),
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
