-- Kesher: Email delivery tracking columns
-- Run in Supabase SQL Editor after migrate.sql
-- Safe to re-run: all statements use IF NOT EXISTS guards.

-- Add per-recipient event timestamps to message_recipients.
-- Populated by the Resend webhook handler at /api/webhooks/resend.

ALTER TABLE message_recipients
  ADD COLUMN IF NOT EXISTS delivered_at   timestamptz,
  ADD COLUMN IF NOT EXISTS opened_at      timestamptz,
  ADD COLUMN IF NOT EXISTS clicked_at     timestamptz,
  ADD COLUMN IF NOT EXISTS bounced_at     timestamptz,
  ADD COLUMN IF NOT EXISTS complained_at  timestamptz,
  ADD COLUMN IF NOT EXISTS bounce_type    text;

-- Index provider_id so webhook lookups are O(log n) instead of full table scan.
-- This is the Resend email ID stored when each email is sent.
CREATE INDEX IF NOT EXISTS message_recipients_provider_id_idx
  ON message_recipients(provider_id);

-- Verify with:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'message_recipients' ORDER BY ordinal_position;
