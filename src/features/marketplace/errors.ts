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
