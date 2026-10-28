-- ─── Kesher Phase 3.1: Shabbos & Yom Tov mode ────────────────────────────────
--
-- Run AFTER migrate_p2_5_tracking.sql. Safe on live data, re-runnable:
-- new tables and one additive column only. Off for every school until an
-- owner/admin turns it on in Settings → Shabbos & Yom Tov.
--
-- org_shabbos       one row per school: on/off, location, candle-lighting and
--                   havdalah rules, and the buffer after havdalah.
-- shabbos_windows   the cached candle-lighting → havdalah windows for the next
--                   few months (refreshed weekly from Hebcal), so sending never
--                   waits on a network call.
-- window_overrides  the audit log of emergency sends during a window.
-- messages.window_override_reason  set when an owner sent during a window.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_shabbos (
  org_id            uuid        PRIMARY KEY REFERENCES public.orgs(id) ON DELETE CASCADE,
  enabled           boolean     NOT NULL DEFAULT false,
  geo_kind          text        NOT NULL DEFAULT 'zip' CHECK (geo_kind IN ('zip', 'geoname')),
  zip               text,
  geonameid         text,
  israel_schedule   boolean     NOT NULL DEFAULT false,
  location_name     text,
  tzid              text,
  latitude          numeric,
  longitude         numeric,
  candle_minutes    integer     NOT NULL DEFAULT 18 CHECK (candle_minutes BETWEEN 0 AND 90),
  havdalah_mode     text        NOT NULL DEFAULT 'minutes' CHECK (havdalah_mode IN ('minutes', 'tzeis')),
  havdalah_minutes  integer     NOT NULL DEFAULT 50 CHECK (havdalah_minutes BETWEEN 20 AND 120),
  buffer_minutes    integer     NOT NULL DEFAULT 30 CHECK (buffer_minutes BETWEEN 0 AND 240),
  fetched_at        timestamptz,
  fetch_error       text,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shabbos_windows (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  starts_at   timestamptz NOT NULL,   -- candle lighting
  ends_at     timestamptz NOT NULL,   -- havdalah (the buffer is added by the app)
  kind        text        NOT NULL DEFAULT 'shabbos' CHECK (kind IN ('shabbos', 'yomtov')),
  label       text,
  fetched_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, starts_at)
);
CREATE INDEX IF NOT EXISTS shabbos_windows_org_range_idx ON public.shabbos_windows(org_id, ends_at);

CREATE TABLE IF NOT EXISTS public.window_overrides (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  message_id  uuid        REFERENCES public.messages(id) ON DELETE SET NULL,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reason      text        NOT NULL,
  window_label text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS window_overrides_org_idx ON public.window_overrides(org_id, created_at DESC);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS window_override_reason text;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Members can read their school's settings and windows (the app shows "Next
-- Shabbos" to everyone); owners/admins change the settings. Windows and the
-- override log are written by server code only (service role) — except that an
-- owner's emergency override is logged under their own session.

ALTER TABLE public.org_shabbos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shabbos_windows  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.window_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_shabbos: members read"   ON public.org_shabbos;
DROP POLICY IF EXISTS "org_shabbos: admins insert"  ON public.org_shabbos;
DROP POLICY IF EXISTS "org_shabbos: admins update"  ON public.org_shabbos;
CREATE POLICY "org_shabbos: members read"  ON public.org_shabbos FOR SELECT
  USING (org_id IN (SELECT public.current_org_ids()));
CREATE POLICY "org_shabbos: admins insert" ON public.org_shabbos FOR INSERT
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY "org_shabbos: admins update" ON public.org_shabbos FOR UPDATE
  USING      (public.org_role(org_id) IN ('owner', 'admin'))
  WITH CHECK (public.org_role(org_id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "shabbos_windows: members read" ON public.shabbos_windows;
CREATE POLICY "shabbos_windows: members read" ON public.shabbos_windows FOR SELECT
  USING (org_id IN (SELECT public.current_org_ids()));

DROP POLICY IF EXISTS "window_overrides: admins read"     ON public.window_overrides;
DROP POLICY IF EXISTS "window_overrides: owners insert"   ON public.window_overrides;
CREATE POLICY "window_overrides: admins read" ON public.window_overrides FOR SELECT
  USING (public.org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY "window_overrides: owners insert" ON public.window_overrides FOR INSERT
  WITH CHECK (public.org_role(org_id) = 'owner' AND user_id = auth.uid());

COMMIT;

-- ─── Verify (run separately) ─────────────────────────────────────────────────
--   SELECT count(*) FROM org_shabbos WHERE enabled;            -- 0 until a school turns it on
--   SELECT relrowsecurity FROM pg_class WHERE relname IN ('org_shabbos','shabbos_windows','window_overrides');  -- all true
