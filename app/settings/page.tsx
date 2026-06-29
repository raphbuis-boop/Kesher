export const dynamic = "force-dynamic";

import { getBrandingSettings } from "@/lib/settings";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const current = await getBrandingSettings();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-zinc-100 px-6 py-4">
        <div>
          <h1 className="text-sm font-semibold text-zinc-900">Settings</h1>
          <p className="mt-0.5 text-xs text-zinc-400">Email branding and sending configuration</p>
        </div>
      </header>

      <div className="px-6 py-6 max-w-xl">
        <SettingsForm current={current} />
      </div>
    </div>
  );
}
