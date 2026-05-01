import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { createCheckoutSession } from '@/features/marketplace/services/orders';
import { MY_ORDERS_KEY } from './useMyOrders';

type CheckoutResult = { url: string; sessionId: string; orderId: string };

export function useCreateCheckoutSession(): UseMutationResult<
  CheckoutResult,
  Error,
  string
> {
  const qc = useQueryClient();
  return useMutation<CheckoutResult, Error, string>({
    mutationFn: (productId) => createCheckoutSession(productId),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: MY_ORDERS_KEY });
    },
  });
}
