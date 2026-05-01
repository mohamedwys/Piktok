import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { listMyOrders, type Order } from '@/features/marketplace/services/orders';

export const MY_ORDERS_KEY = ['marketplace', 'my-orders'] as const;

export function useMyOrders(enabled: boolean): UseQueryResult<Order[], Error> {
  return useQuery<Order[], Error>({
    queryKey: MY_ORDERS_KEY,
    queryFn: listMyOrders,
    enabled,
    staleTime: 30_000,
  });
}
