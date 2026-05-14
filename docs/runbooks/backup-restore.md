# Runbook: Backup and restore

## What Supabase backs up automatically

Free + Pro tiers: daily snapshots of the database, retained for 7-14
days depending on plan.

Pro tier: Point-in-time recovery (PITR) — granular recovery to any
second within retention.

Confirm your project's retention: Dashboard → Settings → Database →
Backups.

## What is NOT backed up by Supabase

- Storage bucket files (avatars, product-media). Mony users upload
  images and videos here. **No automatic backup.**
- Edge Function code (source-of-truth is git).
- Project secrets (you must back these up manually — see below).

## Critical: back up project secrets out-of-band

Once a quarter, export your Supabase Dashboard secrets to a
password manager:

- Supabase Dashboard → Project Settings → Edge Functions → Secrets
- For each secret, click reveal, copy, paste into your password
  manager under an item named "Mony Supabase secrets — YYYY-Q1".

Same for ASC App-Specific Shared Secret, Apple bundle ID, Google
service account JSON, Stripe API keys (use a password manager that
supports long text fields).

Losing these secrets in a Supabase account compromise OR a region
outage means you'd have to regenerate every credential AND ship a
client hotfix.

## Restoring a database backup

### Scenario 1: minor corruption — restore to a NEW project

Best practice for partial recovery (e.g., one table truncated):

1. Dashboard → Settings → Database → Backups → choose the most
   recent good backup → "Restore to new project".
2. Wait for the restore to complete (~10-30 min for a small db).
3. From the new project, SELECT the rows you need + INSERT them
   into the live project.
4. Delete the throwaway new project (Free tier counter-aware).

### Scenario 2: full database loss — restore in place

Only do this if data loss is widespread and you accept downtime.

1. Dashboard → Settings → Database → Backups → choose backup →
   "Restore to this project".
2. ALL EXISTING DATA AFTER THE BACKUP TIMESTAMP IS LOST.
3. Restore takes 15-60 min. Project is read-only during restore.
4. After restore: confirm row counts on critical tables. Smoke-test
   login + listing creation.

### Scenario 3: point-in-time recovery (Pro tier only)

1. Dashboard → Settings → Database → Point in Time Recovery.
2. Pick the exact timestamp before the bad change.
3. Restore to a new project (recommended for forensic recovery)
   OR in-place.

## Restoring storage bucket files

Supabase Storage has no automatic restore mechanism. If you lose
storage data:

- Avatars: cosmetic only — users will re-upload.
- Product media: significant — listings render broken thumbnails.

Mitigation strategies (NOT a restore, but reduces blast radius):

- For high-stakes deployments, do a manual S3-sync of the
  storage buckets to your own S3 bucket once a week. Use the
  Supabase CLI's storage download command:

      npx supabase storage cp ss://product-media ./local-mirror/product-media --recursive

- Free tier: you'd have to use the Dashboard's bulk download
  (no CLI cp until Storage v2 ships). For v1, accept the risk
  and document it in your privacy policy.

## After any restore

- Note the restore in CHANGELOG.md under [Unreleased] → ### Fixed.
- Open a postmortem document (template in incident-response.md).
- Verify Sentry is still receiving events from the app (the auth
  listener may need fresh login if user sessions were lost).
- Notify users via in-app banner or email if data was meaningfully
  affected.
