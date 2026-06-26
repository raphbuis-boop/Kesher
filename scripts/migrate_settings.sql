-- ═══════════════════════════════════════════════════════════════════════════
-- Kesher — Settings table migration
-- Run in Supabase SQL Editor → SQL Editor → New query → paste → Run
--
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT DO NOTHING guards.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Settings table ────────────────────────────────────────────────────
-- Stores branding and email configuration for outgoing messages.
-- Each row is a key-value pair; keys are fixed (see KEY_MAP in lib/settings.ts).

CREATE TABLE IF NOT EXISTS settings (
  key   text PRIMARY KEY,
  value text NOT NULL DEFAULT ''
);

-- ─── 2. Seed default rows ────────────────────────────────────────────────
-- Creates the 8 known keys with empty defaults.
-- Does not overwrite existing values (ON CONFLICT DO NOTHING).

INSERT INTO settings (key, value) VALUES
  ('school_name',     ''),
  ('school_logo_url', ''),
  ('primary_color',   '#1e3a6e'),
  ('website_url',     ''),
  ('footer_text',     ''),
  ('reply_to_email',  ''),
  ('sender_name',     ''),
  ('sender_email',    '')
ON CONFLICT (key) DO NOTHING;

-- ─── 3. Row Level Security ────────────────────────────────────────────────
-- Restricts all access to authenticated sessions only.
-- Matches the policy pattern used in rls_policies.sql.

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings: authenticated full access" ON settings;
CREATE POLICY "settings: authenticated full access"
  ON settings FOR ALL
  USING      (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── Done ────────────────────────────────────────────────────────────────
-- Verify with:
--   SELECT key, value FROM settings ORDER BY key;
--   SELECT tablename, policyname, cmd
--   FROM pg_policies WHERE tablename = 'settings';
