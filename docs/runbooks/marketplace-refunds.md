# Runbook: Marketplace refunds under Stripe Connect

Last updated: 2026-05-15.

## When to use this runbook

Open this runbook whenever you need to refund a buyer on the
marketplace (a `buy_now` product purchase). It does NOT apply to Mony
Pro subscription refunds — those are platform-only charges and the
default Stripe refund flow is correct for them.

Trigger scenarios:

- A buyer requests a refund via support.
- An order shipped damaged or never shipped and the seller agrees to
  refund.
- Chargeback prevention — refunding before the bank dispute lands.
- An admin notices a fraudulent or mistaken purchase and pulls it
  back.

## Background: destination charges

The marketplace runs on Stripe Connect destination charges
([`supabase/functions/create-checkout-session/index.ts`](../../supabase/functions/create-checkout-session/index.ts)).
Every purchase creates a single Stripe Charge with:

- `transfer_data.destination` — the seller's connected account.
- `application_fee_amount` — the platform's 2% commission.
- `on_behalf_of` — the seller's connected account (the charge is
  attributed to the seller for statement descriptor and processing-fee
  purposes).

Money moves in one settlement:

1. Buyer's card is charged the full amount.
2. Stripe routes the post-fee remainder to the seller's connected
   account (the `transfer`).
3. The platform retains the 2% application fee on its own balance.
4. Stripe's processing fees are deducted from the seller's connected
   account (because of `on_behalf_of`).

## Why this matters: the seller-debit gap

Refunds on destination charges have a footgun. By default,
`stripe.refunds.create({ charge })` refunds the buyer **from the
platform balance only**. The transfer to the seller is NOT reversed,
and the platform's 2% fee is NOT refunded. The seller keeps their 98%
while the platform eats the full refund out of its own funds.

To make the refund whole — buyer refunded, seller debited, commission
returned — the refund must be created with two extra flags:

| Flag                       | Effect                                                              |
|----------------------------|---------------------------------------------------------------------|
| `reverse_transfer: true`   | Pulls the original transfer back from the seller's connected account. |
| `refund_application_fee: true` | Refunds the platform's application fee back to the buyer's refund pool. |

Both flags together = atomic, three-sided refund. Skipping either
leaves a silent reconciliation gap.

## How to issue a refund via Stripe Dashboard

Use the Dashboard for one-off refunds (most common path).

1. Sign in to [dashboard.stripe.com](https://dashboard.stripe.com) on
   the **platform** account (not a connected account).
2. Payments → find the charge by buyer email, amount, or PaymentIntent
   id. (Order rows in the database store `stripe_payment_intent_id`
   and `stripe_charge_id` — grep there if you only have an order id.)
3. Click the charge → "Refund payment" in the top-right.
4. Two checkboxes appear under the amount field. **Tick both**:
   - **"Refund application fee"** — refunds the platform's 2% cut.
   - **"Reverse transfer"** — debits the seller's connected account.
5. Optional: pick a reason (`requested_by_customer`, `duplicate`,
   `fraudulent`). The reason is metadata only; it doesn't change the
   money flow.
6. Confirm. The refund is created synchronously.

The Stripe UI does not pre-tick the checkboxes. **Missing either box
leaves the seller un-debited.** Treat ticking both as a hard
requirement on every marketplace refund.

## How to issue a refund via the admin route

For programmatic refunds — bulk support tickets, automated tooling —
hit the admin API:

```
POST /api/admin/refund-last-charge
Authorization: <admin session cookie>
Content-Type: application/json

{ "stripe_customer_id": "cus_..." }
```

The route ([`web/src/app/api/admin/refund-last-charge/route.ts`](../../web/src/app/api/admin/refund-last-charge/route.ts))
lists the customer's most recent charge and refunds it. It detects
destination charges via `charge.transfer_data` and applies
`reverse_transfer: true` and `refund_application_fee: true`
automatically when the charge is on a connected account — you do NOT
need to pass anything extra. Subscription charges (no `transfer_data`)
are refunded without the Connect flags, also automatically.

Caveats:

- The route refunds the **most recent** charge for the customer. If
  the buyer has multiple marketplace purchases on the same Stripe
  Customer, you can only get the latest one this way. For older
  charges, use the Dashboard or extend the route to accept a
  `charge_id` parameter.
- 404 `no_charges` means the customer exists but has no charges.
- 400 `already_refunded` means the most recent charge is already
  fully refunded — find an older charge or check whether the buyer
  is asking about something already handled.

## Partial refunds

For a partial refund, pass `amount` (in the smallest currency unit —
cents for EUR/USD/GBP) on the refund. The Connect-aware flags behave
proportionally:

- `reverse_transfer: true` — Stripe reverses a proportional slice of
  the transfer, computed as `refund.amount * (transfer.amount /
  charge.amount)`. The seller's connected account is debited by that
  proportional amount.
- `refund_application_fee: true` — Stripe refunds a proportional slice
  of the application fee, computed as `refund.amount *
  (application_fee.amount / charge.amount)`.

Example: a 50.00 EUR order with a 1.00 EUR application fee. Refund
20.00 EUR with both flags set.

- Buyer gets 20.00 EUR back.
- Seller is debited `20.00 * (49.00 / 50.00) = 19.60 EUR`.
- Platform refunds `20.00 * (1.00 / 50.00) = 0.40 EUR` of the
  commission to the buyer's refund pool.

If you need to refund the application fee at a different ratio (rare
— usually for goodwill credits where the platform absorbs more), skip
`refund_application_fee` on the refund and call
`stripe.applicationFees.createRefund({ id, amount })` separately. This
is an escape hatch; default to the proportional behavior.

## What happens next

Once the refund is created (Dashboard or admin route):

1. Stripe emits `charge.refunded` to our webhook
   ([`supabase/functions/stripe-webhook/index.ts`](../../supabase/functions/stripe-webhook/index.ts)).
2. The webhook flips `orders.status` to `refunded` in the database,
   keyed by `stripe_payment_intent_id`.
3. The buyer sees the refund in 5-10 business days on their original
   payment method (Stripe's standard timing — outside our control).
4. The seller sees the debit immediately in their Stripe Express
   dashboard. If their connected-account balance can't cover the
   reversal, see Troubleshooting below.

The buyer is NOT emailed automatically by us. If support promised a
confirmation, send it manually after verifying the webhook landed
(check the `orders` row — `status` should be `refunded`).

## Troubleshooting

### `balance_insufficient` on the connected account

The seller's connected-account balance is below the reversal amount
— their payouts have already moved the money out. Stripe queues the
reversal as a debt against the connected account; future transfers
to the seller will be reduced until the balance is square.

Options:

- Accept the debt (default). The seller's next sales will pay it off.
- Coordinate with the seller to top up their connected-account
  balance manually if the debt is large and they have no pending
  sales. Direct them to Stripe Express → Balance → Add funds.

### `charge_already_refunded`

You're trying to refund a charge that's already fully refunded. Check
the Dashboard — there should already be a refund row. If the buyer
claims they didn't receive it, give them the refund's
`receipt_number` and tell them to contact their bank with it.

### Webhook didn't fire / order still shows `paid`

Check the webhook delivery in Stripe Dashboard → Developers → Webhooks
→ the destination → recent events. If the `charge.refunded` delivery
is red:

1. Re-deliver from the Dashboard ("Resend").
2. If it keeps failing, inspect the webhook logs in Supabase Functions
   for the error. Most common cause: a database row that doesn't
   match `stripe_payment_intent_id` (e.g., a manual Dashboard refund
   on a charge created outside our system).

### Refund created without Connect flags by mistake

If you Dashboard-refunded a destination charge and forgot to tick
both boxes, the buyer is refunded but the seller is not debited. To
fix:

1. The application fee can be refunded after the fact: Dashboard →
   the original application fee row → Refund.
2. The transfer reversal **cannot** be created after the fact via the
   Dashboard. Use the API:

   ```
   stripe.transfers.createReversal('tr_...', { amount: <cents> })
   ```

   You'll need the original transfer id from the charge
   (`charge.transfer`).

Treat this as an incident-worthy mistake — file a note in the support
ticket and double-check the reconciliation manually.

### Subscription customer refunded with Connect flags

Shouldn't happen — the admin route gates on `charge.transfer_data` —
but if someone manually called the Stripe API with the flags on a
non-Connect charge, Stripe rejects the refund with
`charge_not_for_destination_charge` (or similar). Re-issue the refund
without the flags.
