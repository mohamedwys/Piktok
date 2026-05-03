import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type UseMutationResult,
} from '@tanstack/react-query';
import {
  postComment,
  type CommentPage,
  type CommentWithAuthor,
} from '@/features/marketplace/services/comments';
import { useMySeller, MY_SELLER_KEY } from './useMySeller';
import { COMMENTS_QUERY_KEY } from './useComments';
import type { SellerProfile } from '@/features/marketplace/services/sellers';

// Pure-JS short-id generator. Avoids adding a dependency (no nanoid, no
// expo-crypto) and works in Hermes which does not expose `crypto.randomUUID`
// out of the box. The id only needs to be unique within the in-memory query
// cache for the brief window between optimistic prepend and onSuccess id-swap.
// The `temp-` prefix is the recognizable signal D.5's realtime subscription
// will use to dedupe self-echoes (real server ids are RFC4122 UUIDs).
function makeTempId(): string {
  return `temp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sellerToAuthor(
  seller: SellerProfile | null | undefined,
): CommentWithAuthor['author'] {
  if (!seller) {
    // Pre-fetch fallback: anonymous-looking placeholder. The server row
    // from onSuccess overwrites these fields when the insert returns.
    return {
      id: '',
      name: '',
      avatar_url: '',
      verified: false,
      is_pro: false,
    };
  }
  return {
    id: seller.id,
    name: seller.name,
    avatar_url: seller.avatarUrl,
    verified: seller.verified,
    is_pro: seller.isPro,
  };
}

export type PostCommentVars = { body: string };

type Ctx = {
  tempId: string;
  previous: InfiniteData<CommentPage, string | undefined> | undefined;
};

export function usePostComment(
  productId: string,
): UseMutationResult<CommentWithAuthor, Error, PostCommentVars, Ctx> {
  const qc = useQueryClient();
  const { data: mySeller } = useMySeller(true);

  return useMutation<CommentWithAuthor, Error, PostCommentVars, Ctx>({
    mutationFn: ({ body }) => postComment({ productId, body }),

    onMutate: async ({ body }) => {
      const queryKey = COMMENTS_QUERY_KEY(productId);
      await qc.cancelQueries({ queryKey });

      const previous =
        qc.getQueryData<InfiniteData<CommentPage, string | undefined>>(
          queryKey,
        );

      const tempId = makeTempId();

      // Build the optimistic row from `useMySeller` if loaded; otherwise
      // try the cached MY_SELLER_KEY snapshot before falling back to an
      // empty placeholder. The server row in onSuccess overwrites these.
      const sellerSource =
        mySeller ?? qc.getQueryData<SellerProfile | null>(MY_SELLER_KEY);
      const author = sellerToAuthor(sellerSource);
      const tempComment: CommentWithAuthor = {
        id: tempId,
        product_id: productId,
        author_id: author.id,
        body: body.trim(),
        created_at: new Date().toISOString(),
        updated_at: null,
        author,
      };

      qc.setQueryData<InfiniteData<CommentPage, string | undefined>>(
        queryKey,
        (old) => {
          if (!old || old.pages.length === 0) {
            return {
              pages: [{ items: [tempComment], nextCursor: null }],
              pageParams: [undefined],
            };
          }
          return {
            ...old,
            pages: old.pages.map((page, i) =>
              i === 0
                ? { ...page, items: [tempComment, ...page.items] }
                : page,
            ),
          };
        },
      );

      return { tempId, previous };
    },

    onSuccess: (serverRow, _vars, ctx) => {
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
                c.id === ctx.tempId ? serverRow : c,
              ),
            })),
          };
        },
      );
      // Refresh the action-rail counter on the parent product card.
      // Trigger-maintained `comments_count` is now incremented server-side.
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
