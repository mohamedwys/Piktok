import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Stripe webhook handler (H.9).
 *
 * Receives subscription lifecycle events from Stripe, verifies
 * the signature header, upserts into `public.subscriptions`
 * (the H.2-shipped table) via the service-role admin client.
 * The H.2 trigger (`handle_subscription_change`) then mirrors
 * `sellers.is_pro` automatically based on the new status —
 * this handler does NOT touch `is_pro` directly.
 *
 * **Force-dynamic.** Side-effectful + reads raw body. Static
 * rendering doesn't apply.
 *
 * **Raw body discipline.** Stripe's signature is computed over
 * the EXACT bytes of the HTTP request body. We read via
 * `req.text()` to preserve the byte sequence; `req.json()`
 * would parse-then-reserialize, breaking the signature
 * comparison. Next.js 15 App Router exposes the raw body
 * cleanly via `req.text()` — no `bodyParser: false` config
 * needed (that was a Pages Router thing).
 *
 * **Idempotency.** Stripe retries failed webhook deliveries
 * (5xx response → exponential backoff). The upsert with
 * `onConflict: 'seller_id'` is naturally idempotent —
 * re-delivering the same event produces the same final state.
 *
 * **Out-of-order delivery (v1 trade-off).** Stripe usually
 * delivers events in chronological order, but during retries
 * an older event for the same seller could arrive after a
 * newer one and overwrite. Acceptable v1 risk per H.9 spec;
 * mitigation (compare event timestamps before write) is H.13
 * territory if support tickets surface it.
 *
 * **Resubscribe semantics.** The H.2 schema enforces
 * `seller_id UNIQUE` — exactly one subscription row per
 * seller. If a seller cancels and resubscribes, the new
 * subscription (different `stripe_subscription_id`) replaces
 * the row. Historical subscription IDs persist in Stripe
 * Dashboard but not in our local DB. This is the v1
 * single-row trade-off.
 *
 * **Status codes.** 200 for handled / acknowledged events.
 * 400 for bad signature or malformed request. 500 for
 * unexpected handler errors (Stripe retries with backoff).
 * 200 for unhandled event types — we don't want Stripe to
 * retry events we deliberately ignore.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // ── 1. Raw body for signature verification ──────────────────
  // MUST come before any branching that could read the body —
  // the Request body is a one-shot stream.
  const rawBody = await req.text();

  // ── 2. Verify signature ────────────────────────────────────
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature header', {
      status: 400,
    });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[H.9] STRIPE_WEBHOOK_SECRET is not set');
    return new Response('Server misconfigured', { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.warn(`[H.9] webhook signature verification failed: ${msg}`);
    return new Response(`Bad signature: ${msg}`, { status: 400 });
  }

  // ── 3. Handle event types we care about ────────────────────
  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionEvent(event.data.object);
        break;
      default:
        // Ack unhandled types so Stripe doesn't retry. Log
        // event.type only — never the full payload (PII).
        console.log(
          `[H.9] ignoring event type=${event.type} id=${event.id}`,
        );
        break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.error(
      `[H.9] handler error for ${event.type} id=${event.id}: ${msg}`,
    );
    // 5xx so Stripe retries with backoff — gives transient
    // DB blips a chance to recover without losing the event.
    return new Response(`Handler error: ${msg}`, { status: 500 });
  }

  return new Response('ok', { status: 200 });
}

/**
 * Persists a Stripe.Subscription as a row in `public.subscriptions`.
 *
 * Reads `seller_id` from `subscription.metadata` — populated
 * by the H.8 Checkout API route via
 * `subscription_data.metadata.seller_id`. If the metadata is
 * missing (e.g., a manual Stripe Dashboard subscription
 * created outside our flow), we log + skip rather than
 * orphaning the row.
 *
 * Reads `current_period_start` / `current_period_end` from
 * the SUBSCRIPTION ITEM (Stripe API 2026-04-22.dahlia moved
 * those fields off the Subscription object into per-item
 * tracking). Mony Pro is a single-item subscription, so
 * `items.data[0]` is the canonical source.
 */
async function handleSubscriptionEvent(
  subscription: Stripe.Subscription,
): Promise<void> {
  const sellerId = subscription.metadata?.seller_id;
  if (!sellerId) {
    console.warn(
      `[H.9] subscription ${subscription.id} missing seller_id ` +
        `metadata; skipping (status=${subscription.status})`,
    );
    return;
  }

  const item = subscription.items.data[0];
  if (!item) {
    console.warn(
      `[H.9] subscription ${subscription.id} has no line items; ` +
        `skipping (seller_id=${sellerId})`,
    );
    return;
  }

  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  // current_period_start / current_period_end live on the
  // SubscriptionItem in API 2026-04-22.dahlia. Single-item
  // subscriptions read from items.data[0].
  const row = {
    seller_id: sellerId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: customerId,
    stripe_price_id: item.price.id,
    status: subscription.status,
    current_period_start: new Date(
      item.current_period_start * 1000,
    ).toISOString(),
    current_period_end: new Date(
      item.current_period_end * 1000,
    ).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : null,
    trial_end: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  };

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('subscriptions')
    .upsert(row, { onConflict: 'seller_id' });

  if (error) {
    throw new Error(
      `subscriptions upsert failed for seller=${sellerId} ` +
        `sub=${subscription.id}: ${error.message}`,
    );
  }

  // Diagnostic log — diagnostic only fields, no PII / payment data.
  console.log(
    `[H.9] upserted subscription seller=${sellerId} ` +
      `status=${subscription.status} sub=${subscription.id}`,
  );

  // The H.2 trigger (`handle_subscription_change`) now fires
  // on the row write and updates `sellers.is_pro` to
  // `status IN ('active','trialing')`. No further action
  // needed here.
}
