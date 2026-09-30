export const dynamic = "force-dynamic";

import { getBrandingSettings } from "@/lib/settings";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId, sendsAreSimulated } from "@/lib/org";
import { isDemoWorkspaceLoaded } from "@/lib/demoWorkspace";
import { DemoWorkspaceControl } from "@/app/components/DemoWorkspaceControl";
import { getChannelStatuses } from "./channels";
import { SettingsShell } from "./SettingsShell";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();

  const [branding, demoLoaded, simulated, claimsRes, importsRes] = await Promise.all([
    getBrandingSettings(),
    isDemoWorkspaceLoaded(supabase, orgId),
    sendsAreSimulated(orgId),
    supabase.auth.getClaims(),
    supabase
      .from("imports")
      .select("id, file_name, imported_count, failed_count, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const claims = claimsRes.data?.claims;
  const userId = claims?.sub ?? "";
  const [channels, membershipRes] = await Promise.all([
    getChannelStatuses(branding.senderEmail),
    supabase.from("memberships").select("role, created_at").eq("user_id", userId).eq("org_id", orgId).maybeSingle(),
  ]);

  const meta = (claims?.user_metadata ?? {}) as { full_name?: string; name?: string };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 border-b border-line bg-card/95 backdrop-blur-sm px-6 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[13px] font-semibold text-ink">Settings</h1>
            <p className="text-[11px] text-ink-3 mt-px">Your profile, school, channels and data</p>
          </div>
          {demoLoaded && <DemoWorkspaceControl mode="remove" />}
        </div>
      </header>

      <SettingsShell
        profile={{ name: meta.full_name ?? meta.name ?? "", email: (claims?.email as string | undefined) ?? "" }}
        branding={branding}
        role={(membershipRes.data?.role as string | undefined) ?? "owner"}
        memberSince={(membershipRes.data?.created_at as string | undefined) ?? null}
        channels={channels}
        simulated={simulated}
        imports={(importsRes.data ?? []) as ImportRow[]}
        logoUploadsEnabled={!!process.env.BLOB_READ_WRITE_TOKEN}
      />
    </div>
  );
}

export type ImportRow = {
  id: string;
  file_name: string;
  imported_count: number;
  failed_count: number | null;
  created_at: string;
};
