export const dynamic = "force-dynamic";

import { getBrandingSettings } from "@/lib/settings";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMembership, isAdminRole, sendsAreSimulated } from "@/lib/org";
import { isDemoWorkspaceLoaded } from "@/lib/demoWorkspace";
import { DemoWorkspaceControl } from "@/app/components/DemoWorkspaceControl";
import { AdminOnly } from "@/app/components/AdminOnly";
import { getChannelStatuses } from "./channels";
import { SettingsShell, type TeamInvite, type TeamMember } from "./SettingsShell";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { orgId, userId, role } = await getMembership();
  const isAdmin = isAdminRole(role);

  const [branding, claimsRes] = await Promise.all([getBrandingSettings(), supabase.auth.getClaims()]);
  const claims = claimsRes.data?.claims;
  const meta = (claims?.user_metadata ?? {}) as { full_name?: string; name?: string };

  // School, team, channels and data are owner/admin only — members only get
  // their own profile and appearance, so none of this is loaded for them.
  const admin = isAdmin
    ? await Promise.all([
        isDemoWorkspaceLoaded(supabase, orgId),
        sendsAreSimulated(orgId),
        supabase
          .from("imports")
          .select("id, file_name, imported_count, failed_count, created_at")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false })
          .limit(10),
        getChannelStatuses(branding.senderEmail),
        supabase.rpc("org_members", { p_org: orgId }),
        supabase
          .from("org_invites")
          .select("id, email, role, created_at, expires_at")
          .eq("org_id", orgId)
          .is("accepted_at", null)
          .is("revoked_at", null)
          .order("created_at", { ascending: false }),
      ])
    : null;

  const [demoLoaded, simulated, importsRes, channels, membersRes, invitesRes] = admin ?? [];

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 border-b border-line bg-card/95 backdrop-blur-sm px-6 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[13px] font-semibold text-ink">Settings</h1>
            <p className="text-[11px] text-ink-3 mt-px">
              {isAdmin ? "Your profile, school, team, channels and data" : "Your profile and appearance"}
            </p>
          </div>
          {demoLoaded && <AdminOnly><DemoWorkspaceControl mode="remove" /></AdminOnly>}
        </div>
      </header>

      <SettingsShell
        currentUserId={userId}
        profile={{ name: meta.full_name ?? meta.name ?? "", email: (claims?.email as string | undefined) ?? "" }}
        branding={branding}
        role={role}
        channels={channels ?? []}
        simulated={simulated ?? false}
        imports={(importsRes?.data ?? []) as ImportRow[]}
        members={(membersRes?.data ?? []) as TeamMember[]}
        invites={withExpiry((invitesRes?.data ?? []) as Omit<TeamInvite, "expired">[])}
        logoUploadsEnabled={!!process.env.BLOB_READ_WRITE_TOKEN}
      />
    </div>
  );
}

function withExpiry(rows: Omit<TeamInvite, "expired">[]): TeamInvite[] {
  const now = Date.now();
  return rows.map((r) => ({ ...r, expired: new Date(r.expires_at).getTime() <= now }));
}

export type ImportRow = {
  id: string;
  file_name: string;
  imported_count: number;
  failed_count: number | null;
  created_at: string;
};
