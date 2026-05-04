import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { deleteProduct } from '@/features/marketplace/services/products';
import { MY_PRODUCTS_KEY } from './useMyProducts';
import { MY_PRODUCTS_COUNT_KEY } from './useMyProductsCount';

export function useDeleteProduct(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MY_PRODUCTS_KEY });
      qc.invalidateQueries({ queryKey: ['marketplace', 'products', 'list'] });
      // Keep the listing-cap state fresh — deleting a listing frees a
      // slot under the free-tier cap, so useListingCap's `remaining`
      // should refresh on the next render.
      qc.invalidateQueries({ queryKey: MY_PRODUCTS_COUNT_KEY });
    },
  });
}
