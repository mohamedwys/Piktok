import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { listMyProducts } from '@/features/marketplace/services/products';
import type { Product } from '@/features/marketplace/types/product';

export const MY_PRODUCTS_KEY = ['marketplace', 'my-products'] as const;

export function useMyProducts(enabled: boolean): UseQueryResult<Product[], Error> {
  return useQuery<Product[], Error>({
    queryKey: MY_PRODUCTS_KEY,
    queryFn: listMyProducts,
    enabled,
    staleTime: 30_000,
  });
}
