import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/auth';
import { stripe } from '@/lib/stripe';

/**
 * Admin: refund last charge (H.11).
 *
 * Approach: list the customer's most recent charges
 * (`stripe.charges.list({ customer, limit: 1 })`), refund it
 * via `stripe.refunds.create({ charge: charge.id, ... })`.
 *
 * Why charges, not invoices: in Stripe API `2026-04-22.dahlia`,
 * the `payment_intent` field moved off `Invoice` onto the
 * sub-resource `InvoicePayment` — extracting it requires
 * either expansion (`stripe.invoices.list({ expand: [...] })`)
 * or a separate `stripe.invoicePayments.list` call. The Charge
 * resource is unchanged: one API call gets the charge, one
 * gets the refund. Simpler is better here.
 *
 * Edge cases:
 *   - No charges yet (e.g., trial-only sub) → 404.
 *   - Charge already fully refunded → 400 with clear error.
 *   - Charge failed (status !== 'succeeded') → 400.
 *
 * The refund's `metadata.refunded_by_admin` records which
 * admin triggered the refund — useful audit trail for the
 * Stripe Dashboard side.
 *
 * Connect awareness (Track F.C.7): destination charges (the
 * marketplace path; `transfer_data` is non-null) need
 * `reverse_transfer: true` and `refund_application_fee: true`
 * on the refund so the connected account is debited and the
 * platform's 2% commission is refunded atomically with the
 * buyer's refund. Without these flags Stripe only refunds the
 * buyer from the platform balance and the seller keeps their
 * 98% — a silent reconciliation gap. The route's primary use
 * is the subscription path (charges with no `transfer_data`),
 * where the flags would be invalid; we therefore set them only
 * when `charge.transfer_data` is present. See
 * docs/runbooks/marketplace-refunds.md.
 *
 * No DB write here. For subscription charges, refund state
 * currently doesn't propagate to `public.subscriptions`; the
 * subscription itself isn't affected by a refund (refunds are
 * charge-level events). For marketplace charges, the
 * stripe-webhook function handles `charge.refunded` and flips
 * `orders.status` to `refunded`.
 */
export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: { stripe_customer_id?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const customerId = body.stripe_customer_id;
  if (typeof customerId !== 'string' || customerId.length === 0) {
    return NextResponse.json(
      { error: 'missing_customer_id' },
      { status: 400 },
    );
  }

  try {
    const charges = await stripe.charges.list({
      customer: customerId,
      limit: 1,
    });
    const charge = charges.data[0];
    if (!charge) {
      return NextResponse.json(
        { error: 'no_charges' },
        { status: 404 },
      );
    }
    if (charge.status !== 'succeeded') {
      return NextResponse.json(
        { error: 'charge_not_succeeded' },
        { status: 400 },
      );
    }
    if (charge.refunded) {
      return NextResponse.json(
        { error: 'already_refunded' },
        { status: 400 },
      );
    }

    // F.C.7: only set the Connect reversal flags on destination
    // charges. `transfer_data` is the destination-charge marker; it's
    // null for plain platform charges (subscriptions) where these
    // flags would be invalid.
    const isDestinationCharge = charge.transfer_data !== null;
    const refund = await stripe.refunds.create({
      charge: charge.id,
      reason: 'requested_by_customer',
      metadata: {
        refunded_by_admin: auth.userId,
      },
      ...(isDestinationCharge && {
        reverse_transfer: true,
        refund_application_fee: true,
      }),
    });

    console.log(
      `[H.11] refund ok customer=${customerId} charge=${charge.id} ` +
        `refund=${refund.id} amount=${refund.amount} admin=${auth.userId}`,
    );
    return NextResponse.json({
      ok: true,
      refund_id: refund.id,
      amount: refund.amount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.error(
      `[H.11] refund-last-charge stripe error customer=${customerId}: ${msg}`,
    );
    return NextResponse.json(
      { error: 'stripe_error', details: msg },
      { status: 500 },
    );
  }
}
