-- ─── Kesher fix 1: SMS consent certification on every import ────────────────
--
-- Safe on live data, re-runnable. Records who certified that the contacts in an
-- import (file upload, Google Sheet connection or sync, or a contact added by
-- hand with a phone number) consented to receive texts, when, and the exact text.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

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
