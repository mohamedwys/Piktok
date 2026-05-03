import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import {
  followSeller,
  unfollowSeller,
} from '@/features/marketplace/services/follows';
import type { UserEngagement } from '@/features/marketplace/services/products';
import { USER_ENGAGEMENT_QUERY_KEY } from './useUserEngagement';

export type ToggleFollowVars = {
  sellerId: string;
  currentlyFollowing: boolean;
};

type Ctx = { prev: UserEngagement | undefined };

export function useToggleFollow(): UseMutationResult<
  void,
  Error,
  ToggleFollowVars,
  Ctx
> {
  const qc = useQueryClient();
  return useMutation<void, Error, ToggleFollowVars, Ctx>({
    mutationFn: async ({ sellerId, currentlyFollowing }) => {
      if (currentlyFollowing) await unfollowSeller(sellerId);
      else await followSeller(sellerId);
    },
    onMutate: async ({ sellerId, currentlyFollowing }) => {
      await qc.cancelQueries({ queryKey: USER_ENGAGEMENT_QUERY_KEY });
      const prev = qc.getQueryData<UserEngagement>(USER_ENGAGEMENT_QUERY_KEY);
      if (prev) {
        const next = new Set(prev.followingSellerIds);
        if (currentlyFollowing) next.delete(sellerId);
        else next.add(sellerId);
        qc.setQueryData<UserEngagement>(USER_ENGAGEMENT_QUERY_KEY, {
          ...prev,
          followingSellerIds: next,
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(USER_ENGAGEMENT_QUERY_KEY, ctx.prev);
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: USER_ENGAGEMENT_QUERY_KEY });
      qc.invalidateQueries({ queryKey: ['seller', 'byId', vars.sellerId] });
      qc.invalidateQueries({ queryKey: ['social', 'followers', vars.sellerId] });
      qc.invalidateQueries({ queryKey: ['social', 'following', vars.sellerId] });
    },
  });
}
