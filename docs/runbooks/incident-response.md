# Runbook: Production incident response

Use when something is broken in production and users are affected.

## Triage (first 5 minutes)

1. **Acknowledge.** Reply in your incident channel: "Investigating.
   Will update in 15 min."
2. **Severity.** Pick SEV1-4 from [README.md](README.md).
3. **Sentry check.**
   - mony-mobile → Issues → filter "Last 24h". New issues at the top.
     Click into the top issue. Read the stack trace, the breadcrumbs,
     the user count.
   - mony-edge → same.
4. **Posthog check.**
   - Activity → filter "Last 1h". Are events still flowing? A sudden
     drop in `Application Opened` events suggests the app can't even
     boot.
5. **Status pages of third parties:**
   - https://status.supabase.com
   - https://status.stripe.com
   - https://www.apple-cloudkit.com/system-status (covers Apple IAP
     sandbox + production)
   - https://status.cloud.google.com (Play Billing depends on)
   - https://status.posthog.com
   - https://status.sentry.io
   If a third party is down: nothing for you to fix. Update incident
   channel with the third-party status URL, wait for their fix.

## Common incident scenarios

### "Users can't sign in"

- Sentry → search for `auth/signIn` or `EmailNotConfirmedError`.
- Supabase Dashboard → Authentication → Logs. Look for `signup` /
  `signin` events. Are they reaching Supabase?
- Auth rate limiting: Supabase → Auth → Logs. If you see "rate limit
  exceeded" 429s, the project's Auth rate limit may need raising in
  Settings → Auth → Rate Limits.

### "Payments are broken"

- Sentry → mony-edge → filter `create-checkout-session` OR
  `stripe-webhook`.
- Stripe Dashboard → Developers → Webhooks. Recent deliveries
  succeeded? If failures: read the Stripe error, redeploy the
  webhook function if needed.
- Stripe Dashboard → Logs. Are checkout sessions being created at
  all? If yes, where do they fail (after card auth? at fulfillment?).

### "Push notifications stopped working"

- Sentry → mony-edge → filter `send-push-notification`.
- Supabase Dashboard → Edge Functions → Logs for `send-push-notification`.
- Expo Push Service status: https://status.expo.dev.
- Check the push_tokens table: any tokens marked stale? Recently
  inserted?

### "App is crashing on launch"

- Sentry → mony-mobile → filter "Last 1h", sort by event count.
  The top issue is your culprit.
- Read the stack trace — pinpoint the failing component.
- Did a recent deploy go out? Check Vercel + App Store + EAS Update
  timelines. The crash likely correlates with a deploy.
- Decision: full release rollback (see [rollback.md](rollback.md))
  OR OTA hotfix if JS-only.

### "Database is slow / queries timing out"

- Supabase Dashboard → Database → Query Performance. Look at top
  slow queries.
- Check connection pool: Settings → Database → Connection Pooler
  Stats. If saturated, the issue is too many open connections — look
  for client-side code holding queries open.
- Long-running migration in flight? Settings → Database → Statement
  Timeout. Or:

      npx supabase link --project-ref mkofisdyebcnmhgkpqws
      psql "$DATABASE_URL" -c "SELECT pid, query FROM pg_stat_activity WHERE state = 'active'"

  Kill a runaway query: `SELECT pg_cancel_backend(<pid>)`.

### "Build pipeline is broken"

- GitHub Actions → look at the failed run's log.
- Common: npm ci fails. Check if the lockfile drifted from .npmrc
  expectations.
- Common: EAS Build fails. Check the EAS build log at expo.dev →
  your project → Builds.

## Communication template

Post in your incident channel at these milestones:

- **Acknowledged**: "Investigating <issue>. SEV<N>. Will update at <time+15min>."
- **Identified**: "Root cause: <one sentence>. Working on fix."
- **Mitigated**: "Workaround in place. Full fix in progress."
- **Resolved**: "Fixed. Cause: <one sentence>. Postmortem to follow."

## Postmortem (within 48h of resolution)

- Date of incident, severity, duration.
- Root cause (1 paragraph).
- Timeline (5-10 bullets, timestamps).
- What went well.
- What went poorly.
- Action items: bug fixes, runbook updates, monitoring gaps to close.

Save postmortems to `docs/postmortems/YYYY-MM-DD-<short-name>.md`.
