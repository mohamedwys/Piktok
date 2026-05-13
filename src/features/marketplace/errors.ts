/**
 * Typed error classes for the marketplace feature.
 *
 * Mirrors the prior-art pattern: a domain-specific Error subclass with an
 * explicit `Object.setPrototypeOf` call inside the constructor so
 * `instanceof` works correctly across the React Native bundle. Without the
 * prototype-fix, transpiled subclasses of built-in Error sometimes fail
 * `instanceof` checks under Hermes / older JS runtimes — the canonical
 * TypeScript escape hatch for that bug.
 *
 * Existing project precedent: `AuthRequiredError` in
 * services/products.ts and `StripeNotConfiguredError` in services/orders.ts
 * both follow the same shape — extend `Error`, set `name`, set the
 * prototype, optionally carry extra context fields.
 */

/**
 * Thrown by `createProduct` (services/sell.ts) when a non-Pro seller
 * attempts to publish a listing that would exceed `FREE_TIER_LISTING_CAP`.
 * UI catches this at the call site (newPost.tsx) and surfaces an
 * upgrade-prompt Alert rather than the generic "publish failed" path.
 *
 * Carries the cap value as a field so the i18n message can interpolate
 * `{{cap}}` without re-reading the constant at the UI layer.
 */
export class ListingCapReachedError extends Error {
  readonly cap: number;

  constructor(cap: number) {
    super(`Listing cap reached (${cap})`);
    this.name = 'ListingCapReachedError';
    this.cap = cap;
    // V8 / Hermes prototype fix — see file header.
    Object.setPrototypeOf(this, ListingCapReachedError.prototype);
  }
}

/**
 * Thrown by services that touch rate-limited tables (likes, bookmarks,
 * comments, messages, conversations, products) when Phase 6's
 * `check_rate_limit` trigger raises SQLSTATE '42501' with a non-empty
 * hint identifying the saturated bucket. Real RLS denials raise the same
 * SQLSTATE but with no hint — the bucket presence is how we disambiguate.
 *
 * The global mutation handler maps this to a localized "slow down" toast.
 */
export class RateLimitError extends Error {
  readonly code = 'rate_limit_exceeded' as const;
  readonly bucket?: string;

  constructor(bucket?: string) {
    super(`Rate limit exceeded${bucket ? `: ${bucket}` : ''}`);
    this.name = 'RateLimitError';
    this.bucket = bucket;
    // V8 / Hermes prototype fix — see file header.
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}
