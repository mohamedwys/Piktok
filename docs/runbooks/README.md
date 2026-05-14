# Runbooks

When something needs doing in production — shipping, rolling back,
responding to an incident, rotating a key — open the matching runbook
and follow it line by line.

## Index

| Scenario | Runbook | Estimated time |
|----------|---------|----------------|
| Shipping v1.x.y to App Store + Play Store + edge functions + web | [deploy.md](deploy.md) | 1-2 hours |
| Reverting a bad mobile release | [rollback.md](rollback.md) | 5-30 min |
| App is broken / users reporting errors / Sentry blowing up | [incident-response.md](incident-response.md) | varies |
| Rotating Stripe / Apple / Google / Supabase / Sentry / Posthog keys | [key-rotation.md](key-rotation.md) | 15-30 min per credential |
| Restoring database from a snapshot | [backup-restore.md](backup-restore.md) | 15-60 min |

## Severity scale (use in incident communications)

| Severity | Definition | Response |
|----------|------------|----------|
| SEV1 | All users affected. App unusable OR data loss in progress | Drop everything. Status page update within 15 min. |
| SEV2 | Major feature broken for many users | Investigate within 1 hour. Status page update within 30 min. |
| SEV3 | Minor feature broken OR small subset of users affected | Investigate within 4 hours. |
| SEV4 | Cosmetic OR easily worked around | Schedule a fix in the next sprint. |

## Before you start any runbook

- Confirm the issue is real. Check Sentry → mony-mobile + mony-edge
  issues. Check Posthog → Activity for user-reported behavior.
- Acknowledge the incident if SEV1/SEV2. Tell your incident channel
  "I'm on it — runbook XYZ".
- Open a new terminal in C:\Users\MwL\Desktop\hubb so you have a
  fresh shell history per incident.
