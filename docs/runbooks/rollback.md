# Runbook: Roll back a bad release

Use when v1.x.y is shipped, error rate spikes, and you need to revert.

Mobile, edge functions, and web have different rollback mechanisms.
Mobile is the slowest — there's no "undo a binary build" on the App
Store, only "publish a previous binary as the live version" OR ship a
hotfix.

## Decision tree — pick one strategy

| Issue scope | Strategy |
|-------------|----------|
| JS-only bug, build native code is fine | OTA rollback (5 min) |
| Edge function bug | Redeploy previous function (10 min) |
| Web companion bug | Vercel "Promote to production" of previous deploy (2 min) |
| Database migration corrupted data | [backup-restore.md](backup-restore.md) |
| Native crash bug | Apple expedited review (24h) OR Play emergency rollback (1 hour) |
| Critical security issue | All of the above + status page notification |

## Strategy 1 — OTA rollback (JS-only)

Find the last good update:

    eas update:list --branch production

Republish:

    eas update:republish --branch production --group <previous-group-id> --message "rollback v1.x.y"

All existing builds get the rolled-back JS on next app launch
(typically within 60 seconds of foreground).

## Strategy 2 — Edge function rollback

Edge functions don't have a "previous version" UI in Supabase. The
rollback path is git-based:

    git log --oneline supabase/functions/ -- name-of-function

Identify the last good commit hash. Then:

    git checkout <last-good-commit> -- supabase/functions/<function-name>
    git commit -m "fix(<function-name>): rollback to <hash>"
    git push origin main

The auto-deploy workflow redeploys the function from the rolled-back
code. Wait for the green check.

If the function is critical (e.g., stripe-webhook), use the manual
deploy path instead — faster than CI:

    git checkout <last-good-commit> -- supabase/functions/<function-name>
    npx supabase link --project-ref mkofisdyebcnmhgkpqws
    npx supabase functions deploy <function-name>

THEN commit and push so git history matches reality.

## Strategy 3 — Web companion rollback

Vercel keeps every deploy. Go to:
https://vercel.com/<team>/<project>/deployments

Find the last green deploy before the bad one. Click "..." menu →
"Promote to Production". Vercel switches the live alias to that
deploy in seconds. No build, no waiting.

## Strategy 4 — Native build rollback (App Store)

- Open App Store Connect → Mony → Distribution
- Find the previous approved version (1.x.y-1)
- Click "Make available" — that version becomes the active binary
  in the store. New downloads get the old binary.
- Existing installs are NOT downgraded. They keep the broken build
  until they update OR you ship a hotfix.

Hotfix path:

- Fix the bug locally
- Bump app.json version to 1.x.y+1
- Rebuild + submit for expedited review
  (App Store Connect → Resolution Center → Request Expedited Review;
   give a reason; Apple typically responds in 24h for legit incidents)

## Strategy 5 — Native build rollback (Play Store)

Play Console → Mony → Production → Releases.

Click the previous release → "Halt release". The previous version
becomes the active production binary for new installs. Existing
installs keep the broken version until they update.

Or ship a hotfix:

- Same hotfix flow as App Store (bump version, rebuild, submit).
  Google review is faster than Apple (typically 24-72h).
- For SEV1 incidents, contact Play support directly via the Help
  Center for emergency review.

## Communicating the rollback

- Update your incident channel: "Rolled back v1.x.y at HH:MM via
  strategy N. Verifying fix on production now."
- Status page (if you have one): mark the incident resolved.
- CHANGELOG: add an entry under [Unreleased] → ### Fixed describing
  the rollback. Don't edit the v1.x.y entry — keep the history.

## Post-rollback

- Open a follow-up GitHub issue with the bug details.
- Update relevant runbooks if the rollback was clunky.
- Schedule the hotfix or v1.x.y+1 within the same sprint.
