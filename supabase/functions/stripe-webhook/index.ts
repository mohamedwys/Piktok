// deno-lint-ignore-file
import Stripe from 'https://esm.sh/stripe@22.1.1?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { initEdgeSentry, captureEdgeException } from '../_shared/sentry.ts';

initEdgeSentry();

// apiVersion pinned to match web/src/lib/stripe.ts (the subscription
// path) so the marketplace and subscription paths share a single Stripe
// API surface. Bump the SDK and the apiVersion together; never bump one
// without the other.
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2026-04-22.dahlia',
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  // Hoisted so the catch block can include them in the Sentry capture.
  let event: Stripe.Event | undefined;
  let session: Stripe.Checkout.Session | undefined;
  try {
    const sig = req.headers.get('stripe-signature');
    const whSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
    const payload = await req.text();
    event = await stripe.webhooks.constructEventAsync(payload, sig!, whSecret, undefined, cryptoProvider);

    if (event.type === 'checkout.session.completed') {
      session = event.data.object as Stripe.Checkout.Session;
      // Phase 8 / Track B: persist shipping_details + customer_details
      // from the completed session. `shipping_details` is widened via
      // assertion because some SDK TS versions don't expose it on
      // Checkout.Session directly; the runtime field is present.
      const shipping = (session as Stripe.Checkout.Session & {
        shipping_details?: Stripe.Checkout.Session.ShippingDetails | null;
      }).shipping_details ?? null;
      const customer = session.customer_details ?? null;
      const shippingAddress = shipping?.address
        ? {
            name:        shipping.name ?? null,
            line1:       shipping.address.line1 ?? null,
            line2:       shipping.address.line2 ?? null,
            city:        shipping.address.city ?? null,
            postal_code: shipping.address.postal_code ?? null,
            state:       shipping.address.state ?? null,
            country:     shipping.address.country ?? null,
          }
        : null;
      await supabase
        .from('orders')
        .update({
          status: 'paid',
          stripe_payment_intent_id: session.payment_intent as string,
          updated_at: new Date().toISOString(),
          shipping_address: shippingAddress,
          buyer_phone: customer?.phone ?? null,
          buyer_name:  customer?.name ?? shipping?.name ?? null,
        })
        .eq('stripe_session_id', session.id);
    } else if (event.type === 'checkout.session.expired') {
      session = event.data.object as Stripe.Checkout.Session;
      await supabase
        .from('orders')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('stripe_session_id', session.id);
    } else if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      await supabase
        .from('orders')
        .update({ status: 'refunded', stripe_charge_id: charge.id, updated_at: new Date().toISOString() })
        .eq('stripe_payment_intent_id', charge.payment_intent as string);
    } else if (event.type === 'account.updated') {
      // Track F.C.1: mirror the connected account's state onto the
      // sellers row. Fires on every account state change Stripe knows
      // about: capability enabled/disabled, charges/payouts toggled,
      // KYC requirement state, country corrections, etc. We only mirror
      // the small surface the platform cares about; the rest stays at
      // Stripe.
      const account = event.data.object as Stripe.Account;
      const stripeAccountId = account.id;

      // Pre-read the existing row to (a) confirm we know about this
      // account (Stripe may send updates for accounts we have no record
      // of in dev/test if the dashboard was used directly), and (b)
      // decide whether stripe_onboarded_at should be stamped this time.
      // stripe_onboarded_at is a first-time-completion timestamp -- set
      // once when details_submitted transitions false -> true, never
      // re-set. If the seller re-onboards (rare; Stripe-driven), the
      // original onboarding date remains the source of truth for funnel
      // analysis.
      const { data: existing } = await supabase
        .from('sellers')
        .select('id, stripe_onboarded_at, stripe_details_submitted')
        .eq('stripe_account_id', stripeAccountId)
        .maybeSingle();

      if (existing) {
        const detailsSubmittedNow = account.details_submitted ?? false;
        const shouldStampOnboarded =
          detailsSubmittedNow &&
          !existing.stripe_details_submitted &&
          !existing.stripe_onboarded_at;

        const updates: Record<string, unknown> = {
          stripe_charges_enabled:   account.charges_enabled ?? false,
          stripe_payouts_enabled:   account.payouts_enabled ?? false,
          stripe_country:           account.country ?? null,
          stripe_details_submitted: detailsSubmittedNow,
        };
        if (shouldStampOnboarded) {
          updates.stripe_onboarded_at = new Date().toISOString();
        }

        const { error: updErr } = await supabase
          .from('sellers')
          .update(updates)
          .eq('stripe_account_id', stripeAccountId);
        if (updErr) throw updErr;
      }
    } else if (event.type === 'account.application.deauthorized') {
      // Track F.C.1: the seller revoked the platform's access to their
      // Stripe account (Stripe Dashboard -> Settings -> Connected
      // accounts -> Disconnect). Null the account id and reset all
      // mirrored flags so a future re-onboarding via create-account-link
      // creates a fresh Express account. The orders history stays
      // intact -- those rows reference seller_id (our id), not the
      // Stripe account id.
      //
      // For account.application.deauthorized, data.object is the
      // Application (just the application id), so the connected account
      // id is on the top-level `event.account` field per Stripe's
      // Connect webhook contract. Fall back to data.object.account for
      // belt-and-suspenders in case Stripe's payload shape ever exposes
      // it there too.
      const stripeAccountId =
        event.account ??
        (event.data.object as { account?: string }).account ??
        null;
      if (stripeAccountId) {
        const { error: updErr } = await supabase
          .from('sellers')
          .update({
            stripe_account_id:        null,
            stripe_charges_enabled:   false,
            stripe_payouts_enabled:   false,
            stripe_details_submitted: false,
          })
          .eq('stripe_account_id', stripeAccountId);
        if (updErr) throw updErr;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('webhook error', err);
    await captureEdgeException(err, {
      function: 'stripe-webhook',
      event_type: event?.type,
      session_id: session?.id,
    });
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 });
  }
});
