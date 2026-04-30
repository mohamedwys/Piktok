import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  listUserEngagement,
  type UserEngagement,
} from '@/features/marketplace/services/products';

export const USER_ENGAGEMENT_QUERY_KEY = ['marketplace', 'engagement'] as const;

export function useUserEngagement(): UseQueryResult<UserEngagement, Error> {
  return useQuery<UserEngagement, Error>({
    queryKey: USER_ENGAGEMENT_QUERY_KEY,
    queryFn: listUserEngagement,
    staleTime: 5 * 60_000,
  });
}
