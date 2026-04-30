import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  getProductById,
} from '@/features/marketplace/services/products';
import type { Product } from '@/features/marketplace/types/product';

export function useProduct(
  productId: string | null,
): UseQueryResult<Product | null, Error> {
  return useQuery<Product | null, Error>({
    queryKey: ['marketplace', 'products', 'byId', productId],
    queryFn: () => (productId ? getProductById(productId) : Promise.resolve(null)),
    enabled: !!productId,
    staleTime: 60_000,
  });
}
