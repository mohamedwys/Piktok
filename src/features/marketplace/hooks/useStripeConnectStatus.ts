import { useAuthStore } from '@/stores/useAuthStore';
import { useIsPro } from './useIsPro';
import { useMySeller } from './useMySeller';

export type StripeConnectStatus = {
  /** Seller has completed Stripe onboarding and may accept funds. */
  isConnected: boolean;
  /** A Connect account row exists, but it may not yet be `charges_enabled`. */
  hasAccount: boolean;
  /** Underlying seller query is still loading. */
  loading: boolean;
};

/**
 * Composes `useIsPro` + `useMySeller` to expose the seller's Stripe Connect
 * readiness in one place. Used by F.C.5 to gate the mobile sell-flow's
 * `buy_now` toggle on a working payout destination.
 *
 * State table:
 *   - !isPro                          → { false, false, false }   (no fetch)
 *   - isPro && loading                → { false, false, true  }
 *   - isPro && !stripe_account_id     → { false, false, false }
 *   - isPro &&  stripe_account_id
 *           && !charges_enabled       → { false, true,  false }
 *   - isPro &&  charges_enabled       → { true,  true,  false }
 *
 * For !isPro callers the underlying `useMySeller` query is disabled (it
 * receives `enabled=false`), so no network fetch is issued. The
 * mobile Buy Now gate only renders for Pro sellers anyway, so this
 * matches the surface's actual data needs.
 */
export function useStripeConnectStatus(): StripeConnectStatus {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isPro = useIsPro();
  const sellerQuery = useMySeller(isAuthenticated && isPro);

  if (!isPro) {
    return { isConnected: false, hasAccount: false, loading: false };
  }

  if (sellerQuery.isLoading) {
    return { isConnected: false, hasAccount: false, loading: true };
  }

  const seller = sellerQuery.data;
  const hasAccount = Boolean(seller?.stripeAccountId);
  const isConnected = seller?.stripeChargesEnabled === true;
  return { isConnected, hasAccount, loading: false };
}
