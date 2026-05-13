import { useMutation, useQueryClient } from '@tanstack/react-query';
import { startOrGetConversation } from '@/features/marketplace/services/messaging';
import { CONVERSATIONS_KEY } from './useConversations';

export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation<string, Error, string>({
    mutationFn: startOrGetConversation,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}
