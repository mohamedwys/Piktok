import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import {
  updateProduct,
  type UpdateProductInput,
} from '@/features/marketplace/services/sell';
import { MY_PRODUCTS_KEY } from './useMyProducts';

type UpdateVariables = { id: string; input: UpdateProductInput };

export function useUpdateProduct(): UseMutationResult<void, Error, UpdateVariables> {
  const qc = useQueryClient();
  return useMutation<void, Error, UpdateVariables>({
    mutationFn: ({ id, input }) => updateProduct(id, input),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: MY_PRODUCTS_KEY });
      qc.invalidateQueries({ queryKey: ['marketplace', 'products', 'list'] });
      qc.invalidateQueries({ queryKey: ['marketplace', 'products', 'byId', id] });
    },
  });
}
