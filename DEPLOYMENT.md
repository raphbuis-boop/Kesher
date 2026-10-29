# Kesher — Deployment Guide

## Prerequisites

- Node.js 18+ installed
- A [Supabase](https://supabase.com) project with the schema applied
- A [Resend](https://resend.com) account for email
- A [Sinch](https://sinch.com) Conversation API app for SMS
- A Meta WhatsApp Cloud API app for WhatsApp
- A GitHub account
- A [Vercel](https://vercel.com) account

---

## 1. Database Setup (Supabase)

### Apply the schema

Open the Supabase **SQL Editor** and run each file below, in order. Every script is safe to re-run (IF NOT EXISTS / ON CONFLICT DO NOTHING guards). Kesher never applies migrations itself.

**Already live?** Only run the files you haven't run yet — normally just the newest combined file at the bottom of the table (each pull request that changes the database says which one).

**New project, run in this order:**

| # | File | What it does |
|---|------|--------------|
| 1 | `scripts/migrate.sql` | `messages`, `message_recipients` |
| 2 | `scripts/migrate_tracking.sql` | Email delivery/open/click timestamps |
| 3 | `scripts/migrate_analytics.sql` | Replies, WhatsApp read receipts, `inbound_messages` |
| 4 | `scripts/migrate_error_detail.sql` | Per-recipient failure reasons |
| 5 | `scripts/migrate_phase1_up.sql` | Extends `people` + `groups`; `import_jobs`, `message_threads`, `thread_messages`, `message_attachments` |
| 6 | `scripts/rls_policies.sql` | Baseline Row Level Security |
| 7 | `scripts/migrate_settings.sql` | `settings` table |
| 8 | `scripts/migrate_multitenancy.sql` | `orgs`, `memberships`, `org_id` on every table, per-school RLS |
| 9 | `scripts/migrate_teams.sql` | Roles and invites; `current_org_ids()` / `org_role()` |
| 10 | `scripts/migrate_tags_org_scoped_unique.sql` | Tag names unique per school, not platform-wide |
| 11 | `scripts/run_all_phases.sql` | Phases 1–4 in one transaction: families, imports, Google Sheets, smart audiences, rollover, templates, per-school channels, send engine, scheduling, read tracking, Shabbos mode, signup, opt-outs, inbox (ends with a table of checks — every row should say `ok = true`) |
| 12 | `scripts/run_fixes.sql` | SMS consent certification records (ends with a checks table) |

The individual `scripts/migrate_p*` and `scripts/migrate_fix_*` files are the pieces the combined files were built from; you don't need to run them separately.

The base tables `people`, `tags`, `person_tags`, `groups`, `group_tags`, `relationships` and `imports` are assumed to exist already (created during Supabase project setup). If they don't, create them first:

```sql
create table people (
  id              uuid primary key default gen_random_uuid(),
  first_name      text not null,
  last_name       text not null,
  email           text,
  phone           text,
  categories      text[] default '{}',
  grade           text,
  graduation_year int,
  organization    text,
  address         text,
  notes           text,
  created_at      timestamptz not null default now()
);

create table tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

create table person_tags (
  person_id uuid not null references people(id) on delete cascade,
  tag_id    uuid not null references tags(id) on delete cascade,
  primary key (person_id, tag_id)
);

create table groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table group_tags (
  group_id uuid not null references groups(id) on delete cascade,
  tag_id   uuid not null references tags(id) on delete cascade,
  primary key (group_id, tag_id)
);

create table relationships (
  id                 uuid primary key default gen_random_uuid(),
  person_id          uuid not null references people(id) on delete cascade,
  related_person_id  uuid not null references people(id) on delete cascade,
  relationship_type  text not null,
  created_at         timestamptz not null default now()
);

create table imports (
  id              uuid primary key default gen_random_uuid(),
  file_name       text not null,
  imported_count  int not null default 0,
  failed_count    int,
  created_at      timestamptz not null default now()
);
```

### Get your Supabase credentials

In your Supabase project: **Settings → API**

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (server only — never expose it in the browser)

---

## 2. Seed Demo Data

```bash
# Make sure .env.local is set up first (see step 4)
npx tsx scripts/seed.ts
```

This creates:
- 150 contacts (students, parents, faculty, alumni, board, donors)
- 18 tags
- 3 custom audience groups (Gala 2025, Shabbaton Committee, Israel Trip)
- 10 sample messages with realistic content across all channels

---

## 3. Push to GitHub

```bash
# Create a new repo at github.com first, then:
git remote add origin https://github.com/YOUR_USERNAME/kesher.git
git push -u origin main
```

---

## 4. Deploy to Vercel

### Option A — Vercel Dashboard (recommended)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Framework: **Next.js** (auto-detected)
4. Add environment variables (see below)
5. Click **Deploy**

### Option B — Vercel CLI

```bash
npx vercel login
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel env add RESEND_API_KEY          # optional
npx vercel env add RESEND_FROM_EMAIL       # optional
npx vercel --prod
```

---

## 5. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes | Supabase anon/public key |
| `RESEND_API_KEY` | ✅ For email | API key from resend.com |
| `RESEND_FROM_EMAIL` | ✅ For email | Verified sender address (e.g. `hello@kesherhq.co`) |
| `OPENAI_API_KEY` | For AI compose | API key from platform.openai.com → API keys. Without it the "Write with AI" button says it isn't configured; everything else works |
| `SINCH_PROJECT_ID` / `SINCH_APP_ID` / `SINCH_ACCESS_KEY` / `SINCH_ACCESS_SECRET` | ✅ For SMS | Sinch Dashboard → **Settings → Access keys** (project ID, key ID, secret) and **Conversation API → Apps** (app ID). Real texts go out through Sinch |
| `SINCH_REGION` | Optional | `us` (default) or `eu` — the region your Conversation app lives in |
| `SINCH_SMS_SENDER` | For SMS | Default sending number; schools can set their own in Settings → Channels |
| `META_WHATSAPP_PHONE_NUMBER_ID` / `META_WHATSAPP_ACCESS_TOKEN` / `META_WHATSAPP_WABA_ID` / `META_WHATSAPP_TEMPLATE_NAME` / `META_WHATSAPP_TEMPLATE_LANG` | Optional | Platform-wide WhatsApp fallback (Meta Cloud API). Each school normally enters its own number, account and token in Settings → Channels; these are used only for anything a school left blank |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | ✅ For WhatsApp | Any string you choose; enter the same value in Meta App Dashboard → WhatsApp → Configuration → Webhooks → Verify token |
| `BLOB_READ_WRITE_TOKEN` | For attachments | From Vercel Dashboard → Storage → Blob store |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes | Server-side Supabase key (webhooks, scheduled sends, signup links) |
| `NEXT_PUBLIC_SITE_URL` | ✅ Yes | Your production URL, e.g. `https://www.kesherhq.co`. Used in every link sent to parents (confirm, preferences, archive, signup) |
| `KESHER_ENCRYPTION_KEY` | ✅ For Google Sheets and per-school WhatsApp | Any long random string (32+ characters). Encrypts stored credentials. Changing it makes stored tokens unreadable, so schools must reconnect |
| `CRON_SECRET` | ✅ For scheduled sends and the nightly sync | Any long random string. Vercel Cron sends it as `Authorization: Bearer …`; `/api/cron/*` rejects anything else |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | For Google Sheets sync | OAuth client from Google Cloud (see below) |
| `META_APP_SECRET` | ✅ For WhatsApp | Meta App Dashboard → your app → **App settings → Basic** → App secret → **Show**. Every WhatsApp webhook POST is checked against it (`X-Hub-Signature-256`); while it is unset, WhatsApp delivery updates and replies are **rejected**. If schools use different Meta apps, list each secret separated by commas |
| `RESEND_WEBHOOK_SECRET` | ✅ For email tracking | Resend Dashboard → **Webhooks** → your endpoint → **Signing secret** (starts with `whsec_`). While unset, events are accepted without a signature check and Settings → Channels shows a warning |
| `SINCH_WEBHOOK_SECRET` | ✅ For SMS | Sinch Dashboard → **Conversation API → Apps** → your app → **Show credentials** → App secret. While unset, delivery reports and replies are accepted without a signature check and Settings → Channels shows a warning |
| `KESHER_LINK_SECRET` | Optional | Signs the no-login links. Defaults to `SUPABASE_SERVICE_ROLE_KEY`; set it if you ever need to rotate link signing separately |

**Background jobs (cron).** Two endpoints, both protected by `CRON_SECRET`:

| Endpoint | How often | What it does |
|----------|-----------|--------------|
| `/api/cron/sync` | Once a day | Nightly Google Sheets sync (only sheets an admin has certified consent for) |
| `/api/cron/dispatch` | Every ~5 minutes | Scheduled and repeating messages, messages held for Shabbos/Yom Tov, interrupted sends, STOP confirmations |

`vercel.json` already runs `/api/cron/sync` daily. For `/api/cron/dispatch`:

- **Vercel Pro:** add `{ "path": "/api/cron/dispatch", "schedule": "*/5 * * * *" }` to `crons` in `vercel.json`.
- **Vercel Hobby (free):** Hobby only allows daily cron jobs — a more frequent one makes the deploy fail — so use Supabase's pg_cron instead:
  1. Supabase Dashboard → **Database → Extensions** → enable **pg_cron** and **pg_net** (the script also tries to enable them).
  2. Open `scripts/optional_pg_cron.sql`, replace `YOUR-SITE` with your production URL (no trailing slash) and `YOUR_CRON_SECRET` with the value of `CRON_SECRET`.
  3. Run it in the SQL Editor.
  4. Within 5 minutes Settings → Messaging shows the background sender as **Running**. To check by hand: `select * from cron.job_run_details order by start_time desc limit 5;`
  5. To stop it later: `select cron.unschedule('kesher-dispatch');`

**Google Sheets (optional).** Google Cloud Console → create a project → enable the **Google Sheets API** → OAuth consent screen (External; add `spreadsheets.readonly`, `openid`, `email`) → Credentials → **OAuth client ID** (Web application) → Authorized redirect URI: `https://<your site>/api/google/oauth/callback`. Put the client ID and secret in the environment variables above.

**Webhooks to point at the app** (Settings → Channels warns about any missing secret):

| Provider | URL | Subscribe to | Secret env var |
|----------|-----|--------------|----------------|
| Resend | `https://<your site>/api/webhooks/resend` | delivered, bounced, complained, opened, clicked, failed, suppressed | `RESEND_WEBHOOK_SECRET` |
| Sinch | `https://<your site>/api/webhooks/sinch` | `MESSAGE_DELIVERY_REPORT`, `INBOUND_MESSAGE` | `SINCH_WEBHOOK_SECRET` |
| Meta WhatsApp | `https://<your site>/api/webhooks/meta-whatsapp` | the `messages` field (delivery statuses, replies, STOP) | `META_APP_SECRET` (+ `WHATSAPP_WEBHOOK_VERIFY_TOKEN` for the one-time verify) |

**To get a Resend API key:**
1. Sign up at [resend.com](https://resend.com)
2. Go to **Domains** → add `kesherhq.co` → verify SPF, DKIM, DMARC DNS records
3. Go to **API Keys** → **Create API Key**

**To get a Vercel Blob token:**
1. In Vercel Dashboard → your project → **Storage** tab
2. Create a new **Blob** store
3. Copy the `BLOB_READ_WRITE_TOKEN` and add it as an environment variable

---

## 6. Post-Deploy Checklist

- [ ] Visit the production URL and confirm the Audiences page loads with contact counts
- [ ] Click into Parents/Students to verify contacts are visible
- [ ] Open Messages and confirm demo message history is populated
- [ ] Settings → Channels shows Email, SMS and WhatsApp as Connected and no webhook-secret warning
- [ ] Send a test message to yourself on each channel and watch it go Delivered on the message page
- [ ] Reply STOP to the test text and confirm you land on the opt-out list
- [ ] Settings → Messaging shows the background sender as Running
- [ ] Verify CSV import works (the consent certification box must be ticked before Apply)
- [ ] Test the Contacts search

---

## Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials

# Run dev server
npm run dev

# Seed demo data
npx tsx scripts/seed.ts

# Build for production
npm run build
```

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Database | Supabase (PostgreSQL) |
| Email | Resend |
| SMS | Sinch Conversation API (live) |
| WhatsApp | Meta WhatsApp Cloud API (live; each school can use its own number) |
| AI compose | OpenAI |
| Background jobs | Vercel Cron (daily sync) + Vercel Cron Pro or Supabase pg_cron (dispatch) |
| Styling | Tailwind CSS v4 |
| Hosting | Vercel |
