# Server Setup

Backend deployment for this project: Stripe Checkout (payments) and Expo Push (notifications), both running on Supabase Edge Functions. Schema and function source code are committed; deployment happens once you have the relevant accounts.

# Stripe

This project uses Stripe Checkout via Supabase Edge Functions. The schema and function source code are committed; deployment happens once you have a Stripe account.

## Prerequisites
- A Stripe account in test mode → https://dashboard.stripe.com/register
- The Supabase CLI installed locally → `npm i -g supabase`

## 1. Get your Stripe keys
In Stripe Dashboard → Developers → API keys:
- Copy your `Secret key` (starts with `sk_test_...`)
- You'll also need a `Webhook signing secret` after step 3 below.

## 2. Deploy the create-checkout-session function

```
supabase login
supabase link --project-ref <your-project-ref>
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
supabase functions deploy create-checkout-session
```

After deployment, note the function URL — it will look like:

```
https://<your-project-ref>.supabase.co/functions/v1/create-checkout-session
```

The mobile app calls this URL with a Bearer token (the user's Supabase access token) and a JSON body `{ product_id, return_url }`. It returns `{ url, session_id, order_id }`. The client opens `url` in the in-app browser to present Stripe Checkout.

## 3. Deploy the stripe-webhook function

The webhook receives events from Stripe (payment success, expiration, refund) and updates the `orders` table.

```
supabase functions deploy stripe-webhook --no-verify-jwt
```

The `--no-verify-jwt` flag is required because Stripe is calling the function, not an authenticated app user. Authenticity is verified instead by the Stripe signature header.

After deployment, note the webhook URL:

```
https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook
```

## 4. Register the webhook with Stripe

In Stripe Dashboard → Developers → Webhooks → Add endpoint:
- **Endpoint URL**: paste the webhook URL from step 3.
- **Events to send**: select
  - `checkout.session.completed`
  - `checkout.session.expired`
  - `charge.refunded`
- Click **Add endpoint**.
- On the endpoint detail page, click **Reveal** under "Signing secret" and copy the value (starts with `whsec_...`).

Then set it as a Supabase secret and redeploy:

```
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
supabase functions deploy stripe-webhook --no-verify-jwt
```

## 5. Verify

1. In the app, tap **Buy Now** on any product.
2. Stripe Checkout opens. Use test card `4242 4242 4242 4242`, any future expiry, any CVC.
3. Complete payment. Stripe sends `checkout.session.completed` to the webhook.
4. In Supabase → Table editor → `orders`, the row's `status` should flip from `pending` to `paid` and `stripe_payment_intent_id` should be populated.
5. Issue a refund from the Stripe Dashboard for that payment; the order's `status` should flip to `refunded`.

## Environment variables summary

| Secret                       | Where set                  | Used by                    |
| ---------------------------- | -------------------------- | -------------------------- |
| `STRIPE_SECRET_KEY`          | `supabase secrets set`     | both functions             |
| `STRIPE_WEBHOOK_SECRET`      | `supabase secrets set`     | `stripe-webhook` only      |
| `SUPABASE_URL`               | auto-injected by Supabase  | both functions             |
| `SUPABASE_SERVICE_ROLE_KEY`  | auto-injected by Supabase  | both functions             |

## Connect (future)

The schema includes `sellers.stripe_account_id`, `stripe_charges_enabled`, `stripe_payouts_enabled` and `orders.application_fee_amount` so we can switch from direct charges (current MVP — all funds to platform, manual redistribution) to destination charges with Connect Express accounts later, without a schema migration. The flow when we add it:

1. Add a "Connect with Stripe" CTA in the seller dashboard that calls a new `create-account-link` function.
2. After onboarding completes, persist `stripe_account_id` and the capability flags on the seller row via the `account.updated` webhook event.
3. In `create-checkout-session`, when the seller has `stripe_charges_enabled`, add `payment_intent_data.transfer_data.destination = sellerStripeAccountId` and set `application_fee_amount` for the platform cut.

# Push Notifications

Edge Function: `send-push-notification`. Triggered explicitly by the client after sending messages, likes, or other events. Uses the Expo Push API (no API key required, no setup beyond the device token).

The `push_tokens` table stores one row per device per user. RLS lets each user manage only their own tokens; the Edge Function uses the service role to look up tokens for the recipient regardless of caller.

## Deploy

```
supabase functions deploy send-push-notification
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase — no extra secrets needed.

After deployment, note the function URL:

```
https://<your-project-ref>.supabase.co/functions/v1/send-push-notification
```

## Calling it

The mobile app calls this URL with a Bearer token (the user's Supabase access token) and a JSON body:

```json
{
  "user_id": "<recipient-uuid>",
  "title": "New message",
  "body": "You have a new message from Alex",
  "data": { "thread_id": "..." }
}
```

It returns `{ sent: <number-of-tokens-pushed>, expo: <expo-api-response> }`. If the recipient has no registered tokens, it returns `{ sent: 0 }` with status 200 — that is not an error.

## Verify

1. After client integration (step L.2), launch the app on a physical device, grant notification permission, and confirm a row appears in `push_tokens` for your user.
2. From a second account, send a message (or any notification-triggering event) to the first.
3. The first device should receive a push notification within a few seconds.

## Future: database triggers

For MVP the client calls `send-push-notification` explicitly after each event. This is simple but unreliable — pushes are lost if the sender's app is killed mid-request. Later, replace those calls with a Postgres trigger on `messages` / `likes` that calls the Edge Function via `pg_net` or a Supabase database webhook, so delivery does not depend on the sender's network.
