-- ─── Kesher Phase 1.4: "request integration" ─────────────────────────────────
--
-- Run AFTER migrate_p1_3_google_sheets.sql. Safe on live data, re-runnable.
-- Records which school asked for which SIS connector (FACTS / Veracross /
-- Blackbaud) so you know what to build next. One request per school per
-- provider; owners/admins of the school can create and see their own.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.integration_requests (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  provider      text        NOT NULL CHECK (provider IN ('facts', 'veracross', 'blackbaud', 'other')),
  note          text,
  requested_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, provider)
);

ALTER TABLE public.integration_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integration_requests: admins read"   ON public.integration_requests;
DROP POLICY IF EXISTS "integration_requests: admins insert" ON public.integration_requests;
DROP POLICY IF EXISTS "integration_requests: admins delete" ON public.integration_requests;
CREATE POLICY "integration_requests: admins read" ON public.integration_requests FOR SELECT
  USING (public.org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY "integration_requests: admins insert" ON public.integration_requests FOR INSERT
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin') AND requested_by = auth.uid());
CREATE POLICY "integration_requests: admins delete" ON public.integration_requests FOR DELETE
  USING (public.org_role(org_id) IN ('owner', 'admin'));

COMMIT;

-- See what schools are asking for (run as the project owner):
--   SELECT provider, count(*) FROM integration_requests GROUP BY 1 ORDER BY 2 DESC;
