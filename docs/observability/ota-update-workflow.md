# EAS Update (OTA) Workflow

Mony uses EAS Update to ship JS-only bug fixes without an App Store /
Play Store review cycle. Native dependency changes still require a
full EAS build.

## When OTA is appropriate

YES (ship via OTA):
  - Typo / copy fix in EN or FR locales
  - Bug in a React Native component
  - New feature flag default (when feature flags ship in Track F)
  - Server-side schema change that requires a small client-side
    adapter
  - Performance fix (React.memo, useCallback)
  - Style / token change

NO (require a full build):
  - Adding a new expo-* module (e.g., expo-localization v2)
  - Bumping React Native or Expo SDK
  - Changing the iOS Privacy Manifest or Info.plist
  - Adding a new Capability (push notifications, in-app purchase)
  - Updating app.json plugins
  - Bumping app version in app.json

The fingerprint runtimeVersion policy prevents accidental NO-cases
from reaching users — if you publish an OTA with a native dep change,
the new runtimeVersion won't match existing builds and they won't
receive the update.

## Publishing an update

### Preview channel (TestFlight / internal testers)

  eas update --branch preview --message "fix: typo in onboarding"

### Production channel (live users)

  eas update --branch production --message "fix: chat scroll-to-bottom"

The CLI:
  1. Bundles the JS.
  2. Uploads to Expo's CDN.
  3. Publishes to the named branch.
  4. Existing builds on the matching channel auto-download on next
     app launch.

## Rollback

### Option A — Republish previous

Find the previous successful update id:
  eas update:list --branch production

Republish:
  eas update:republish --branch production --group <previous-group-id> \
    --message "rollback to <date>"

All existing builds get the rolled-back JS on next launch.

### Option B — Force rollback to the embedded JS

If even the previous OTA was bad and you need to fall back to the
JS that shipped with the original native build:

  eas update:rollback --branch production

This publishes a no-op update that tells builds to use their embedded
JS bundle.

## Verifying an update reached users

  eas update:list --branch production
  # Shows update id, runtimeVersion, message, created_at, who created

For per-build adoption rates: open https://expo.dev → your project →
Updates → branch details. Adoption chart shows % of builds running
each update.

## Sentry integration

OTA updates inherit the build's Sentry release tag
(`mony@<version>+<buildNumber>`). Crashes after an OTA still tag to
the underlying build. To distinguish JS issues introduced by a
specific OTA from issues in the build itself, include the update id
in the OTA message:

  eas update --branch production --message "feat: faster feed (update-2025-01-15)"

Then cross-reference Sentry breadcrumbs with the EAS Updates dashboard.

Optional improvement (post-launch): tag the Sentry release with
`Updates.updateId` from expo-updates. See
https://docs.sentry.io/platforms/react-native/configuration/options/#dist

## Channel-to-branch mapping

| Channel       | Branch        | Audience              |
|---------------|---------------|-----------------------|
| development   | development   | Local dev devices     |
| preview       | preview       | TestFlight + internal |
| production    | production    | All store users       |

## Common gotchas

- **`eas update` without `--branch`**: defaults to your current git
  branch name. ALWAYS pass `--branch` explicitly.
- **runtimeVersion mismatch**: if you accidentally bump a native dep,
  the new fingerprint kicks in and only NEW builds get the update.
  Existing builds keep their last compatible OTA.
- **EAS account scope**: `eas update` runs against the project linked
  via app.json `extra.eas.projectId`. Verify with `eas whoami` and
  `cat app.json | grep projectId`.
