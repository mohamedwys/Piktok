import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { listMySales, type Order } from '@/features/marketplace/services/orders';

export const MY_SALES_KEY = ['marketplace', 'sales', 'mine'] as const;

export function useMySales(
  enabled: boolean,
): UseQueryResult<Order[], Error> {
  return useQuery<Order[], Error>({
    queryKey: MY_SALES_KEY,
    queryFn: listMySales,
    enabled,
    staleTime: 60_000,
  });
}
