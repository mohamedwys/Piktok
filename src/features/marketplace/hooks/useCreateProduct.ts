import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createProduct,
  type CreateProductInput,
} from '@/features/marketplace/services/sell';
import { MY_PRODUCTS_KEY } from './useMyProducts';
import { MY_PRODUCTS_COUNT_KEY } from './useMyProductsCount';

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation<string, Error, CreateProductInput>({
    mutationFn: createProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketplace', 'products', 'list'] });
      qc.invalidateQueries({ queryKey: MY_PRODUCTS_KEY });
      // Keep the listing-cap state fresh after a successful create so
      // useListingCap's `used` / `remaining` reflect the new total
      // immediately on the next render.
      qc.invalidateQueries({ queryKey: MY_PRODUCTS_COUNT_KEY });
    },
  });
}
