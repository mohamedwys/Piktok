import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { mmkvStorage } from '@shared/storage/mmkv';
import {
  CURRENCY_RATES_CACHE_KEY,
  CURRENCY_RATES_VERSION,
} from '@/lib/currency/constants';
import {
  fetchExchangeRates,
  isStale,
  type ExchangeRateSnapshot,
} from '@/lib/currency/exchangeRates';

export type ExchangeRatesData = {
  snapshot: ExchangeRateSnapshot | null;
  loading: boolean;
  error: string | null;
};

export type ExchangeRatesActions = {
  refresh: () => Promise<void>;
  refreshIfStale: () => Promise<void>;
};

export type ExchangeRatesStore = ExchangeRatesData & ExchangeRatesActions;

const INITIAL_DATA: ExchangeRatesData = {
  snapshot: null,
  loading: false,
  error: null,
};

export const useExchangeRates = create<ExchangeRatesStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_DATA,

      refresh: async () => {
        if (get().loading) return;
        set({ loading: true, error: null });
        try {
          const snap = await fetchExchangeRates();
          set({ snapshot: snap, loading: false, error: null });
        } catch (err) {
          // Fail soft — keep last known snapshot if any. The
          // formatter will degrade to product-currency display
          // when rates are missing.
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'unknown',
          });
        }
      },

      refreshIfStale: async () => {
        const { snapshot, loading } = get();
        if (loading) return;
        if (!isStale(snapshot)) return;
        await get().refresh();
      },
    }),
    {
      name: CURRENCY_RATES_CACHE_KEY,
      version: CURRENCY_RATES_VERSION,
      storage: createJSONStorage(() => mmkvStorage),
      // Persist only the cached snapshot — `loading` and `error`
      // are runtime state and should not survive restarts.
      partialize: (state) => ({ snapshot: state.snapshot }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      migrate: (persistedState: any, _fromVersion: number) => {
        // No migrations needed at v1.
        return persistedState;
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Defensive: corrupted shape → drop cache, force refetch.
        const snap = state.snapshot;
        const valid =
          snap !== null &&
          typeof snap === 'object' &&
          typeof snap.base === 'string' &&
          typeof snap.fetchedAt === 'number' &&
          snap.rates !== null &&
          typeof snap.rates === 'object';
        if (snap !== null && !valid) {
          state.snapshot = null;
        }
      },
    },
  ),
);
