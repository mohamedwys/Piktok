import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  sendMessage,
  type MessageKind,
} from '@/features/marketplace/services/messaging';
import { sendPushNotification } from '@/services/pushNotifications';
import { CONVERSATIONS_KEY } from './useConversations';

type SendMessageInput = {
  body: string;
  kind?: MessageKind;
  offerAmount?: number;
};

type PushTarget = {
  recipientUserId: string;
  senderName: string;
};

export function useSendMessage(
  conversationId: string | null,
  pushTarget?: PushTarget | null,
) {
  const qc = useQueryClient();
  return useMutation<void, Error, SendMessageInput>({
    mutationFn: async ({ body, kind, offerAmount }) => {
      if (!conversationId) throw new Error('No conversation');
      await sendMessage({ conversationId, body, kind, offerAmount });
    },
    onSuccess: (_void, vars) => {
      qc.invalidateQueries({
        queryKey: ['messaging', 'messages', conversationId],
      });
      qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });

      if (pushTarget?.recipientUserId && conversationId) {
        const isOffer = vars.kind === 'offer';
        const preview = isOffer
          ? 'Sent you an offer'
          : vars.body.length > 80
            ? `${vars.body.slice(0, 80)}…`
            : vars.body;
        void sendPushNotification({
          recipientUserId: pushTarget.recipientUserId,
          conversationId,
          title: pushTarget.senderName || 'New message',
          body: preview,
          data: { conversation_id: conversationId },
        });
      }
    },
  });
}
