import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  CURRENCY_PREFERENCE_KEY,
  CURRENCY_PREFERENCE_VERSION,
  DEFAULT_CURRENCY,
} from '@/lib/currency/constants';
import { countryToCurrency } from '@/lib/currency/country-currency-map';

export type DisplayCurrencySource = 'auto' | 'manual';

export type DisplayCurrencyData = {
  currency: string;
  source: DisplayCurrencySource;
};

export type DisplayCurrencyActions = {
  setManual: (currency: string) => void;
  setAuto: () => void;
};

export type DisplayCurrencyStore = DisplayCurrencyData & DisplayCurrencyActions;

/**
 * 3-tier auto-detection per CURRENCY_AUDIT.md §7.
 *
 *   1. Localization.getLocales()[0]?.currencyCode  — Apple/Google
 *      authoritative mapping derived from device region settings.
 *      Covers ~99% of real users.
 *   2. countryToCurrency(regionCode)               — fallback for
 *      simulators / unusual region setups.
 *   3. DEFAULT_CURRENCY                            — final fallback.
 *
 * Mirrors `src/i18n/index.ts:detectInitialLanguage` for consistency
 * with the existing locale-detection pattern.
 */
function detectCurrency(): string {
  const first = Localization.getLocales()[0];
  if (!first) return DEFAULT_CURRENCY;

  const direct = first.currencyCode;
  if (direct && typeof direct === 'string') {
    return direct.toUpperCase();
  }

  const region = first.regionCode;
  if (region) return countryToCurrency(region);

  return DEFAULT_CURRENCY;
}

const INITIAL_DATA: DisplayCurrencyData = {
  currency: detectCurrency(),
  source: 'auto',
};

export const useDisplayCurrency = create<DisplayCurrencyStore>()(
  persist(
    (set) => ({
      ...INITIAL_DATA,

      setManual: (currency) => {
        const trimmed = currency.trim().toUpperCase();
        if (trimmed.length === 0) return;
        set({ currency: trimmed, source: 'manual' });
      },

      setAuto: () => {
        set({ currency: detectCurrency(), source: 'auto' });
      },
    }),
    {
      name: CURRENCY_PREFERENCE_KEY,
      version: CURRENCY_PREFERENCE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currency: state.currency,
        source: state.source,
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      migrate: (persistedState: any, _fromVersion: number) => {
        // No migrations needed at v1. Future schema changes land here.
        return persistedState;
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Defensive: corrupted/empty currency falls back to fresh
        // detection.
        if (typeof state.currency !== 'string' || state.currency.length === 0) {
          state.currency = detectCurrency();
          state.source = 'auto';
          return;
        }
        // Auto-mode rehydrates: re-run detection so users moving
        // regions pick up the change. Manual rehydrates as-is.
        if (state.source === 'auto') {
          state.currency = detectCurrency();
        }
      },
    },
  ),
);
