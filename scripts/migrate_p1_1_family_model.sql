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

BEGIN;

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

COMMIT;

-- ─── Verify (run separately) ─────────────────────────────────────────────────
--   SELECT status, count(*) FROM people GROUP BY status;                 -- all 'active'
--   SELECT count(*) FROM guardian_students;                              -- ≈ parent→child relationships
--   SELECT count(*) AS households, count(*) FILTER (WHERE name = 'family') AS unnamed FROM households;
--   SELECT tablename, policyname FROM pg_policies
--   WHERE tablename IN ('households','guardian_students','custom_field_defs','contact_preferences');
