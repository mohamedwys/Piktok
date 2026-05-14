# Posthog Setup

Mony uses Posthog (EU Cloud) for analytics and feature flags. The
client is wired in mobile-only for v1; the web companion gets its own
Posthog setup post-launch.

## Dashboard

- URL: https://eu.posthog.com  (US: https://us.posthog.com)
- Project: Mony
- Region: EU (matches Sentry; GDPR consistency)

## Required Secrets

| Name | Where set | Used by |
|------|-----------|---------|
| EXPO_PUBLIC_POSTHOG_API_KEY | EAS Secrets (project scope) | mobile bundle |
| EXPO_PUBLIC_POSTHOG_HOST    | eas.json env (placeholder per profile) | mobile bundle |

Project API keys are write-only; they can be embedded in the client.
Treat as a secret only for clean rotation hygiene.

## Events instrumented in v1

| Event | When fires | Properties |
|-------|-----------|------------|
| register_completed | After supabase.auth.signUp resolves | confirmed: boolean |
| onboarding_completed | After set_my_interests RPC | interest_count: number |
| listing_created | After createProduct success | has_media: boolean |
| message_sent | After sendMessage onSuccess | is_offer: boolean |
| checkout_started | When useCreateCheckoutSession fires | product_id |
| subscription_started | After IAP validates OR Stripe upgrade opens | provider |
| product_viewed | When ProductDetailSheet opens | product_id |
| pro_upgrade_cta_tapped | When useUpgradeFlow is invoked | (none) |

## Setting up funnels (post-launch dashboard work)

Recommended funnels:

1. **Acquisition**: register_completed -> onboarding_completed ->
   listing_created OR message_sent (any meaningful first action)
2. **Pro conversion**: pro_upgrade_cta_tapped -> subscription_started
3. **Marketplace activation**: product_viewed -> checkout_started ->
   (server-side: order paid)

Posthog dashboard -> Insights -> New insight -> Funnels.

## Feature flags

v1 ships ONE flag as a wiring demonstration:

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| show_for_you_tab | Boolean | true | Kill switch: hide the For-You feed tab if the algorithmic feed is broken |

### Creating the flag

1. Posthog -> Feature Flags -> New feature flag
2. Key: `show_for_you_tab`
3. Type: Boolean
4. Default value: `true`
5. Rollout: 100% true
6. Save.

### Using the flag at runtime

The mobile client reads the flag at mount via
`getFeatureFlag('show_for_you_tab', true)`. If Posthog is unreachable
OR the flag is loading, the default `true` is used — so Posthog outages
do NOT take down the feature.

### Killing the flag (emergency)

1. Posthog -> Feature Flags -> show_for_you_tab -> Edit
2. Set rollout to 0% true (or delete the rollout condition entirely)
3. Save.
4. Existing app sessions continue showing the tab; new app launches and
   foreground events pick up the new value (<= 60 seconds).

## PII redaction

- `disableGeoip: true` is set in initPosthog. Posthog will NOT auto-
  record user IP addresses. The user_id (set via identify) is the
  canonical user reference.
- No event properties contain PII beyond the user's auth-bound email
  (set on identify; redact at the Posthog project level if needed via
  Project Settings -> Data Management -> Person Property Filters).

## When to add a new event

Threshold: an event is worth instrumenting if you've been asked the
same business question three times. Avoid instrumenting "every screen"
noise — it inflates the 1M-events-per-month free tier and produces
shallow funnels.

## When to add a new feature flag

Use flags for:
- Kill switches on risky new features (rollout safety net)
- Gradual percentage rollouts (10% -> 25% -> 50% -> 100%)
- Per-environment overrides (dev: enabled, prod: disabled)

Do NOT use flags for:
- Long-lived configuration values (use a config table in Supabase
  instead)
- Per-user feature gates (use sellers.is_admin / is_pro etc.)

## Sentry + Posthog: how they differ

| Sentry | Posthog |
|--------|---------|
| Errors and crashes | User behavior |
| "Why is the app broken?" | "How are users using the app?" |
| One event per error | Many events per user session |
| Source-mapped stack traces | Aggregate funnels and cohorts |

Both wire to the same user ID (from supabase.auth) so a user's Sentry
error can be cross-referenced with their Posthog session.
