export const dynamic = "force-dynamic";

import { getBrandingSettings } from "@/lib/settings";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const current = await getBrandingSettings();

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-[#e7e7e7] bg-white/95 backdrop-blur-sm px-6 py-3.5">
        <div>
          <h1 className="text-[13px] font-semibold text-[#0f0f0f]">Settings</h1>
          <p className="text-[11px] text-[#a1a1aa] mt-px">Email branding and sending configuration</p>
        </div>
      </header>

      <div className="px-6 py-6 max-w-lg">
        <SettingsForm current={current} />
      </div>
    </div>
  );
}
