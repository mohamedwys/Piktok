import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from '@tanstack/react-query';
import {
  feedForYou,
  type ForYouCursor,
  type ListForYouResult,
} from '@/features/marketplace/services/products';
import { useUserLocation } from '@/features/location/stores/useUserLocation';
import { useAuthStore } from '@/stores/useAuthStore';

const PAGE_SIZE = 30;

export function useForYouFeed(): UseInfiniteQueryResult<
  InfiniteData<ListForYouResult, ForYouCursor | null>,
  Error
> {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const latitude = useUserLocation((s) => s.latitude);
  const longitude = useUserLocation((s) => s.longitude);
  const radiusKm = useUserLocation((s) => s.radiusKm);

  return useInfiniteQuery<
    ListForYouResult,
    Error,
    InfiniteData<ListForYouResult, ForYouCursor | null>,
    readonly unknown[],
    ForYouCursor | null
  >({
    queryKey: [
      'marketplace',
      'forYou',
      { lat: latitude, lng: longitude, radiusKm },
    ],
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      feedForYou({
        location: { latitude, longitude, radiusKm },
        cursor: pageParam,
        limit: PAGE_SIZE,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
}
