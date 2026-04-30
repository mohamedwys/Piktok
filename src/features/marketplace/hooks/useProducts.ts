import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  listProducts,
  type ListProductsResult,
} from '@/features/marketplace/services/products';

export function useProducts(): UseQueryResult<ListProductsResult, Error> {
  return useQuery<ListProductsResult, Error>({
    queryKey: ['marketplace', 'products', 'list'],
    queryFn: () => listProducts({ limit: 20 }),
    staleTime: 60_000,
  });
}
