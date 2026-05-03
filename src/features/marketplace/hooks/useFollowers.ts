import {
  useInfiniteQuery,
  type UseInfiniteQueryResult,
  type InfiniteData,
} from '@tanstack/react-query';
import {
  listFollowers,
  type FollowerRow,
} from '@/features/marketplace/services/follows';

const PAGE_SIZE = 20;

export function useFollowers(
  sellerId: string | null | undefined,
): UseInfiniteQueryResult<InfiniteData<FollowerRow[], number>, Error> {
  return useInfiniteQuery<
    FollowerRow[],
    Error,
    InfiniteData<FollowerRow[], number>,
    readonly ['social', 'followers', string | null | undefined],
    number
  >({
    queryKey: ['social', 'followers', sellerId] as const,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listFollowers(sellerId as string, {
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE,
    enabled: !!sellerId,
    staleTime: 60_000,
  });
}
