# Runbook: Rotate a credential

Rotate keys quarterly (best practice) OR immediately if you suspect
compromise (mandatory).

## Order matters

When rotating any key that's used by both the client AND the server:
1. Add the NEW key to all consumers.
2. Wait until all consumers have the new key (release rolled out,
   all clients updated).
3. Revoke the OLD key.

Reverse the order and you'll break production for users still on the
old build.

## Stripe — secret key

1. Stripe Dashboard → Developers → API Keys.
2. Click "Roll" next to the live secret key. A new key is generated;
   the old key remains active for 24 hours by default.
3. Update the Supabase secret:
   - Dashboard → Project Settings → Edge Functions → Secrets →
     STRIPE_SECRET_KEY → edit → paste new key.
4. Trigger a redeploy of all 5 edge functions (the secret is read at
   function cold-start):

       npx supabase functions deploy create-checkout-session
       (... etc for all 5 functions)

5. Test: create a fresh checkout session in production. Verify the
   order row is created.
6. After verification: in Stripe Dashboard, revoke the old key
   manually (don't wait for the 24h auto-expiry — close the window).

## Stripe — webhook signing secret

1. Stripe Dashboard → Developers → Webhooks → your endpoint.
2. Click "Roll signing secret".
3. Update Supabase secret STRIPE_WEBHOOK_SECRET.
4. Redeploy stripe-webhook function.
5. In Stripe Dashboard, send a test webhook → confirm it succeeds
   against the new secret.

## Sentry — auth token

Source-map upload only. No runtime impact.

1. Sentry Dashboard → User Settings → Auth Tokens.
2. Click "Create New Token". Scope: project:releases, project:read,
   project:write, org:read. Name: `mony-eas-build-YYYY-MM`.
3. Update EAS secret:

       eas secret:create --name SENTRY_AUTH_TOKEN --value "<new>" --scope project --type string --force

4. Revoke the old token in Sentry.

## Apple Shared Secret

1. ASC → My Apps → Mony → App Information → App-Specific Shared
   Secret. Click "Regenerate".
2. Copy the new value.
3. Update Supabase secret APPLE_SHARED_SECRET.
4. Redeploy validate-iap-receipt function.
5. Test: trigger a sandbox IAP purchase + verify the receipt
   validates.

## Google Play service account

1. Google Cloud Console → IAM → Service Accounts → your service
   account → Keys → Add Key → Create new key (JSON). Download it.
2. Update Supabase secret GOOGLE_PLAY_SERVICE_ACCOUNT_JSON. Paste
   the entire JSON content.
3. Redeploy validate-iap-receipt function.
4. Test: trigger a sandbox Android subscription purchase.
5. Google Cloud Console → delete the OLD key (don't leave it active).

## Supabase service role key

1. Supabase Dashboard → Project Settings → API → Service Role Key.
   Click "Reset" — generates a new key, old key expires immediately.
2. Update any external service that uses the old service role key
   (e.g., your CI workflows if they reference it — they shouldn't;
   Track E uses SUPABASE_ACCESS_TOKEN which is a separate credential).
3. Service role is server-side only; redeploy edge functions to
   pick up the new key from the environment.

Note: edge functions read SUPABASE_SERVICE_ROLE_KEY automatically
from the Supabase platform env (you don't manually set it in
Secrets — Supabase injects it). The "Reset" action takes effect
on next cold-start automatically.

## Supabase anon key

1. Supabase Dashboard → Project Settings → API → Anon Key. Click
   "Reset".
2. Update EAS Build env:

       eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<new>" --scope project --type string --force

   Plus update eas.json placeholder for visibility.
3. Trigger a new EAS Build. Existing builds keep working with the
   old anon key until the old key is revoked (the Reset disables
   it immediately, so existing builds break — coordinate with a
   hotfix release).

This rotation is HIGH IMPACT. Plan a maintenance window or skip
unless the key is confirmed compromised.

## Supabase access token (CI/CD)

1. Supabase Dashboard → Account → Access Tokens → Revoke old.
2. Generate new. Update GitHub repo secret SUPABASE_ACCESS_TOKEN.
3. Next push to main triggers edge-deploy with the new token.
   Confirm CI green.

## hCaptcha site key

Usually doesn't rotate, but if compromised:

1. Supabase Dashboard → Auth → Bot and Abuse Protection → regenerate
   site key.
2. Update EAS secret EXPO_PUBLIC_HCAPTCHA_SITE_KEY.
3. Hotfix release (existing builds use the old key which now fails).

## Posthog API key

1. Posthog Dashboard → Project Settings → Project API Key →
   Regenerate.
2. Update EAS secret EXPO_PUBLIC_POSTHOG_API_KEY.
3. Hotfix release.

Posthog project API keys are write-only; rotating mainly affects
client telemetry, not user data security.

## Expo access token

1. expo.dev → Personal access tokens → Revoke old.
2. Generate new. Update GitHub repo secret EXPO_TOKEN.
3. Next CI run uses the new token.
