# Mony Web

The web companion to the Mony React Native marketplace. Hosts the
Pro upgrade flow, the seller dashboard, and (future) the admin
surface. Mobile remains the buyer + seller surface; the web
codebase exists primarily to host Stripe Checkout (App Store
policy steers subscription billing off-app per `PRO_AUDIT.md` §7)
and adjacent support surfaces.

## Stack

- Next.js 15 (App Router)
- TypeScript strict
- Tailwind CSS (port of the mobile design tokens — see
  `tailwind.config.ts`)
- Supabase SSR (`@supabase/ssr`) sharing the same Supabase
  project as the mobile app
- Vercel hosting (Root Directory = `web`)

## Local development

```bash
cd web
npm install
cp .env.local.example .env.local       # fill in the values
npm run dev                              # http://localhost:3000
```

Both Supabase env vars come from your Supabase project's
**Dashboard → Settings → API** page. They are the same anon
credentials the mobile app reads from `EXPO_PUBLIC_SUPABASE_*`
— RLS does the gating; the values are safe in the browser.

## Build / type-check

```bash
npm run build         # production build (what Vercel runs)
npm run type-check    # `tsc --noEmit`
npm run lint          # `next lint`
```

## Type generation

The web codebase has its own `src/types/supabase.ts` independent
of mobile's. Both regenerate against the same Supabase project,
so the contents stay byte-identical when run in lockstep. After
any DB migration:

```bash
npm run gen:types
```

(Runs `supabase gen types typescript --linked` — the linked
project is the one inherited from the repo-level `supabase/`
directory.)

## Deployment (Vercel)

One-time setup:

1. Push the repo to GitHub.
2. Vercel Dashboard → **New Project** → import the repo.
3. Configure:
   - **Root Directory:** `web`
   - **Framework:** Next.js (auto-detected)
   - **Environment Variables:**
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy.

After the first deploy, if the URL differs from
`https://mony.vercel.app`:
- Update `WEB_BASE_URL` in `src/lib/web/constants.ts`
  (mobile codebase) to match.
- Update the `WEB_BASE_URL` Supabase secret
  (`npx supabase secrets set WEB_BASE_URL=...`).
- Add the new URL to **Supabase Dashboard → Authentication →
  URL Configuration → Redirect URLs**.

Push-to-main triggers Vercel auto-deploys thereafter.

## Auth model

Magic links from the mobile app's `useUpgradeFlow()` hook (Phase
H.5) land at:

```
/auth/callback?token_hash=<...>&type=magiclink&next=/upgrade
```

The route handler at `src/app/auth/callback/route.ts`:

1. Whitelists `next` to same-origin relative paths.
2. Calls `supabase.auth.verifyOtp({ token_hash, type })` to
   exchange the single-use token for a session. Cookies are
   written via `@supabase/ssr`'s server-client adapter.
3. Redirects to `next` (default `/upgrade`).

Failures bounce to `/auth/error?reason=...`.

The `src/middleware.ts` file refreshes the session cookie on
every request — required for sessions to survive their
short-lived access-token expiry. Without it, a long-idle session
silently fails mid-request.

Auth-gated pages (`/upgrade`, `/dashboard`) call
`getSupabaseServer().auth.getUser()` and `redirect('/')` when
unauthenticated. **Always use `getUser()` (server-validated),
not `getSession()` (cookie-only, tamperable)** for auth gates.

## Phase H roadmap on this codebase

| Step | Status | Surface |
| --- | --- | --- |
| H.6 | This step | Scaffold + auth bridge + placeholder pages |
| H.7 | Next | Real public landing + `/upgrade` Stripe Checkout |
| H.10 | Future | Real `/dashboard` + Customer Portal link |
| H.11 | Future | `/admin/subscriptions` |
| H.12 | Future | `/api/stripe/webhook` (writes to `subscriptions` via service role) |
