import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { useMySeller } from './useMySeller';

/**
 * Query-key factory. The seller id is part of the key so multi-account
 * scenarios in development don't bleed counts across accounts. Mirrors
 * the `MY_PRODUCTS_KEY` / `MY_SUBSCRIPTION_KEY` pattern in this folder.
 *
 * Exported so other parts of the app (e.g., useCreateProduct's onSuccess
 * invalidation) can target it without a string literal.
 */
export const MY_PRODUCTS_COUNT_KEY = ['marketplace', 'my-products-count'] as const;

/**
 * Returns the count of products owned by the current user — without
 * fetching the rows themselves.
 *
 * Implementation note: PostgREST's `select('id', { count: 'exact', head: true })`
 * sends a HEAD request that returns ONLY the `Content-Range` count
 * header. Zero row data crosses the wire — the count comes back even
 * for sellers with hundreds of listings at constant cost. This is the
 * correct shape for the cap-check use case (the only consumer needs a
 * number, not the rows themselves).
 *
 * Compared to using `useMyProducts().data?.length`:
 *   - `useMyProducts` fetches the FULL Product[] rows (joined with the
 *     seller, with media URLs, etc.) — fine when the listings are about
 *     to render in a grid, wasteful when we only need the count.
 *   - The two hooks are intentionally separate and complementary; the
 *     profile screen uses `useMyProducts` (it renders the grid), the
 *     cap-state hook uses `useMyProductsCount` (it just needs the
 *     number). They will both invalidate after a create/delete via the
 *     hooks that own those mutations.
 *
 * Stale time: 30s. The count moves only on create/delete — both of
 * which the mutation hooks invalidate — so 30s is a comfortable upper
 * bound for stragglers.
 */
export function useMyProductsCount(): UseQueryResult<number, Error> {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const sellerQuery = useMySeller(isAuthenticated);
  const sellerId = sellerQuery.data?.id ?? null;

  return useQuery<number, Error>({
    queryKey: [...MY_PRODUCTS_COUNT_KEY, sellerId],
    queryFn: async () => {
      if (!sellerId) return 0;
      const { count, error } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', sellerId);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!sellerId,
    staleTime: 30_000,
  });
}
