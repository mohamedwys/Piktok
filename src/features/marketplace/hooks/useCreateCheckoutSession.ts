import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { createCheckoutSession } from '@/features/marketplace/services/orders';
import { captureEvent } from '@/lib/posthog';
import { MY_ORDERS_KEY } from './useMyOrders';

type CheckoutResult = { url: string; sessionId: string; orderId: string };

export function useCreateCheckoutSession(): UseMutationResult<
  CheckoutResult,
  Error,
  string
> {
  const qc = useQueryClient();
  return useMutation<CheckoutResult, Error, string>({
    mutationFn: (productId) => {
      captureEvent('checkout_started', { product_id: productId });
      return createCheckoutSession(productId);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: MY_ORDERS_KEY });
    },
  });
}
