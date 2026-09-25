export const dynamic = "force-dynamic";

import { getBrandingSettings } from "@/lib/settings";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { isDemoWorkspaceLoaded } from "@/lib/demoWorkspace";
import { DemoWorkspaceControl } from "@/app/components/DemoWorkspaceControl";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();
  const [current, demoLoaded] = await Promise.all([
    getBrandingSettings(),
    isDemoWorkspaceLoaded(supabase, orgId),
  ]);

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur-sm px-6 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[13px] font-semibold text-text-primary">Settings</h1>
            <p className="text-[11px] text-text-subtle mt-px">Email branding and sending configuration</p>
          </div>
          {demoLoaded && <DemoWorkspaceControl mode="remove" />}
        </div>
      </header>

      <div className="px-6 py-6 max-w-lg">
        <SettingsForm current={current} />
      </div>
    </div>
  );
}
