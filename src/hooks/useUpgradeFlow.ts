import { useCallback, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import { useQueryClient } from '@tanstack/react-query';
import {
  ErrorCode,
  fetchProducts,
  finishTransaction,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type ProductSubscription,
  type Purchase,
} from 'expo-iap';
import { supabase } from '@/lib/supabase';
import { MY_SUBSCRIPTION_KEY } from '@/features/marketplace/hooks/useMySubscription';
import { WEB_BASE_URL, WEB_UPGRADE_PATH } from '@/lib/web/constants';

const PRODUCT_ID = 'mony_pro_monthly';

/**
 * Returns the single "open the Pro upgrade flow" handler used by every
 * Pro upsell affordance in the app:
 *   - The cap-modal "Upgrade to Pro" button in newPost.tsx (H.3)
 *   - The sell-flow banner CTA (H.4)
 *   - The profile-screen pitch banner CTA (H.4)
 *   - The action-rail own-non-Pro checkout-gate button (H.4)
 *
 * Platform branching (Phase 8 / Track A):
 *   - iOS / Android — native IAP via expo-iap. fetchProducts + requestPurchase
 *     against `mony_pro_monthly`; the resulting receipt (iOS JWS or Android
 *     purchaseToken — both surfaced under the unified `purchase.purchaseToken`
 *     field) is posted to the `validate-iap-receipt` edge function which
 *     upserts the subscriptions row. The handle_subscription_change trigger
 *     then flips sellers.is_pro.
 *   - Web — unchanged from pre-Track-A: issue-web-session edge function
 *     mints a Supabase magic link to the Next.js companion's /upgrade page,
 *     opened in an in-app browser.
 *
 * Event-based purchase API. expo-iap delivers the purchase outcome via
 * `purchaseUpdatedListener` / `purchaseErrorListener` — NOT the
 * `requestPurchase` return value. Wrapped here in a single-shot Promise so
 * the surrounding hook keeps a simple async signature.
 *
 * Reentrancy. The useRef flag guards against rapid taps stacking IAP
 * sheets or in-app browsers. Cleared in `finally` so a transient failure
 * doesn't lock the user out of retrying.
 *
 * Error policy. User cancellation (ErrorCode.UserCancelled, or a message
 * containing "cancel") is silent. All other errors surface the existing
 * generic `pro.upgradeError*` Alert.
 */
export function useUpgradeFlow(): () => Promise<void> {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const inFlight = useRef(false);

  return useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await runNativeIapPurchase();
        await qc.invalidateQueries({ queryKey: MY_SUBSCRIPTION_KEY });
      } else {
        await runWebStripeFlow();
      }
    } catch (err) {
      if (isUserCancellation(err)) return;
      Alert.alert(t('pro.upgradeErrorTitle'), t('pro.upgradeErrorBody'));
    } finally {
      inFlight.current = false;
    }
  }, [t, qc]);
}

function isUserCancellation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  if (e.code === ErrorCode.UserCancelled) return true;
  return typeof e.message === 'string' && /cancel/i.test(e.message);
}

async function runNativeIapPurchase(): Promise<void> {
  await initConnection();

  const fetched = await fetchProducts({ skus: [PRODUCT_ID], type: 'subs' });
  const list = Array.isArray(fetched) ? fetched : [];
  const sub = list[0] as ProductSubscription | undefined;
  if (!sub) throw new Error('iap_product_not_available');

  const userId = (await supabase.auth.getUser()).data.user?.id;

  const purchase = await new Promise<Purchase>((resolve, reject) => {
    let updateSub: { remove: () => void } | null = null;
    let errorSub: { remove: () => void } | null = null;
    const cleanup = () => {
      updateSub?.remove();
      errorSub?.remove();
    };
    updateSub = purchaseUpdatedListener((p) => {
      if (p.productId !== PRODUCT_ID) return;
      cleanup();
      resolve(p);
    });
    errorSub = purchaseErrorListener((err) => {
      cleanup();
      reject(err);
    });

    // Android subscriptions require an `offerToken` for each SKU (Play
    // Billing 5+). iOS ignores google-side fields. The offer token is on
    // the product the store returned in the fetchProducts call above.
    const androidOffers =
      Platform.OS === 'android' &&
      'subscriptionOfferDetailsAndroid' in sub &&
      Array.isArray(sub.subscriptionOfferDetailsAndroid)
        ? sub.subscriptionOfferDetailsAndroid.map((o) => ({
            sku: PRODUCT_ID,
            offerToken: o.offerToken,
          }))
        : null;

    requestPurchase({
      request: {
        apple: { sku: PRODUCT_ID, appAccountToken: userId ?? null },
        google: { skus: [PRODUCT_ID], subscriptionOffers: androidOffers },
      },
      type: 'subs',
    }).catch(reject);
  });

  const receipt = purchase.purchaseToken;
  if (!receipt) throw new Error('iap_no_receipt');

  const { data, error } = await supabase.functions.invoke(
    'validate-iap-receipt',
    {
      body: {
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        receipt,
        product_id: PRODUCT_ID,
      },
    },
  );
  if (error) throw error;
  if ((data as { status?: string })?.status !== 'active') {
    throw new Error('iap_validation_failed');
  }

  await finishTransaction({ purchase, isConsumable: false });
}

async function runWebStripeFlow(): Promise<void> {
  const { data, error } = await supabase.functions.invoke(
    'issue-web-session',
    { body: { redirect_to: WEB_UPGRADE_PATH } },
  );
  const minted = (data as { url?: unknown } | null)?.url;
  const urlToOpen =
    !error && typeof minted === 'string' && minted.length > 0
      ? minted
      : `${WEB_BASE_URL}${WEB_UPGRADE_PATH}`;
  await WebBrowser.openBrowserAsync(urlToOpen, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  });
}
