import {
  useInfiniteQuery,
  type UseInfiniteQueryResult,
  type InfiniteData,
} from '@tanstack/react-query';
import {
  listFollowing,
  type FollowerRow,
} from '@/features/marketplace/services/follows';

const PAGE_SIZE = 20;

export function useFollowing(
  sellerId: string | null | undefined,
): UseInfiniteQueryResult<InfiniteData<FollowerRow[], number>, Error> {
  return useInfiniteQuery<
    FollowerRow[],
    Error,
    InfiniteData<FollowerRow[], number>,
    readonly ['social', 'following', string | null | undefined],
    number
  >({
    queryKey: ['social', 'following', sellerId] as const,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listFollowing(sellerId as string, {
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE,
    enabled: !!sellerId,
    staleTime: 60_000,
  });
}
