import { FREE_TIER_LISTING_CAP } from '@/features/marketplace/constants';
import { useIsPro } from './useIsPro';
import { useMyProductsCount } from './useMyProductsCount';

/**
 * Aggregated listing-cap state for the current user. Combines the
 * trigger-maintained `is_pro` flag (via `useIsPro`) with the
 * head-count of the user's listings (via `useMyProductsCount`) into
 * the shape the UI needs:
 *
 *   - `isPro`     — pure passthrough of the trigger flag.
 *   - `cap`       — `FREE_TIER_LISTING_CAP` for free, `null` for Pro
 *                   (null = unlimited; matches the "no upper bound"
 *                   semantics of the tier rather than picking a
 *                   sentinel like Number.POSITIVE_INFINITY which
 *                   doesn't render gracefully in JSON / debug output).
 *   - `used`      — current count, or 0 while loading.
 *   - `remaining` — `cap - used` clamped at 0 for free,
 *                   `Number.POSITIVE_INFINITY` for Pro. The Infinity
 *                   sentinel is chosen for `remaining` (not `cap`)
 *                   because consumers will typically render `remaining`
 *                   as a number ("3 listings remaining"); they branch
 *                   on `isPro` to skip that line entirely for Pro.
 *   - `isAtCap`   — convenience boolean. False for Pro by definition.
 *   - `loading`   — true while the count query is in flight (the
 *                   useIsPro side has its own loading characteristics
 *                   but in practice resolves in the same RTT, so the
 *                   count query is the dominant signal).
 */
export type ListingCapState = {
  isPro: boolean;
  cap: number | null;
  used: number;
  remaining: number;
  isAtCap: boolean;
  loading: boolean;
};

/**
 * Pure aggregator hook over `useIsPro` + `useMyProductsCount`.
 *
 * Consumers in H.4 (proactive CTA banners, "X / 10 used" indicator on
 * newPost) read this and render accordingly. The cap-enforcement at
 * the create-product mutation (services/sell.ts) does NOT read this
 * hook — it does an independent server-side check inside the mutation
 * to avoid trusting client cache state at the gate. The hook is
 * therefore advisory for UX; the mutation is authoritative.
 */
export function useListingCap(): ListingCapState {
  const isPro = useIsPro();
  const countQuery = useMyProductsCount();

  const used = countQuery.data ?? 0;
  const cap = isPro ? null : FREE_TIER_LISTING_CAP;
  const remaining = isPro
    ? Number.POSITIVE_INFINITY
    : Math.max(0, FREE_TIER_LISTING_CAP - used);
  const isAtCap = !isPro && used >= FREE_TIER_LISTING_CAP;

  return {
    isPro,
    cap,
    used,
    remaining,
    isAtCap,
    loading: countQuery.isLoading,
  };
}
