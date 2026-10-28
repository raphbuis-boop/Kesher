-- ─── Kesher Phase 4.3: opt-out engine ────────────────────────────────────────
--
-- Run AFTER migrate_p4_1_signup.sql. Safe on live data, re-runnable.
--
-- suppressions   ONE list of "never message this address on this channel" per
--                school. A parent's STOP reply, an email unsubscribe (link or
--                one-click), a spam complaint, a hard bounce, or a staff action
--                each add a row; START (or staff, with a recorded reason)
--                releases it. Sending checks only this table.
--
-- Until now an opt-out was a status on message_recipients rows (and the STOP
-- handler matched phone numbers across every school). Existing opt-outs are
-- copied here once, per school, by the INSERT below.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.suppressions (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  channel               text        NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
  -- lowercase email, or E.164 phone number
  address               text        NOT NULL,
  person_id             uuid        REFERENCES public.people(id) ON DELETE SET NULL,
  reason                text        NOT NULL CHECK (reason IN ('stop', 'unsubscribe', 'complaint', 'bounce', 'manual')),
  source                text,
  keyword               text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  released_at           timestamptz,
  released_by           uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  release_reason        text,
  -- the one confirmation text sent after a STOP
  confirmation_sent_at  timestamptz,
  confirmation_attempts integer     NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS suppressions_active_uidx ON public.suppressions(org_id, channel, address) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS suppressions_person_idx ON public.suppressions(org_id, person_id);
CREATE INDEX IF NOT EXISTS suppressions_confirm_idx ON public.suppressions(created_at) WHERE confirmation_sent_at IS NULL AND released_at IS NULL AND source IN ('sms_reply', 'whatsapp_reply');

-- ─── Copy existing opt-outs (once per school/channel/address) ────────────────
INSERT INTO public.suppressions (org_id, channel, address, person_id, reason, source, created_at)
SELECT DISTINCT ON (m.org_id, x.ch, x.addr)
       m.org_id, x.ch, x.addr, mr.person_id,
       CASE WHEN x.ch = 'email' THEN 'unsubscribe' ELSE 'stop' END,
       'legacy',
       COALESCE(mr.replied_at, mr.sent_at, now())
FROM public.message_recipients mr
JOIN public.messages m ON m.id = mr.message_id
CROSS JOIN LATERAL (
  SELECT
    CASE WHEN position('@' IN mr.contact_value) > 0 THEN 'email'
         WHEN mr.channel IN ('sms', 'whatsapp') THEN mr.channel
         WHEN m.channel IN ('sms', 'whatsapp') THEN m.channel
         ELSE 'sms' END AS ch,
    CASE WHEN position('@' IN mr.contact_value) > 0 THEN lower(btrim(mr.contact_value)) ELSE btrim(mr.contact_value) END AS addr
) x
WHERE mr.status = 'opted_out' AND m.org_id IS NOT NULL AND btrim(mr.contact_value) <> ''
ORDER BY m.org_id, x.ch, x.addr, COALESCE(mr.replied_at, mr.sent_at, now())
ON CONFLICT DO NOTHING;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Members can see their school's list (the person page shows who opted out);
-- only owners/admins can add by hand or release one. Webhooks and the send
-- engine use the service role.

ALTER TABLE public.suppressions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suppressions: members read"  ON public.suppressions;
DROP POLICY IF EXISTS "suppressions: admins insert" ON public.suppressions;
DROP POLICY IF EXISTS "suppressions: admins update" ON public.suppressions;
CREATE POLICY "suppressions: members read"  ON public.suppressions FOR SELECT
  USING (org_id IN (SELECT public.current_org_ids()));
CREATE POLICY "suppressions: admins insert" ON public.suppressions FOR INSERT
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY "suppressions: admins update" ON public.suppressions FOR UPDATE
  USING      (public.org_role(org_id) IN ('owner', 'admin'))
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));

COMMIT;

-- ─── Verify (run separately) ─────────────────────────────────────────────────
--   SELECT channel, count(*) FROM suppressions WHERE released_at IS NULL GROUP BY 1;
--   -- compare with the old store; the two numbers should match per school:
--   SELECT count(DISTINCT (m.org_id, mr.contact_value)) FROM message_recipients mr
--     JOIN messages m ON m.id = mr.message_id WHERE mr.status = 'opted_out';
