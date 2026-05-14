import { useAuthStore } from '@/stores/useAuthStore';
import { useMySeller } from '@/features/marketplace/hooks/useMySeller';
import { useMyProducts } from '@/features/marketplace/hooks/useMyProducts';
import { useIsPro } from '@/features/marketplace/hooks/useIsPro';
import { useProOnboardingSkips } from '@/stores/useProOnboardingSkips';

/**
 * Derived state for the post-IAP onboarding checklist that lives on
 * the profile screen (Track 6 / Steps 2–4 of the 5-step wizard).
 *
 * Every "done" predicate is computed from data the app already
 * fetches — sellers row (bio, locationText, lastBoostAt), products
 * list (purchase_mode), and the local MMKV skip flags. No new DB
 * columns and no new queries.
 *
 * Visibility rule: card is visible iff the user is Pro AND at least
 * one step is still outstanding. Once all three steps are done (or
 * skipped, where skipping is allowed) the card disappears entirely
 * — v1 intentionally has no "100% complete" celebration row.
 */
export type ProOnboardingState = {
  visible: boolean;
  step2Done: boolean;
  step3Done: boolean;
  step4Done: boolean;
  allDone: boolean;
  progress: number;
};

export function useProOnboardingState(): ProOnboardingState {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isPro = useIsPro();
  const sellerQuery = useMySeller(isAuthenticated);
  const productsQuery = useMyProducts(isAuthenticated);
  const step3Skipped = useProOnboardingSkips((s) => s.step3Skipped);
  const step4Skipped = useProOnboardingSkips((s) => s.step4Skipped);

  const seller = sellerQuery.data;
  const products = productsQuery.data;

  const bioFilled = (seller?.bio?.trim().length ?? 0) > 0;
  const locationFilled = (seller?.locationText?.trim().length ?? 0) > 0;
  const step2Done = bioFilled && locationFilled;

  const hasBuyNowListing =
    products?.some((p) => p.purchaseMode === 'buy_now') === true;
  const step3Done = hasBuyNowListing || step3Skipped;

  const step4Done = seller?.lastBoostAt != null || step4Skipped;

  const doneCount =
    (step2Done ? 1 : 0) + (step3Done ? 1 : 0) + (step4Done ? 1 : 0);
  const allDone = doneCount === 3;
  const progress = doneCount / 3;
  const visible = isPro && !allDone;

  return { visible, step2Done, step3Done, step4Done, allDone, progress };
}
