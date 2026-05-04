import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';
import { WEB_BASE_URL, WEB_UPGRADE_PATH } from '@/lib/web/constants';

/**
 * Returns the single "open the Pro upgrade flow" handler used by every
 * Pro upsell affordance in the app:
 *   - The cap-modal "Upgrade to Pro" button in newPost.tsx (H.3)
 *   - The sell-flow banner CTA (H.4)
 *   - The profile-screen pitch banner CTA (H.4)
 *   - The action-rail own-non-Pro checkout-gate button (H.4)
 *
 * The flow:
 *   1. Invoke the `issue-web-session` Edge Function (H.5). The function
 *      verifies the caller's auth, mints a single-use Supabase magic-link
 *      URL pointing at `WEB_BASE_URL + WEB_UPGRADE_PATH`, and returns it.
 *   2. Open the magic-link URL in an in-app browser via
 *      `WebBrowser.openBrowserAsync`. Clicking the link auto-authenticates
 *      the user on the web side, then redirects to the upgrade page —
 *      no second login.
 *   3. **Soft fallback.** If the Edge Function fails (network error,
 *      function not deployed yet during dev, transient Supabase issue),
 *      fall back to opening the bare `WEB_BASE_URL + WEB_UPGRADE_PATH`.
 *      The web side will require login but the upgrade flow itself
 *      still works. Better than blocking the user behind an error
 *      modal.
 *   4. Hard fail (e.g., `expo-web-browser` itself rejects) → surface a
 *      generic error Alert (`pro.upgradeError*` keys).
 *
 * **Reentrancy.** Wrapped in a `useRef` flag — rapid taps on a CTA do
 * not fire the Edge Function multiple times, do not stack in-app
 * browsers. The flag clears in `finally` so a transient failure
 * doesn't lock the user out of retrying.
 *
 * **Return type.** `() => Promise<void>` is assignable to React Native's
 * `onPress: () => void` — the consumer doesn't need to await; the
 * async work happens internally. H.4 banner / H.3 cap-modal call sites
 * pass this as `onPress` directly without changes.
 *
 * **Single integration point.** When the brand domain is finalized
 * (PRO_AUDIT.md §10), edit only `WEB_BASE_URL` in
 * `src/lib/web/constants.ts`. The Edge Function reads its companion
 * value from the `WEB_BASE_URL` Supabase secret.
 */
export function useUpgradeFlow(): () => Promise<void> {
  const { t } = useTranslation();
  const inFlight = useRef(false);

  return useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      // Step 1 — try to mint a magic link via the Edge Function.
      const { data, error } = await supabase.functions.invoke(
        'issue-web-session',
        { body: { redirect_to: WEB_UPGRADE_PATH } },
      );

      // Step 2 — pick the URL. Soft-fallback on any Edge-Function-side
      //         error (or a malformed payload) to the bare web URL so the
      //         upgrade affordance is never a dead-end.
      const minted = (data as { url?: unknown } | null)?.url;
      const urlToOpen =
        !error && typeof minted === 'string' && minted.length > 0
          ? minted
          : `${WEB_BASE_URL}${WEB_UPGRADE_PATH}`;

      // Step 3 — open in-app browser. PAGE_SHEET on iOS is the same
      //         presentation as the existing checkout flow at
      //         ProductDetailSheet.tsx so the upgrade UX feels cohesive.
      await WebBrowser.openBrowserAsync(urlToOpen, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });
    } catch {
      Alert.alert(t('pro.upgradeErrorTitle'), t('pro.upgradeErrorBody'));
    } finally {
      inFlight.current = false;
    }
  }, [t]);
}
