export const dynamic = "force-dynamic";

import { getBrandingSettings } from "@/lib/settings";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const current = await getBrandingSettings();

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-2xl px-6 py-5">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Settings</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Messaging branding applied to all outgoing emails.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-8">
        <SettingsForm current={current} />

        {/* Setup note */}
        <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
            First-time setup
          </p>
          <p className="text-sm text-zinc-500 mb-2">
            These settings are stored in your Supabase database. Run this SQL once in the Supabase SQL editor to create the table:
          </p>
          <pre className="overflow-x-auto rounded-md bg-zinc-50 border border-zinc-200 p-4 text-xs text-zinc-700 leading-relaxed">{`CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

INSERT INTO settings (key, value) VALUES
  ('school_name',    ''),
  ('school_logo_url',''),
  ('primary_color',  '#1e3a6e'),
  ('website_url',    ''),
  ('footer_text',    ''),
  ('reply_to_email', ''),
  ('sender_name',    ''),
  ('sender_email',   '')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_select" ON settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all"    ON settings FOR ALL    USING (auth.role() = 'authenticated');`}</pre>
        </div>
      </div>
    </div>
  );
}
