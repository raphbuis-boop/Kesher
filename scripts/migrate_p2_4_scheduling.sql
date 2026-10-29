-- ─── Kesher Phase 2.4: scheduling, drafts, approvals, recurring sends ────────
--
-- Run AFTER migrate_p2_3_send_engine.sql. Safe on live data, re-runnable:
-- additive columns and new tables only.
--
-- messages.status now also uses:
--   draft · pending_approval · scheduled · cancelled · rejected
--   (alongside the existing sending · sent · failed)
--
-- recurring_sends  a repeating send (weekly newsletter): the message blueprint
--                  plus a rule ("every N weeks on <weekday> at <time>", later
--                  also "N hours before candle lighting"). The dispatcher turns
--                  each due occurrence into a normal scheduled message exactly
--                  once (unique recurring_id + scheduled_for).
-- system_heartbeats  last time the dispatcher ran, so the app can warn when
--                  scheduled sends aren't being picked up.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.recurring_sends (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  active         boolean     NOT NULL DEFAULT true,
  timezone       text        NOT NULL DEFAULT 'America/New_York',
  -- {"kind":"clock","everyWeeks":1,"weekday":0,"time":"09:00"}
  rule           jsonb       NOT NULL,
  payload        jsonb       NOT NULL,
  subject        text,
  body           text        NOT NULL,
  audience_label text        NOT NULL DEFAULT '',
  next_run_at    timestamptz,
  last_run_at    timestamptz,
  created_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recurring_sends_due_idx ON public.recurring_sends(next_run_at) WHERE active;
CREATE INDEX IF NOT EXISTS recurring_sends_org_idx ON public.recurring_sends(org_id);

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_for    timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_at       timestamptz,
  ADD COLUMN IF NOT EXISTS requested_at     timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at      timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at      timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS recurring_id     uuid REFERENCES public.recurring_sends(id) ON DELETE SET NULL;

-- A recurring send creates each occurrence once, even if the dispatcher runs twice
CREATE UNIQUE INDEX IF NOT EXISTS messages_recurring_occurrence_uidx
  ON public.messages(recurring_id, scheduled_for) WHERE recurring_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS messages_due_idx ON public.messages(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS messages_org_status_idx ON public.messages(org_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.system_heartbeats (
  name        text        PRIMARY KEY,
  last_run_at timestamptz NOT NULL DEFAULT now(),
  detail      jsonb
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- recurring_sends: any member can see them; owners/admins manage them.
-- system_heartbeats: readable by any signed-in user (it's just a timestamp);
-- written only by the server (service role).

ALTER TABLE public.recurring_sends   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_heartbeats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recurring_sends: members read"  ON public.recurring_sends;
DROP POLICY IF EXISTS "recurring_sends: admins write"  ON public.recurring_sends;
DROP POLICY IF EXISTS "recurring_sends: admins insert" ON public.recurring_sends;
DROP POLICY IF EXISTS "recurring_sends: admins update" ON public.recurring_sends;
DROP POLICY IF EXISTS "recurring_sends: admins delete" ON public.recurring_sends;
CREATE POLICY "recurring_sends: members read" ON public.recurring_sends FOR SELECT
  USING (org_id IN (SELECT public.current_org_ids()));
CREATE POLICY "recurring_sends: admins insert" ON public.recurring_sends FOR INSERT
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY "recurring_sends: admins update" ON public.recurring_sends FOR UPDATE
  USING      (public.org_role(org_id) IN ('owner', 'admin'))
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY "recurring_sends: admins delete" ON public.recurring_sends FOR DELETE
  USING (public.org_role(org_id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "system_heartbeats: signed-in read" ON public.system_heartbeats;
CREATE POLICY "system_heartbeats: signed-in read" ON public.system_heartbeats FOR SELECT
  USING (auth.role() = 'authenticated');

COMMIT;

-- ─── Verify (run separately) ─────────────────────────────────────────────────
--   SELECT status, count(*) FROM messages GROUP BY status;     -- existing rows unchanged
