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

BEGIN;

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

COMMIT;
