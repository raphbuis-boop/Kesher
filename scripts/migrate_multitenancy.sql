-- ═══════════════════════════════════════════════════════════════════════════
-- Multi-tenancy migration — full tenant isolation
--
-- Run in Supabase SQL Editor. Safe to inspect step-by-step.
-- Back up your data before running (see STEP 0 in the investigation report).
--
-- What this does:
--   1. Creates orgs + memberships tables
--   2. Adds a signup trigger so every new user auto-gets an org
--   3. Adds org_id (NULLABLE) to every tenant-scoped table
--   4. Backfills all existing rows into a single "Legacy Organization"
--      and creates memberships for every existing auth user
--   5. Makes org_id NOT NULL on root tables
--   6. Restructures the settings table primary key to (org_id, key)
--   7. Drops the broken auth-only RLS policies
--   8. Installs correct org-scoped RLS policies
--
-- DESTRUCTIVE OPERATIONS (flagged):
--   • ALTER TABLE settings DROP CONSTRAINT settings_pkey
--     → replaced immediately with PRIMARY KEY (org_id, key)
--     → no data loss; only the key-uniqueness constraint changes
--   All other operations add columns or update values — no deletes.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── STEP 1: Core tenant model ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orgs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL DEFAULT 'My Organization',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id     uuid        NOT NULL REFERENCES orgs(id)       ON DELETE CASCADE,
  role       text        NOT NULL DEFAULT 'owner'
               CONSTRAINT memberships_role_check CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);

CREATE INDEX IF NOT EXISTS memberships_user_id_idx ON memberships(user_id);
CREATE INDEX IF NOT EXISTS memberships_org_id_idx  ON memberships(org_id);


-- ─── STEP 2: Auto-org trigger for new signups ─────────────────────────────
-- Every new auth user gets their own org and is added as owner.
-- Settings rows for the new org are seeded here.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org_id uuid;
BEGIN
  INSERT INTO public.orgs (name)
  VALUES ('My Organization')
  RETURNING id INTO v_org_id;

  INSERT INTO public.memberships (user_id, org_id, role)
  VALUES (NEW.id, v_org_id, 'owner');

  INSERT INTO public.settings (org_id, key, value) VALUES
    (v_org_id, 'school_name',     ''),
    (v_org_id, 'school_logo_url', ''),
    (v_org_id, 'primary_color',   '#1e3a6e'),
    (v_org_id, 'website_url',     ''),
    (v_org_id, 'footer_text',     ''),
    (v_org_id, 'reply_to_email',  ''),
    (v_org_id, 'sender_name',     ''),
    (v_org_id, 'sender_email',    '');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─── STEP 3: Add org_id (NULLABLE) to all root tables ────────────────────

ALTER TABLE people          ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE groups          ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE tags            ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE messages        ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE import_jobs     ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE message_threads ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES orgs(id) ON DELETE CASCADE;
-- settings gets org_id too — handled separately in step 6 (PK change required)
ALTER TABLE settings        ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES orgs(id) ON DELETE CASCADE;

-- inbound_messages: nullable — webhook inserts may not have org context
-- (rows with null org_id are invisible to all users via RLS)
ALTER TABLE inbound_messages ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES orgs(id) ON DELETE CASCADE;

-- Optional legacy tables (may not exist — wrapped in exception handlers below)


-- ─── STEP 4: Backfill all existing rows into a "Legacy Organization" ──────
-- Also creates memberships for every existing auth user.
-- SAFE: adds data only, never deletes.

DO $$
DECLARE
  v_legacy_org_id uuid;
BEGIN
  -- Create the legacy org
  INSERT INTO public.orgs (name)
  VALUES ('Legacy Organization')
  RETURNING id INTO v_legacy_org_id;

  -- Create memberships for all existing auth users → legacy org
  INSERT INTO public.memberships (user_id, org_id, role)
  SELECT id, v_legacy_org_id, 'owner'
  FROM auth.users
  ON CONFLICT (user_id, org_id) DO NOTHING;

  -- Backfill root tables
  UPDATE people          SET org_id = v_legacy_org_id WHERE org_id IS NULL;
  UPDATE groups          SET org_id = v_legacy_org_id WHERE org_id IS NULL;
  UPDATE tags            SET org_id = v_legacy_org_id WHERE org_id IS NULL;
  UPDATE messages        SET org_id = v_legacy_org_id WHERE org_id IS NULL;
  UPDATE import_jobs     SET org_id = v_legacy_org_id WHERE org_id IS NULL;
  UPDATE message_threads SET org_id = v_legacy_org_id WHERE org_id IS NULL;
  UPDATE settings        SET org_id = v_legacy_org_id WHERE org_id IS NULL;

  -- Backfill inbound_messages via message_recipient → message chain
  UPDATE inbound_messages im
  SET org_id = m.org_id
  FROM message_recipients mr
  JOIN messages m ON m.id = mr.message_id
  WHERE mr.id = im.message_recipient_id
    AND im.org_id IS NULL;

  -- Optional tables (imports, relationships) — handle with exceptions
  BEGIN
    UPDATE imports SET org_id = v_legacy_org_id WHERE org_id IS NULL;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL; -- table doesn't exist yet, skip
  END;

  BEGIN
    UPDATE relationships SET org_id = v_legacy_org_id WHERE org_id IS NULL;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;

  RAISE NOTICE 'Backfill complete. Legacy org id = %', v_legacy_org_id;
END;
$$;


-- ─── STEP 5: Make org_id NOT NULL on root tables ──────────────────────────
-- Run AFTER backfill. Any row still NULL was missed — investigate before proceeding.

ALTER TABLE people          ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE groups          ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE tags            ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE messages        ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE import_jobs     ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE message_threads ALTER COLUMN org_id SET NOT NULL;
-- inbound_messages stays NULLABLE (webhook-inserted, no session context)


-- ─── STEP 6: Restructure settings primary key ─────────────────────────────
-- ⚠ DESTRUCTIVE: drops settings_pkey, replaces with (org_id, key)
-- No data is lost — only the uniqueness constraint changes.

ALTER TABLE settings ALTER COLUMN org_id SET NOT NULL;
-- Drop the old single-column primary key
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey;
-- New composite primary key: one row per (org, key)
ALTER TABLE settings ADD PRIMARY KEY (org_id, key);


-- ─── Add org_id to optional legacy tables (best-effort) ───────────────────

DO $$
BEGIN
  ALTER TABLE imports ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES orgs(id) ON DELETE CASCADE;
  ALTER TABLE imports ALTER COLUMN org_id SET NOT NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER TABLE relationships ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES orgs(id) ON DELETE CASCADE;
  ALTER TABLE relationships ALTER COLUMN org_id SET NOT NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END;
$$;


-- ─── STEP 7: Indexes on org_id columns ───────────────────────────────────

CREATE INDEX IF NOT EXISTS people_org_id_idx            ON people(org_id);
CREATE INDEX IF NOT EXISTS groups_org_id_idx            ON groups(org_id);
CREATE INDEX IF NOT EXISTS tags_org_id_idx              ON tags(org_id);
CREATE INDEX IF NOT EXISTS messages_org_id_idx          ON messages(org_id);
CREATE INDEX IF NOT EXISTS import_jobs_org_id_idx       ON import_jobs(org_id);
CREATE INDEX IF NOT EXISTS message_threads_org_id_idx   ON message_threads(org_id);
CREATE INDEX IF NOT EXISTS settings_org_id_idx          ON settings(org_id);
CREATE INDEX IF NOT EXISTS inbound_messages_org_id_idx  ON inbound_messages(org_id);


-- ─── STEP 8: Drop old broken RLS policies ────────────────────────────────

DROP POLICY IF EXISTS "people: authenticated full access"             ON people;
DROP POLICY IF EXISTS "groups: authenticated full access"             ON groups;
DROP POLICY IF EXISTS "tags: authenticated full access"               ON tags;
DROP POLICY IF EXISTS "person_tags: authenticated full access"        ON person_tags;
DROP POLICY IF EXISTS "group_tags: authenticated full access"         ON group_tags;
DROP POLICY IF EXISTS "messages: authenticated full access"           ON messages;
DROP POLICY IF EXISTS "message_recipients: authenticated full access" ON message_recipients;
DROP POLICY IF EXISTS "import_jobs: authenticated full access"        ON import_jobs;
DROP POLICY IF EXISTS "message_threads: authenticated full access"    ON message_threads;
DROP POLICY IF EXISTS "thread_messages: authenticated full access"    ON thread_messages;
DROP POLICY IF EXISTS "message_attachments: authenticated full access" ON message_attachments;
DROP POLICY IF EXISTS "settings: authenticated full access"           ON settings;


-- ─── STEP 9: Org-scoped RLS policies ─────────────────────────────────────
--
-- Security boundary: every policy checks org_id against the current user's
-- memberships row. A user can only see and write data in their own org.
--
-- For root tables (have org_id column): direct check.
-- For child/junction tables (no org_id column): join-based check through parent.
-- ─────────────────────────────────────────────────────────────────────────

-- orgs: members can see their own org
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orgs: members can view" ON orgs;
CREATE POLICY "orgs: members can view"
  ON orgs FOR SELECT
  USING (id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));

-- memberships: users see only their own rows; inserts are via trigger only
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "memberships: view own" ON memberships;
CREATE POLICY "memberships: view own"
  ON memberships FOR SELECT
  USING (user_id = auth.uid());

-- people
DROP POLICY IF EXISTS "people: org access" ON people;
CREATE POLICY "people: org access"
  ON people FOR ALL
  USING     (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));

-- groups
DROP POLICY IF EXISTS "groups: org access" ON groups;
CREATE POLICY "groups: org access"
  ON groups FOR ALL
  USING     (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));

-- tags
DROP POLICY IF EXISTS "tags: org access" ON tags;
CREATE POLICY "tags: org access"
  ON tags FOR ALL
  USING     (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));

-- person_tags (join-based via people.org_id)
DROP POLICY IF EXISTS "person_tags: org access" ON person_tags;
CREATE POLICY "person_tags: org access"
  ON person_tags FOR ALL
  USING (
    person_id IN (
      SELECT id FROM people
      WHERE org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    person_id IN (
      SELECT id FROM people
      WHERE org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
    )
  );

-- group_tags (join-based via groups.org_id)
DROP POLICY IF EXISTS "group_tags: org access" ON group_tags;
CREATE POLICY "group_tags: org access"
  ON group_tags FOR ALL
  USING (
    group_id IN (
      SELECT id FROM groups
      WHERE org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    group_id IN (
      SELECT id FROM groups
      WHERE org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
    )
  );

-- messages
DROP POLICY IF EXISTS "messages: org access" ON messages;
CREATE POLICY "messages: org access"
  ON messages FOR ALL
  USING     (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));

-- message_recipients (join-based via messages.org_id)
-- NOTE: The Sinch webhook opt-out check (.eq("status","opted_out")) uses admin
-- client so it bypasses this policy. Cross-org opt-out is intentional for CTIA.
DROP POLICY IF EXISTS "message_recipients: org access" ON message_recipients;
CREATE POLICY "message_recipients: org access"
  ON message_recipients FOR ALL
  USING (
    message_id IN (
      SELECT id FROM messages
      WHERE org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    message_id IN (
      SELECT id FROM messages
      WHERE org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
    )
  );

-- import_jobs
DROP POLICY IF EXISTS "import_jobs: org access" ON import_jobs;
CREATE POLICY "import_jobs: org access"
  ON import_jobs FOR ALL
  USING     (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));

-- message_threads
DROP POLICY IF EXISTS "message_threads: org access" ON message_threads;
CREATE POLICY "message_threads: org access"
  ON message_threads FOR ALL
  USING     (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));

-- thread_messages (join-based via message_threads.org_id)
DROP POLICY IF EXISTS "thread_messages: org access" ON thread_messages;
CREATE POLICY "thread_messages: org access"
  ON thread_messages FOR ALL
  USING (
    thread_id IN (
      SELECT id FROM message_threads
      WHERE org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    thread_id IN (
      SELECT id FROM message_threads
      WHERE org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
    )
  );

-- message_attachments (join-based via messages.org_id)
DROP POLICY IF EXISTS "message_attachments: org access" ON message_attachments;
CREATE POLICY "message_attachments: org access"
  ON message_attachments FOR ALL
  USING (
    message_id IN (
      SELECT id FROM messages
      WHERE org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    message_id IN (
      SELECT id FROM messages
      WHERE org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
    )
  );

-- settings
DROP POLICY IF EXISTS "settings: org access" ON settings;
CREATE POLICY "settings: org access"
  ON settings FOR ALL
  USING     (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));

-- inbound_messages (nullable org_id — join through recipient chain as fallback)
DROP POLICY IF EXISTS "inbound_messages: org access" ON inbound_messages;
CREATE POLICY "inbound_messages: org access"
  ON inbound_messages FOR ALL
  USING (
    org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
    OR (
      org_id IS NULL
      AND message_recipient_id IN (
        SELECT mr.id FROM message_recipients mr
        WHERE mr.message_id IN (
          SELECT id FROM messages
          WHERE org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
        )
      )
    )
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
  );

-- imports (if exists)
DO $$
BEGIN
  EXECUTE $inner$
    DROP POLICY IF EXISTS "imports: org access" ON imports;
    CREATE POLICY "imports: org access"
      ON imports FOR ALL
      USING     (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()))
      WITH CHECK (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));
    ALTER TABLE imports ENABLE ROW LEVEL SECURITY;
  $inner$;
EXCEPTION WHEN undefined_table THEN NULL;
END;
$$;

-- relationships (if exists)
DO $$
BEGIN
  EXECUTE $inner$
    DROP POLICY IF EXISTS "relationships: org access" ON relationships;
    CREATE POLICY "relationships: org access"
      ON relationships FOR ALL
      USING     (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()))
      WITH CHECK (org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid()));
    ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
  $inner$;
EXCEPTION WHEN undefined_table THEN NULL;
END;
$$;


-- ─── Verify ───────────────────────────────────────────────────────────────
-- Run these to confirm:
--
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
--
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname;
--
-- SELECT COUNT(*) FROM memberships;         -- should equal number of auth users
-- SELECT COUNT(*) FROM people WHERE org_id IS NULL;  -- should be 0
-- SELECT COUNT(*) FROM messages WHERE org_id IS NULL; -- should be 0
