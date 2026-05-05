import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  listFeaturedProducts,
} from '@/features/marketplace/services/products';
import type { Product } from '@/features/marketplace/types/product';

const LIMIT = 10;

/**
 * Returns the list of currently-featured products for the Categories-page
 * Featured rail (H.12). The underlying query filters
 * `featured_until > now()` server-side and orders by `featured_until DESC`
 * (most-recently boosted first), backed by the partial index from
 * 20260524_featured_listings.sql.
 *
 * Mirrors `useTrendingProducts` / `useNewestProducts` shape so the rail
 * consumer pattern is uniform across the Categories page.
 */
export function useFeaturedProducts(): UseQueryResult<Product[], Error> {
  return useQuery<Product[], Error>({
    queryKey: ['marketplace', 'featured', 'list', LIMIT],
    queryFn: () => listFeaturedProducts({ limit: LIMIT }),
    staleTime: 60_000,
  });
}
