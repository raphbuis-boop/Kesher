-- ─── Kesher Phase 4.1: parent self-signup ────────────────────────────────────
--
-- Run AFTER migrate_p3_1_shabbos.sql. Safe on live data, re-runnable.
--
-- signup_otps  one-time phone verification codes for the public signup form.
--              RLS is on with NO policies: only server code (service role) can
--              read or write it, so codes can never be read from a browser.
-- contact_preferences.phone_verified_at  when the parent proved they own the
--              number (shown to staff in "Review new contacts").
--
-- Signups themselves are ordinary rows: a household, a parent and the
-- children with status 'pending', so they appear in the existing Review new
-- contacts queue. The consent text, time and IP are stored in
-- contact_preferences (sms_consent_text / sms_consent_at / sms_consent_ip).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.signup_otps (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  phone        text        NOT NULL,
  code_hash    text        NOT NULL,
  expires_at   timestamptz NOT NULL,
  attempts     integer     NOT NULL DEFAULT 0,
  verified_at  timestamptz,
  used_at      timestamptz,
  ip           text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS signup_otps_phone_idx ON public.signup_otps(org_id, phone, created_at DESC);
CREATE INDEX IF NOT EXISTS signup_otps_ip_idx    ON public.signup_otps(ip, created_at DESC);
ALTER TABLE public.signup_otps ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: service role only.

ALTER TABLE public.contact_preferences ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;
CREATE INDEX IF NOT EXISTS contact_preferences_consent_ip_idx ON public.contact_preferences(sms_consent_ip, sms_consent_at DESC) WHERE sms_consent_ip IS NOT NULL;

COMMIT;

-- ─── Verify (run separately) ─────────────────────────────────────────────────
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'signup_otps';           -- true
--   SELECT count(*) FROM pg_policies WHERE tablename = 'signup_otps';             -- 0
