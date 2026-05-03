import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  listProducts,
  type ListProductsResult,
} from '@/features/marketplace/services/products';

const LIMIT = 12;

export function useNewestProducts(): UseQueryResult<ListProductsResult, Error> {
  return useQuery<ListProductsResult, Error>({
    queryKey: ['marketplace', 'products', 'newest', LIMIT],
    queryFn: () => listProducts({ limit: LIMIT }),
    staleTime: 2 * 60_000,
  });
}
