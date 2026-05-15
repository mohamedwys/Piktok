import { useAuthStore } from '@/stores/useAuthStore';
import { useMySeller } from '@/features/marketplace/hooks/useMySeller';
import { useMyProducts } from '@/features/marketplace/hooks/useMyProducts';
import { useIsPro } from '@/features/marketplace/hooks/useIsPro';
import { useProOnboardingSkips } from '@/stores/useProOnboardingSkips';

/**
 * Derived state for the post-IAP onboarding checklist that lives on
 * the profile screen (Track 6 / Steps 2–5 of the 5-step wizard).
 *
 * Every "done" predicate is computed from data the app already
 * fetches — sellers row (bio, locationText, stripeChargesEnabled,
 * lastBoostAt), products list (purchase_mode), and the local MMKV
 * skip flags. No new DB columns and no new queries.
 *
 * Step 3 (Connect Stripe) is the F.C.6 retrofit mirroring the web
 * checklist (F.C.4). Done when the seller's Stripe Connect account
 * has cleared `charges_enabled` — webhook-mirrored on the sellers row
 * by F.C.1. Not skippable: Buy Now (step 4) is gated on it.
 *
 * Visibility rule: card is visible iff the user is Pro AND at least
 * one step is still outstanding. Once all four steps are done (or
 * skipped, where skipping is allowed) the card disappears entirely
 * — v1 intentionally has no "100% complete" celebration row.
 */
export type ProOnboardingState = {
  visible: boolean;
  step2Done: boolean;
  step3Done: boolean;
  step4Done: boolean;
  step5Done: boolean;
  allDone: boolean;
  progress: number;
};

export function useProOnboardingState(): ProOnboardingState {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isPro = useIsPro();
  const sellerQuery = useMySeller(isAuthenticated);
  const productsQuery = useMyProducts(isAuthenticated);
  const step4Skipped = useProOnboardingSkips((s) => s.step4Skipped);
  const step5Skipped = useProOnboardingSkips((s) => s.step5Skipped);

  const seller = sellerQuery.data;
  const products = productsQuery.data;

  const bioFilled = (seller?.bio?.trim().length ?? 0) > 0;
  const locationFilled = (seller?.locationText?.trim().length ?? 0) > 0;
  const step2Done = bioFilled && locationFilled;

  const step3Done = seller?.stripeChargesEnabled === true;

  const hasBuyNowListing =
    products?.some((p) => p.purchaseMode === 'buy_now') === true;
  const step4Done = hasBuyNowListing || step4Skipped;

  const step5Done = seller?.lastBoostAt != null || step5Skipped;

  const doneCount =
    (step2Done ? 1 : 0)
    + (step3Done ? 1 : 0)
    + (step4Done ? 1 : 0)
    + (step5Done ? 1 : 0);
  const allDone = doneCount === 4;
  const progress = doneCount / 4;
  const visible = isPro && !allDone;

  return {
    visible,
    step2Done,
    step3Done,
    step4Done,
    step5Done,
    allDone,
    progress,
  };
}
