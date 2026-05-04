# SI Outreach — Web

Next.js 15 + TypeScript + Tailwind + Supabase rewrite of the legacy Flask app at `../backend/` and `../frontend/`. The legacy app remains untouched.

## Setup

```bash
pnpm install
cp .env.example .env.local   # already done — keys live in .env.local
```

### Supabase

1. Open the SQL editor in your Supabase project (`https://supabase.com/dashboard/project/kargxhcpiyqaqkzxtics/sql/new`).
2. Paste the contents of `supabase/migrations/0001_init.sql` and run it.
3. Seed the default admin user:

```bash
pnpm seed
```

This creates `admin@siucsd.com` / `siucsd2026` (or whatever the `DEFAULT_*` env vars say).

### Run

```bash
pnpm dev          # http://localhost:3000
```

## Tests

```bash
pnpm test         # Vitest — unit + API integration (mocked externals)
pnpm test:e2e     # Playwright — browser E2E (mocked externals)
pnpm test:all     # typecheck + lint + build + both test suites
pnpm test:live    # Optional: hit real Gemini / Brevo / YC / DDG (skips on missing creds)
```

## Architecture

- `app/(auth)/login` — login page (Supabase signInWithPassword).
- `app/(app)/` — authenticated app shell with header + tabs.
  - `queue/` — approval queue with chunked bulk-draft.
  - `contacts/` — contacts table + CRUD.
  - `events/` — event CRUD.
  - `import/` — CSV / YC / LinkedIn search / manual.
  - `team/` — add/list team members.
- `app/api/` — route handlers, 1:1 mapping with the legacy Flask endpoints.
- `lib/` — pure ports of the legacy `backend/` modules (personalizer, gemini, brevo, csv, scraper) plus Supabase clients.
- `supabase/migrations/` — Postgres schema + RLS policies.

## Bulk-draft batching

The legacy `/api/draft/bulk` iterated every contact serially — it would have timed out on Vercel. The Next.js version splits work into chunks of 5 contacts per request, processed in parallel via `Promise.allSettled`. The client drives the loop and shows a progress bar.
