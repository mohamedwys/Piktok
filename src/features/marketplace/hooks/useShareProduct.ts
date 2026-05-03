import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import {
  incrementShareCount,
  shareProduct,
  type ShareProductInput,
} from '@/features/marketplace/services/products';
import type { Product } from '@/features/marketplace/types/product';

type Ctx = { previous: Product | null | undefined };

// Phase E.2 — share intent mutation.
//
// Track-on-intent (T1 per SHARE_AUDIT.md §6): the counter bumps optimistically
// before the system Share sheet opens. If the user dismisses the sheet the
// counter STAYS incremented — intent is the metric. Only an RPC failure
// rolls the optimistic patch back.
//
// The optimistic patch lands on the byId cache used by useProduct
// (cache key mirrors hooks/useProduct.ts:11). The action rail in the feed
// reads its product from a list-cache prop, not byId, so the count there
// pops only after the onSettled invalidation refetches the list — same
// staleness window as Phase D's comment-counter wiring at
// usePostComment.ts:132-139.
export function useShareProduct(): UseMutationResult<
  void,
  Error,
  ShareProductInput,
  Ctx
> {
  const qc = useQueryClient();

  return useMutation<void, Error, ShareProductInput, Ctx>({
    onMutate: async (input) => {
      const productKey = [
        'marketplace',
        'products',
        'byId',
        input.productId,
      ];
      await qc.cancelQueries({ queryKey: productKey });
      const previous = qc.getQueryData<Product | null>(productKey);

      qc.setQueryData<Product | null>(productKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          engagement: {
            ...old.engagement,
            shares: (old.engagement.shares ?? 0) + 1,
          },
        };
      });

      return { previous };
    },

    mutationFn: async (input) => {
      // RPC first so a failure rolls back the optimistic patch via onError
      // before we open the share sheet. If the sheet itself rejects (rare
      // — iPad simulator without a Share extension is the documented case
      // per SHARE_AUDIT.md §5.3), the counter still represents intent and
      // does NOT roll back.
      await incrementShareCount(input.productId);
      try {
        await shareProduct(input);
      } catch {
        // Swallow share-sheet errors. T1 keeps the counter incremented.
      }
    },

    onError: (_err, input, ctx) => {
      const productKey = [
        'marketplace',
        'products',
        'byId',
        input.productId,
      ];
      if (ctx?.previous !== undefined) {
        qc.setQueryData(productKey, ctx.previous);
      }
    },

    onSettled: (_data, _err, input) => {
      qc.invalidateQueries({
        queryKey: ['marketplace', 'products', 'byId', input.productId],
      });
      qc.invalidateQueries({
        queryKey: ['marketplace', 'products', 'list'],
      });
    },
  });
}
