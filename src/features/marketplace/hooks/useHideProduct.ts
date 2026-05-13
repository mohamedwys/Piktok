import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type UseMutationResult,
} from '@tanstack/react-query';
import {
  hideProduct,
  type HideReason,
  type ListNearbyResult,
  type ProductsCursor,
} from '@/features/marketplace/services/products';

type Vars = { productId: string; reason?: HideReason };

type MarketplaceCache = InfiniteData<ListNearbyResult, ProductsCursor | null>;

type Ctx = {
  prev: Array<[readonly unknown[], MarketplaceCache | undefined]>;
};

// Optimistic "Not interested" — removes the product from every cached
// marketplace-feed page synchronously, calls hide_product, rolls back on
// error. No onSettled invalidation; the optimistic removal is permanent
// because the server now hides the product from this user's future fetches.
export function useHideProduct(): UseMutationResult<void, Error, Vars, Ctx> {
  const qc = useQueryClient();
  return useMutation<void, Error, Vars, Ctx>({
    mutationFn: ({ productId, reason }) => hideProduct(productId, reason),
    onMutate: async ({ productId }) => {
      // Cancel any in-flight feed fetches so the optimistic remove isn't
      // overwritten by a slower inbound response.
      await qc.cancelQueries({ queryKey: ['marketplace', 'nearby'] });

      const entries = qc.getQueriesData<MarketplaceCache>({
        queryKey: ['marketplace', 'nearby'],
      });
      const prev: Ctx['prev'] = [];

      for (const [key, data] of entries) {
        prev.push([key, data]);
        if (!data) continue;
        qc.setQueryData<MarketplaceCache>(key, {
          ...data,
          pages: data.pages.map((p) => ({
            ...p,
            items: p.items.filter((item) => item.id !== productId),
          })),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      for (const [key, snapshot] of ctx.prev) {
        qc.setQueryData(key, snapshot);
      }
    },
  });
}
