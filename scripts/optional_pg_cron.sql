-- ─── OPTIONAL: run Kesher's background sender from Supabase (pg_cron) ─────────
--
-- Scheduled sends, repeating sends and Shabbos-held sends are picked up by
-- GET /api/cron/dispatch. Vercel's free (Hobby) plan only allows daily cron
-- jobs, so if you are NOT on Vercel Pro, run this once in the Supabase SQL
-- editor instead. (On Vercel Pro, add the line shown in the PR notes to
-- vercel.json and skip this file.)
--
-- 1. Replace YOUR-SITE with your production URL (no trailing slash), and
--    YOUR_CRON_SECRET with the same value as the CRON_SECRET env var.
-- 2. Run it. To stop it later:  select cron.unschedule('kesher-dispatch');
--
-- Note: the secret is stored in cron.job, which only database admins can read.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('kesher-dispatch') where exists (select 1 from cron.job where jobname = 'kesher-dispatch');

select cron.schedule(
  'kesher-dispatch',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://YOUR-SITE/api/cron/dispatch',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET'),
    timeout_milliseconds := 55000
  );
  $$
);

-- Check it is running (Settings → Messaging shows "Running" within 5 minutes):
--   select jobname, schedule, active from cron.job where jobname = 'kesher-dispatch';
--   select * from cron.job_run_details order by start_time desc limit 5;
