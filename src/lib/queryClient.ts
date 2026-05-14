import { QueryClient, onlineManager, focusManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { AppState, type AppStateStatus } from 'react-native';
import { toast } from '@/shared/ui/toast';
import { AuthRequiredError } from '@/features/marketplace/services/products';
import { ListingCapReachedError, RateLimitError } from '@/features/marketplace/errors';
import { StripeNotConfiguredError } from '@/features/marketplace/services/orders';
import { EmailNotConfirmedError } from '@/stores/useAuthStore';
import { captureException } from '@/lib/sentry';
import i18n from '@/i18n';

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

// Global mutation error handler. TanStack v5 fires this BEFORE any
// mutation-level onError, so callers that already surface their own
// Alert/toast (login, register, newPost) will double up — acceptable for
// v1, tracked as a follow-up to migrate those to typed errors so this
// handler can suppress its default for them.
//
// Hard-coded English fallbacks ensure something readable shows even if
// i18n.t fails (init race, missing key, etc.).
function defaultMutationErrorHandler(error: unknown): void {
  if (error instanceof AuthRequiredError) {
    toast.error(i18n.t('errors.authRequired') || 'Sign in to continue');
    return;
  }
  if (error instanceof EmailNotConfirmedError) {
    toast.error(i18n.t('errors.emailNotConfirmed') || 'Please confirm your email');
    return;
  }
  if (error instanceof ListingCapReachedError) {
    // Already surfaced via Alert by newPost.tsx; suppress to avoid double UI.
    return;
  }
  if (error instanceof RateLimitError) {
    toast.error(i18n.t('errors.rateLimited') || 'Slow down a bit');
    return;
  }
  if (error instanceof StripeNotConfiguredError) {
    toast.error(i18n.t('errors.checkoutUnavailable') || 'Checkout is unavailable right now');
    return;
  }
  // Unknown / unexpected error — capture for Sentry visibility.
  captureException(error, { handler: 'globalMutationOnError' });
  const msg = error instanceof Error ? error.message : String(error);
  toast.error(
    i18n.t('common.errorGeneric') || 'Something went wrong',
    __DEV__ ? msg : undefined,
  );
}

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
    mutations: {
      // Three retries with exponential backoff: attempt 0 immediate,
      // 1 after ~1s, 2 after ~2s, 3 after ~4s (capped). Total ceiling
      // ~7s of auto-retry before the user sees a toast. Safe to bump
      // now that Phase 7 wired client_request_id idempotency keys for
      // messages + products; toggle-likes / bookmarks / follows are
      // naturally idempotent under retry already.
      //
      // Typed errors that will never succeed short-circuit the retry
      // chain so the user gets the localized toast on the first try.
      retry: (failureCount, error) => {
        if (error instanceof AuthRequiredError) return false;
        if (error instanceof EmailNotConfirmedError) return false;
        if (error instanceof RateLimitError) return false;
        if (error instanceof ListingCapReachedError) return false;
        return failureCount < 3;
      },
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
      onError: defaultMutationErrorHandler,
    },
  },
});
