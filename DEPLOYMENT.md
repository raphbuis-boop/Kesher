# Kesher — Deployment Guide

## Prerequisites

- Node.js 18+ installed
- A [Supabase](https://supabase.com) project with the schema applied
- A [Resend](https://resend.com) account for email sending (optional — SMS/WhatsApp work without it)
- A GitHub account
- A [Vercel](https://vercel.com) account

---

## 1. Database Setup (Supabase)

### Apply the schema

In your Supabase project, open the **SQL Editor** and run `scripts/migrate.sql` to create the `messages` and `message_recipients` tables.

The following tables are assumed to already exist (created by the Supabase setup):
- `people`
- `tags`
- `person_tags`
- `groups`
- `group_tags`
- `relationships`
- `imports`

If they don't exist, create them in Supabase with these columns:

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

Then run `scripts/migrate.sql` in the SQL Editor.

### Get your Supabase credentials

In your Supabase project: **Settings → API**

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

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
| `RESEND_API_KEY` | For email | API key from resend.com |
| `RESEND_FROM_EMAIL` | For email | Verified sender address (e.g. `noreply@yourdomain.com`) |

**Without `RESEND_API_KEY`:** Email compose will show an error. SMS and WhatsApp work in demo/mock mode without any provider keys.

**To get a Resend API key:**
1. Sign up at [resend.com](https://resend.com)
2. Go to **API Keys** → **Create API Key**
3. Verify your domain, or use `onboarding@resend.dev` as the from address during testing

---

## 6. Post-Deploy Checklist

- [ ] Visit the production URL and confirm the Audiences page loads with contact counts
- [ ] Click into Parents/Students to verify contacts are visible
- [ ] Open Messages and confirm demo message history is populated
- [ ] Try composing a message (email requires Resend; SMS/WhatsApp work in demo mode)
- [ ] Verify CSV import works
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
| SMS/WhatsApp | Mocked (demo mode) |
| Styling | Tailwind CSS v4 |
| Hosting | Vercel |
