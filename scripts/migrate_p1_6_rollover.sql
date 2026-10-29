-- ─── Kesher Phase 1.6: year-end rollover history ─────────────────────────────
--
-- Run AFTER migrate_p1_4_integration_requests.sql. Safe on live data,
-- re-runnable. Every "New school year" rollover is recorded with the exact
-- per-person changes it made, so it can be undone (only where the person
-- hasn't been edited since).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.rollover_runs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  school_year      text        NOT NULL,
  top_grade        text        NOT NULL,
  archive_parents  boolean     NOT NULL DEFAULT false,
  promoted_count   integer     NOT NULL DEFAULT 0,
  graduated_count  integer     NOT NULL DEFAULT 0,
  parents_archived integer     NOT NULL DEFAULT 0,
  changes          jsonb       NOT NULL DEFAULT '[]'::jsonb,
  status           text        NOT NULL DEFAULT 'applying' CHECK (status IN ('applying', 'applied', 'failed', 'undone')),
  error            text,
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  undone_at        timestamptz
);

CREATE INDEX IF NOT EXISTS rollover_runs_org_idx ON public.rollover_runs(org_id, created_at DESC);

ALTER TABLE public.rollover_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rollover_runs: admins" ON public.rollover_runs;
CREATE POLICY "rollover_runs: admins" ON public.rollover_runs FOR ALL
  USING      (public.org_role(org_id) IN ('owner', 'admin'))
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));

COMMIT;
