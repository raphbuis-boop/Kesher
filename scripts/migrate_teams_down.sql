-- ─── Rollback for migrate_teams.sql ─────────────────────────────────────────
-- Restores single-user behaviour. Teammates added by invites will LOSE access
-- (their memberships are removed); only each org's owner(s) remain.
BEGIN;

-- Signup trigger: back to "every signup gets its own org"
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org_id uuid;
BEGIN
  INSERT INTO public.orgs (name) VALUES ('My Organization') RETURNING id INTO v_org_id;
  INSERT INTO public.memberships (user_id, org_id, role) VALUES (NEW.id, v_org_id, 'owner');
  INSERT INTO public.settings (org_id, key, value) VALUES
    (v_org_id, 'school_name', ''), (v_org_id, 'school_logo_url', ''), (v_org_id, 'primary_color', '#1e3a6e'),
    (v_org_id, 'website_url', ''), (v_org_id, 'footer_text', ''), (v_org_id, 'reply_to_email', ''),
    (v_org_id, 'sender_name', ''), (v_org_id, 'sender_email', '');
  RETURN NEW;
END;
$$;

-- Non-owner memberships can't exist in the single-user model
DELETE FROM public.memberships WHERE role <> 'owner';

DROP POLICY IF EXISTS "memberships: view own org" ON public.memberships;
CREATE POLICY "memberships: view own" ON public.memberships FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "settings: members read"  ON public.settings;
DROP POLICY IF EXISTS "settings: admins insert" ON public.settings;
DROP POLICY IF EXISTS "settings: admins update" ON public.settings;
DROP POLICY IF EXISTS "settings: admins delete" ON public.settings;
CREATE POLICY "settings: org access" ON public.settings FOR ALL
  USING      (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

DROP FUNCTION IF EXISTS public.get_invite(text);
DROP FUNCTION IF EXISTS public.accept_invite(text);
DROP FUNCTION IF EXISTS public.org_members(uuid);
DROP FUNCTION IF EXISTS public.set_member_role(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.remove_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.transfer_ownership(uuid, uuid);
DROP FUNCTION IF EXISTS public.create_personal_org();
DROP TABLE IF EXISTS public.org_invites;
DROP FUNCTION IF EXISTS public.org_role(uuid);
DROP FUNCTION IF EXISTS public.current_org_ids();

COMMIT;
