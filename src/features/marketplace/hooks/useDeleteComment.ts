import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type UseMutationResult,
} from '@tanstack/react-query';
import {
  deleteComment,
  type CommentPage,
} from '@/features/marketplace/services/comments';
import { COMMENTS_QUERY_KEY } from './useComments';

export type DeleteCommentVars = { commentId: string };

type Ctx = {
  previous: InfiniteData<CommentPage, string | undefined> | undefined;
};

export function useDeleteComment(
  productId: string,
): UseMutationResult<void, Error, DeleteCommentVars, Ctx> {
  const qc = useQueryClient();

  return useMutation<void, Error, DeleteCommentVars, Ctx>({
    mutationFn: ({ commentId }) => deleteComment(commentId),

    onMutate: async ({ commentId }) => {
      const queryKey = COMMENTS_QUERY_KEY(productId);
      await qc.cancelQueries({ queryKey });

      const previous =
        qc.getQueryData<InfiniteData<CommentPage, string | undefined>>(
          queryKey,
        );

      qc.setQueryData<InfiniteData<CommentPage, string | undefined>>(
        queryKey,
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.filter((c) => c.id !== commentId),
            })),
          };
        },
      );

      return { previous };
    },

    onSuccess: () => {
      // Refresh action-rail counter — trigger decremented `comments_count`.
      qc.invalidateQueries({ queryKey: ['product', 'byId', productId] });
      qc.invalidateQueries({ queryKey: ['marketplace', 'products', 'list'] });
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(COMMENTS_QUERY_KEY(productId), ctx.previous);
      }
    },
  });
}
