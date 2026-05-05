import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  getProductAnalytics,
  type ProductAnalytics,
} from '@/features/marketplace/services/analytics';
import { useIsPro } from '@/features/marketplace/hooks/useIsPro';

/**
 * Phase H.13 — Pro-gated, owner-only product analytics.
 *
 * Three-way enable gate:
 *   - `productId` must be defined,
 *   - the calling user must be the listing owner (`isOwner`),
 *   - the calling user must be Pro (`useIsPro()`).
 *
 * If any gate is false the underlying React Query stays disabled and
 * `data` is `undefined` — callers should treat that as "no analytics to
 * show" and render a teaser / nothing instead of an error state.
 *
 * Pro state is intentionally checked here (client-side) rather than in
 * the SECURITY DEFINER RPC. The aggregates themselves are not legally
 * sensitive — the perk is the polished in-app surface, not the raw
 * count. See ANALYTICS_AUDIT.md §2.8 for the full rationale.
 *
 * 60s `staleTime` per spec — refetch on focus is the React Query
 * default and does what we want (open the sheet after a long idle =
 * fresh counts).
 */
export function useProductAnalytics(
  productId: string | null | undefined,
  isOwner: boolean,
): UseQueryResult<ProductAnalytics, Error> {
  const isPro = useIsPro();

  return useQuery<ProductAnalytics, Error>({
    queryKey: ['marketplace', 'analytics', 'product', productId],
    queryFn: () => getProductAnalytics(productId as string),
    enabled: !!productId && isOwner && isPro,
    staleTime: 60_000,
  });
}
