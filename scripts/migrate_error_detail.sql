-- Kesher: Add error detail columns to capture send failure reasons
-- Run in Supabase SQL Editor after migrate_analytics.sql
-- Safe to re-run: all statements use IF NOT EXISTS guards.

-- Per-recipient error reason (Sinch/Resend rejection detail)
ALTER TABLE message_recipients
  ADD COLUMN IF NOT EXISTS error_detail text;

-- Per-message top-level error (batch failure or provider error)
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS error_detail text;

-- Verify with:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'message_recipients' ORDER BY ordinal_position;
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'messages' ORDER BY ordinal_position;
