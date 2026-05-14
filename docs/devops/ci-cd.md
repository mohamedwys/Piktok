# CI/CD

Two GitHub Actions workflows handle continuous integration and edge-
function deployment for Mony.

## ci.yml — runs on every PR and main push

- Mobile job: `npm ci` + `npx tsc --noEmit` + `npx expo-doctor`
- Web job:    `npm ci` + `npx tsc --noEmit` (from web/)

Both jobs run in parallel. Both must pass before a PR can merge.

Configure branch protection rules at
https://github.com/mohamedwys/Piktok/settings/branches:

  - Branch: `main`
  - Require status checks to pass before merging: YES
  - Required checks: `Mobile typecheck + expo-doctor`, `Web typecheck`
  - Require branches to be up to date before merging: YES (recommended)
  - Require pull request reviews before merging: optional but
    recommended (1 approval minimum)

## edge-deploy.yml — runs on push to main when supabase/functions/** changes

Auto-deploys all 5 edge functions to the production Supabase project
(mkofisdyebcnmhgkpqws). Each function is a separate deploy step so the
CI log shows which one failed if any break.

### When edge-deploy runs

- Push to main that includes any change under `supabase/functions/`
- Push to main that modifies the workflow file itself

### When edge-deploy does NOT run

- PR opened or updated (only mobile + web typecheck run on PRs).
  Edge function changes can't be auto-deployed before merging because
  Supabase doesn't support per-PR ephemeral function environments.
- Push to any non-main branch
- Changes outside `supabase/functions/`

### Manual deploy

When you need to redeploy a function without a code change (e.g.,
after rotating a secret), use the CLI from your machine:

  npx supabase link --project-ref mkofisdyebcnmhgkpqws
  npx supabase functions deploy <function-name>

Or trigger the workflow manually via the Actions tab -> Deploy Edge
Functions -> Run workflow. (Requires adding a `workflow_dispatch:`
trigger to the workflow — see Track G runbook for the addition.)

## Required secrets (in repo Settings -> Secrets and variables -> Actions)

| Name | Where it comes from | Used by |
|------|---------------------|---------|
| EXPO_TOKEN | expo.dev -> Personal access tokens | ci.yml (mobile job) |
| SUPABASE_ACCESS_TOKEN | supabase.com -> Account tokens | edge-deploy.yml |
| SUPABASE_PROJECT_REF | hardcoded: mkofisdyebcnmhgkpqws | edge-deploy.yml |

All three are project-level secrets. Rotate annually OR after any team
member with access leaves.

## What CI does NOT do

- Run unit / integration tests (no test suite in v1)
- Build the mobile app (EAS Build is manual)
- Publish an EAS Update OTA (manual)
- Apply database migrations (manual via `npm run db:push` on the
  release manager's machine — preserves human oversight on schema
  changes)
- Deploy the web companion (Vercel handles this on its own push hook
  to main)

## Future improvements (post-launch)

- Add a `release.yml` workflow triggered by `v*` git tags -> runs
  `eas build --profile production --non-interactive`
- Add `eas update` step on main merge for JS-only changes (gated by
  a label or commit-message convention like `[ota-safe]`)
- Per-function deploy filtering via `git diff` so edge-deploy only
  rebuilds the function that actually changed
- Pre-commit hooks (husky / lefthook) for typecheck on commit, so CI
  becomes an enforcement layer rather than the first signal
