import { Platform } from 'react-native';
import {
  getAvailablePurchases,
  initConnection,
  type Purchase,
} from 'expo-iap';
import { supabase } from '@/lib/supabase';

const PRODUCT_ID = 'mony_pro_monthly';

/**
 * Silent restore-purchases flow. Called once at app launch on iOS/Android
 * when the user is signed in. Catches the reinstall / new-device case
 * where the user already paid through Apple or Google but the local
 * database has no subscriptions row (e.g., after a fresh install or after
 * the row was deleted during account deletion).
 *
 * For each unfinished purchase the store knows about, POSTs the receipt
 * (unified `purchaseToken` field — iOS JWS or Android purchaseToken) to
 * the `validate-iap-receipt` edge function. That endpoint upserts the
 * subscriptions row keyed by apple_transaction_id or
 * google_purchase_token — duplicate POSTs collapse to a single row, so
 * this is safe to run on every launch. The is_pro trigger fires
 * downstream.
 *
 * Best-effort. Individual receipt failures are swallowed; the user can
 * always tap Upgrade again from the UI which goes through useUpgradeFlow.
 * Caller is responsible for invalidating the MY_SUBSCRIPTION_KEY cache
 * after this resolves.
 */
export async function restoreSubscriptions(): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  try {
    await initConnection();
    const purchases = await getAvailablePurchases();
    if (!Array.isArray(purchases)) return;
    for (const p of purchases as Purchase[]) {
      const receipt = p.purchaseToken;
      const productId = p.productId ?? PRODUCT_ID;
      if (!receipt) continue;
      await supabase.functions.invoke('validate-iap-receipt', {
        body: {
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          receipt,
          product_id: productId,
        },
      }).catch(() => {
        // silent on individual failures
      });
    }
  } catch {
    // Silent — restore is best-effort.
  }
}
