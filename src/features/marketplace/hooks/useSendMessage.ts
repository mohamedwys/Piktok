import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  sendMessage,
  type ChatMessage,
  type MessageKind,
} from '@/features/marketplace/services/messaging';
import { sendPushNotification } from '@/services/pushNotifications';
import { useAuthStore } from '@/stores/useAuthStore';
import { captureEvent } from '@/lib/posthog';
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

// Context object threaded onMutate -> onSuccess / onError so the temp-row
// swap (or rollback) can locate the optimistic bubble by its temp id.
type Ctx = { tempId: string };

export function useSendMessage(
  conversationId: string | null,
  pushTarget?: PushTarget | null,
) {
  const qc = useQueryClient();
  // Captured once at hook mount. Conversation screens remount on sign-in
  // changes, so this is safe — no risk of writing an optimistic bubble
  // attributed to a stale user id.
  const myUserId = useAuthStore.getState().user?.id;
  return useMutation<ChatMessage, Error, SendMessageInput, Ctx>({
    mutationFn: async ({ body, kind, offerAmount }) => {
      if (!conversationId) throw new Error('No conversation');
      // One UUID per logical send — preserved across the mutation's
      // automatic retries so a 23505 on retry re-selects the row that
      // won the race instead of inserting a duplicate.
      const clientRequestId = globalThis.crypto.randomUUID();
      return sendMessage({ conversationId, body, kind, offerAmount, clientRequestId });
    },
    onMutate: async (vars) => {
      if (!conversationId || !myUserId) return { tempId: '' };
      // Cancel in-flight refetches so they can't overwrite the optimistic
      // append after we set it.
      await qc.cancelQueries({ queryKey: ['messaging', 'messages', conversationId] });
      const tempId = `temp-${globalThis.crypto.randomUUID()}`;
      const optimistic: ChatMessage = {
        id: tempId,
        conversationId,
        senderId: myUserId,
        body: vars.body,
        kind: vars.kind ?? 'text',
        offerAmount: vars.offerAmount ?? null,
        createdAt: new Date().toISOString(),
      };
      qc.setQueryData<ChatMessage[]>(
        ['messaging', 'messages', conversationId],
        (prev) => (prev ? [...prev, optimistic] : [optimistic]),
      );
      return { tempId };
    },
    onSuccess: (serverRow, vars, ctx) => {
      if (!conversationId || !ctx?.tempId) return;
      // Swap the temp row's id to the server id in place. useMessages's
      // realtime subscription dedups by id, so once the swap lands the
      // inbound echo for this message is a no-op.
      qc.setQueryData<ChatMessage[]>(
        ['messaging', 'messages', conversationId],
        (prev) =>
          prev?.map((m) => (m.id === ctx.tempId ? serverRow : m)) ?? [serverRow],
      );
      void qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });

      captureEvent('message_sent', { is_offer: vars.kind === 'offer' });

      if (pushTarget?.recipientUserId) {
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
    onError: (_err, _vars, ctx) => {
      if (!conversationId || !ctx?.tempId) return;
      qc.setQueryData<ChatMessage[]>(
        ['messaging', 'messages', conversationId],
        (prev) => prev?.filter((m) => m.id !== ctx.tempId) ?? [],
      );
    },
  });
}
