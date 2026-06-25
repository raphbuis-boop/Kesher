-- ═══════════════════════════════════════════════════════════════════════════
-- Kesher Phase 1 — DOWN migration (rollback)
-- Reverses every change in migrate_phase1_up.sql.
-- Run ONLY if you need to undo the Phase 1 migration.
-- WARNING: drops all data in the tables below.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Drop indexes (must go before tables) ─────────────────────────────

DROP INDEX IF EXISTS message_attachments_message_id_idx;
DROP INDEX IF EXISTS thread_messages_created_at_idx;
DROP INDEX IF EXISTS thread_messages_thread_id_idx;
DROP INDEX IF EXISTS message_threads_external_id_idx;
DROP INDEX IF EXISTS message_threads_person_id_idx;
DROP INDEX IF EXISTS import_jobs_created_at_idx;
DROP INDEX IF EXISTS import_jobs_status_idx;

-- ─── 2. Drop Phase 1 tables (reverse dependency order) ───────────────────

DROP TABLE IF EXISTS message_attachments;
DROP TABLE IF EXISTS thread_messages;
DROP TABLE IF EXISTS message_threads;
DROP TABLE IF EXISTS import_jobs;

-- ─── 3. Remove columns from `groups` ─────────────────────────────────────

ALTER TABLE groups
  DROP COLUMN IF EXISTS is_dynamic,
  DROP COLUMN IF EXISTS filter_config;

-- ─── 4. Remove columns from `people` ─────────────────────────────────────

ALTER TABLE people
  DROP COLUMN IF EXISTS preferred_name,
  DROP COLUMN IF EXISTS parent_role,
  DROP COLUMN IF EXISTS gender,
  DROP COLUMN IF EXISTS salutation;

-- ─── Done ────────────────────────────────────────────────────────────────
-- The database is now back to its pre-Phase-1 state.
-- Re-run migrate_phase1_up.sql to re-apply.
