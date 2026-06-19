-- ─── Kesher: Messaging tables migration ──────────────────────────────────────
-- Run this in your Supabase SQL Editor before seeding.

-- Messages: one row per send campaign
create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  subject         text,
  body            text not null,
  channel         text not null default 'email',   -- 'email' | 'sms' | 'whatsapp'
  audience_slug   text not null,
  audience_label  text not null,
  recipient_count int  not null default 0,
  sent_count      int,
  failed_count    int,
  status          text not null default 'sending', -- 'sending' | 'sent'
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);

-- Message recipients: one row per person per campaign
create table if not exists message_recipients (
  id              uuid primary key default gen_random_uuid(),
  message_id      uuid not null references messages(id) on delete cascade,
  person_id       uuid not null references people(id) on delete cascade,
  contact_value   text not null,   -- the email address or phone number used
  name            text not null,
  status          text not null default 'sent',    -- 'sent' | 'failed'
  provider_id     text,            -- Resend email ID or Twilio SID
  sent_at         timestamptz
);

create index if not exists message_recipients_message_id_idx on message_recipients(message_id);
create index if not exists message_recipients_person_id_idx  on message_recipients(person_id);
create index if not exists messages_channel_idx              on messages(channel);
create index if not exists messages_sent_at_idx              on messages(sent_at desc);
