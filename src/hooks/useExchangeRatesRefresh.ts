import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useExchangeRates } from '@/stores/useExchangeRates';

/**
 * Side-effect hook that keeps the exchange-rate cache fresh.
 *
 *   • On mount: fire `refreshIfStale()` to refetch when the
 *     persisted snapshot is older than the 12h window (or absent).
 *   • On AppState → 'active': re-run the staleness check, so a
 *     long-backgrounded session picks up new rates as soon as the
 *     user returns to the app.
 *
 * Intended to mount exactly once at the root layout level. Failure
 * is silent — the rates store fails soft and keeps the last known
 * snapshot, and the formatter degrades to product-currency display
 * when rates are missing entirely.
 */
export function useExchangeRatesRefresh(): void {
  useEffect(() => {
    const refreshIfStale = useExchangeRates.getState().refreshIfStale;
    void refreshIfStale();

    const handleChange = (next: AppStateStatus): void => {
      if (next === 'active') {
        void useExchangeRates.getState().refreshIfStale();
      }
    };

    const sub = AppState.addEventListener('change', handleChange);
    return () => {
      sub.remove();
    };
  }, []);
}
