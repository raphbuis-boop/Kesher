-- ═══════════════════════════════════════════════════════════════════════════
-- Kesher — Row Level Security (RLS) policies
-- Run in Supabase SQL Editor after migrate_phase1_up.sql
--
-- These policies restrict all table access to authenticated users only.
-- The anon key used in the app cannot read or write any data without a
-- valid Supabase session.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Enable RLS on all tables ────────────────────────────────────────────

ALTER TABLE people              ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags                ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_tags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_tags          ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_recipients  ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_threads     ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

-- ─── people ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "people: authenticated full access" ON people;
CREATE POLICY "people: authenticated full access"
  ON people FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── groups ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "groups: authenticated full access" ON groups;
CREATE POLICY "groups: authenticated full access"
  ON groups FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── tags ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tags: authenticated full access" ON tags;
CREATE POLICY "tags: authenticated full access"
  ON tags FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── person_tags ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "person_tags: authenticated full access" ON person_tags;
CREATE POLICY "person_tags: authenticated full access"
  ON person_tags FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── group_tags ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "group_tags: authenticated full access" ON group_tags;
CREATE POLICY "group_tags: authenticated full access"
  ON group_tags FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── messages ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "messages: authenticated full access" ON messages;
CREATE POLICY "messages: authenticated full access"
  ON messages FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── message_recipients ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "message_recipients: authenticated full access" ON message_recipients;
CREATE POLICY "message_recipients: authenticated full access"
  ON message_recipients FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── import_jobs ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "import_jobs: authenticated full access" ON import_jobs;
CREATE POLICY "import_jobs: authenticated full access"
  ON import_jobs FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── message_threads ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "message_threads: authenticated full access" ON message_threads;
CREATE POLICY "message_threads: authenticated full access"
  ON message_threads FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── thread_messages ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "thread_messages: authenticated full access" ON thread_messages;
CREATE POLICY "thread_messages: authenticated full access"
  ON thread_messages FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── message_attachments ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "message_attachments: authenticated full access" ON message_attachments;
CREATE POLICY "message_attachments: authenticated full access"
  ON message_attachments FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── Done ────────────────────────────────────────────────────────────────
-- Verify with:
--   SELECT schemaname, tablename, rowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public'
--   ORDER BY tablename;
--
--   SELECT tablename, policyname, cmd
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename, policyname;
