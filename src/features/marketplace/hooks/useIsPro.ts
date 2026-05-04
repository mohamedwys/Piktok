import { useAuthStore } from '@/stores/useAuthStore';
import { useMySeller } from './useMySeller';

/**
 * Returns the current user's Pro state as a plain boolean.
 *
 * Reads `sellers.is_pro` (camelCased to `isPro` in `SellerProfile`) which
 * the H.2 `handle_subscription_change` trigger maintains as the
 * denormalization of `subscriptions.status IN ('active','trialing')`. The
 * trigger is the single writer of the flag; this hook is therefore the
 * canonical client-side accessor — there is no need to derive Pro state
 * from the subscription row at the JS layer.
 *
 * Returns `false` for:
 *   - Unauthenticated sessions (the underlying useMySeller query is
 *     disabled, so `seller.data` is undefined → coalesces to false).
 *   - Authenticated users with no seller row yet (data is null).
 *   - Authenticated sellers with no active/trialing subscription
 *     (the H.2 trigger keeps is_pro = false in this case).
 *
 * Callers (e.g., ProductActionRail's existing `isPro` branch, the new
 * H.4 banner placements, the listing-cap hook below) should NOT add
 * their own auth gating around this — the hook handles it transparently.
 */
export function useIsPro(): boolean {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const sellerQuery = useMySeller(isAuthenticated);
  return sellerQuery.data?.isPro ?? false;
}
