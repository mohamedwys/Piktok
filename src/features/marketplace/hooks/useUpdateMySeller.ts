import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import {
  updateMySeller,
  type SellerProfile,
  type UpdateMySellerInput,
} from '@/features/marketplace/services/sellers';
import { MY_SELLER_KEY } from './useMySeller';

export function useUpdateMySeller(): UseMutationResult<
  SellerProfile,
  Error,
  UpdateMySellerInput
> {
  const qc = useQueryClient();
  return useMutation<SellerProfile, Error, UpdateMySellerInput>({
    mutationFn: updateMySeller,
    onSuccess: (next) => {
      qc.setQueryData(MY_SELLER_KEY, next);
      qc.invalidateQueries({ queryKey: ['seller', 'byId'] });
    },
  });
}
