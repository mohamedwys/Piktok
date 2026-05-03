import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  listTrendingProducts,
  type ListProductsResult,
} from '@/features/marketplace/services/products';

const SINCE_DAYS = 7;
const LIMIT = 12;

export function useTrendingProducts(): UseQueryResult<ListProductsResult, Error> {
  return useQuery<ListProductsResult, Error>({
    queryKey: ['marketplace', 'products', 'trending', `last-${SINCE_DAYS}-days`],
    queryFn: () => listTrendingProducts({ sinceDays: SINCE_DAYS, limit: LIMIT }),
    staleTime: 5 * 60_000,
  });
}
