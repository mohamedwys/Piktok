import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import {
  likeProduct,
  unlikeProduct,
  type UserEngagement,
} from '@/features/marketplace/services/products';
import { USER_ENGAGEMENT_QUERY_KEY } from './useUserEngagement';

type Ctx = { prev: UserEngagement | undefined };

export function useToggleLike(
  productId: string
): UseMutationResult<void, Error, boolean, Ctx> {
  const qc = useQueryClient();
  return useMutation<void, Error, boolean, Ctx>({
    mutationFn: async (currentlyLiked) => {
      if (currentlyLiked) await unlikeProduct(productId);
      else await likeProduct(productId);
    },
    onMutate: async (currentlyLiked) => {
      await qc.cancelQueries({ queryKey: USER_ENGAGEMENT_QUERY_KEY });
      const prev = qc.getQueryData<UserEngagement>(USER_ENGAGEMENT_QUERY_KEY);
      if (prev) {
        const next = new Set(prev.likedIds);
        if (currentlyLiked) next.delete(productId);
        else next.add(productId);
        qc.setQueryData<UserEngagement>(USER_ENGAGEMENT_QUERY_KEY, {
          ...prev,
          likedIds: next,
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(USER_ENGAGEMENT_QUERY_KEY, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === 'marketplace' && q.queryKey[1] !== 'engagement',
      });
    },
  });
}
