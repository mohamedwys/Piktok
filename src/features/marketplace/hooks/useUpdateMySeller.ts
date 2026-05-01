import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import {
  updateMySeller,
  type UpdateMySellerInput,
} from '@/features/marketplace/services/sellers';
import { MY_SELLER_KEY } from './useMySeller';

export function useUpdateMySeller(): UseMutationResult<void, Error, UpdateMySellerInput> {
  const qc = useQueryClient();
  return useMutation<void, Error, UpdateMySellerInput>({
    mutationFn: updateMySeller,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MY_SELLER_KEY });
      qc.invalidateQueries({ queryKey: ['seller', 'byId'] });
    },
  });
}
