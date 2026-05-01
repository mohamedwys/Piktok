import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  getConversationById,
  type ConversationItem,
} from '@/features/marketplace/services/messaging';

export function useConversation(
  id: string | null,
): UseQueryResult<ConversationItem | null, Error> {
  return useQuery<ConversationItem | null, Error>({
    queryKey: ['messaging', 'conversation', id],
    queryFn: () => (id ? getConversationById(id) : Promise.resolve(null)),
    enabled: !!id,
    staleTime: 60_000,
  });
}
