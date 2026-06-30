-- Kesher: Analytics expansion — replies, WhatsApp read receipts, inbound messages
-- Run in Supabase SQL Editor after migrate_tracking.sql
-- Safe to re-run: all statements use IF NOT EXISTS guards.

-- ─── New columns on message_recipients ────────────────────────────────────────

ALTER TABLE message_recipients
  ADD COLUMN IF NOT EXISTS replied_at  timestamptz,
  ADD COLUMN IF NOT EXISTS read_at     timestamptz;

-- ─── Inbound messages table ────────────────────────────────────────────────────
-- Stores every inbound SMS / WhatsApp message received on our number.
-- Used to:
--   1. Set replied_at on the matching outbound message_recipient
--   2. Power a future Conversations / Inbox page

CREATE TABLE IF NOT EXISTS inbound_messages (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel              text        NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
  from_number          text        NOT NULL,
  to_number            text        NOT NULL,
  body                 text,
  received_at          timestamptz NOT NULL DEFAULT now(),
  -- Linked to the most recent outbound message sent to this number (may be null if
  -- no match was found, e.g. an unsolicited inbound or a reply to an old campaign)
  message_recipient_id uuid        REFERENCES message_recipients(id) ON DELETE SET NULL,
  telnyx_id            text,       -- Telnyx message UUID for deduplication
  raw_payload          jsonb       -- Full Telnyx payload for debugging / future fields
);

CREATE INDEX IF NOT EXISTS inbound_messages_from_number_idx
  ON inbound_messages(from_number);

CREATE INDEX IF NOT EXISTS inbound_messages_message_recipient_id_idx
  ON inbound_messages(message_recipient_id);

CREATE UNIQUE INDEX IF NOT EXISTS inbound_messages_telnyx_id_idx
  ON inbound_messages(telnyx_id)
  WHERE telnyx_id IS NOT NULL;

-- ─── Verify with ──────────────────────────────────────────────────────────────
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'message_recipients' ORDER BY ordinal_position;
--
--   SELECT * FROM information_schema.tables
--   WHERE table_name = 'inbound_messages';
