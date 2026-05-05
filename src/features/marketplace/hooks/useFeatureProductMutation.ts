import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  featureProduct,
  type FeatureProductResult,
} from '@/features/marketplace/services/products';

/**
 * H.12 boost mutation. One-shot RPC, not a toggle — there is no
 * useful optimistic state to apply: until the server confirms the boost
 * succeeded (cooldown / Pro / ownership all pass), we cannot know whether
 * the listing is featured. On success we invalidate the relevant caches:
 *
 *   - `['marketplace', 'featured']`         → the Categories Featured rail
 *     picks up the newly-boosted listing.
 *   - `['marketplace', 'products', 'byId', productId]` → the
 *     ProductDetailSheet refetches so the card-level Featured badge appears
 *     and the BoostButton transitions to its "isFeatured" state.
 *   - `['marketplace', 'my-seller']`        → MY_SELLER_KEY from
 *     `useMySeller`. Refreshes `lastBoostAt` so cooldown countdown works
 *     immediately after the boost without a manual reload.
 */
export function useFeatureProductMutation() {
  const queryClient = useQueryClient();
  return useMutation<FeatureProductResult, Error, string>({
    mutationFn: featureProduct,
    onSuccess: (_data, productId) => {
      queryClient.invalidateQueries({
        queryKey: ['marketplace', 'featured'],
      });
      queryClient.invalidateQueries({
        queryKey: ['marketplace', 'products', 'byId', productId],
      });
      queryClient.invalidateQueries({
        queryKey: ['marketplace', 'my-seller'],
      });
    },
  });
}
