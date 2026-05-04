import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Banner identifiers. Adding a new upsell surface? Extend this union and
 * the `BANNER_KEYS` array below. The store is forward-compatible — a
 * future `BannerKey` not present in persisted state simply reads as
 * "not dismissed" because `dismissals[key]` is `undefined`.
 */
export type BannerKey =
  | 'sell-flow-cap'
  | 'profile-pro-pitch'
  | 'checkout-gate';

/**
 * Re-exported as a runtime array for any consumer that wants to iterate
 * (e.g., a future "restore dismissed banners" admin affordance, which is
 * deliberately NOT shipped in v1 per the H.4 spec).
 */
export const BANNER_KEYS: readonly BannerKey[] = [
  'sell-flow-cap',
  'profile-pro-pitch',
  'checkout-gate',
] as const;

/**
 * 24-hour cooldown. Dismiss a banner → it stays hidden for the next
 * 24h, then re-appears. Chosen over session-only because session
 * dismissal would re-show the banner on every app cold-start (annoying
 * for power users) and over permanent dismissal because permanent
 * dismissal eliminates the upsell entirely (defeats the purpose of a
 * persistent CTA strategy).
 *
 * Per-banner-key, NOT global: dismissing the sell-flow banner does NOT
 * dismiss the profile banner. Each surface has its own cooldown clock.
 */
const DISMISSAL_COOLDOWN_MS = 24 * 60 * 60 * 1000;

type DismissedBannersState = {
  /** Map of banner key → dismiss timestamp (Date.now() at dismiss time). */
  dismissals: Partial<Record<BannerKey, number>>;
  /** Mark a banner as dismissed now. Persists to AsyncStorage. */
  dismiss: (key: BannerKey) => void;
  /** True iff the banner was dismissed within the last 24h. */
  isDismissed: (key: BannerKey) => boolean;
};

/**
 * Zustand store backing the per-banner 24h-cooldown dismissal logic.
 *
 * Persistence: same `persist` + `createJSONStorage(AsyncStorage)` shape
 * as `useMarketplaceFilters` (src/stores/useMarketplaceFilters.ts) and
 * H'.2's `useDisplayCurrency`. Storage key `dismissed-banners-v1` is
 * versioned so a future state-shape migration is clean.
 *
 * Why a store rather than per-component AsyncStorage reads: hot-path
 * banner-visibility decisions need to be synchronous in render. The
 * Zustand store rehydrates once at app boot and exposes synchronous
 * selectors thereafter; `AsyncStorage.getItem` would require an async
 * boundary that doesn't compose with the existing render pattern.
 */
export const useDismissedBanners = create<DismissedBannersState>()(
  persist(
    (set, get) => ({
      dismissals: {},
      dismiss: (key) =>
        set((state) => ({
          dismissals: { ...state.dismissals, [key]: Date.now() },
        })),
      isDismissed: (key) => {
        const ts = get().dismissals[key];
        if (typeof ts !== 'number') return false;
        return Date.now() - ts < DISMISSAL_COOLDOWN_MS;
      },
    }),
    {
      name: 'dismissed-banners-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
