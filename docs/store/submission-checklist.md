# Pre-Submission Checklist

Walk through every section before submitting Mony to App Store Connect
or Play Console. Each unchecked item is a known rejection risk.

## 0. Lockfile + Dependencies

- [ ] `cat .npmrc` shows `legacy-peer-deps=false` (project-pinned)
- [ ] `npx tsc --noEmit` is clean
- [ ] `cd web && npx tsc --noEmit && cd ..` is clean
- [ ] `npx expo-doctor` is acceptable (the React 19.2 / RN 0.81.6 drift
      from Track C and the metro projectRoot warning are known)

## 0.5. CI / GitHub Actions

- [ ] Repository secrets configured in GitHub:
      EXPO_TOKEN, SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF
- [ ] Branch protection on `main`: require CI status checks to pass
- [ ] CI green on the most recent main commit (Actions tab shows
      green checks for the merge that includes Phase 9)
- [ ] At least one edge-deploy run has succeeded (verify by editing
      any supabase/functions/**/index.ts with a no-op comment + merging)

## 0.6. Posthog analytics

- [ ] Posthog project provisioned at https://eu.posthog.com (project
      name: Mony)
- [ ] EAS Secret `EXPO_PUBLIC_POSTHOG_API_KEY` set
- [ ] eas.json env `EXPO_PUBLIC_POSTHOG_HOST` populated for all 3 profiles
- [ ] Feature flag `show_for_you_tab` created with default = true
- [ ] First production build registers an `Application Opened` event
      on launch (verify in Posthog -> Activity within 5 minutes of app
      open)

## 1. Supabase Production Project

### Migrations
- [ ] All migrations from `supabase/migrations/` applied via
      `npm run db:push` against the production project
- [ ] `npm run gen:types` produces no diff
- [ ] `cd web && npm run gen:types && cd ..` produces no diff

### Dashboard checklist (see [docs/security/dashboard-checklist.md](../security/dashboard-checklist.md))
- [ ] hCaptcha enabled in Authentication → Bot and Abuse Protection
- [ ] Site key from hCaptcha enabled section pasted into eas.json
      `EXPO_PUBLIC_HCAPTCHA_SITE_KEY` for all 3 profiles
- [ ] Password minimum length set to 10
- [ ] Redirect URLs allowlist contains:
      `client://auth/callback`
      `https://mony-psi.vercel.app/auth/callback`
      (or the final production domain)
- [ ] Email rate limit raised to 30/hour (default 3 is too restrictive)

### Edge Functions deployed
- [ ] `supabase functions deploy create-checkout-session`
- [ ] `supabase functions deploy stripe-webhook`
- [ ] `supabase functions deploy send-push-notification`
- [ ] `supabase functions deploy issue-web-session`
- [ ] `supabase functions deploy validate-iap-receipt`

### Edge Function secrets
Project Settings → Edge Functions → Secrets:
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `APPLE_SHARED_SECRET`         (from ASC App-Specific Shared Secret)
- [ ] `APPLE_BUNDLE_ID = com.pictok.client`
- [ ] `GOOGLE_PLAY_PACKAGE_NAME = com.pictok.client`
- [ ] `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`  (full JSON from Google Cloud)
- [ ] `WEB_BASE_URL = https://mony-psi.vercel.app`  (or final domain)

### Stripe Dashboard
- [ ] Webhook endpoint registered: `https://<supabase-project>.supabase.co/functions/v1/stripe-webhook`
- [ ] Webhook signing secret matches the `STRIPE_WEBHOOK_SECRET` above
- [ ] Webhook events subscribed: `checkout.session.completed`,
      `checkout.session.expired`, `charge.refunded`
- [ ] Stripe Connect or Standard account fully configured for the
      legal entity that will receive funds

## 2. App Store Connect

- [ ] App listing created with bundle ID `com.pictok.client`
- [ ] Subscription product `mony_pro_monthly` created and approved
      (see [docs/store/iap-setup-checklist.md](iap-setup-checklist.md))
- [ ] App-Specific Shared Secret generated and copied into Supabase
      Edge Function secret
- [ ] App Privacy answers submitted (use [docs/store/apple-privacy-questions.md](apple-privacy-questions.md))
- [ ] Privacy Policy URL points to a permanent domain (NOT
      mony-psi.vercel.app — Apple expects permanence)
- [ ] Support URL configured
- [ ] Marketing URL (optional)
- [ ] Screenshots uploaded:
      - iPhone 6.7" (1290×2796) — 3-10 images
      - iPhone 6.5" (1242×2688) — 3-10 images
      - iPad 12.9" (2048×2732) — 3-10 images (supportsTablet: true)
- [ ] App preview videos (optional)
- [ ] App description (EN + FR)
- [ ] What's New (release notes) for v1.0.0
- [ ] Keywords (EN + FR)
- [ ] Promotional text
- [ ] App rating questionnaire completed
- [ ] EULA: linked to web companion `/legal/terms`
- [ ] App Review information: contact email, demo account credentials,
      notes explaining the Pro subscription (Apple needs to test IAP)

## 3. Google Play Console

- [ ] App listing created with package `com.pictok.client`
- [ ] Subscription `mony_pro_monthly` created and active
      (see [docs/store/iap-setup-checklist.md](iap-setup-checklist.md))
- [ ] Service account configured in Play Console with publisher API
      access; JSON key copied into Supabase Edge Function secret
- [ ] Data Safety form completed (use [docs/store/play-data-safety.md](play-data-safety.md))
- [ ] Content rating questionnaire completed
- [ ] Target audience set (13+ recommended for marketplace UGC)
- [ ] Ads declaration: contains no ads
- [ ] App access: provide test account credentials for Play's review
      team
- [ ] Privacy Policy URL points to a permanent domain
- [ ] Screenshots uploaded:
      - Phone (1080×1920 minimum) — 2-8 images
      - 7-inch tablet (1024×600 minimum) — 1-8 images (optional)
      - 10-inch tablet (1024×768 minimum) — 1-8 images
- [ ] Feature graphic (1024×500)
- [ ] High-res app icon (512×512)
- [ ] Short description (80 chars)
- [ ] Full description (4000 chars)
- [ ] Release notes for v1.0.0

## 4. Mobile App Build

- [ ] `eas build --profile production --platform ios`
- [ ] `eas build --profile production --platform android`
- [ ] Test build installed via TestFlight (iOS) and internal testing
      track (Android)
- [ ] On a clean install:
      - [ ] Register flow works (email confirmation + hCaptcha)
      - [ ] EULA acceptance flow tested
      - [ ] Onboarding flow tested (interest selection + notification
            opt-in modal)
      - [ ] Permission prompts fire with the EN copy from app.json
      - [ ] Sandbox IAP purchase tested for both platforms
      - [ ] Restore Purchases tested after reinstalling
      - [ ] Marketplace feed scrolls smoothly, FlashList no jank
      - [ ] For-You feed loads and shows mixed slices
      - [ ] Buy Now flow (Pro seller) completes end-to-end via Stripe
            sandbox
      - [ ] Contact flow (non-Pro seller) opens chat
      - [ ] Push notification arrives for a new message
      - [ ] Account deletion flow tested

## 5. Web Companion (mony-psi.vercel.app or final domain)

- [ ] Admin dashboard accessible at `/admin/reports` to a seeded
      is_admin=true user
- [ ] `/legal/terms` includes the Objectionable Content & Moderation
      section
- [ ] `/legal/privacy` is up to date and references all third parties
      listed in [docs/store/play-data-safety.md](play-data-safety.md)
- [ ] `/upgrade` Stripe subscription flow tested end-to-end
- [ ] Auth callback `/auth/callback` works for magic-link login

## 6. Final

- [ ] CHANGELOG.md updated with v1.0.0 entry
- [ ] git tag v1.0.0
- [ ] git push --tags
- [ ] git push origin main
- [ ] `eas submit --profile production --platform ios`
- [ ] `eas submit --profile production --platform android`

## 6.5. EAS Update (post-launch OTA)

- [ ] First production OTA published as a smoke test:
      `eas update --branch production --message "v1.0.0 smoke test"`
- [ ] Verified via TestFlight build that the update reached the device
      on next app launch
- [ ] Document the workflow with your team (link to
      [docs/observability/ota-update-workflow.md](../observability/ota-update-workflow.md))

## 7. Post-submission monitoring

- [ ] Apple review queue (typical 24-48 hours)
- [ ] Google review queue (typical 24-72 hours)
- [ ] Watch Supabase Dashboard → Logs for any 4xx/5xx surge
- [ ] Watch Stripe Dashboard for failed webhook deliveries
- [ ] Watch Sentry → mony-mobile + mony-edge for new issues
- [ ] Watch Posthog → Activity for event flow

See [docs/runbooks/](../runbooks/) for full operational procedures:
- [deploy.md](../runbooks/deploy.md) — shipping a release
- [rollback.md](../runbooks/rollback.md) — reverting a bad release
- [incident-response.md](../runbooks/incident-response.md) — when
  production is broken
- [key-rotation.md](../runbooks/key-rotation.md) — rotating
  credentials safely
- [backup-restore.md](../runbooks/backup-restore.md) — Supabase
  snapshot recovery

If rejected: read the rejection notice carefully; rejections in
Phase 8 areas (privacy manifest, IAP, EULA, content moderation,
permissions) are the highest-probability vectors; the docs in
[docs/store/](.) show the declared answers and can be re-submitted
with appeal text.
