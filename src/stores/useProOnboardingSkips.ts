import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { mmkvStorage } from '@shared/storage/mmkv';

/**
 * Persistent skip flags for the post-IAP Pro onboarding checklist
 * (Track 6 / Step 2 of the 5-step onboarding wizard).
 *
 * Only Steps 3 and 4 are skippable. Step 2 (complete your seller
 * profile) is intentionally NOT skippable — it is the highest-value
 * step and remains visible until the underlying bio + location
 * fields are actually populated on the sellers row.
 *
 * Persistence shape mirrors `useDismissedBanners` — Zustand `persist`
 * middleware + JSON storage backed by MMKV. The store key is
 * versioned so a future state-shape migration is clean.
 */
export type SkippableStep = 'step3' | 'step4';

type ProOnboardingSkipsState = {
  step3Skipped: boolean;
  step4Skipped: boolean;
  skipStep: (step: SkippableStep) => void;
};

export const useProOnboardingSkips = create<ProOnboardingSkipsState>()(
  persist(
    (set) => ({
      step3Skipped: false,
      step4Skipped: false,
      skipStep: (step) =>
        set(() =>
          step === 'step3'
            ? { step3Skipped: true }
            : { step4Skipped: true },
        ),
    }),
    {
      name: 'pro-onboarding-skips-v1',
      version: 1,
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
