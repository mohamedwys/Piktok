import { useConversations } from './useConversations';
import { useAuthStore } from '@/stores/useAuthStore';

// Phase 3 placeholder. Phase 7 will add an `unread_count` field via the
// conversations RPC; until then this returns 0. Wired now so the tab
// bar has a single owner and Phase 7 lands without touching consumers.
export function useUnreadConversationsCount(): number {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data } = useConversations(isAuthenticated);
  if (!data) return 0;
  return 0;
}
