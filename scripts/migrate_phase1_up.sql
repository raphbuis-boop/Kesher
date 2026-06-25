-- ═══════════════════════════════════════════════════════════════════════════
-- Kesher Phase 1 — UP migration
-- Run in Supabase SQL Editor → SQL Editor → New query → paste → Run
--
-- REVERSIBLE: pair with migrate_phase1_down.sql to undo every change here.
-- Safe to re-run: all statements use IF NOT EXISTS / IF NOT EXISTS guards.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Extend `people` with contact intelligence columns ─────────────────
-- salutation  : Mr. / Mrs. / Rabbi / Dr. / Reb / Ms. / Prof. etc.
-- gender      : inferred from salutation at import; always editable
-- parent_role : mom | dad — only meaningful for contacts with category 'parent'
-- preferred_name : used as {{first_name}} merge-token override

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS salutation      text,
  ADD COLUMN IF NOT EXISTS gender          text
    CONSTRAINT people_gender_check CHECK (gender IN ('male', 'female', 'unknown')),
  ADD COLUMN IF NOT EXISTS parent_role     text
    CONSTRAINT people_parent_role_check CHECK (parent_role IN ('mom', 'dad')),
  ADD COLUMN IF NOT EXISTS preferred_name  text;

-- ─── 2. Extend `groups` with dynamic filter support ───────────────────────
-- filter_config : JSONB filter spec (null = legacy tag-based group)
-- is_dynamic    : true = membership recomputed on every query; false = tag-based

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS filter_config  jsonb,
  ADD COLUMN IF NOT EXISTS is_dynamic     boolean NOT NULL DEFAULT false;

-- ─── 3. AI-assisted CSV import jobs ──────────────────────────────────────
-- One row per import attempt. parsed_rows stores the AI-proposed contacts
-- (JSONB array) for the admin preview step; commit_edits stores corrections.

CREATE TABLE IF NOT EXISTS import_jobs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  status         text        NOT NULL DEFAULT 'pending'
                               CONSTRAINT import_jobs_status_check
                               CHECK (status IN ('pending','parsing','preview','committed','failed')),
  file_name      text        NOT NULL,
  row_count      integer,
  parsed_rows    jsonb,      -- array of AI-proposed contact objects
  commit_edits   jsonb,      -- admin corrections keyed by row_index
  imported_count integer,
  failed_count   integer,
  error_message  text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS import_jobs_status_idx     ON import_jobs(status);
CREATE INDEX IF NOT EXISTS import_jobs_created_at_idx ON import_jobs(created_at DESC);

-- ─── 4. WhatsApp / SMS thread routing ────────────────────────────────────
-- message_threads : one thread per (person × channel × phone number)
-- thread_messages : individual inbound + outbound messages within a thread

CREATE TABLE IF NOT EXISTS message_threads (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id       uuid        REFERENCES people(id) ON DELETE SET NULL,
  channel         text        NOT NULL
                                CONSTRAINT message_threads_channel_check
                                CHECK (channel IN ('whatsapp', 'sms')),
  -- external_id: WhatsApp number (e.g. "whatsapp:+15551234567") or Twilio SID
  external_id     text        NOT NULL UNIQUE,
  last_message_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS thread_messages (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id           uuid        NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  direction           text        NOT NULL
                                    CONSTRAINT thread_messages_direction_check
                                    CHECK (direction IN ('inbound', 'outbound')),
  body                text,
  media_urls          jsonb,      -- [{url, type, name}]
  provider_message_id text,       -- Twilio Message SID
  status              text
                        CONSTRAINT thread_messages_status_check
                        CHECK (status IN ('sent','delivered','read','failed','received')),
  sent_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS message_threads_person_id_idx   ON message_threads(person_id);
CREATE INDEX IF NOT EXISTS message_threads_external_id_idx ON message_threads(external_id);
CREATE INDEX IF NOT EXISTS thread_messages_thread_id_idx   ON thread_messages(thread_id);
CREATE INDEX IF NOT EXISTS thread_messages_created_at_idx  ON thread_messages(created_at DESC);

-- ─── 5. Message attachments (email + WhatsApp) ───────────────────────────
-- Stores Vercel Blob URLs and metadata for files attached to messages.
-- Channel constraints are enforced in application code, not here.

CREATE TABLE IF NOT EXISTS message_attachments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  url        text        NOT NULL,
  media_type text        NOT NULL
               CONSTRAINT message_attachments_type_check
               CHECK (media_type IN ('image', 'document', 'link')),
  file_name  text,
  file_size  integer,    -- bytes
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS message_attachments_message_id_idx ON message_attachments(message_id);

-- ─── Done ────────────────────────────────────────────────────────────────
-- Verify with:
--   SELECT column_name FROM information_schema.columns WHERE table_name = 'people' ORDER BY ordinal_position;
--   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
