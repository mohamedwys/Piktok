import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { searchProducts, type ListProductsResult } from '@/features/marketplace/services/products';
import { useMarketplaceFilters } from '@/stores/useMarketplaceFilters';

export function useFilteredProducts(): UseQueryResult<ListProductsResult, Error> {
  const filters = useMarketplaceFilters((s) => s.filters);
  return useQuery<ListProductsResult, Error>({
    queryKey: ['marketplace', 'products', 'list', filters],
    queryFn: () => searchProducts(filters),
    staleTime: 30_000,
  });
}
