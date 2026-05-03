import { useQuery } from '@tanstack/react-query';
import {
  searchNearbyProducts,
  type NearbyProduct,
} from '@/features/marketplace/services/products';
import {
  useHasLocation,
  useUserLocation,
} from '@/features/location/stores/useUserLocation';
import type { MarketplaceFilters } from '@/stores/useMarketplaceFilters';

const RAIL_LIMIT = 10;

const RAIL_NEUTRAL_FILTERS: MarketplaceFilters = {
  query: '',
  categoryId: null,
  subcategoryId: null,
  priceMax: null,
  pickupOnly: false,
  locationQuery: '',
};

export type UseNearbyRailProductsResult = {
  products: NearbyProduct[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  isEnabled: boolean;
};

export function useNearbyRailProducts(): UseNearbyRailProductsResult {
  const latitude = useUserLocation((s) => s.latitude);
  const longitude = useUserLocation((s) => s.longitude);
  const radiusKm = useUserLocation((s) => s.radiusKm);
  const isEnabled = useHasLocation();

  const query = useQuery({
    queryKey: [
      'marketplace',
      'nearby-rail',
      { lat: latitude, lng: longitude, radiusKm },
    ],
    queryFn: () =>
      searchNearbyProducts({
        filters: RAIL_NEUTRAL_FILTERS,
        location: { latitude, longitude, radiusKm },
        sort: 'distance',
        limit: RAIL_LIMIT,
        offset: 0,
      }),
    enabled: isEnabled,
    staleTime: 60_000,
  });

  return {
    products: query.data?.items ?? [],
    loading: query.isLoading,
    error: (query.error as Error | null) ?? null,
    refetch: () => {
      void query.refetch();
    },
    isEnabled,
  };
}
