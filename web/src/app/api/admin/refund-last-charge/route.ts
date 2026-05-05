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
 * No DB write here. The H.9 webhook handles
 * `charge.refunded` events (well — actually H.9 doesn't yet,
 * since H.9 only listens for `customer.subscription.*`). Refund
 * state currently doesn't propagate to `public.subscriptions`,
 * but the subscription itself isn't affected by a refund
 * (refunds are charge-level events). H.9 could be extended in
 * a future H.X to log refunds to a separate audit table if
 * support tickets warrant.
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

    const refund = await stripe.refunds.create({
      charge: charge.id,
      reason: 'requested_by_customer',
      metadata: {
        refunded_by_admin: auth.userId,
      },
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
