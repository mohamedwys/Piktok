# IAP Setup Checklist

Track A ships the client + edge function code. Pro subscription will NOT
work end-to-end until the manual setup below is complete.

## 1. App Store Connect

1. ASC → Mony → In-App Purchases & Subscriptions → Create Subscription Group.
   - Name: "Pro Membership"
   - Reference Name: pro_membership
2. Within the group, create one subscription:
   - Reference Name: "Mony Pro Monthly"
   - Product ID: `mony_pro_monthly`        ← MUST match the constant in
                                            src/hooks/useUpgradeFlow.ts
   - Duration: 1 Month
   - Price: $19.99 USD (or equivalent in local currencies)
   - Localization: English + French.
     Display Name (EN): "Mony Pro Monthly"
     Description (EN): "Unlock unlimited listings, the Boost button,
                        sales analytics, and direct payment with Stripe.
                        Cancel anytime."
     (Translate FR.)
   - Review information:
     - Screenshot of the upgrade affordance in the app
     - Review notes:
       "Pro Membership unlocks: (1) raising the free-tier 10-listing
       cap, (2) the Boost button which promotes a listing for 7 days,
       (3) sales analytics on the seller's product detail sheet, (4)
       the option for direct-payment listings (Buy Now button)."
3. Submit the IAP for review — IAP approval is separate from app review.
4. ASC → My Apps → Mony → App Information → App-Specific Shared Secret.
   - Generate. Copy the value.

## 2. Google Play Console

1. Play Console → Mony → Monetize → Subscriptions → Create subscription.
   - Product ID: `mony_pro_monthly`
   - Name: "Mony Pro Monthly"
   - Description: same as App Store.
2. Add a base plan:
   - Billing period: monthly
   - Price: $19.99 USD
   - Auto-renewing: yes
   - Grace period: 3 days (recommended — covers transient card
     renewal failures).
3. Save and activate.

## 3. Google Cloud service account

1. https://console.cloud.google.com → IAM & Admin → Service Accounts →
   Create.
   - Name: mony-play-subs-verify
   - Role: "Pub/Sub Subscriber" (for real-time developer notifications;
     optional but recommended).
2. After creation → Keys → Add Key → Create new key → JSON.
   - Download the JSON. This is the credential the Edge Function uses.
3. Play Console → Settings → API access → Link this service account.
   - Grant permission: "View financial data, orders, and cancellation
     survey responses".
4. Open the JSON file. The entire JSON string (including newlines in
   private_key) goes into the Supabase secret in step 4.

## 4. Supabase Dashboard secrets

Project Settings → Edge Functions → Secrets. Add four secrets:

    APPLE_SHARED_SECRET             <from step 1.4>
    APPLE_BUNDLE_ID                 com.pictok.client
    GOOGLE_PLAY_PACKAGE_NAME        com.pictok.client
    GOOGLE_PLAY_SERVICE_ACCOUNT_JSON <full JSON from step 3.2>

## 5. Sandbox testing

### iOS

1. ASC → Users and Access → Sandbox Testers → New Sandbox Tester.
   - Email + password (use one you control; cannot be a real Apple ID).
2. On the device: Settings → App Store → sign out of the production
   account. Build the app via `eas build --profile development` or
   run on a connected device with Xcode. Tap "Upgrade" — the system
   IAP sheet prompts to sign in. Use the sandbox tester credentials.
3. Sandbox renewals run at accelerated intervals (monthly = 5 minutes).
   Use this to test renewal flow.

### Android

1. Play Console → Settings → License testing → add test users (Google
   accounts).
2. The test user installs the internal-test track build. Test purchases
   are free but go through the full Play Billing flow.
3. To reset a test purchase: Play Store app → Subscriptions → cancel.

## 6. Verify end-to-end

- Build a production build (`eas build --profile production`) and TestFlight
  / internal-test it.
- Tap Upgrade. Complete the sandbox / test purchase.
- Confirm:
  - The IAP sheet succeeds.
  - The subscriptions table has a new row with payment_provider =
    'apple_iap' (or 'google_play'), status = 'active',
    current_period_end set.
  - The is_pro trigger fired: sellers.is_pro = true.
  - The app UI now shows Pro affordances (Boost button, no cap modal).
- Force-quit the app, reopen. The restore-purchases flow should NOT
  create a duplicate row (the unique index on apple_transaction_id /
  google_purchase_token guards against this).

## 7. Production submission

Once sandbox testing passes:
- ASC: submit the app + IAP for review together.
- Play Console: submit the app + subscription for review together.
