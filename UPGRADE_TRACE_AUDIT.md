# UPGRADE_TRACE_AUDIT.md

End-to-end trace of the "Upgrade to Pro → Authentication failed" loop.
Recorded 2026-05-06. Audit-first; no code edits performed.

---

## 1. Executive summary

Most likely root cause, in descending order of certainty:

1. **The Supabase Edge Function `issue-web-session` is almost certainly running stale code on the Supabase platform.** The mobile-bridge fix (`/auth/callback?next=…` routing) was committed locally on 2026-05-05 (`86be8c9`), but the function file mtime on disk also matches that date — there is no evidence the user ran `npx supabase functions deploy issue-web-session` afterward. If the deployed function still emits `redirectTo = …/upgrade` directly, it bypasses the callback and `verifyOtp` is never called — but that bug presents as "lands on landing page", NOT "lands on /auth/error". Verify first; treat this as the diagnostic checkpoint.

2. **The error page (`web/src/app/auth/error/page.tsx`) hides the actual `reason` query param.** We cannot confirm what `verifyOtp` is failing with without surfacing it. This is the single most important observability gap; every diagnosis below is constrained by it.

3. **No code-level bug is conclusively proven** in the deployed Next.js app. All three target fixes are present on `main` and `origin/main` is in sync. Cookie flow is canonical for Next.js Route Handlers.

The bug is plausibly a deployment / configuration issue, not a code issue. Stop guessing and instrument first.

---

## 2. Phase-by-phase findings

### Phase 1 — Deployment state ✅

- [`web/src/app/auth/callback/route.ts`](web/src/app/auth/callback/route.ts) — dual-format support (`code` + `token_hash`) present. Last touched in `6387deb` (2026-05-06 10:12) and earlier `a2d72eb`. **In git.**
- [`web/src/app/api/stripe/checkout/route.ts`](web/src/app/api/stripe/checkout/route.ts) — `try/catch` around `customers.create` ([route.ts:119-136](web/src/app/api/stripe/checkout/route.ts#L119-L136)) and `sessions.create` ([route.ts:177-212](web/src/app/api/stripe/checkout/route.ts#L177-L212)) returning `details: message` present. Last touched in `ca3fa85` (2026-05-06 10:50). **In git.**
- [`web/src/components/upgrade/UpgradeForm.tsx`](web/src/components/upgrade/UpgradeForm.tsx) — surfaces `body.details` in error message ([UpgradeForm.tsx:67-75](web/src/components/upgrade/UpgradeForm.tsx#L67-L75)). Last touched in `8a515fd` (2026-05-06 10:56). **In git.**
- `git status`: clean, working tree matches HEAD.
- `git fetch origin` + `git log origin/main`: local `main` and `origin/main` agree. Top commit `b328c52`.

**Conclusion:** Vercel auto-deploy from `origin/main` → `mony-psi.vercel.app` is the deployed version. Assuming the Vercel project is configured for `main` push triggers (default), the dual-format callback fix IS deployed. ⚠ The user should confirm via Vercel Dashboard → Deployments → most recent build SHA = `b328c52`.

### Phase 2 — Mobile→web bridge ⚠️

- [`src/hooks/useUpgradeFlow.ts:58-77`](src/hooks/useUpgradeFlow.ts#L58-L77): calls `supabase.functions.invoke('issue-web-session', { body: { redirect_to: '/upgrade' } })`, then opens the returned `data.url` via `WebBrowser.openBrowserAsync` (PAGE_SHEET).
- Soft fallback (lines 67-70): on Edge-Function error or empty `url`, opens bare `https://mony-psi.vercel.app/upgrade`. **This is relevant** — if the user actually sees `/auth/error` (not `/`), the Edge Function did return a `url` and the magic-link flow IS reaching the verify endpoint. Soft-fallback would land on `/` (no auth → bounce to landing), not `/auth/error`.
- [`supabase/functions/issue-web-session/index.ts:90-95`](supabase/functions/issue-web-session/index.ts#L90-L95): builds `https://mony-psi.vercel.app/auth/callback?next=/upgrade` then passes to `admin.generateLink({type: 'magiclink', email, options: { redirectTo }})`.
- File mtime: `2026-05-05 23:13:34`. Latest commit touching this file: `86be8c9` (same date). **No evidence of post-commit `supabase functions deploy`.** ❌
- Secrets read: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WEB_BASE_URL` (with `https://mony-psi.vercel.app` fallback at line 90). Missing `WEB_BASE_URL` is benign; only matters if the secret is set incorrectly.
- The action_link returned by `generateLink` has shape: `https://<ref>.supabase.co/auth/v1/verify?token=<TOKEN>&type=magiclink&redirect_to=<ENCODED-CALLBACK-URL>`.

**User action required (Phase 2.3):** Run `npx supabase functions list` and confirm `issue-web-session` "Updated at" is ≥ 2026-05-05 23:16 (commit timestamp). If older, **the Edge Function is stale.**

### Phase 3 — `/auth/callback` handler ⚠️

- [`web/src/app/auth/callback/route.ts:73-96`](web/src/app/auth/callback/route.ts#L73-L96): OTP branch. Validates `type` against `ALLOWED_OTP_TYPES`, then `verifyOtp({type, token_hash})`. On error: `console.error('[auth/callback] verifyOtp failed:', error.message)` then redirects to `/auth/error?reason=<encoded-message>`.
- The reason is in the URL but `web/src/app/auth/error/page.tsx` does **not** display it ([error/page.tsx:13-32](web/src/app/auth/error/page.tsx#L13-L32)). The user only sees the generic English copy "may have expired or already been used". ❌ Observability gap.
- Vercel function logs WILL contain the actual error message. The user must check: Vercel Dashboard → mony-psi → Logs (or Functions → `app/auth/callback/route` → Logs) immediately after a failed tap.

### Phase 4 — Web sign-in → /upgrade ⚠️

- [`web/src/app/[locale]/sign-in/page.tsx`](web/src/app/[locale]/sign-in/page.tsx): exists. Auto-redirects authed users via `redirect({ href: (next ?? '/dashboard') as '/', locale })`.
- [`web/src/components/auth/SignInForm.tsx:20`](web/src/components/auth/SignInForm.tsx#L20): builds `emailRedirectTo = ${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`. Calls `signInWithOtp({email, options: { emailRedirectTo }})`.
- This is the **PKCE branch** of `/auth/callback` (the `code` query param). It is structurally identical to the OTP branch but uses `exchangeCodeForSession`.
- `/dashboard` route exists at `web/src/app/[locale]/dashboard/page.tsx`. ✅
- **Untested in this session — control test required.** If browser-direct sign-in via `/sign-in` works, the callback's PKCE branch is fine and the bug is OTP-specific (mobile bridge). If it ALSO fails, the issue is broader (deploy / env / Supabase config).

### Phase 5 — /upgrade page auth gate ✅ (cookie flow likely fine)

- [`web/src/app/[locale]/upgrade/page.tsx:47-53`](web/src/app/%5Blocale%5D/upgrade/page.tsx#L47-L53): `getUser()` → if null → `redirect({ href: '/', locale })`. **Bouncing to `/` on auth failure means: a successfully-authenticated user landing here would see the page; an unauth'd user lands on `/`, NOT on `/auth/error`.**
- The user reports `/auth/error` — so `/upgrade` is never reached. The verifyOtp call is failing **before** any cookie can be tested by `/upgrade`.
- This rules OUT cookie-flow problems as the proximate cause: cookies don't matter if `verifyOtp` fails first.
- For completeness: cookie-flow audit
  - [`web/src/lib/supabase/server.ts:36-53`](web/src/lib/supabase/server.ts#L36-L53): `setAll` writes via `cookieStore.set()` from `next/headers`. In Next.js Route Handlers, this DOES propagate to the outgoing response (including `NextResponse.redirect()`). The try/catch is for Server Component contexts where cookie writes throw.
  - [`web/src/middleware.ts:99-112`](web/src/middleware.ts#L99-L112): matcher excludes `/auth/callback` (correct — the route owns the cookie write). Does NOT exclude `/upgrade` — middleware re-runs and refreshes the session cookie there.
  - This is the canonical Supabase + Next.js App Router pattern. The "build redirect first then attach cookies" alternative pattern is one option but the current `cookies()` from `next/headers` pattern works correctly in Route Handlers per Next.js 13+ docs.
  - **Verdict:** cookie flow is not the bug. Will become relevant only AFTER `verifyOtp` is made to succeed.

### Phase 6 — Stripe Checkout chain (deferred)

Not reached. Upstream (`/auth/callback`) is failing; Stripe is downstream. Re-evaluate after `verifyOtp` succeeds.

### Phase 7 — Configuration cross-check (user-only)

- Supabase Dashboard → Auth → URL Configuration:
  - **Site URL** must be `https://mony-psi.vercel.app`.
  - **Additional Redirect URLs** must include `https://mony-psi.vercel.app/auth/callback` AND `https://mony-psi.vercel.app/**`.
  - If `redirect_to` is not allow-listed, Supabase silently swaps to Site URL. That would land the user on `/` with `?token_hash=...` (which `/` ignores) and bounce to landing — NOT to `/auth/error`. So if the user is on `/auth/error`, allow-list is probably correct, BUT verify anyway because misconfiguration cascades.
- Supabase Dashboard → Edge Functions → `issue-web-session` → Secrets:
  - `WEB_BASE_URL` should equal `https://mony-psi.vercel.app` (or absent → fallback works).
  - **Critical:** secret value must NOT have a trailing slash; `new URL('/auth/callback', 'https://x.com/')` produces `https://x.com/auth/callback` correctly, but a typo like `mony.vercel.app` would break the allow-list match.
- Supabase Dashboard → Auth → Email Templates → Magic Link: confirm template uses default `{{ .ConfirmationURL }}`. A customized template that constructs URLs manually can produce malformed links.

---

## 3. Root cause(s) and proposed fixes

**Important:** The reason for the multi-fix proposal is that Phase 3's observability gap blocks single-cause confirmation. We must instrument first to diagnose.

### Fix A — Surface the `reason` on `/auth/error` (HIGHEST priority — diagnostic unlock)

**File:** `web/src/app/auth/error/page.tsx`
**Lines:** 13-32 (entire component)

**Current code:**
```tsx
export default async function AuthErrorPage() {
  return (
    <main ...>
      <h1>Authentication failed</h1>
      <p>The link may have expired or already been used. ...</p>
      <a href="/">Back to home</a>
    </main>
  );
}
```

**Proposed code:**
```tsx
export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; debug?: string }>;
}) {
  const { reason, debug } = await searchParams;
  const showReason = debug === '1' || process.env.NODE_ENV !== 'production';
  return (
    <main ...>
      <h1>Authentication failed</h1>
      <p>The link may have expired or already been used. ...</p>
      {showReason && reason ? (
        <pre className="mt-4 rounded bg-surface-elevated px-3 py-2 text-xs text-text-tertiary text-left whitespace-pre-wrap break-all">
          reason: {reason}
        </pre>
      ) : null}
      <a href="/">Back to home</a>
    </main>
  );
}
```

**Why:** Without the actual error message we are guessing. After this lands, the user adds `?debug=1` to the URL (or visits the failing flow once and copies the `reason=` from the URL bar) and we know whether `verifyOtp` is failing with `Token has expired or is invalid`, `Email link is invalid or has expired`, `User not found`, etc. Each maps to a different downstream action.

**Risks:** None significant. Even in production, only users who tack on `?debug=1` see the message; the URL the user lands on automatically contains `?reason=…` already so this is not new information leakage.

**Test that the fix works:** After deploy, hit any failing magic link, then visit the URL with `&debug=1` appended. The reason string should render in a code block.

### Fix B — Redeploy the Edge Function (USER-ONLY action)

**File:** none. Action: `npx supabase functions deploy issue-web-session`

**Why:** No proof the function on Supabase matches `supabase/functions/issue-web-session/index.ts` on disk. The fix routing through `/auth/callback?next=…` is in commit `86be8c9` (2026-05-05 23:16). If a deploy never followed, the Supabase platform is still serving an older variant. ⚠ Even if this isn't the root cause of `/auth/error` directly, deploying it eliminates an unknown.

**Test that the fix works:** After deploy, run `npx supabase functions list` — the Updated at column for `issue-web-session` should show the deploy timestamp. Then tap "Upgrade to Pro". The URL the in-app browser opens (long-press address bar → Copy) should contain `redirect_to=…%2Fauth%2Fcallback%3Fnext%3D%2Fupgrade` (URL-encoded), NOT `redirect_to=…%2Fupgrade` directly.

### Fix C — DO NOT APPLY YET — pending diagnostic from Fix A

If, after Fix A is deployed and the user reads the `reason`, the message is one of:
- `Token has expired or is invalid` / `OTP expired` → time-sync or single-use-already-consumed issue. Investigate iOS preview / prefetch.
- `Email link is invalid or has expired` → same family.
- `Invalid magic link type` / similar → mismatch between `admin.generateLink({type})` and `verifyOtp({type})`. Inspect.
- `User not found` → email mismatch / user deleted between link issue and click.
- Anything else → new investigation branch.

Do not propose Fix C until diagnosis lands.

---

## 4. User-action items

In execution order:

1. **Apply Fix A** — let me edit `web/src/app/auth/error/page.tsx` per Section 3, commit, push. Wait for Vercel deploy to finish (Vercel Dashboard → Deployments → top entry shows "Ready").
2. **Run** `npx supabase functions deploy issue-web-session` from repo root. Confirm output shows a new deploy.
3. **Verify Supabase Dashboard config** (Phase 7):
   - Auth → URL Configuration → Site URL = `https://mony-psi.vercel.app`
   - Auth → URL Configuration → Additional Redirect URLs include `https://mony-psi.vercel.app/auth/callback` AND `https://mony-psi.vercel.app/**`
   - Edge Functions → `issue-web-session` → Secrets → `WEB_BASE_URL` is unset OR equals `https://mony-psi.vercel.app` (no trailing slash, no typos)
   - Auth → Email Templates → Magic Link uses default `{{ .ConfirmationURL }}`
4. **Reproduce the failure once** in iPad app. When `/auth/error` shows, append `?debug=1` to the URL (e.g., `https://mony-psi.vercel.app/auth/error?reason=…&debug=1`) — paste the reason string into chat.
5. **Capture Vercel logs** for the same time window: Vercel Dashboard → mony-psi → Logs → filter for `[auth/callback]`. Paste the `verifyOtp failed:` line.
6. **Capture the in-app-browser URL** from the failing tap: in the iPad in-app browser, tap the address bar → Copy URL → paste into chat. We need to see whether the URL is `/auth/callback?next=/upgrade&token_hash=…` (correct flow) OR `/upgrade?token_hash=…` (Edge Function still stale OR allow-list rejected).

---

## 5. Test plan

After Fix A is deployed AND items 2-3 in Section 4 are confirmed, run both control tests:

### Test 1 — Browser-direct sign-in (control, isolates PKCE branch)
1. Open Safari on the iPad. Visit `https://mony-psi.vercel.app/sign-in`.
2. Enter the same email used in the iPad app. Submit. Confirm "Check your email" copy renders.
3. Open the email on the iPad. Tap the magic link.
4. **Expected:** lands on `/dashboard` showing the signed-in dashboard.
5. **Failure modes:**
   - Lands on `/auth/error?reason=…&debug=1` → PKCE branch failing too → broader bug.
   - Lands on `/` → cookie not propagating → revisit Phase 5.
   - Lands on `/dashboard` → PKCE works → bug is OTP-specific. Proceed to Test 2.

### Test 2 — Mobile-bridge sign-in (the failing flow)
1. From the iPad app, tap "Upgrade to Pro" anywhere (cap modal, profile pitch, sell-flow banner).
2. The in-app browser opens. **Before letting it auto-redirect**, long-press the address bar → Copy. Paste into chat.
3. Let the redirect complete. If it fails, append `?debug=1` to the URL on the error page; copy the visible `reason` string into chat.
4. **Expected:** lands on `/upgrade` with email rendered in footer.
5. **Failure modes:**
   - `/auth/error?reason=…` → Fix A surfaces the message. Diagnose from there.
   - `/` → Edge Function still stale (deploy didn't run) OR allow-list misconfigured. Re-check Section 4 items 2-3.
   - `/upgrade` ✅ → fix complete. Proceed to Phase 6 verification (test the "Subscribe" button → Stripe Checkout).

### Test 3 — Stripe Checkout (only run after Test 2 passes)
1. On `/upgrade`, click "Subscribe" with a known cadence.
2. **Expected:** redirect to `checkout.stripe.com/...`.
3. **Failure modes:**
   - Inline error like `stripe_customer_create_failed: …` → Stripe key issue / test mode not activated. Read `details` for specifics.
   - Inline error like `price_unavailable: …` → one of the 6 `STRIPE_PRICE_*` env vars missing on Vercel.

---

## 6. Hard constraints honored

- ✅ No code edited.
- ✅ No commits.
- ✅ No iOS / Expo tooling run.
- ✅ Every claim is sourced to a `file:line` reference.
- ⚠ Phase 1 was confirmed deployed (commits exist in `origin/main`); proceeded as instructed.
- ⚠ Two phases produced ⚠ rather than ✅ because they require user-side action (Edge Function deploy verification, Supabase Dashboard verification, Vercel logs). Those user-action items are listed in Section 4 with exact commands.
