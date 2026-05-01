import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { listProductsBySeller } from '@/features/marketplace/services/sellers';
import type { Product } from '@/features/marketplace/types/product';

export function useSellerProducts(
  sellerId: string | null | undefined,
): UseQueryResult<Product[], Error> {
  return useQuery<Product[], Error>({
    queryKey: ['seller', 'products', sellerId],
    queryFn: () =>
      sellerId ? listProductsBySeller(sellerId) : Promise.resolve([]),
    enabled: !!sellerId,
    staleTime: 60_000,
  });
}
