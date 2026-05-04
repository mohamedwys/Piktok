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

## Locales

Three locales ship in v1: **`en`** (default), **`fr`**, **`ar`**.

- Translation catalogs live at `messages/<locale>.json`.
- All locale-aware pages live under `src/app/[locale]/`.
- Non-localized routes stay at the root: `src/app/auth/callback/route.ts` (H.5 magic-link landing) and `src/app/auth/error/page.tsx` (rare error page, English-only).
- The header's language switcher (`src/components/ui/LanguageSwitcher.tsx`) writes a `NEXT_LOCALE` cookie so the choice sticks across visits.
- Locale detection priority: URL path → `NEXT_LOCALE` cookie → `Accept-Language` header → `defaultLocale: 'en'`.

URLs:

```
/         → English landing (default, no prefix)
/fr       → French landing
/ar       → Arabic landing (LTR layout for v1; RTL polish in H.7.2)
/upgrade  → English upgrade
/fr/upgrade, /ar/upgrade → localized variants
```

### Adding a new locale

1. Add the locale code to `src/i18n/routing.ts` (`locales: [...]`).
2. Create `messages/<code>.json` with the same key shape as `messages/en.json`.
3. Add the option to `src/components/ui/LanguageSwitcher.tsx`'s `LOCALES` array.
4. `npm run build` — Next.js prerenders the new locale automatically via `generateStaticParams`.

### Translation quality

- **EN** — written by the team, source-of-truth voice.
- **FR** — written by the team (mobile market precedent).
- **AR** — best-effort initial translation, **pending professional review** before public launch. The marketing surface deserves better than auto-translation; flag this when the AR market is prioritized.

Missing keys in any catalog fall back to the default locale (EN).

## Currency

Three currencies ship in v1: **EUR** (default), **USD**, **AED**.

- Per-currency pricing copy lives in `messages/<locale>.json` under the `pricing.<currency>` subtree (`priceMonthly`, `cadenceMonthly`, `priceYearly`, `cadenceYearly`, `savings`).
- Pricing is per-currency-authored (€19, $19, AED 79 monthly) — no live FX-rate conversion. The Mony Pro subscription has fixed prices per currency, so static authoring is the right model.
- The header's `CurrencyPicker` (`src/components/ui/CurrencyPicker.tsx`) writes a `NEXT_CURRENCY` cookie so the choice sticks across visits.
- Currency detection priority: `NEXT_CURRENCY` cookie → first `Accept-Language` country tag mapped via `COUNTRY_CURRENCY` (`src/i18n/currency.ts`) → fallback `eur`.

### Stripe prices (6 total)

The Stripe Dashboard backs the per-currency pricing with six Prices on the Mony Pro Product:

| Currency | Monthly | Yearly |
| --- | --- | --- |
| EUR | €19 | €190 |
| USD | $19 | $190 |
| AED | AED 79 | AED 749 |

Each Price ID lands in an env var named `STRIPE_PRICE_<CURRENCY>_<CADENCE>` (uppercase) — see `.env.local.example`. The H.8 Checkout API route (revised post-H.7.3) reads the visitor's `NEXT_CURRENCY` cookie + cadence param and selects the matching env var.

### Adding a new currency

1. Add the code to `src/i18n/currency.ts` (`CURRENCIES` + `CURRENCY_LABELS`).
2. Map relevant country codes to the currency in `COUNTRY_CURRENCY`.
3. Add the per-currency subtree to all locale catalogs at `pricing.<currency>`.
4. Create the two new Stripe Prices (monthly + yearly) and capture the IDs into `STRIPE_PRICE_<CURRENCY>_<CADENCE>` env vars.
5. Add the option to `src/components/ui/CurrencyPicker.tsx`'s rendered list (it already iterates `CURRENCIES`, but a dedicated symbol/label needs the `CURRENCY_LABELS` entry from step 1).

### Mobile vs. web — independent detection

The mobile app already auto-detects display currency via `expo-localization` + jsdelivr live FX rates (Phase H' on the mobile side) — but mobile's currency reflects the BUYER's display preference for marketplace products listed in the SELLER's local currency. Web's currency reflects the visitor's preferred Stripe Checkout currency for the Mony Pro subscription itself.

The two systems are independent; a UAE visitor sees AED on both surfaces (mobile via H'.2.1 jsdelivr, web via H.7.3 cookie/header), but the mechanisms are different.

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
