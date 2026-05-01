import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createProduct,
  type CreateProductInput,
} from '@/features/marketplace/services/sell';

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation<string, Error, CreateProductInput>({
    mutationFn: createProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketplace', 'products', 'list'] });
    },
  });
}
