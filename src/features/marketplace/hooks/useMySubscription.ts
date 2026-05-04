import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { useMySeller } from './useMySeller';
import type { Database } from '@/types/supabase';

/**
 * The Stripe-mirroring `subscriptions` row shape from the H.2 migration.
 * Drawn directly from the regenerated supabase types so the row shape stays
 * 1:1 with the database (status enum, period timestamps, cancel flags).
 */
export type SubscriptionRow =
  Database['public']['Tables']['subscriptions']['Row'];

/**
 * Query-key factory. Includes the seller id so the cache splits cleanly
 * per-seller (the underlying `seller_id UNIQUE` invariant means at most
 * one row exists, but the React Query key still needs to be stable per
 * key-input). The `'my-subscription'` segment matches the existing
 * `'my-seller'` / `'my-products'` / `'my-orders'` family in this folder.
 */
export const MY_SUBSCRIPTION_KEY = ['marketplace', 'my-subscription'] as const;

/**
 * Reads the current user's subscription row, or null if no subscription
 * exists yet (free tier).
 *
 * Webhooks (H.12) write to `public.subscriptions` via service_role; the
 * H.2 trigger then mirrors `status IN ('active','trialing')` into
 * `sellers.is_pro`. For most UI gates, prefer the lighter `useIsPro()`
 * which reads the trigger-maintained boolean. Use this hook when the
 * UI needs to display plan details — period_end for "renews on …",
 * `cancel_at_period_end` for "scheduled cancellation", `trial_end` for
 * trial-countdown banners, etc. (H.4 / H.10 surfaces.)
 *
 * Auth gating: reads `useAuthStore` directly so the underlying query
 * is `enabled: false` for unauthed sessions (no wasted round-trip),
 * but the hook itself remains pure — it returns the same `UseQueryResult`
 * shape in every state and lets the call site decide what to render.
 *
 * Stale time: 5 minutes. Subscription state changes via webhook, not
 * via client write — refetch-on-focus + 5min staleness covers the
 * common "seller upgraded on web → returned to mobile" case without
 * hammering Supabase.
 */
export function useMySubscription(): UseQueryResult<
  SubscriptionRow | null,
  Error
> {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const sellerQuery = useMySeller(isAuthenticated);
  const sellerId = sellerQuery.data?.id ?? null;

  return useQuery<SubscriptionRow | null, Error>({
    queryKey: [...MY_SUBSCRIPTION_KEY, sellerId],
    queryFn: async () => {
      if (!sellerId) return null;
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('seller_id', sellerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!sellerId,
    staleTime: 5 * 60_000,
  });
}
