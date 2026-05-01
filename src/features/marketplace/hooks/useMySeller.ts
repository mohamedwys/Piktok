import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getMySeller, type SellerProfile } from '@/features/marketplace/services/sellers';

export const MY_SELLER_KEY = ['marketplace', 'my-seller'] as const;

export function useMySeller(enabled: boolean): UseQueryResult<SellerProfile | null, Error> {
  return useQuery<SellerProfile | null, Error>({
    queryKey: MY_SELLER_KEY,
    queryFn: getMySeller,
    enabled,
    staleTime: 5 * 60_000,
  });
}
