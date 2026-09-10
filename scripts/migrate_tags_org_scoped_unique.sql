-- ═══════════════════════════════════════════════════════════════════════════
-- Kesher — Fix cross-tenant tag name collision
-- Run in Supabase SQL Editor.
--
-- BUG: `tags.name` still carries a table-wide UNIQUE constraint
-- (`tags_name_key`) left over from before multi-tenancy was added. org_id
-- was added to `tags` by migrate_multitenancy.sql, but the uniqueness
-- constraint was never migrated from "unique across the whole platform" to
-- "unique within one org." Concretely: if Org A already has a tag named
-- "Board", Org B can never create a tag named "Board" — a completely
-- unrelated tenant's data blocks yours, surfaced to the user as a raw
-- Postgres error with no indication of the real cause.
--
-- SAFE TO RUN: dropping the old constraint and adding
-- UNIQUE(org_id, name) cannot violate any existing row, because global
-- uniqueness (the current, stricter constraint) already implies per-org
-- uniqueness — no two rows anywhere share a name today, so no two rows can
-- possibly collide once the check is narrowed to "within the same org."
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_name_key;

ALTER TABLE tags
  ADD CONSTRAINT tags_org_id_name_key UNIQUE (org_id, name);

COMMIT;

-- ─── Verify ───────────────────────────────────────────────────────────────
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'tags'::regclass;
-- Expect to see tags_org_id_name_key — UNIQUE (org_id, name) — and no
-- remaining tags_name_key.


-- ═══════════════════════════════════════════════════════════════════════════
-- Optional but recommended: prevent duplicate contacts by email within an
-- org at the database layer, not just in application code.
--
-- Run this SELECT first — if it returns any rows, resolve those duplicates
-- (merge or clear one side's email) before adding the index, or the CREATE
-- INDEX below will fail listing the exact conflict:
--
--   SELECT org_id, lower(email) AS email, count(*), array_agg(id) AS person_ids
--   FROM people
--   WHERE email IS NOT NULL
--   GROUP BY org_id, lower(email)
--   HAVING count(*) > 1;
-- ═══════════════════════════════════════════════════════════════════════════

-- CREATE UNIQUE INDEX IF NOT EXISTS people_org_id_email_unique_idx
--   ON people (org_id, lower(email))
--   WHERE email IS NOT NULL;
