import { useEffect } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  listMessages,
  subscribeToMessages,
  type ChatMessage,
} from '@/features/marketplace/services/messaging';

export function useMessages(conversationId: string | null): UseQueryResult<ChatMessage[], Error> {
  const qc = useQueryClient();
  const key = ['messaging', 'messages', conversationId];
  const result = useQuery<ChatMessage[], Error>({
    queryKey: key,
    queryFn: () =>
      conversationId ? listMessages(conversationId) : Promise.resolve([]),
    enabled: !!conversationId,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!conversationId) return;
    const unsub = subscribeToMessages(conversationId, (msg) => {
      qc.setQueryData<ChatMessage[]>(key, (prev) => {
        if (!prev) return [msg];
        if (prev.find((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, qc]);

  return result;
}
