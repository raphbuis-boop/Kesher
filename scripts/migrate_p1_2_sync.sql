-- ─── Kesher Phase 1.2: imports that update (sync engine) ─────────────────────
--
-- Run AFTER migrate_p1_1_family_model.sql. Safe on live data, re-runnable.
--
--   sync_sources  one per list the school syncs from (a CSV/Excel roster, a
--                 Google Sheet tab, later FACTS/Veracross/Blackbaud). Holds the
--                 saved column mapping so re-imports are one click.
--   sync_runs     every import / sync: the diff, its counts, warnings, and
--                 whether it was applied. This is the import/sync history.
--   people / households / guardian_students get sync_source_id; a record is
--   identified by (sync_source_id, source_id). Records are matched on that ID
--   only — two source records are never merged because they share an email.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.sync_sources (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  kind         text        NOT NULL CHECK (kind IN ('csv', 'google_sheets', 'facts', 'veracross', 'blackbaud')),
  name         text        NOT NULL,
  mapping      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  config       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  auto_sync    boolean     NOT NULL DEFAULT false,
  status       text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error')),
  last_run_at  timestamptz,
  last_run_id  uuid,
  last_error   text,
  created_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sync_sources_org_idx ON public.sync_sources(org_id);

CREATE TABLE IF NOT EXISTS public.sync_runs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  source_id   uuid        NOT NULL REFERENCES public.sync_sources(id) ON DELETE CASCADE,
  trigger     text        NOT NULL DEFAULT 'upload' CHECK (trigger IN ('upload', 'manual', 'cron')),
  status      text        NOT NULL DEFAULT 'preview'
                CHECK (status IN ('preview', 'applying', 'applied', 'failed', 'discarded')),
  file_name   text,
  stats       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  diff        jsonb,
  records     jsonb,
  warnings    text[]      NOT NULL DEFAULT '{}',
  error       text,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  applied_at  timestamptz
);

CREATE INDEX IF NOT EXISTS sync_runs_org_created_idx ON public.sync_runs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sync_runs_source_idx      ON public.sync_runs(source_id, created_at DESC);

ALTER TABLE public.people            ADD COLUMN IF NOT EXISTS sync_source_id uuid REFERENCES public.sync_sources(id) ON DELETE SET NULL;
ALTER TABLE public.households        ADD COLUMN IF NOT EXISTS sync_source_id uuid REFERENCES public.sync_sources(id) ON DELETE SET NULL;
ALTER TABLE public.guardian_students ADD COLUMN IF NOT EXISTS sync_source_id uuid REFERENCES public.sync_sources(id) ON DELETE SET NULL;

-- One record per source ID within a source
CREATE UNIQUE INDEX IF NOT EXISTS people_sync_identity_idx
  ON public.people(org_id, sync_source_id, source_id)
  WHERE sync_source_id IS NOT NULL AND source_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS households_sync_identity_idx
  ON public.households(org_id, sync_source_id, source_id)
  WHERE sync_source_id IS NOT NULL AND source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS guardian_students_sync_idx ON public.guardian_students(sync_source_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Sync setup and history are Settings → Data: owner/admin only.

ALTER TABLE public.sync_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_runs    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sync_sources: admins" ON public.sync_sources;
CREATE POLICY "sync_sources: admins" ON public.sync_sources FOR ALL
  USING      (public.org_role(org_id) IN ('owner', 'admin'))
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "sync_runs: admins" ON public.sync_runs;
CREATE POLICY "sync_runs: admins" ON public.sync_runs FOR ALL
  USING      (public.org_role(org_id) IN ('owner', 'admin'))
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));

COMMIT;

-- ─── Verify (run separately) ─────────────────────────────────────────────────
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'people' AND column_name = 'sync_source_id';
--   SELECT indexname FROM pg_indexes WHERE indexname LIKE '%sync_identity%';
