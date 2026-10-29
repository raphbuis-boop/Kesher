-- ─── Kesher Phase 2.2: per-school channel config ─────────────────────────────
--
-- Run AFTER migrate_p2_1_templates.sql. Safe on live data, re-runnable.
--
-- Until now WhatsApp / SMS credentials were global env vars. Each school
-- now has its own:
--   org_channels  WhatsApp phone number ID, WABA ID, display name, template
--                 name / language / variable count, and SMS sender number.
--                 Owners/admins can read and edit their own row.
--   org_secrets   encrypted secrets (the school's WhatsApp access token).
--                 RLS is ON with NO policies: only the server (service role)
--                 can read it, never the browser.
--
-- use_env_defaults: when TRUE a blank field falls back to the old env vars.
-- It is switched on for every school that exists when you run this, so
-- nothing about current sending changes. Schools created afterwards default
-- to FALSE and must configure their own numbers — they can never send from
-- another school's number by accident.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_channels (
  org_id                   uuid        PRIMARY KEY REFERENCES public.orgs(id) ON DELETE CASCADE,
  use_env_defaults         boolean     NOT NULL DEFAULT false,
  whatsapp_phone_number_id text,
  whatsapp_waba_id         text,
  whatsapp_display_name    text,
  whatsapp_template_name   text,
  whatsapp_template_lang   text        NOT NULL DEFAULT 'en_US',
  -- 1 = body only; 2 = {{1}} school/group name + {{2}} message body
  whatsapp_template_vars   integer     NOT NULL DEFAULT 1 CHECK (whatsapp_template_vars IN (1, 2)),
  sms_sender               text,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_secrets (
  org_id     uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  key        text        NOT NULL CHECK (key IN ('whatsapp_token')),
  value_enc  text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, key)
);

ALTER TABLE public.org_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_secrets  ENABLE ROW LEVEL SECURITY;
-- org_secrets: intentionally no policies.

DROP POLICY IF EXISTS "org_channels: admins read"   ON public.org_channels;
DROP POLICY IF EXISTS "org_channels: admins insert" ON public.org_channels;
DROP POLICY IF EXISTS "org_channels: admins update" ON public.org_channels;
CREATE POLICY "org_channels: admins read" ON public.org_channels FOR SELECT
  USING (public.org_role(org_id) IN ('owner', 'admin'));
-- use_env_defaults can only be switched on by the server (service role), not by a browser session
CREATE POLICY "org_channels: admins insert" ON public.org_channels FOR INSERT
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin') AND use_env_defaults = false);
CREATE POLICY "org_channels: admins update" ON public.org_channels FOR UPDATE
  USING      (public.org_role(org_id) IN ('owner', 'admin'))
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));

-- A browser session can never change use_env_defaults (otherwise an admin could
-- switch on the platform's number for their own school). Only the SQL editor /
-- service role can.
CREATE OR REPLACE FUNCTION public.org_channels_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.use_env_defaults IS DISTINCT FROM OLD.use_env_defaults AND current_user IN ('authenticated', 'anon') THEN
    NEW.use_env_defaults := OLD.use_env_defaults;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS org_channels_guard_trg ON public.org_channels;
CREATE TRIGGER org_channels_guard_trg BEFORE UPDATE ON public.org_channels
  FOR EACH ROW EXECUTE FUNCTION public.org_channels_guard();

-- Existing schools keep sending exactly as before (env fallback on)
INSERT INTO public.org_channels (org_id, use_env_defaults)
SELECT id, true FROM public.orgs
ON CONFLICT (org_id) DO NOTHING;

COMMIT;

-- ─── Verify (run separately) ─────────────────────────────────────────────────
--   SELECT org_id, use_env_defaults FROM org_channels;            -- one row per existing school, true
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'org_secrets';   -- true
--   SELECT count(*) FROM pg_policies WHERE tablename = 'org_secrets';    -- 0
