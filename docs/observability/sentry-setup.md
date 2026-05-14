# Sentry Setup — Manual Steps

Phase 9 Track A wires the Sentry client code. The DSN, projects, and
alerts are configured manually in Sentry's web dashboard.

Last updated: pending Phase 9 ship.

## 1. Sentry organization

- Create or use your existing Sentry organization at https://sentry.io.
  Free tier covers 5,000 errors/month + 10,000 performance events.
  Sufficient for v1 launch.

## 2. Create two projects

Mony uses two Sentry projects to track mobile and edge function errors
separately — different SDKs, different release cadence.

### Project A — mony-mobile
- Platform: React Native
- Alert me on: every new issue, regression after release
- DSN: copy from project settings → SDK Keys

### Project B — mony-edge
- Platform: Node.js (closest match — Deno SDK isn't a Sentry preset)
- Alert me on: every new issue
- DSN: copy from project settings → SDK Keys

## 3. Generate auth token (for source-map upload)

- Sentry → User Settings → Auth Tokens → Create New Token
- Scopes required: project:releases, project:read, project:write
- Copy the token (shown only once).

## 4. Populate EAS secrets (mobile)

  eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value <mobile-dsn>      --scope project
  eas secret:create --name SENTRY_AUTH_TOKEN     --value <auth-token>      --scope project

Once stored, the placeholder strings in eas.json are replaced by EAS
Build at build time. The deployed app contains the DSN; the auth token
is build-time only (not shipped).

## 5. Populate Supabase secrets (Edge Functions)

Supabase Dashboard → Edge Functions → Secrets:

  SENTRY_DSN              <edge-dsn>
  SUPABASE_ENVIRONMENT    production
  SENTRY_RELEASE          edge@<your-versioning>

Update SENTRY_RELEASE on every edge function deploy. Suggested:
  "edge@" + first 7 chars of the deploy git SHA.

## 6. Update app.json plugin organization/project

Edit app.json — find the @sentry/react-native/expo plugin entry. Replace:

  "organization": "PLACEHOLDER_SENTRY_ORG"
  "project": "PLACEHOLDER_SENTRY_PROJECT_MOBILE"

with your actual values (visible in Sentry → Organization Settings →
General + project's URL slug).

## 7. Configure alerts

Sentry → Alerts → Create Alert Rule.

Suggested rules for mony-mobile:
  - When: A new issue is created
    And: Issue's level is error or fatal
    Send to: your email + (optional) Slack #incidents channel
  - When: An issue is unresolved for 1 day
    Send to: same destinations

Suggested rules for mony-edge:
  - When: A new issue is created
    Send to: your email
  - When: Issue frequency > 10 events / minute
    Send to: page (PagerDuty integration if you have one)

## 8. Verify

After mobile deploy:
  - Open the app on a device.
  - Trigger a known error (e.g., disconnect network mid-checkout).
  - Sentry → mony-mobile → Issues should show the error within
    ~30 seconds.

After Edge Function deploy:
  - Call any function with malformed input that triggers the catch
    block (e.g., send-push-notification with no conversation_id).
  - Sentry → mony-edge → Issues should show the error.

## 9. PII redaction

Phase 9 Track A's beforeSend hook redacts access_token, refresh_token,
and apikey from URLs. Verify in Sentry → Project Settings → Data
Scrubbing that the default scrubbers ("Scrub IP addresses", "Use
default scrubbers") are enabled. Add custom scrubbers for any other
PII your team identifies.
