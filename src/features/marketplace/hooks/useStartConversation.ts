import { useMutation } from '@tanstack/react-query';
import { startOrGetConversation } from '@/features/marketplace/services/messaging';

export function useStartConversation() {
  return useMutation<string, Error, string>({
    mutationFn: startOrGetConversation,
  });
}
