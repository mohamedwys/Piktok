# Runbook: Deploy a new release

Use this runbook when shipping a new version of Mony (mobile + edge
functions + optionally web companion + migrations).

Estimated time: 1-2 hours including App Store / Play Store review wait
(which can be 1-7 days but the active work is hours).

## Pre-flight (10 min)

- [ ] `git status` shows clean working tree
- [ ] You're on `main` with no unpushed commits
- [ ] `npx tsc --noEmit` clean
- [ ] `cd web && npx tsc --noEmit && cd ..` clean
- [ ] `npx expo-doctor` 17/17 (or known-acceptable drift)
- [ ] Open [docs/store/submission-checklist.md](../store/submission-checklist.md)
      — walk through every section. Anything unchecked? Stop and fix.
- [ ] Bump the version in app.json: `expo.version` from `1.x.y` to the
      new value. EAS auto-increments build/version code.
- [ ] Add an entry under `## [1.x.y]` in CHANGELOG.md with the new
      version + date + list of changes.
- [ ] Commit version bump + CHANGELOG: `git commit -am "chore(release):
      v1.x.y"`.

## Tag the release (2 min)

    git tag v1.x.y
    git push origin main --tags

CI runs automatically (Phase 9 Track E). Wait for the green check at:
https://github.com/<user>/<repo>/actions

## Database migrations (if any new ones in supabase/migrations/)

- [ ] Read every new migration file. Look for DROP, DELETE, ALTER COLUMN.
- [ ] If anything is destructive, take a manual snapshot first:
      Supabase Dashboard → Settings → Database → Backups → Create
      manual backup.
- [ ] Apply: `npx supabase link --project-ref mkofisdyebcnmhgkpqws`
      followed by `npm run db:push`.
- [ ] Regenerate types: `npm run gen:types`. Confirm
      `git diff src/types/supabase.ts` matches expectations.

## Edge function deploys

Two options:

### Auto via GitHub Actions (preferred)

Pushing main with changes under `supabase/functions/**` auto-triggers
the edge-deploy workflow. Wait for the green check at the Actions tab.

### Manual (if CI fails OR you need a redeploy without code change)

    npx supabase link --project-ref mkofisdyebcnmhgkpqws
    npx supabase functions deploy create-checkout-session
    npx supabase functions deploy issue-web-session
    npx supabase functions deploy send-push-notification
    npx supabase functions deploy stripe-webhook
    npx supabase functions deploy validate-iap-receipt

## EAS Build (mobile)

- [ ] Lockfile pinned via .npmrc (Phase 9 Track C) — `cat .npmrc` shows
      `legacy-peer-deps=false`. If missing, restore from git: `git
      checkout main -- .npmrc web/.npmrc`.
- [ ] Trigger production builds:

          eas build --profile production --platform ios
          eas build --profile production --platform android

      Each takes ~20 min. Run in parallel.

- [ ] Once builds complete, install the iOS build via TestFlight on
      your own device. Smoke-test:
      - Register a fresh account
      - Create one listing
      - Send one message
      - (For Pro test) buy the IAP subscription in sandbox
- [ ] Same smoke test for Android via the internal-testing track.

## App Store + Play Store submission

- [ ] `eas submit --profile production --platform ios`
      Wait for upload to complete (~5 min). Open App Store Connect,
      attach the build to the v1.x.y version, fill in "What's New"
      (from CHANGELOG), submit for review.
- [ ] `eas submit --profile production --platform android`
      Same flow on Play Console.
- [ ] Apple review queue: 24-48h typical, up to 7 days.
- [ ] Google review queue: 24-72h typical.

## Web companion (if there are changes under web/)

Vercel auto-deploys on push to main. Verify at:
https://vercel.com/<your-team>/<your-project>/deployments

No manual action needed unless Vercel reports a failure — then
consult the Vercel build log + redeploy from the dashboard.

## After review approval

- [ ] In App Store Connect, click "Release this version" if you
      configured manual release (default is "Automatically release").
- [ ] In Play Console, advance the release from "Available to release"
      to "In production".
- [ ] Watch Sentry → mony-mobile for the first hour. Spike in error
      rate? Consult [rollback.md](rollback.md).
- [ ] Watch Posthog → Activity. First `Application Opened` events
      from real users should appear within minutes of store
      availability.

## OTA hot-fix (alternative to full release)

If the bug is JS-only, ship via OTA instead of a full build cycle.
See [docs/observability/ota-update-workflow.md](../observability/ota-update-workflow.md).
5-minute deploy cycle vs 7-day review.

## Post-deploy

- [ ] Update the live status (Phase 9 Track H may add a status page —
      until then, your incident channel works).
- [ ] Close any GitHub issues fixed by v1.x.y.
- [ ] Move on. Don't poll Sentry for the rest of the day — emails will
      fire if a new issue arises.
