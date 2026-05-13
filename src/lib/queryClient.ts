import { QueryClient, onlineManager, focusManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { AppState, type AppStateStatus } from 'react-native';

onlineManager.setEventListener((setOnline) => {
  const sub = NetInfo.addEventListener((s) => setOnline(!!s.isConnected));
  return () => sub();
});

const onAppStateChange = (status: AppStateStatus) => {
  focusManager.setFocused(status === 'active');
};

// App-lifetime listener; AppState only dispatches one event per change so
// the cost is constant. No need to unsubscribe.
AppState.addEventListener('change', onAppStateChange);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: 1 },
  },
});
