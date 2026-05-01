import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { deleteProduct } from '@/features/marketplace/services/products';
import { MY_PRODUCTS_KEY } from './useMyProducts';

export function useDeleteProduct(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MY_PRODUCTS_KEY });
      qc.invalidateQueries({ queryKey: ['marketplace', 'products', 'list'] });
    },
  });
}
