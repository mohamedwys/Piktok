import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/auth';
import { stripe } from '@/lib/stripe';

/**
 * Admin: cancel subscription (H.11).
 *
 * Two modes:
 *   - `period_end` → `stripe.subscriptions.update(id, {
 *       cancel_at_period_end: true })`. Reversible until the
 *       period rolls over. User keeps Pro access until then.
 *       Webhook fires `customer.subscription.updated`; H.9
 *       upserts the row; H.2 trigger keeps `is_pro = true`
 *       (status stays `active` while
 *       `cancel_at_period_end = true`).
 *   - `immediate` → `stripe.subscriptions.cancel(id)`. Sub
 *       ends now. User loses Pro access. Webhook fires
 *       `customer.subscription.deleted`; H.9 upserts with
 *       `status: 'canceled'`; H.2 trigger flips
 *       `is_pro = false`.
 *
 * Defense-in-depth: `requireAdminApi()` re-checks `is_admin`
 * even though the page that POSTs here also checked. A
 * compromised page (or a direct API call from outside) still
 * can't bypass the gate.
 *
 * No DB write here. The single-writer invariant for
 * `public.subscriptions` is the H.9 webhook — this route only
 * tells Stripe to act, then waits for the event to propagate
 * back. The page reload after success picks up the new state
 * once the webhook lands (~2s typical).
 */
export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: { stripe_subscription_id?: unknown; mode?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const subId = body.stripe_subscription_id;
  if (typeof subId !== 'string' || subId.length === 0) {
    return NextResponse.json(
      { error: 'missing_subscription_id' },
      { status: 400 },
    );
  }

  const mode: 'period_end' | 'immediate' =
    body.mode === 'immediate' ? 'immediate' : 'period_end';

  try {
    if (mode === 'immediate') {
      await stripe.subscriptions.cancel(subId);
    } else {
      await stripe.subscriptions.update(subId, {
        cancel_at_period_end: true,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.error(
      `[H.11] cancel-subscription stripe error sub=${subId} mode=${mode}: ${msg}`,
    );
    return NextResponse.json(
      { error: 'stripe_error', details: msg },
      { status: 500 },
    );
  }

  console.log(
    `[H.11] cancel-subscription ok sub=${subId} mode=${mode} ` +
      `admin=${auth.userId}`,
  );
  return NextResponse.json({ ok: true });
}
