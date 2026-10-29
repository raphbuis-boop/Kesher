-- ─── Kesher Phase 1.3: Google Sheets connection ──────────────────────────────
--
-- Run AFTER migrate_p1_2_sync.sql. Safe on live data, re-runnable.
--
-- oauth_connections stores each school's Google connection: the account
-- email and the refresh token, AES-256-GCM encrypted by the app
-- (KESHER_ENCRYPTION_KEY). RLS is on with NO policies, so the browser can
-- never read it — only server code using the service role, always filtered
-- by org_id.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.oauth_connections (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  provider           text        NOT NULL CHECK (provider IN ('google')),
  account_email      text,
  refresh_token_enc  text        NOT NULL,
  scopes             text,
  connected_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, provider)
);

ALTER TABLE public.oauth_connections ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: service role only.

COMMIT;

-- ─── Verify (run separately) ─────────────────────────────────────────────────
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'oauth_connections';   -- true
--   SELECT count(*) FROM pg_policies WHERE tablename = 'oauth_connections';     -- 0
