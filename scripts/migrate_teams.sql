-- ─── Kesher: multi-user teams (roles + invites) ─────────────────────────────
--
-- Run once in the Supabase SQL editor, AFTER migrate_multitenancy.sql.
-- Safe to re-run (idempotent). Everything runs in one transaction.
--
-- What it does
--   1. Helper functions current_org_ids() / org_role() (SECURITY DEFINER, so
--      policies on `memberships` can look at `memberships` without recursion)
--   2. memberships RLS: members can SEE their teammates' rows in their own
--      org(s) — never another org's. Still no INSERT/UPDATE/DELETE policies:
--      membership changes only happen through the functions below.
--   3. settings RLS: every member can read; only owner/admin can write
--   4. org_invites table (token stored only as a SHA-256 hash) + RLS
--   5. Functions: get_invite, accept_invite, org_members, set_member_role,
--      remove_member, transfer_ownership, create_personal_org
--   6. Signup trigger: an email with a pending invite does NOT get its own
--      empty org at signup
--   7. Existing users: the sole member of every existing org is its owner
--
-- Data tables (people, messages, …) already allow access via
--   org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())
-- so a teammate's membership row is all they need — and deleting it blocks
-- access on the very next query. Those policies are unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─── 1. Helpers ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_org_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.memberships WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.org_role(p_org uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.memberships WHERE user_id = auth.uid() AND org_id = p_org;
$$;

REVOKE ALL ON FUNCTION public.current_org_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.org_role(uuid)    FROM PUBLIC;
-- anon too: they return nothing without a session, so policies that call
-- them simply match no rows instead of raising "permission denied"
GRANT EXECUTE ON FUNCTION public.current_org_ids() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.org_role(uuid)    TO anon, authenticated;


-- ─── 2. memberships: see teammates in your own org only ──────────────────────

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "memberships: view own"     ON public.memberships;
DROP POLICY IF EXISTS "memberships: view own org" ON public.memberships;
CREATE POLICY "memberships: view own org"
  ON public.memberships FOR SELECT
  USING (org_id IN (SELECT public.current_org_ids()));


-- ─── 3. settings: read for members, write for owner/admin ────────────────────

DROP POLICY IF EXISTS "settings: org access" ON public.settings;
DROP POLICY IF EXISTS "settings: members read" ON public.settings;
DROP POLICY IF EXISTS "settings: admins insert" ON public.settings;
DROP POLICY IF EXISTS "settings: admins update" ON public.settings;
DROP POLICY IF EXISTS "settings: admins delete" ON public.settings;

CREATE POLICY "settings: members read" ON public.settings FOR SELECT
  USING (org_id IN (SELECT public.current_org_ids()));
CREATE POLICY "settings: admins insert" ON public.settings FOR INSERT
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY "settings: admins update" ON public.settings FOR UPDATE
  USING      (public.org_role(org_id) IN ('owner', 'admin'))
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY "settings: admins delete" ON public.settings FOR DELETE
  USING (public.org_role(org_id) IN ('owner', 'admin'));


-- ─── 4. Invites ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_invites (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  email       text        NOT NULL CHECK (email = lower(email)),
  role        text        NOT NULL CHECK (role IN ('admin', 'member')),
  token_hash  text        NOT NULL UNIQUE,          -- sha256(token) hex; raw token only ever in the email
  invited_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at  timestamptz
);

CREATE INDEX IF NOT EXISTS org_invites_org_id_idx ON public.org_invites(org_id);
-- At most one open invite per (org, email); "invite again" re-uses it
CREATE UNIQUE INDEX IF NOT EXISTS org_invites_one_open_idx
  ON public.org_invites(org_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_invites: admins read"   ON public.org_invites;
DROP POLICY IF EXISTS "org_invites: admins insert" ON public.org_invites;
DROP POLICY IF EXISTS "org_invites: admins update" ON public.org_invites;

CREATE POLICY "org_invites: admins read" ON public.org_invites FOR SELECT
  USING (public.org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY "org_invites: admins insert" ON public.org_invites FOR INSERT
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin') AND invited_by = auth.uid());
CREATE POLICY "org_invites: admins update" ON public.org_invites FOR UPDATE
  USING      (public.org_role(org_id) IN ('owner', 'admin'))
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));
-- No DELETE policy: invites are revoked (revoked_at), never deleted, for an audit trail.


-- ─── 5. Functions ────────────────────────────────────────────────────────────

-- Public preview of an invite for the /invite/[token] page (works signed out).
-- Takes the token's SHA-256 hash; returns nothing useful for a wrong token.
CREATE OR REPLACE FUNCTION public.get_invite(p_token_hash text)
RETURNS TABLE (status text, school_name text, email text, role text, inviter text, expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    CASE
      WHEN i.revoked_at  IS NOT NULL THEN 'revoked'
      WHEN i.accepted_at IS NOT NULL THEN 'accepted'
      WHEN i.expires_at  <= now()    THEN 'expired'
      ELSE 'valid'
    END,
    COALESCE(NULLIF(s.value, ''), 'your school'),
    i.email,
    i.role,
    COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), u.email),
    i.expires_at
  FROM public.org_invites i
  LEFT JOIN public.settings s ON s.org_id = i.org_id AND s.key = 'school_name'
  LEFT JOIN auth.users u      ON u.id = i.invited_by
  WHERE i.token_hash = p_token_hash;
$$;

-- Accepts an invite for the signed-in user. Single-use, checks expiry and
-- revocation, and requires the user's confirmed email to match the invite.
CREATE OR REPLACE FUNCTION public.accept_invite(p_token_hash text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invite public.org_invites%ROWTYPE;
  v_email  text;
  v_confirmed timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in to accept this invite.' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_invite FROM public.org_invites WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This invite link is not valid.' USING ERRCODE = 'P0002';
  END IF;
  IF v_invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'This invite was revoked.' USING ERRCODE = 'P0001';
  END IF;
  IF v_invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This invite has already been used.' USING ERRCODE = 'P0001';
  END IF;
  IF v_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'This invite has expired. Ask for a new one.' USING ERRCODE = 'P0001';
  END IF;

  SELECT lower(email), email_confirmed_at INTO v_email, v_confirmed FROM auth.users WHERE id = auth.uid();
  IF v_email IS DISTINCT FROM v_invite.email THEN
    RAISE EXCEPTION 'This invite was sent to a different email address.' USING ERRCODE = '42501';
  END IF;
  IF v_confirmed IS NULL THEN
    RAISE EXCEPTION 'Please confirm your email address first.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.memberships (user_id, org_id, role)
  VALUES (auth.uid(), v_invite.org_id, v_invite.role)
  ON CONFLICT (user_id, org_id) DO NOTHING;

  UPDATE public.org_invites
     SET accepted_at = now(), accepted_by = auth.uid()
   WHERE id = v_invite.id;

  RETURN v_invite.org_id;
END;
$$;

-- Team list with names and emails (auth.users isn't readable through RLS).
CREATE OR REPLACE FUNCTION public.org_members(p_org uuid)
RETURNS TABLE (user_id uuid, email text, full_name text, role text, joined_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.user_id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', ''), m.role, m.created_at
  FROM public.memberships m
  JOIN auth.users u ON u.id = m.user_id
  WHERE m.org_id = p_org
    AND p_org IN (SELECT public.current_org_ids())
  ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.created_at;
$$;

-- Change a teammate's role between admin and member.
-- Owner/admin only; never yourself; admins can't touch owners.
-- Ownership moves only through transfer_ownership().
CREATE OR REPLACE FUNCTION public.set_member_role(p_org uuid, p_user uuid, p_role text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller text := public.org_role(p_org);
  v_target text;
BEGIN
  IF v_caller NOT IN ('owner', 'admin') OR v_caller IS NULL THEN
    RAISE EXCEPTION 'You don''t have permission to change roles.' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Role must be admin or member. Use transfer ownership to make someone the owner.' USING ERRCODE = '22023';
  END IF;
  IF p_user = auth.uid() THEN
    RAISE EXCEPTION 'You can''t change your own role.' USING ERRCODE = '42501';
  END IF;
  SELECT role INTO v_target FROM public.memberships WHERE org_id = p_org AND user_id = p_user FOR UPDATE;
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'That person isn''t on this team.' USING ERRCODE = 'P0002';
  END IF;
  IF v_target = 'owner' THEN
    RAISE EXCEPTION 'The owner''s role can only change by transferring ownership.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.memberships SET role = p_role WHERE org_id = p_org AND user_id = p_user;
END;
$$;

-- Remove a teammate. Owner/admin only; never yourself; admins can't remove
-- owners; the last owner can never be removed.
CREATE OR REPLACE FUNCTION public.remove_member(p_org uuid, p_user uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller text := public.org_role(p_org);
  v_target text;
BEGIN
  IF v_caller NOT IN ('owner', 'admin') OR v_caller IS NULL THEN
    RAISE EXCEPTION 'You don''t have permission to remove members.' USING ERRCODE = '42501';
  END IF;
  IF p_user = auth.uid() THEN
    RAISE EXCEPTION 'You can''t remove yourself.' USING ERRCODE = '42501';
  END IF;
  SELECT role INTO v_target FROM public.memberships WHERE org_id = p_org AND user_id = p_user FOR UPDATE;
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'That person isn''t on this team.' USING ERRCODE = 'P0002';
  END IF;
  IF v_target = 'owner' AND v_caller <> 'owner' THEN
    RAISE EXCEPTION 'Only an owner can remove an owner.' USING ERRCODE = '42501';
  END IF;
  IF v_target = 'owner' AND (SELECT count(*) FROM public.memberships WHERE org_id = p_org AND role = 'owner') <= 1 THEN
    RAISE EXCEPTION 'You can''t remove the last owner.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.memberships WHERE org_id = p_org AND user_id = p_user;
END;
$$;

-- Make a teammate the owner; the current owner becomes an admin. Atomic.
CREATE OR REPLACE FUNCTION public.transfer_ownership(p_org uuid, p_user uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.org_role(p_org) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only the owner can transfer ownership.' USING ERRCODE = '42501';
  END IF;
  IF p_user = auth.uid() THEN
    RAISE EXCEPTION 'You already own this account.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.memberships WHERE org_id = p_org AND user_id = p_user) THEN
    RAISE EXCEPTION 'That person isn''t on this team.' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.memberships SET role = 'owner' WHERE org_id = p_org AND user_id = p_user;
  UPDATE public.memberships SET role = 'admin' WHERE org_id = p_org AND user_id = auth.uid();
END;
$$;

-- For a signed-in user with no school at all (invite revoked before they
-- accepted, or removed from a team): create their own workspace, exactly
-- like signup used to.
CREATE OR REPLACE FUNCTION public.create_personal_org()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in.' USING ERRCODE = '28000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.memberships WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You already belong to a school.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.orgs (name) VALUES ('My Organization') RETURNING id INTO v_org_id;
  INSERT INTO public.memberships (user_id, org_id, role) VALUES (auth.uid(), v_org_id, 'owner');
  INSERT INTO public.settings (org_id, key, value) VALUES
    (v_org_id, 'school_name',     ''),
    (v_org_id, 'school_logo_url', ''),
    (v_org_id, 'primary_color',   '#1e3a6e'),
    (v_org_id, 'website_url',     ''),
    (v_org_id, 'footer_text',     ''),
    (v_org_id, 'reply_to_email',  ''),
    (v_org_id, 'sender_name',     ''),
    (v_org_id, 'sender_email',    '');
  RETURN v_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_invite(text)                     FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_invite(text)                  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.org_members(uuid)                    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_member_role(uuid, uuid, text)    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_member(uuid, uuid)            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transfer_ownership(uuid, uuid)       FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_personal_org()                FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_invite(text)                  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invite(text)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_members(uuid)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_member(uuid, uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_ownership(uuid, uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_personal_org()             TO authenticated;


-- ─── 6. Signup trigger: invited emails don't get their own org ───────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Someone signing up from an invite joins that school when they accept it
  -- (/invite/[token]) — don't create an empty org of their own.
  IF EXISTS (
    SELECT 1 FROM public.org_invites
    WHERE email = lower(NEW.email)
      AND accepted_at IS NULL
      AND revoked_at  IS NULL
      AND expires_at  > now()
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.orgs (name)
  VALUES ('My Organization')
  RETURNING id INTO v_org_id;

  INSERT INTO public.memberships (user_id, org_id, role)
  VALUES (NEW.id, v_org_id, 'owner');

  INSERT INTO public.settings (org_id, key, value) VALUES
    (v_org_id, 'school_name',     ''),
    (v_org_id, 'school_logo_url', ''),
    (v_org_id, 'primary_color',   '#1e3a6e'),
    (v_org_id, 'website_url',     ''),
    (v_org_id, 'footer_text',     ''),
    (v_org_id, 'reply_to_email',  ''),
    (v_org_id, 'sender_name',     ''),
    (v_org_id, 'sender_email',    '');

  RETURN NEW;
END;
$$;
-- (trigger on_auth_user_created already points at this function)


-- ─── 7. Existing users: the only member of each org is its owner ─────────────

UPDATE public.memberships m
   SET role = 'owner'
 WHERE m.role <> 'owner'
   AND (SELECT count(*) FROM public.memberships x WHERE x.org_id = m.org_id) = 1;

COMMIT;

-- ─── Verify (run separately) ─────────────────────────────────────────────────
-- Every org should have exactly one owner (expect zero rows):
--   SELECT org_id, count(*) FILTER (WHERE role = 'owner') AS owners
--   FROM memberships GROUP BY org_id HAVING count(*) FILTER (WHERE role = 'owner') <> 1;
-- Policies in place:
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE tablename IN ('memberships', 'settings', 'org_invites') ORDER BY 1, 2;
