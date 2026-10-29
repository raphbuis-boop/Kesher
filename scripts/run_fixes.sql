-- ═══════════════════════════════════════════════════════════════════════════
-- Kesher — FIXES (PR "Fixes") in one file
--
-- WHAT TO DO: open the Supabase SQL Editor, paste this whole file, press Run.
-- Do it BEFORE you merge and deploy the pull request.
--
-- SAFE ON LIVE DATA
--   • Additive only: one new table and two new nullable columns. Nothing is
--     dropped, emptied, renamed or changed.
--   • One transaction: if anything fails, nothing is applied.
--   • Re-runnable: IF NOT EXISTS / DROP POLICY IF EXISTS throughout.
--
-- NEEDS: scripts/run_all_phases.sql already run (uses sync_sources, sync_runs).
--
-- AT THE BOTTOM: a table of checks. Every row should say ok = true.
--
-- Built from: scripts/migrate_fix_1_consent.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $preflight$
DECLARE
  missing text[] := ARRAY[]::text[];
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['orgs','people','sync_sources','sync_runs','memberships']
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN missing := missing || t; END IF;
  END LOOP;
  IF to_regprocedure('public.current_org_ids()') IS NULL THEN missing := missing || 'function current_org_ids()'; END IF;
  IF array_length(missing, 1) > 0 THEN
    RAISE EXCEPTION 'Kesher: your database is missing % — run scripts/run_all_phases.sql first.', array_to_string(missing, ', ');
  END IF;
END
$preflight$;

-- ═══ Fix 1 — SMS consent certification ═══
-- ─── Kesher fix 1: SMS consent certification on every import ────────────────
--
-- Safe on live data, re-runnable. Records who certified that the contacts in an
-- import (file upload, Google Sheet connection or sync, or a contact added by
-- hand with a phone number) consented to receive texts, when, and the exact text.
-- ─────────────────────────────────────────────────────────────────────────────


CREATE TABLE IF NOT EXISTS public.consent_certifications (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email    text,
  context       text        NOT NULL CHECK (context IN ('file_import', 'sheet_connect', 'sheet_sync', 'sheet_auto_sync', 'contact_create')),
  text          text        NOT NULL,
  sync_source_id uuid       REFERENCES public.sync_sources(id) ON DELETE SET NULL,
  sync_run_id   uuid        REFERENCES public.sync_runs(id) ON DELETE SET NULL,
  person_id     uuid        REFERENCES public.people(id) ON DELETE SET NULL,
  certified_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS consent_certifications_org_idx ON public.consent_certifications(org_id, certified_at DESC);

-- An automatic (nightly) Google Sheet sync only runs once an admin has certified for that sheet
ALTER TABLE public.sync_sources
  ADD COLUMN IF NOT EXISTS consent_certified_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_certified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.consent_certifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "consent_certifications: members read" ON public.consent_certifications;
DROP POLICY IF EXISTS "consent_certifications: admins insert" ON public.consent_certifications;
DROP POLICY IF EXISTS "consent_certifications: members insert own" ON public.consent_certifications;
CREATE POLICY "consent_certifications: members read" ON public.consent_certifications FOR SELECT
  USING (org_id IN (SELECT public.current_org_ids()));
-- Anyone in the school who adds contacts certifies as themselves; nobody can edit or delete a certification
CREATE POLICY "consent_certifications: members insert own" ON public.consent_certifications FOR INSERT
  WITH CHECK (org_id IN (SELECT public.current_org_ids()) AND user_id = auth.uid());


COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- CHECKS — every row should show ok = true.
-- ═══════════════════════════════════════════════════════════════════════════
SELECT check_name, ok FROM (
  SELECT 'table consent_certifications' AS check_name, to_regclass('public.consent_certifications') IS NOT NULL AS ok
  UNION ALL
  SELECT 'RLS on consent_certifications', COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.consent_certifications')), false)
  UNION ALL
  SELECT 'column ' || c, EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = split_part(c, '.', 1) AND column_name = split_part(c, '.', 2))
  FROM unnest(ARRAY['sync_sources.consent_certified_at','sync_sources.consent_certified_by']) AS c
  UNION ALL
  SELECT 'policies on consent_certifications', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'consent_certifications') = 2
) c
ORDER BY ok, check_name;
