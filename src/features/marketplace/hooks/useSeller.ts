import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getSellerById, type SellerProfile } from '@/features/marketplace/services/sellers';

export function useSeller(
  id: string | null | undefined,
): UseQueryResult<SellerProfile | null, Error> {
  return useQuery<SellerProfile | null, Error>({
    queryKey: ['seller', 'byId', id],
    queryFn: () => (id ? getSellerById(id) : Promise.resolve(null)),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}
