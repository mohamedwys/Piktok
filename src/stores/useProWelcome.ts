import { create } from 'zustand';

/**
 * One-shot in-memory flag controlling the post-IAP welcome modal
 * (Track 6 / Step 1 of the 5-step onboarding wizard).
 *
 * In-memory by design: the modal is a single celebratory moment that
 * fires immediately after a successful IAP within the same session,
 * and should NOT replay on the next cold-start of the app. The
 * upgrade-flow hook flips `visible` true after the subscription
 * cache invalidation; `ProWelcomeModalHost` reads the flag, opens
 * the modal with a small delay (G10 race window for the cap-modal
 * close animation), then flips it back to false on any dismiss.
 */
type ProWelcomeState = {
  visible: boolean;
  show: () => void;
  hide: () => void;
};

export const useProWelcome = create<ProWelcomeState>((set) => ({
  visible: false,
  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),
}));
