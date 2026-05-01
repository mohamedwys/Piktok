import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type MarketplaceFilters = {
  query: string;
  categoryId: string | null;
  subcategoryId: string | null;
  priceMax: number | null;
  pickupOnly: boolean;
  locationQuery: string;
};

const INITIAL_FILTERS: MarketplaceFilters = {
  query: '',
  categoryId: null,
  subcategoryId: null,
  priceMax: null,
  pickupOnly: false,
  locationQuery: '',
};

type Store = {
  filters: MarketplaceFilters;
  setFilters: (patch: Partial<MarketplaceFilters>) => void;
  resetFilters: () => void;
};

export const useMarketplaceFilters = create<Store>()(
  persist(
    (set) => ({
      filters: INITIAL_FILTERS,
      setFilters: (patch) =>
        set((state) => ({ filters: { ...state.filters, ...patch } })),
      resetFilters: () => set({ filters: INITIAL_FILTERS }),
    }),
    {
      name: 'marketplace-filters',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export function hasActiveFilters(f: MarketplaceFilters): boolean {
  return (
    f.query.trim().length > 0 ||
    f.categoryId !== null ||
    f.subcategoryId !== null ||
    f.priceMax !== null ||
    f.pickupOnly ||
    f.locationQuery.trim().length > 0
  );
}

export function activeFilterCount(f: MarketplaceFilters): number {
  let n = 0;
  if (f.query.trim().length > 0) n++;
  if (f.categoryId !== null) n++;
  if (f.subcategoryId !== null) n++;
  if (f.priceMax !== null) n++;
  if (f.pickupOnly) n++;
  if (f.locationQuery.trim().length > 0) n++;
  return n;
}
