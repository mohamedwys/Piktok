import { useEffect } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  listConversations,
  subscribeToConversations,
  type ConversationItem,
} from '@/features/marketplace/services/messaging';

export const CONVERSATIONS_KEY = ['messaging', 'conversations'] as const;

export function useConversations(enabled: boolean): UseQueryResult<ConversationItem[], Error> {
  const qc = useQueryClient();
  const result = useQuery<ConversationItem[], Error>({
    queryKey: CONVERSATIONS_KEY,
    queryFn: listConversations,
    enabled,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!enabled) return;
    const unsub = subscribeToConversations(() => {
      void qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    });
    return unsub;
  }, [enabled, qc]);

  return result;
}
