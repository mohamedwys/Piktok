# AUTH_FIX_AUDIT.md — BUG-001 / BUG-002 / BUG-003

Audit and fix log for the broken web auth flow. Recorded 2026-05-05.

---

## Symptoms

| ID | Symptom |
|----|---------|
| BUG-001 | Visiting `/admin`, `/upgrade`, `/dashboard` directly lands on the landing page |
| BUG-002 | Tapping "Upgrade to Pro" in the mobile app lands on landing instead of `/upgrade` |
| BUG-003 | Clicking "Sign in" in the landing header does nothing visible |
| BUG-004 | Clicking "Pricing" anchor appears to do nothing (section obscured by sticky header) |

---

## Root Causes Found

### RC-1: Edge Function `redirectTo` bypasses the auth callback (BUG-002)

**File:** `supabase/functions/issue-web-session/index.ts`

The Edge Function called `supabase.auth.admin.generateLink` with `redirectTo` set to
the *final destination* (`https://mony-psi.vercel.app/upgrade`). When Supabase
verifies the magic-link token at its own `/auth/v1/verify` endpoint, it redirects to
`redirectTo` — but `@supabase/ssr` session cookies are only written when the request
passes through the Next.js `/auth/callback` route handler (which calls `verifyOtp`
and uses the response object to set cookies). Pointing `redirectTo` directly at
`/upgrade` meant no cookies were ever set, so the auth-gated page bounced the user.

**Fix:** Changed `fullRedirect` construction to route through `/auth/callback?next=<path>`:

```
Before: https://mony-psi.vercel.app/upgrade
After:  https://mony-psi.vercel.app/auth/callback?next=%2Fupgrade
```

Also corrected the hardcoded fallback default from `'https://mony.vercel.app'`
(wrong domain) to `'https://mony-psi.vercel.app'`.

### RC-2: No `/sign-in` page existed (BUG-003)

The "Sign in" button in `Header.tsx` was wired to `/upgrade`. `/upgrade` redirects
any unauthenticated visitor to `/` (by design — auth gate is correct). So clicking
"Sign in" felt like doing nothing: visitor → `/upgrade` → `/`.

**Fix:** Created `web/src/app/[locale]/sign-in/page.tsx` with a magic-link request
form. Changed `Header.tsx` to link to `/sign-in`.

### RC-3: Sticky header obscures scroll anchor targets (BUG-004)

The `#pricing`, `#features`, `#faq` anchor links worked correctly, but the 64 px
sticky header covered the first ~4 lines of each section after scroll.

**Fix:** Added `scroll-padding-top: 5rem` and `scroll-behavior: smooth` to the `html`
rule in `globals.css`.

### RC-4: `/auth/callback/route.ts` status

The route **already existed** at `web/src/app/auth/callback/route.ts` (78 lines).
It correctly uses `getSupabaseServer()`, whitelists `next` to same-origin paths,
validates OTP type against Supabase's allowed set, and redirects failures to
`/auth/error`. No changes required.

---

## Files Created

| File | Purpose |
|------|---------|
| `web/src/app/[locale]/sign-in/page.tsx` | Server Component — redirects authed users, renders `SignInForm` |
| `web/src/components/auth/SignInForm.tsx` | Client Component — email input → `signInWithOtp` → "check email" state |

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/issue-web-session/index.ts` | `fullRedirect` now routes through `/auth/callback?next=<path>`; fallback base URL corrected to `mony-psi.vercel.app` |
| `web/src/components/landing/Header.tsx` | "Sign in" button `href` changed from `/upgrade` to `/sign-in` |
| `web/src/app/globals.css` | Added `scroll-padding-top: 5rem; scroll-behavior: smooth` to `html` |
| `web/messages/en.json` | Added `signIn` namespace |
| `web/messages/fr.json` | Added `signIn` namespace |
| `web/messages/ar.json` | Added `signIn` namespace (draft — native-speaker review needed) |

---

## Step 5 — Edge Function redirect_to verdict: **WRONG → FIXED**

The function was generating:
```
redirectTo = "https://mony.vercel.app/upgrade"   (wrong domain + bypasses callback)
```

It now generates:
```
redirectTo = "https://mony-psi.vercel.app/auth/callback?next=%2Fupgrade"
```

The `WEB_BASE_URL` Supabase secret must be set (see USER ACTION REQUIRED below).
The hardcoded fallback now correctly defaults to `https://mony-psi.vercel.app`.

---

## USER ACTION REQUIRED — Supabase Dashboard configuration

Log in to the Supabase Dashboard for your Mony project and verify / set the following.

### Authentication → URL Configuration

| Field | Required value |
|-------|---------------|
| **Site URL** | `https://mony-psi.vercel.app` |
| **Redirect URLs** (Additional) | `https://mony-psi.vercel.app/auth/callback` |
| | `https://mony-psi.vercel.app/**` |
| | `http://localhost:3000/auth/callback` |

All three redirect URLs must be present. Without them Supabase will reject the
`emailRedirectTo` / `redirectTo` values at link-generation time and fall back to the
Site URL, which re-breaks the flow.

### Edge Functions → issue-web-session → Secrets

| Secret | Required value |
|--------|---------------|
| `WEB_BASE_URL` | `https://mony-psi.vercel.app` |

Without this secret the function falls back to the hardcoded default. Setting it
explicitly future-proofs the function when the Vercel domain changes.

---

## Verification checklist

- [ ] `cd web && npx tsc --noEmit` exits 0
- [ ] `cd web && npm run build` exits 0
- [ ] Visit `/sign-in`, submit email → "Check your email" state displayed
- [ ] Open magic link from inbox → lands on `/dashboard` with session active
- [ ] Visit `/admin` while signed out → bounces to `/` (gate intact)
- [ ] Visit `/admin` while signed in, no admin row → bounces to `/`
- [ ] Set `is_admin = true` on sellers row → `/admin` loads subscription table
- [ ] Click "Pricing" in header → smooth scroll, section visible below sticky bar
- [ ] From mobile, tap "Upgrade to Pro" → magic link email → lands on `/upgrade` with email shown
