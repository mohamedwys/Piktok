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
    const unsub = subscribeToConversations((event) => {
      qc.setQueryData<ConversationItem[]>(CONVERSATIONS_KEY, (prev) => {
        if (!prev) return prev;

        if (event.kind === 'message_inserted') {
          const idx = prev.findIndex(
            (c) => c.id === event.row.conversation_id,
          );
          // New conversation we haven't seen — refetch to pick up joined
          // product/seller data.
          if (idx === -1) {
            void qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
            return prev;
          }
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx]!,
            lastMessageAt: event.row.created_at,
            lastMessagePreview: event.row.body,
          };
          updated.sort((a, b) =>
            b.lastMessageAt.localeCompare(a.lastMessageAt),
          );
          return updated;
        }

        // conversation_changed
        if (event.eventType === 'DELETE') {
          return prev.filter((c) => c.id !== event.row.id);
        }
        // INSERT lacks joined product/seller data — fall back to refetch.
        if (event.eventType === 'INSERT') {
          void qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
          return prev;
        }
        // UPDATE: patch the row in place.
        const idx = prev.findIndex((c) => c.id === event.row.id);
        if (idx === -1) return prev;
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx]!,
          lastMessageAt: event.row.last_message_at,
          lastMessagePreview: event.row.last_message_preview,
        };
        return updated;
      });
    });
    return unsub;
  }, [enabled, qc]);

  return result;
}
