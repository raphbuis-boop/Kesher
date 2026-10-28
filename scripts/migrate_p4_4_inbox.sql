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

BEGIN;

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

-- ─── Verify (run separately) ─────────────────────────────────────────────────
--   SELECT column_name FROM information_schema.columns WHERE table_name = 'message_threads' AND column_name IN ('status','assigned_to','unread_count');   -- 3 rows
--   SELECT count(*) FROM thread_messages WHERE org_id IS NULL;        -- 0
