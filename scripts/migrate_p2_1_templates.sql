-- ─── Kesher Phase 2.1: templates per group ───────────────────────────────────
--
-- Run AFTER migrate_p1_6_rollover.sql. Safe on live data, re-runnable.
--
--   message_templates      look & feel of an email: logo/header, colors,
--                          sender name, default subject, footer. A field left
--                          blank inherits Settings → School.
--   audience_templates     which template an audience uses by default
--                          (audience_slug is a system slug like 'parents' or a
--                          custom audience's id).
--   messages.template_id   the template a message was sent with.
--   messages.is_fundraising  fundraising messages never go out on WhatsApp
--                          (Meta blocks them to US numbers).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.message_templates (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  logo_url         text,
  primary_color    text        CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9a-fA-F]{6}$'),
  background_color text        CHECK (background_color IS NULL OR background_color ~ '^#[0-9a-fA-F]{6}$'),
  sender_name      text,
  default_subject  text,
  footer_text      text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS message_templates_org_idx ON public.message_templates(org_id);

CREATE TABLE IF NOT EXISTS public.audience_templates (
  org_id         uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  audience_slug  text NOT NULL,
  template_id    uuid NOT NULL REFERENCES public.message_templates(id) ON DELETE CASCADE,
  PRIMARY KEY (org_id, audience_slug)
);

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS template_id    uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_fundraising boolean NOT NULL DEFAULT false;

-- ─── RLS: everyone in the org can read; owners/admins manage ─────────────────

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_templates: members read"  ON public.message_templates;
DROP POLICY IF EXISTS "message_templates: admins write"  ON public.message_templates;
DROP POLICY IF EXISTS "message_templates: admins insert" ON public.message_templates;
DROP POLICY IF EXISTS "message_templates: admins update" ON public.message_templates;
DROP POLICY IF EXISTS "message_templates: admins delete" ON public.message_templates;
CREATE POLICY "message_templates: members read" ON public.message_templates FOR SELECT
  USING (org_id IN (SELECT public.current_org_ids()));
CREATE POLICY "message_templates: admins insert" ON public.message_templates FOR INSERT
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY "message_templates: admins update" ON public.message_templates FOR UPDATE
  USING      (public.org_role(org_id) IN ('owner', 'admin'))
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY "message_templates: admins delete" ON public.message_templates FOR DELETE
  USING (public.org_role(org_id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "audience_templates: members read"  ON public.audience_templates;
DROP POLICY IF EXISTS "audience_templates: admins insert" ON public.audience_templates;
DROP POLICY IF EXISTS "audience_templates: admins update" ON public.audience_templates;
DROP POLICY IF EXISTS "audience_templates: admins delete" ON public.audience_templates;
CREATE POLICY "audience_templates: members read" ON public.audience_templates FOR SELECT
  USING (org_id IN (SELECT public.current_org_ids()));
CREATE POLICY "audience_templates: admins insert" ON public.audience_templates FOR INSERT
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY "audience_templates: admins update" ON public.audience_templates FOR UPDATE
  USING      (public.org_role(org_id) IN ('owner', 'admin'))
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY "audience_templates: admins delete" ON public.audience_templates FOR DELETE
  USING (public.org_role(org_id) IN ('owner', 'admin'));

COMMIT;
