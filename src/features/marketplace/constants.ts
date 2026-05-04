/**
 * Marketplace-wide constants.
 *
 * Single source of truth — both the cap-check at the create-product
 * mutation (services/sell.ts) and the cap-state hook (hooks/useListingCap.ts)
 * read from this module so the placeholder cap is changed in one place
 * if/when the user finalizes a different number.
 */

/**
 * Free-tier listing cap. Non-Pro sellers may publish up to this many
 * listings before the create-product mutation throws
 * `ListingCapReachedError`. Pro sellers (subscriptions.status IN
 * ('active','trialing') → sellers.is_pro = true via the H.2 trigger)
 * have no cap.
 *
 * v1 placeholder per PRO_AUDIT.md §10 open-question 1. User-decided
 * final value will land via a one-line edit here.
 */
export const FREE_TIER_LISTING_CAP = 10;
