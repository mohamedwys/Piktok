import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  sendMessage,
  type MessageKind,
} from '@/features/marketplace/services/messaging';
import { CONVERSATIONS_KEY } from './useConversations';

export function useSendMessage(conversationId: string | null) {
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    { body: string; kind?: MessageKind; offerAmount?: number }
  >({
    mutationFn: async ({ body, kind, offerAmount }) => {
      if (!conversationId) throw new Error('No conversation');
      await sendMessage({ conversationId, body, kind, offerAmount });
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['messaging', 'messages', conversationId],
      });
      qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}
