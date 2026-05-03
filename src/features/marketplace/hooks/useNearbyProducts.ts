import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  searchNearbyProducts,
  type ListNearbyResult,
} from '@/features/marketplace/services/products';
import { useMarketplaceFilters } from '@/stores/useMarketplaceFilters';
import { useUserLocation } from '@/features/location/stores/useUserLocation';

const PAGE_SIZE = 50;

export function useNearbyProducts(): UseQueryResult<ListNearbyResult, Error> {
  const filters = useMarketplaceFilters((s) => s.filters);
  const latitude = useUserLocation((s) => s.latitude);
  const longitude = useUserLocation((s) => s.longitude);
  const radiusKm = useUserLocation((s) => s.radiusKm);

  return useQuery<ListNearbyResult, Error>({
    queryKey: [
      'marketplace',
      'nearby',
      { lat: latitude, lng: longitude, radiusKm, filters },
    ],
    queryFn: () =>
      searchNearbyProducts({
        filters,
        location: { latitude, longitude, radiusKm },
        limit: PAGE_SIZE,
        offset: 0,
      }),
    staleTime: 60_000,
  });
}
