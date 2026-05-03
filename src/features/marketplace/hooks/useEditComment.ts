import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type UseMutationResult,
} from '@tanstack/react-query';
import {
  editComment,
  type CommentPage,
  type CommentWithAuthor,
} from '@/features/marketplace/services/comments';
import { COMMENTS_QUERY_KEY } from './useComments';

export type EditCommentVars = { commentId: string; body: string };

type Ctx = {
  previous: InfiniteData<CommentPage, string | undefined> | undefined;
};

export function useEditComment(
  productId: string,
): UseMutationResult<CommentWithAuthor, Error, EditCommentVars, Ctx> {
  const qc = useQueryClient();

  return useMutation<CommentWithAuthor, Error, EditCommentVars, Ctx>({
    mutationFn: ({ commentId, body }) => editComment({ commentId, body }),

    onMutate: async ({ commentId, body }) => {
      const queryKey = COMMENTS_QUERY_KEY(productId);
      await qc.cancelQueries({ queryKey });

      const previous =
        qc.getQueryData<InfiniteData<CommentPage, string | undefined>>(
          queryKey,
        );

      // Optimistic body patch + an `updated_at` hint of "now". The server
      // row from onSuccess replaces this with the trigger-set timestamp.
      const nowIso = new Date().toISOString();
      const trimmed = body.trim();

      qc.setQueryData<InfiniteData<CommentPage, string | undefined>>(
        queryKey,
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((c) =>
                c.id === commentId
                  ? { ...c, body: trimmed, updated_at: nowIso }
                  : c,
              ),
            })),
          };
        },
      );

      return { previous };
    },

    onSuccess: (serverRow) => {
      const queryKey = COMMENTS_QUERY_KEY(productId);
      qc.setQueryData<InfiniteData<CommentPage, string | undefined>>(
        queryKey,
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((c) =>
                c.id === serverRow.id ? serverRow : c,
              ),
            })),
          };
        },
      );
      // No counter invalidation — edit does not change comments_count.
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(COMMENTS_QUERY_KEY(productId), ctx.previous);
      }
    },
  });
}
