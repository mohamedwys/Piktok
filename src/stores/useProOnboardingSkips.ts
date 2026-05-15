import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { mmkvStorage } from '@shared/storage/mmkv';

/**
 * Persistent skip flags for the post-IAP Pro onboarding checklist
 * (Track 6 / Step 2 of the 5-step onboarding wizard).
 *
 * Only Steps 4 (Buy Now) and 5 (Boost) are skippable. Step 2
 * (complete your seller profile) and Step 3 (Connect Stripe) are
 * intentionally NOT skippable — Connect gates Buy Now and is the
 * highest-value step in the F.C.6 retrofit.
 *
 * Persistence shape mirrors `useDismissedBanners` — Zustand `persist`
 * middleware + JSON storage backed by MMKV. Version bumped to 2 in
 * F.C.6 when the renumber landed: a v1 user who skipped Buy Now (old
 * step3) or Boost (old step4) is migrated to step4Skipped / step5Skipped
 * so they don't see those rows reappear.
 */
export type SkippableStep = 'step4' | 'step5';

type ProOnboardingSkipsState = {
  step4Skipped: boolean;
  step5Skipped: boolean;
  skipStep: (step: SkippableStep) => void;
};

type PersistedV1 = {
  step3Skipped?: boolean;
  step4Skipped?: boolean;
};

export const useProOnboardingSkips = create<ProOnboardingSkipsState>()(
  persist(
    (set) => ({
      step4Skipped: false,
      step5Skipped: false,
      skipStep: (step) =>
        set(() =>
          step === 'step4'
            ? { step4Skipped: true }
            : { step5Skipped: true },
        ),
    }),
    {
      name: 'pro-onboarding-skips-v1',
      version: 2,
      storage: createJSONStorage(() => mmkvStorage),
      migrate: (persisted, version) => {
        if (version < 2) {
          const v1 = (persisted ?? {}) as PersistedV1;
          return {
            step4Skipped: v1.step3Skipped === true,
            step5Skipped: v1.step4Skipped === true,
          } as ProOnboardingSkipsState;
        }
        return persisted as ProOnboardingSkipsState;
      },
    },
  ),
);
