import {
  useInfiniteQuery,
  type UseInfiniteQueryResult,
  type InfiniteData,
} from '@tanstack/react-query';
import {
  listComments,
  type CommentPage,
} from '@/features/marketplace/services/comments';

export const COMMENTS_QUERY_KEY = (productId: string) =>
  ['marketplace', 'comments', productId] as const;

const PAGE_SIZE = 20;

export function useComments(
  productId: string,
): UseInfiniteQueryResult<InfiniteData<CommentPage, string | undefined>, Error> {
  return useInfiniteQuery<
    CommentPage,
    Error,
    InfiniteData<CommentPage, string | undefined>,
    ReturnType<typeof COMMENTS_QUERY_KEY>,
    string | undefined
  >({
    queryKey: COMMENTS_QUERY_KEY(productId),
    queryFn: ({ pageParam }) =>
      listComments(productId, { cursor: pageParam, limit: PAGE_SIZE }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!productId,
    staleTime: 60_000,
  });
}
