-- ═══════════════════════════════════════════════════════════════════════════
-- Kesher — ALL PHASES (1 through 4) in one file
--
-- WHAT TO DO: open the Supabase SQL Editor, paste this whole file, press Run.
-- Do it BEFORE you merge and deploy the pull request.
--
-- SAFE ON LIVE DATA
--   • Additive only: new tables, new columns, new indexes, new policies. No
--     existing table is dropped, emptied or renamed, and no existing row is
--     changed (the one data copy — old opt-outs into the new suppression list —
--     only INSERTS, once per school/channel/address).
--   • The whole script runs as ONE transaction: if anything fails, nothing is
--     applied and you can fix the cause and run it again.
--   • Re-runnable: every statement is IF NOT EXISTS / DROP POLICY IF EXISTS
--     style, so running it twice does no harm.
--
-- NEEDS (already in your database from earlier migrations): the tables orgs,
-- people, groups, messages, message_recipients, settings, memberships,
-- message_threads, thread_messages, inbound_messages, and the helper functions
-- current_org_ids() and org_role() (from migrate_teams.sql). A check below stops
-- with a clear message if any are missing.
--
-- AT THE BOTTOM: a table of checks. Every row should say ok = true.
--
-- Built from, in this order: scripts/migrate_p1_1 … migrate_p4_4 (the individual
-- files stay in the repo for reference; you don't need to run them).
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Preflight: refuse to start if the base schema isn't there ─────────────
DO $preflight$
DECLARE
  missing text[] := ARRAY[]::text[];
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['orgs','people','groups','messages','message_recipients','settings','memberships','message_threads','thread_messages','inbound_messages']
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN missing := missing || t; END IF;
  END LOOP;
  IF to_regprocedure('public.current_org_ids()') IS NULL THEN missing := missing || 'function current_org_ids()'; END IF;
  IF to_regprocedure('public.org_role(uuid)') IS NULL THEN missing := missing || 'function org_role(uuid)'; END IF;
  IF array_length(missing, 1) > 0 THEN
    RAISE EXCEPTION 'Kesher: your database is missing % — run the earlier migrations (migrate_multitenancy.sql, migrate_teams.sql, migrate_phase1_up.sql) first.', array_to_string(missing, ', ');
  END IF;
END
$preflight$;

-- ═══ Phase 1.1 — family model (households, guardians, custom fields, contact preferences) ═══
-- (from scripts/migrate_p1_1_family_model.sql)

-- ─── Kesher Phase 1.1: family data model ─────────────────────────────────────
--
-- Run AFTER migrate_teams.sql (uses current_org_ids() / org_role()).
-- Safe on live data and re-runnable: only adds tables/columns and backfills
-- rows that haven't been backfilled yet. Nothing is deleted.
--
-- Model
--   households          one family unit (FACTS "family", a Google Sheet family ID…)
--   people              unchanged table; guardians and students are both people.
--                       New: household_id, source_system/source_id, status,
--                       custom_fields, missing_sync_count.
--   guardian_students   guardian ↔ student links with custodial / receives_messages.
--                       Two parents in separate households are two links, so each
--                       gets messages.
--   custom_field_defs   per-org fields (class, division, team, bus route…);
--                       values live in people.custom_fields (jsonb).
--   contact_preferences Kesher-only data (WhatsApp opt-in, language, channels,
--                       consent). A sync never writes this table.
--   orgs.type           school | shul | camp (only the column for now).
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── orgs.type ───────────────────────────────────────────────────────────────

ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'school';
DO $$ BEGIN
  ALTER TABLE public.orgs ADD CONSTRAINT orgs_type_check CHECK (type IN ('school', 'shul', 'camp'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── households ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.households (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name                text        NOT NULL DEFAULT '',
  address             text,
  source_system       text        NOT NULL DEFAULT 'manual',
  source_id           text,
  status              text        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'pending', 'archived', 'rejected')),
  missing_sync_count  integer     NOT NULL DEFAULT 0,
  last_synced_at      timestamptz,
  archived_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS households_org_id_idx ON public.households(org_id);
CREATE INDEX IF NOT EXISTS households_source_idx ON public.households(org_id, source_system, source_id);

-- ─── people: family + sync columns ───────────────────────────────────────────

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS household_id       uuid REFERENCES public.households(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_system      text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_id          text,
  ADD COLUMN IF NOT EXISTS status             text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS missing_sync_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_synced_at     timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at        timestamptz,
  ADD COLUMN IF NOT EXISTS custom_fields      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at         timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.people ADD CONSTRAINT people_status_check
    CHECK (status IN ('active', 'pending', 'archived', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS people_household_id_idx ON public.people(household_id);
CREATE INDEX IF NOT EXISTS people_org_status_idx   ON public.people(org_id, status);
CREATE INDEX IF NOT EXISTS people_source_idx       ON public.people(org_id, source_system, source_id);

-- ─── guardian_students ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.guardian_students (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  guardian_id       uuid        NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  student_id        uuid        NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  relationship      text        NOT NULL DEFAULT 'parent',
  custodial         boolean     NOT NULL DEFAULT true,
  receives_messages boolean     NOT NULL DEFAULT true,
  source_system     text        NOT NULL DEFAULT 'manual',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guardian_id, student_id),
  CHECK (guardian_id <> student_id)
);

CREATE INDEX IF NOT EXISTS guardian_students_org_idx      ON public.guardian_students(org_id);
CREATE INDEX IF NOT EXISTS guardian_students_student_idx  ON public.guardian_students(student_id);
CREATE INDEX IF NOT EXISTS guardian_students_guardian_idx ON public.guardian_students(guardian_id);

-- ─── custom_field_defs ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.custom_field_defs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  key         text        NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]{0,39}$'),
  label       text        NOT NULL,
  field_type  text        NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'select')),
  options     text[]      NOT NULL DEFAULT '{}',
  applies_to  text        NOT NULL DEFAULT 'any' CHECK (applies_to IN ('student', 'guardian', 'any')),
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, key)
);

-- ─── contact_preferences (Kesher-only; a sync never writes here) ─────────────

CREATE TABLE IF NOT EXISTS public.contact_preferences (
  person_id         uuid        PRIMARY KEY REFERENCES public.people(id) ON DELETE CASCADE,
  org_id            uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  whatsapp_opt_in   boolean,
  language          text,
  email_enabled     boolean     NOT NULL DEFAULT true,
  sms_enabled       boolean     NOT NULL DEFAULT true,
  whatsapp_enabled  boolean     NOT NULL DEFAULT true,
  preferred_channel text        CHECK (preferred_channel IN ('whatsapp', 'sms', 'email')),
  emergency_only    boolean     NOT NULL DEFAULT false,
  muted_group_ids   uuid[]      NOT NULL DEFAULT '{}',
  sms_consent_at    timestamptz,
  sms_consent_text  text,
  sms_consent_ip    text,
  consent_source    text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_preferences_org_idx ON public.contact_preferences(org_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Family data is directory data: every member of the org can read and edit it,
-- same as people. Field definitions are settings: members read, admins write.

ALTER TABLE public.households          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_students   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_defs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "households: org access" ON public.households;
CREATE POLICY "households: org access" ON public.households FOR ALL
  USING      (org_id IN (SELECT public.current_org_ids()))
  WITH CHECK (org_id IN (SELECT public.current_org_ids()));

DROP POLICY IF EXISTS "guardian_students: org access" ON public.guardian_students;
CREATE POLICY "guardian_students: org access" ON public.guardian_students FOR ALL
  USING      (org_id IN (SELECT public.current_org_ids()))
  WITH CHECK (org_id IN (SELECT public.current_org_ids()));

DROP POLICY IF EXISTS "contact_preferences: org access" ON public.contact_preferences;
CREATE POLICY "contact_preferences: org access" ON public.contact_preferences FOR ALL
  USING      (org_id IN (SELECT public.current_org_ids()))
  WITH CHECK (org_id IN (SELECT public.current_org_ids()));

DROP POLICY IF EXISTS "custom_field_defs: members read"   ON public.custom_field_defs;
DROP POLICY IF EXISTS "custom_field_defs: admins insert"  ON public.custom_field_defs;
DROP POLICY IF EXISTS "custom_field_defs: admins update"  ON public.custom_field_defs;
DROP POLICY IF EXISTS "custom_field_defs: admins delete"  ON public.custom_field_defs;
CREATE POLICY "custom_field_defs: members read" ON public.custom_field_defs FOR SELECT
  USING (org_id IN (SELECT public.current_org_ids()));
CREATE POLICY "custom_field_defs: admins insert" ON public.custom_field_defs FOR INSERT
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY "custom_field_defs: admins update" ON public.custom_field_defs FOR UPDATE
  USING      (public.org_role(org_id) IN ('owner', 'admin'))
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY "custom_field_defs: admins delete" ON public.custom_field_defs FOR DELETE
  USING (public.org_role(org_id) IN ('owner', 'admin'));

-- ─── Backfill 1: guardian ↔ student links from existing relationships ────────
-- relationships.relationship_type describes person_id's role toward
-- related_person_id ("Mother" = person is the mother of related person;
-- "Child" = person is the child). Grandparents are linked but don't receive
-- the family's school messages unless someone turns that on.

DO $$
BEGIN
  INSERT INTO public.guardian_students (org_id, guardian_id, student_id, relationship, custodial, receives_messages)
  SELECT g.org_id, r.person_id, r.related_person_id,
         lower(r.relationship_type),
         lower(r.relationship_type) <> 'grandparent',
         lower(r.relationship_type) <> 'grandparent'
  FROM public.relationships r
  JOIN public.people g ON g.id = r.person_id
  JOIN public.people s ON s.id = r.related_person_id AND s.org_id = g.org_id
  WHERE lower(r.relationship_type) IN ('parent', 'mother', 'father', 'guardian', 'grandparent')
    AND r.person_id <> r.related_person_id
  ON CONFLICT (guardian_id, student_id) DO NOTHING;

  INSERT INTO public.guardian_students (org_id, guardian_id, student_id, relationship)
  SELECT s.org_id, r.related_person_id, r.person_id, 'parent'
  FROM public.relationships r
  JOIN public.people s ON s.id = r.person_id
  JOIN public.people g ON g.id = r.related_person_id AND g.org_id = s.org_id
  WHERE lower(r.relationship_type) = 'child'
    AND r.person_id <> r.related_person_id
  ON CONFLICT (guardian_id, student_id) DO NOTHING;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'relationships table not found — skipping guardian backfill';
END $$;

-- ─── Backfill 2: households for existing families ────────────────────────────
-- Each guardian without a household gets one ("<Last name> family"), shared
-- with a spouse (relationships "Spouse") and with their linked students that
-- have no household yet. Parents with no links get their own household.
-- Only rows with household_id IS NULL are touched, so re-running is a no-op.

DO $$
DECLARE
  g  record;
  hh uuid;
BEGIN
  FOR g IN
    SELECT p.id, p.org_id, p.last_name, p.address
    FROM public.people p
    WHERE p.household_id IS NULL
      AND (
        EXISTS (SELECT 1 FROM public.guardian_students gs WHERE gs.guardian_id = p.id AND gs.receives_messages)
        OR 'parent' = ANY (COALESCE(p.categories, '{}'))
      )
    ORDER BY p.org_id, p.last_name, p.created_at
  LOOP
    -- Re-check: a spouse processed earlier in this loop may have claimed us
    CONTINUE WHEN (SELECT household_id FROM public.people WHERE id = g.id) IS NOT NULL;

    INSERT INTO public.households (org_id, name, address)
    VALUES (g.org_id, trim(COALESCE(g.last_name, '') || ' family'), g.address)
    RETURNING id INTO hh;

    UPDATE public.people SET household_id = hh WHERE id = g.id;

    BEGIN
      UPDATE public.people sp SET household_id = hh
      FROM public.relationships r
      WHERE r.person_id = g.id AND lower(r.relationship_type) = 'spouse'
        AND sp.id = r.related_person_id AND sp.org_id = g.org_id AND sp.household_id IS NULL;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    UPDATE public.people st SET household_id = hh
    FROM public.guardian_students gs
    WHERE gs.guardian_id = g.id AND gs.receives_messages
      AND st.id = gs.student_id AND st.household_id IS NULL;
  END LOOP;
END $$;

-- ═══ Phase 1.2 — imports that update (sync sources and runs) ═══
-- (from scripts/migrate_p1_2_sync.sql)

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

-- ═══ Phase 1.3 — Google Sheets connection ═══
-- (from scripts/migrate_p1_3_google_sheets.sql)

-- ─── Kesher Phase 1.3: Google Sheets connection ──────────────────────────────
--
-- Run AFTER migrate_p1_2_sync.sql. Safe on live data, re-runnable.
--
-- oauth_connections stores each school's Google connection: the account
-- email and the refresh token, AES-256-GCM encrypted by the app
-- (KESHER_ENCRYPTION_KEY). RLS is on with NO policies, so the browser can
-- never read it — only server code using the service role, always filtered
-- by org_id.
-- ─────────────────────────────────────────────────────────────────────────────


CREATE TABLE IF NOT EXISTS public.oauth_connections (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  provider           text        NOT NULL CHECK (provider IN ('google')),
  account_email      text,
  refresh_token_enc  text        NOT NULL,
  scopes             text,
  connected_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, provider)
);

ALTER TABLE public.oauth_connections ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: service role only.

-- ═══ Phase 1.4 — school-system connector requests ═══
-- (from scripts/migrate_p1_4_integration_requests.sql)

-- ─── Kesher Phase 1.4: "request integration" ─────────────────────────────────
--
-- Run AFTER migrate_p1_3_google_sheets.sql. Safe on live data, re-runnable.
-- Records which school asked for which SIS connector (FACTS / Veracross /
-- Blackbaud) so you know what to build next. One request per school per
-- provider; owners/admins of the school can create and see their own.
-- ─────────────────────────────────────────────────────────────────────────────


CREATE TABLE IF NOT EXISTS public.integration_requests (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  provider      text        NOT NULL CHECK (provider IN ('facts', 'veracross', 'blackbaud', 'other')),
  note          text,
  requested_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, provider)
);

ALTER TABLE public.integration_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integration_requests: admins read"   ON public.integration_requests;
DROP POLICY IF EXISTS "integration_requests: admins insert" ON public.integration_requests;
DROP POLICY IF EXISTS "integration_requests: admins delete" ON public.integration_requests;
CREATE POLICY "integration_requests: admins read" ON public.integration_requests FOR SELECT
  USING (public.org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY "integration_requests: admins insert" ON public.integration_requests FOR INSERT
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin') AND requested_by = auth.uid());
CREATE POLICY "integration_requests: admins delete" ON public.integration_requests FOR DELETE
  USING (public.org_role(org_id) IN ('owner', 'admin'));


-- See what schools are asking for (run as the project owner):
--   SELECT provider, count(*) FROM integration_requests GROUP BY 1 ORDER BY 2 DESC;

-- ═══ Phase 1.6 — year-end rollover ═══
-- (from scripts/migrate_p1_6_rollover.sql)

-- ─── Kesher Phase 1.6: year-end rollover history ─────────────────────────────
--
-- Run AFTER migrate_p1_4_integration_requests.sql. Safe on live data,
-- re-runnable. Every "New school year" rollover is recorded with the exact
-- per-person changes it made, so it can be undone (only where the person
-- hasn't been edited since).
-- ─────────────────────────────────────────────────────────────────────────────


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

-- ═══ Phase 2.1 — email templates per group ═══
-- (from scripts/migrate_p2_1_templates.sql)

-- ─── Kesher Phase 2.1: templates per group ───────────────────────────────────
--
-- Run AFTER migrate_p1_6_rollover.sql. Safe on live data, re-runnable.
--
--   message_templates      look & feel of an email: logo/header, colors,
--                          sender name, default subject, footer. A field left
--                          blank inherits Settings → School.
--   audience_templates     which template an audience uses by default
--                          (audience_slug is a system slug like 'parents' or a
--                          custom audience's id).
--   messages.template_id   the template a message was sent with.
--   messages.is_fundraising  fundraising messages never go out on WhatsApp
--                          (Meta blocks them to US numbers).
-- ─────────────────────────────────────────────────────────────────────────────


CREATE TABLE IF NOT EXISTS public.message_templates (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  logo_url         text,
  primary_color    text        CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9a-fA-F]{6}$'),
  background_color text        CHECK (background_color IS NULL OR background_color ~ '^#[0-9a-fA-F]{6}$'),
  sender_name      text,
  default_subject  text,
  footer_text      text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS message_templates_org_idx ON public.message_templates(org_id);

CREATE TABLE IF NOT EXISTS public.audience_templates (
  org_id         uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  audience_slug  text NOT NULL,
  template_id    uuid NOT NULL REFERENCES public.message_templates(id) ON DELETE CASCADE,
  PRIMARY KEY (org_id, audience_slug)
);

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS template_id    uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_fundraising boolean NOT NULL DEFAULT false;

-- ─── RLS: everyone in the org can read; owners/admins manage ─────────────────

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_templates: members read"  ON public.message_templates;
DROP POLICY IF EXISTS "message_templates: admins write"  ON public.message_templates;
DROP POLICY IF EXISTS "message_templates: admins insert" ON public.message_templates;
DROP POLICY IF EXISTS "message_templates: admins update" ON public.message_templates;
DROP POLICY IF EXISTS "message_templates: admins delete" ON public.message_templates;
CREATE POLICY "message_templates: members read" ON public.message_templates FOR SELECT
  USING (org_id IN (SELECT public.current_org_ids()));
CREATE POLICY "message_templates: admins insert" ON public.message_templates FOR INSERT
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY "message_templates: admins update" ON public.message_templates FOR UPDATE
  USING      (public.org_role(org_id) IN ('owner', 'admin'))
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY "message_templates: admins delete" ON public.message_templates FOR DELETE
  USING (public.org_role(org_id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "audience_templates: members read"  ON public.audience_templates;
DROP POLICY IF EXISTS "audience_templates: admins insert" ON public.audience_templates;
DROP POLICY IF EXISTS "audience_templates: admins update" ON public.audience_templates;
DROP POLICY IF EXISTS "audience_templates: admins delete" ON public.audience_templates;
CREATE POLICY "audience_templates: members read" ON public.audience_templates FOR SELECT
  USING (org_id IN (SELECT public.current_org_ids()));
CREATE POLICY "audience_templates: admins insert" ON public.audience_templates FOR INSERT
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY "audience_templates: admins update" ON public.audience_templates FOR UPDATE
  USING      (public.org_role(org_id) IN ('owner', 'admin'))
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY "audience_templates: admins delete" ON public.audience_templates FOR DELETE
  USING (public.org_role(org_id) IN ('owner', 'admin'));

-- ═══ Phase 2.2 — per-school channels (WhatsApp, SMS) ═══
-- (from scripts/migrate_p2_2_channels.sql)

-- ─── Kesher Phase 2.2: per-school channel config ─────────────────────────────
--
-- Run AFTER migrate_p2_1_templates.sql. Safe on live data, re-runnable.
--
-- Until now WhatsApp / SMS credentials were global env vars. Each school
-- now has its own:
--   org_channels  WhatsApp phone number ID, WABA ID, display name, template
--                 name / language / variable count, and SMS sender number.
--                 Owners/admins can read and edit their own row.
--   org_secrets   encrypted secrets (the school's WhatsApp access token).
--                 RLS is ON with NO policies: only the server (service role)
--                 can read it, never the browser.
--
-- use_env_defaults: when TRUE a blank field falls back to the old env vars.
-- It is switched on for every school that exists when you run this, so
-- nothing about current sending changes. Schools created afterwards default
-- to FALSE and must configure their own numbers — they can never send from
-- another school's number by accident.
-- ─────────────────────────────────────────────────────────────────────────────


CREATE TABLE IF NOT EXISTS public.org_channels (
  org_id                   uuid        PRIMARY KEY REFERENCES public.orgs(id) ON DELETE CASCADE,
  use_env_defaults         boolean     NOT NULL DEFAULT false,
  whatsapp_phone_number_id text,
  whatsapp_waba_id         text,
  whatsapp_display_name    text,
  whatsapp_template_name   text,
  whatsapp_template_lang   text        NOT NULL DEFAULT 'en_US',
  -- 1 = body only; 2 = {{1}} school/group name + {{2}} message body
  whatsapp_template_vars   integer     NOT NULL DEFAULT 1 CHECK (whatsapp_template_vars IN (1, 2)),
  sms_sender               text,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_secrets (
  org_id     uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  key        text        NOT NULL CHECK (key IN ('whatsapp_token')),
  value_enc  text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, key)
);

ALTER TABLE public.org_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_secrets  ENABLE ROW LEVEL SECURITY;
-- org_secrets: intentionally no policies.

DROP POLICY IF EXISTS "org_channels: admins read"   ON public.org_channels;
DROP POLICY IF EXISTS "org_channels: admins insert" ON public.org_channels;
DROP POLICY IF EXISTS "org_channels: admins update" ON public.org_channels;
CREATE POLICY "org_channels: admins read" ON public.org_channels FOR SELECT
  USING (public.org_role(org_id) IN ('owner', 'admin'));
-- use_env_defaults can only be switched on by the server (service role), not by a browser session
CREATE POLICY "org_channels: admins insert" ON public.org_channels FOR INSERT
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin') AND use_env_defaults = false);
CREATE POLICY "org_channels: admins update" ON public.org_channels FOR UPDATE
  USING      (public.org_role(org_id) IN ('owner', 'admin'))
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));

-- A browser session can never change use_env_defaults (otherwise an admin could
-- switch on the platform's number for their own school). Only the SQL editor /
-- service role can.
CREATE OR REPLACE FUNCTION public.org_channels_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.use_env_defaults IS DISTINCT FROM OLD.use_env_defaults AND current_user IN ('authenticated', 'anon') THEN
    NEW.use_env_defaults := OLD.use_env_defaults;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS org_channels_guard_trg ON public.org_channels;
CREATE TRIGGER org_channels_guard_trg BEFORE UPDATE ON public.org_channels
  FOR EACH ROW EXECUTE FUNCTION public.org_channels_guard();

-- Existing schools keep sending exactly as before (env fallback on)
INSERT INTO public.org_channels (org_id, use_env_defaults)
SELECT id, true FROM public.orgs
ON CONFLICT (org_id) DO NOTHING;

-- ═══ Phase 2.3 — send engine (multichannel, household dedupe, fallbacks) ═══
-- (from scripts/migrate_p2_3_send_engine.sql)

-- ─── Kesher Phase 2.3: one send, multichannel, household dedupe ──────────────
--
-- Run AFTER migrate_p2_2_channels.sql. Safe on live data, re-runnable: only
-- adds nullable / defaulted columns. Existing messages keep working exactly
-- as before (channel = their single channel, recipients have channel NULL).
--
-- messages
--   channels       the channels picked for the send
--   channel_mode   'all' = every selected channel; 'best' = WhatsApp first,
--                  then SMS, then email, falling back if one fails
--   family_prefix  start each parent's message with "For Moshe (3rd) and …"
--   is_emergency   emergency messages reach "emergency only" parents
--   payload        everything needed to (re)build the send: audiences,
--                  greeting, attachments, exclusions…
--   channel        'email' | 'sms' | 'whatsapp' for single-channel sends,
--                  'multi' when several channels were used
-- message_recipients
--   channel        which channel this row went out on (NULL = message.channel)
--   children_label "Moshe (3rd) and Rivka (6th)" — whose message this is
--   children       the same children as data (for merge tokens)
--   fallbacks      channels still to try if this one fails (best-channel mode)
--   claimed_at     when a worker took this row (so a re-run never double-sends)
--   fallback_of    the failed row this one is the fallback for
--   status         new transient states 'queued' / 'sending' (the engine is
--                  resumable and never double-sends)
-- ─────────────────────────────────────────────────────────────────────────────


ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS channels      text[],
  ADD COLUMN IF NOT EXISTS channel_mode  text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS family_prefix boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_emergency  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payload       jsonb;

DO $$ BEGIN
  ALTER TABLE public.messages ADD CONSTRAINT messages_channel_mode_check CHECK (channel_mode IN ('all', 'best'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.message_recipients
  ADD COLUMN IF NOT EXISTS channel        text,
  ADD COLUMN IF NOT EXISTS children_label text,
  ADD COLUMN IF NOT EXISTS children       jsonb,
  ADD COLUMN IF NOT EXISTS fallbacks      text[],
  ADD COLUMN IF NOT EXISTS claimed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS fallback_of    uuid REFERENCES public.message_recipients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS message_recipients_message_status_idx ON public.message_recipients(message_id, status);
-- a failed row gets at most one fallback row, even if its failure webhook arrives twice
CREATE UNIQUE INDEX IF NOT EXISTS message_recipients_fallback_of_uidx
  ON public.message_recipients(fallback_of) WHERE fallback_of IS NOT NULL;

-- ═══ Phase 2.4 — scheduling, drafts, approvals, repeating sends ═══
-- (from scripts/migrate_p2_4_scheduling.sql)

-- ─── Kesher Phase 2.4: scheduling, drafts, approvals, recurring sends ────────
--
-- Run AFTER migrate_p2_3_send_engine.sql. Safe on live data, re-runnable:
-- additive columns and new tables only.
--
-- messages.status now also uses:
--   draft · pending_approval · scheduled · cancelled · rejected
--   (alongside the existing sending · sent · failed)
--
-- recurring_sends  a repeating send (weekly newsletter): the message blueprint
--                  plus a rule ("every N weeks on <weekday> at <time>", later
--                  also "N hours before candle lighting"). The dispatcher turns
--                  each due occurrence into a normal scheduled message exactly
--                  once (unique recurring_id + scheduled_for).
-- system_heartbeats  last time the dispatcher ran, so the app can warn when
--                  scheduled sends aren't being picked up.
-- ─────────────────────────────────────────────────────────────────────────────


CREATE TABLE IF NOT EXISTS public.recurring_sends (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  active         boolean     NOT NULL DEFAULT true,
  timezone       text        NOT NULL DEFAULT 'America/New_York',
  -- {"kind":"clock","everyWeeks":1,"weekday":0,"time":"09:00"}
  rule           jsonb       NOT NULL,
  payload        jsonb       NOT NULL,
  subject        text,
  body           text        NOT NULL,
  audience_label text        NOT NULL DEFAULT '',
  next_run_at    timestamptz,
  last_run_at    timestamptz,
  created_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recurring_sends_due_idx ON public.recurring_sends(next_run_at) WHERE active;
CREATE INDEX IF NOT EXISTS recurring_sends_org_idx ON public.recurring_sends(org_id);

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_for    timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_at       timestamptz,
  ADD COLUMN IF NOT EXISTS requested_at     timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at      timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at      timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS recurring_id     uuid REFERENCES public.recurring_sends(id) ON DELETE SET NULL;

-- A recurring send creates each occurrence once, even if the dispatcher runs twice
CREATE UNIQUE INDEX IF NOT EXISTS messages_recurring_occurrence_uidx
  ON public.messages(recurring_id, scheduled_for) WHERE recurring_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS messages_due_idx ON public.messages(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS messages_org_status_idx ON public.messages(org_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.system_heartbeats (
  name        text        PRIMARY KEY,
  last_run_at timestamptz NOT NULL DEFAULT now(),
  detail      jsonb
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- recurring_sends: any member can see them; owners/admins manage them.
-- system_heartbeats: readable by any signed-in user (it's just a timestamp);
-- written only by the server (service role).

ALTER TABLE public.recurring_sends   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_heartbeats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recurring_sends: members read"  ON public.recurring_sends;
DROP POLICY IF EXISTS "recurring_sends: admins write"  ON public.recurring_sends;
DROP POLICY IF EXISTS "recurring_sends: admins insert" ON public.recurring_sends;
DROP POLICY IF EXISTS "recurring_sends: admins update" ON public.recurring_sends;
DROP POLICY IF EXISTS "recurring_sends: admins delete" ON public.recurring_sends;
CREATE POLICY "recurring_sends: members read" ON public.recurring_sends FOR SELECT
  USING (org_id IN (SELECT public.current_org_ids()));
CREATE POLICY "recurring_sends: admins insert" ON public.recurring_sends FOR INSERT
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY "recurring_sends: admins update" ON public.recurring_sends FOR UPDATE
  USING      (public.org_role(org_id) IN ('owner', 'admin'))
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY "recurring_sends: admins delete" ON public.recurring_sends FOR DELETE
  USING (public.org_role(org_id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "system_heartbeats: signed-in read" ON public.system_heartbeats;
CREATE POLICY "system_heartbeats: signed-in read" ON public.system_heartbeats FOR SELECT
  USING (auth.role() = 'authenticated');

-- ═══ Phase 2.5 — honest read tracking ═══
-- (from scripts/migrate_p2_5_tracking.sql)

-- ─── Kesher Phase 2.5: honest read tracking ──────────────────────────────────
--
-- Run AFTER migrate_p2_4_scheduling.sql. Safe on live data, re-runnable:
-- additive columns and indexes only.
--
-- message_recipients.confirmed_at  the parent tapped "I've read this" (a signed
--                                  per-recipient link; the only signal that is
--                                  certain a person saw the message)
-- messages.resend_of               a reminder sent to people who hadn't confirmed
--                                  or read the original
-- ─────────────────────────────────────────────────────────────────────────────


ALTER TABLE public.message_recipients ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
ALTER TABLE public.messages           ADD COLUMN IF NOT EXISTS resend_of    uuid REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS message_recipients_confirmed_idx ON public.message_recipients(message_id) WHERE confirmed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS messages_resend_of_idx           ON public.messages(resend_of)           WHERE resend_of IS NOT NULL;
-- "delivery problems" report: recent failures and bounces
CREATE INDEX IF NOT EXISTS message_recipients_failed_idx    ON public.message_recipients(message_id) WHERE status = 'failed';

-- ═══ Phase 3.1 — Shabbos and Yom Tov mode ═══
-- (from scripts/migrate_p3_1_shabbos.sql)

-- ─── Kesher Phase 3.1: Shabbos & Yom Tov mode ────────────────────────────────
--
-- Run AFTER migrate_p2_5_tracking.sql. Safe on live data, re-runnable:
-- new tables and one additive column only. Off for every school until an
-- owner/admin turns it on in Settings → Shabbos & Yom Tov.
--
-- org_shabbos       one row per school: on/off, location, candle-lighting and
--                   havdalah rules, and the buffer after havdalah.
-- shabbos_windows   the cached candle-lighting → havdalah windows for the next
--                   few months (refreshed weekly from Hebcal), so sending never
--                   waits on a network call.
-- window_overrides  the audit log of emergency sends during a window.
-- messages.window_override_reason  set when an owner sent during a window.
-- ─────────────────────────────────────────────────────────────────────────────


CREATE TABLE IF NOT EXISTS public.org_shabbos (
  org_id            uuid        PRIMARY KEY REFERENCES public.orgs(id) ON DELETE CASCADE,
  enabled           boolean     NOT NULL DEFAULT false,
  geo_kind          text        NOT NULL DEFAULT 'zip' CHECK (geo_kind IN ('zip', 'geoname')),
  zip               text,
  geonameid         text,
  israel_schedule   boolean     NOT NULL DEFAULT false,
  location_name     text,
  tzid              text,
  latitude          numeric,
  longitude         numeric,
  candle_minutes    integer     NOT NULL DEFAULT 18 CHECK (candle_minutes BETWEEN 0 AND 90),
  havdalah_mode     text        NOT NULL DEFAULT 'minutes' CHECK (havdalah_mode IN ('minutes', 'tzeis')),
  havdalah_minutes  integer     NOT NULL DEFAULT 50 CHECK (havdalah_minutes BETWEEN 20 AND 120),
  buffer_minutes    integer     NOT NULL DEFAULT 30 CHECK (buffer_minutes BETWEEN 0 AND 240),
  fetched_at        timestamptz,
  fetch_error       text,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shabbos_windows (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  starts_at   timestamptz NOT NULL,   -- candle lighting
  ends_at     timestamptz NOT NULL,   -- havdalah (the buffer is added by the app)
  kind        text        NOT NULL DEFAULT 'shabbos' CHECK (kind IN ('shabbos', 'yomtov')),
  label       text,
  fetched_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, starts_at)
);
CREATE INDEX IF NOT EXISTS shabbos_windows_org_range_idx ON public.shabbos_windows(org_id, ends_at);

CREATE TABLE IF NOT EXISTS public.window_overrides (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  message_id  uuid        REFERENCES public.messages(id) ON DELETE SET NULL,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reason      text        NOT NULL,
  window_label text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS window_overrides_org_idx ON public.window_overrides(org_id, created_at DESC);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS window_override_reason text;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Members can read their school's settings and windows (the app shows "Next
-- Shabbos" to everyone); owners/admins change the settings. Windows and the
-- override log are written by server code only (service role) — except that an
-- owner's emergency override is logged under their own session.

ALTER TABLE public.org_shabbos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shabbos_windows  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.window_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_shabbos: members read"   ON public.org_shabbos;
DROP POLICY IF EXISTS "org_shabbos: admins insert"  ON public.org_shabbos;
DROP POLICY IF EXISTS "org_shabbos: admins update"  ON public.org_shabbos;
CREATE POLICY "org_shabbos: members read"  ON public.org_shabbos FOR SELECT
  USING (org_id IN (SELECT public.current_org_ids()));
CREATE POLICY "org_shabbos: admins insert" ON public.org_shabbos FOR INSERT
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY "org_shabbos: admins update" ON public.org_shabbos FOR UPDATE
  USING      (public.org_role(org_id) IN ('owner', 'admin'))
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "shabbos_windows: members read" ON public.shabbos_windows;
CREATE POLICY "shabbos_windows: members read" ON public.shabbos_windows FOR SELECT
  USING (org_id IN (SELECT public.current_org_ids()));

DROP POLICY IF EXISTS "window_overrides: admins read"     ON public.window_overrides;
DROP POLICY IF EXISTS "window_overrides: owners insert"   ON public.window_overrides;
CREATE POLICY "window_overrides: admins read" ON public.window_overrides FOR SELECT
  USING (public.org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY "window_overrides: owners insert" ON public.window_overrides FOR INSERT
  WITH CHECK (public.org_role(org_id) = 'owner' AND user_id = auth.uid());

-- ═══ Phase 4.1 — parent self-signup ═══
-- (from scripts/migrate_p4_1_signup.sql)

-- ─── Kesher Phase 4.1: parent self-signup ────────────────────────────────────
--
-- Run AFTER migrate_p3_1_shabbos.sql. Safe on live data, re-runnable.
--
-- signup_otps  one-time phone verification codes for the public signup form.
--              RLS is on with NO policies: only server code (service role) can
--              read or write it, so codes can never be read from a browser.
-- contact_preferences.phone_verified_at  when the parent proved they own the
--              number (shown to staff in "Review new contacts").
--
-- Signups themselves are ordinary rows: a household, a parent and the
-- children with status 'pending', so they appear in the existing Review new
-- contacts queue. The consent text, time and IP are stored in
-- contact_preferences (sms_consent_text / sms_consent_at / sms_consent_ip).
-- ─────────────────────────────────────────────────────────────────────────────


CREATE TABLE IF NOT EXISTS public.signup_otps (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  phone        text        NOT NULL,
  code_hash    text        NOT NULL,
  expires_at   timestamptz NOT NULL,
  attempts     integer     NOT NULL DEFAULT 0,
  verified_at  timestamptz,
  used_at      timestamptz,
  ip           text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS signup_otps_phone_idx ON public.signup_otps(org_id, phone, created_at DESC);
CREATE INDEX IF NOT EXISTS signup_otps_ip_idx    ON public.signup_otps(ip, created_at DESC);
ALTER TABLE public.signup_otps ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: service role only.

ALTER TABLE public.contact_preferences ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;
CREATE INDEX IF NOT EXISTS contact_preferences_consent_ip_idx ON public.contact_preferences(sms_consent_ip, sms_consent_at DESC) WHERE sms_consent_ip IS NOT NULL;

-- ═══ Phase 4.3 — opt-out engine (suppression list) ═══
-- (from scripts/migrate_p4_3_suppressions.sql)

-- ─── Kesher Phase 4.3: opt-out engine ────────────────────────────────────────
--
-- Run AFTER migrate_p4_1_signup.sql. Safe on live data, re-runnable.
--
-- suppressions   ONE list of "never message this address on this channel" per
--                school. A parent's STOP reply, an email unsubscribe (link or
--                one-click), a spam complaint, a hard bounce, or a staff action
--                each add a row; START (or staff, with a recorded reason)
--                releases it. Sending checks only this table.
--
-- Until now an opt-out was a status on message_recipients rows (and the STOP
-- handler matched phone numbers across every school). Existing opt-outs are
-- copied here once, per school, by the INSERT below.
-- ─────────────────────────────────────────────────────────────────────────────


CREATE TABLE IF NOT EXISTS public.suppressions (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  channel               text        NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
  -- lowercase email, or E.164 phone number
  address               text        NOT NULL,
  person_id             uuid        REFERENCES public.people(id) ON DELETE SET NULL,
  reason                text        NOT NULL CHECK (reason IN ('stop', 'unsubscribe', 'complaint', 'bounce', 'manual')),
  source                text,
  keyword               text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  released_at           timestamptz,
  released_by           uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  release_reason        text,
  -- the one confirmation text sent after a STOP
  confirmation_sent_at  timestamptz,
  confirmation_attempts integer     NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS suppressions_active_uidx ON public.suppressions(org_id, channel, address) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS suppressions_person_idx ON public.suppressions(org_id, person_id);
CREATE INDEX IF NOT EXISTS suppressions_confirm_idx ON public.suppressions(created_at) WHERE confirmation_sent_at IS NULL AND released_at IS NULL AND source IN ('sms_reply', 'whatsapp_reply');

-- ─── Copy existing opt-outs (once per school/channel/address) ────────────────
INSERT INTO public.suppressions (org_id, channel, address, person_id, reason, source, created_at)
SELECT DISTINCT ON (m.org_id, x.ch, x.addr)
       m.org_id, x.ch, x.addr, mr.person_id,
       CASE WHEN x.ch = 'email' THEN 'unsubscribe' ELSE 'stop' END,
       'legacy',
       COALESCE(mr.replied_at, mr.sent_at, now())
FROM public.message_recipients mr
JOIN public.messages m ON m.id = mr.message_id
CROSS JOIN LATERAL (
  SELECT
    CASE WHEN position('@' IN mr.contact_value) > 0 THEN 'email'
         WHEN mr.channel IN ('sms', 'whatsapp') THEN mr.channel
         WHEN m.channel IN ('sms', 'whatsapp') THEN m.channel
         ELSE 'sms' END AS ch,
    CASE WHEN position('@' IN mr.contact_value) > 0 THEN lower(btrim(mr.contact_value)) ELSE btrim(mr.contact_value) END AS addr
) x
WHERE mr.status = 'opted_out' AND m.org_id IS NOT NULL AND btrim(mr.contact_value) <> ''
ORDER BY m.org_id, x.ch, x.addr, COALESCE(mr.replied_at, mr.sent_at, now())
ON CONFLICT DO NOTHING;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Members can see their school's list (the person page shows who opted out);
-- only owners/admins can add by hand or release one. Webhooks and the send
-- engine use the service role.

ALTER TABLE public.suppressions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suppressions: members read"  ON public.suppressions;
DROP POLICY IF EXISTS "suppressions: admins insert" ON public.suppressions;
DROP POLICY IF EXISTS "suppressions: admins update" ON public.suppressions;
CREATE POLICY "suppressions: members read"  ON public.suppressions FOR SELECT
  USING (org_id IN (SELECT public.current_org_ids()));
CREATE POLICY "suppressions: admins insert" ON public.suppressions FOR INSERT
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY "suppressions: admins update" ON public.suppressions FOR UPDATE
  USING      (public.org_role(org_id) IN ('owner', 'admin'))
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));

-- ═══ Phase 4.4 — two-way inbox ═══
-- (from scripts/migrate_p4_4_inbox.sql)

-- ─── Kesher Phase 4.4: two-way inbox ─────────────────────────────────────────
--
-- Run AFTER migrate_p4_3_suppressions.sql. Safe on live data, re-runnable:
-- additive columns and indexes on the existing message_threads / thread_messages
-- tables (unused until now).
--
-- One thread per guardian per school (a parent who texts and also WhatsApps
-- stays in one conversation); each message records its channel and, for a reply,
-- the message it answers.
-- ─────────────────────────────────────────────────────────────────────────────


ALTER TABLE public.message_threads
  ADD COLUMN IF NOT EXISTS address                  text,
  ADD COLUMN IF NOT EXISTS display_name             text,
  ADD COLUMN IF NOT EXISTS status                   text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS assigned_to              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unread_count             integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_inbound_at          timestamptz,
  ADD COLUMN IF NOT EXISTS last_inbound_channel     text,
  ADD COLUMN IF NOT EXISTS last_whatsapp_inbound_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_preview             text;

DO $$ BEGIN
  ALTER TABLE public.message_threads ADD CONSTRAINT message_threads_status_check CHECK (status IN ('open', 'done'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.thread_messages
  ADD COLUMN IF NOT EXISTS org_id                uuid REFERENCES public.orgs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS channel               text,
  ADD COLUMN IF NOT EXISTS kind                  text NOT NULL DEFAULT 'message',
  ADD COLUMN IF NOT EXISTS reply_to_recipient_id uuid REFERENCES public.message_recipients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_by               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS error_detail          text;

DO $$ BEGIN
  ALTER TABLE public.thread_messages ADD CONSTRAINT thread_messages_channel_check CHECK (channel IS NULL OR channel IN ('sms', 'whatsapp'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.thread_messages ADD CONSTRAINT thread_messages_kind_check CHECK (kind IN ('message', 'optout', 'optin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE public.thread_messages tm SET org_id = t.org_id FROM public.message_threads t WHERE t.id = tm.thread_id AND tm.org_id IS NULL;

CREATE INDEX IF NOT EXISTS message_threads_inbox_idx ON public.message_threads(org_id, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS message_threads_unread_idx ON public.message_threads(org_id) WHERE unread_count > 0;
CREATE INDEX IF NOT EXISTS thread_messages_org_idx   ON public.thread_messages(org_id, created_at DESC);
-- A provider retrying a webhook can't create the same message twice
CREATE UNIQUE INDEX IF NOT EXISTS thread_messages_provider_uidx ON public.thread_messages(org_id, provider_message_id) WHERE provider_message_id IS NOT NULL;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- CHECKS — run as part of the same paste. Every row should show ok = true.
-- ═══════════════════════════════════════════════════════════════════════════
SELECT check_name, ok FROM (
  -- new tables exist
  SELECT 'table ' || t AS check_name, to_regclass('public.' || t) IS NOT NULL AS ok
  FROM unnest(ARRAY['households','guardian_students','custom_field_defs','contact_preferences','sync_sources','sync_runs','oauth_connections','integration_requests','rollover_runs','message_templates','audience_templates','org_channels','org_secrets','recurring_sends','system_heartbeats','org_shabbos','shabbos_windows','window_overrides','signup_otps','suppressions']) AS t
  UNION ALL
  -- row-level security is ON for every new table
  SELECT 'RLS on ' || t, COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.' || t)), false)
  FROM unnest(ARRAY['households','guardian_students','custom_field_defs','contact_preferences','sync_sources','sync_runs','oauth_connections','integration_requests','rollover_runs','message_templates','audience_templates','org_channels','org_secrets','recurring_sends','system_heartbeats','org_shabbos','shabbos_windows','window_overrides','signup_otps','suppressions']) AS t
  UNION ALL
  -- secret tables can only be read by the server: no policies at all
  SELECT 'no browser policies on ' || t, NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t)
  FROM unnest(ARRAY['oauth_connections','org_secrets','signup_otps']) AS t
  UNION ALL
  -- new columns on existing tables
  SELECT 'column ' || c, EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = split_part(c, '.', 1) AND column_name = split_part(c, '.', 2))
  FROM unnest(ARRAY['people.household_id','people.status','people.custom_fields','messages.scheduled_for','messages.recurring_id','messages.window_override_reason','messages.resend_of','messages.payload','message_recipients.channel','message_recipients.confirmed_at','message_recipients.fallback_of','contact_preferences.phone_verified_at','message_threads.unread_count','message_threads.assigned_to','thread_messages.reply_to_recipient_id']) AS c
  UNION ALL
  -- the send engine's duplicate guards
  SELECT 'unique ' || i, to_regclass('public.' || i) IS NOT NULL
  FROM unnest(ARRAY['messages_recurring_occurrence_uidx','message_recipients_fallback_of_uidx','suppressions_active_uidx','thread_messages_provider_uidx']) AS i
  UNION ALL
  -- every old opt-out was carried into the new suppression list
  SELECT 'old opt-outs copied to the suppression list',
    (SELECT count(*) FROM (
       SELECT DISTINCT m.org_id,
              CASE WHEN position('@' IN mr.contact_value) > 0 THEN lower(btrim(mr.contact_value)) ELSE btrim(mr.contact_value) END
       FROM public.message_recipients mr JOIN public.messages m ON m.id = mr.message_id
       WHERE mr.status = 'opted_out' AND m.org_id IS NOT NULL AND btrim(mr.contact_value) <> '') x)
    <= (SELECT count(*) FROM public.suppressions)
) c
ORDER BY ok, check_name;
