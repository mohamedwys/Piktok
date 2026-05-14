# Changelog

All notable changes to Mony will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- EAS Update (OTA) configured with fingerprint runtimeVersion policy.
  JS-only fixes can now ship via `eas update --branch production`
  without an App Store review cycle. See
  [docs/observability/ota-update-workflow.md](docs/observability/ota-update-workflow.md).
- GitHub Actions CI: every PR runs mobile + web typechecks +
  expo-doctor. Every main push auto-deploys edge functions to the
  production Supabase project. See
  [docs/devops/ci-cd.md](docs/devops/ci-cd.md).

### Changed

- Pin npm resolution mode via project-level .npmrc files (mobile +
  web) so EAS Build no longer requires the manual lockfile
  regeneration step before each production build.

## [1.0.0] — pending submission

Initial production release. Eight phases of development consolidated
into v1.0.0 for App Store + Play Store submission.

### Added

- **Marketplace feed** — vertical-snap product feed with FlashList
  virtualization, video playback pooled to 3 active players, pull-to-
  refresh, image prefetch for next-up cards, selection haptic on snap
- **For-You algorithmic feed** — 40/30/20/10 mix of followed-seller
  listings, boosted Pro listings, trending in viewed categories, and
  serendipity slices
- **Hybrid purchase model** — Pro sellers may opt in per-listing to
  direct Buy Now (Stripe checkout, shipping + phone collected) or
  Contact-only chat
- **Pro subscription** — $19.99/month via Apple StoreKit (iOS), Google
  Play Billing (Android), or Stripe (web). Unlocks boost button,
  unlimited listings, sales analytics, and the Buy Now affordance
- **Seller boost** — Pro sellers may promote one listing for 7 days,
  surfaced as "À la une" in the feed
- **Messaging** — realtime in-app chat with optimistic message inserts,
  typing-state preview, and offer flow
- **Image and video upload** — listings support both, with per-user
  folder isolation and size/MIME enforcement
- **Location-based search** — adjustable radius, distance-sorted feed,
  keyset cursor pagination
- **User blocking and content reporting** — in-app report action + 24h
  moderation SLA + admin dashboard
- **Onboarding** — pick 3-5 interest categories after register,
  notification permission explainer with "ask after value" timing
- **Account deletion** — in-app via `delete_my_account` RPC + web
  companion path

### Security

- Supabase session tokens stored in expo-secure-store (sharded for the
  iOS 2KB limit) instead of AsyncStorage
- Fail-fast environment-variable validator at JS bundle parse time
- Per-user folder enforcement on product-media and avatar storage
  uploads, with size and MIME-type allow-lists
- Rate limiting on likes, bookmarks, comments, messages, conversations,
  and listing creation via BEFORE INSERT triggers
- Push notification recipient verification via conversation
  participant check
- Stripe checkout return_url whitelisted server-side
- hCaptcha on register (Phase 8 Track D)
- Column-level grants on `sellers` so anonymous reads return only
  public marketplace-card fields
- SECURITY DEFINER RPCs with `search_path = public, pg_catalog`
  hardening
- iOS privacy manifest (PrivacyInfo) declaring all collected data types
  and required-reason API usage

### Performance

- FlashList v2 on the marketplace feed (recycling cells, constant memory)
- MMKV for hot-path stores (i18n, filters, location, currency,
  exchange rates) — 30x faster than AsyncStorage
- VideoPlayer pool with 3 slots for the marketplace feed
- React Native New Architecture enabled
- Mutation retry with exponential backoff (3 attempts max), idempotency
  keys on messages and products
- Image prefetch for the next 8 feed items on data arrival
- Realtime payload merge into the TanStack Query cache (no full
  refetches on inbound events)

### Localization

- French and English UI strings
- Permission descriptions in English (Info.plist root level — FR
  localization via .lproj deferred)

### Known limitations

- Pro subscription IAP requires sandbox testing before App Store and
  Play Console submission. See [docs/store/iap-setup-checklist.md](docs/store/iap-setup-checklist.md).
- Content moderation is manual review only. Automated image and text
  safety scanning is a post-launch effort.
- Crash reporting (Sentry) and analytics are deferred to Phase 9.
- The mobile app uses a custom URL scheme (`client://`) rather than
  Universal Links / App Links — deep-link host validation provides
  interim protection.
