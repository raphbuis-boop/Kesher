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

BEGIN;

ALTER TABLE public.message_recipients ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
ALTER TABLE public.messages           ADD COLUMN IF NOT EXISTS resend_of    uuid REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS message_recipients_confirmed_idx ON public.message_recipients(message_id) WHERE confirmed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS messages_resend_of_idx           ON public.messages(resend_of)           WHERE resend_of IS NOT NULL;
-- "delivery problems" report: recent failures and bounces
CREATE INDEX IF NOT EXISTS message_recipients_failed_idx    ON public.message_recipients(message_id) WHERE status = 'failed';

COMMIT;

-- ─── Verify (run separately) ─────────────────────────────────────────────────
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'message_recipients' AND column_name = 'confirmed_at';   -- 1 row
