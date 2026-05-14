// deno-lint-ignore-file
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  try {
    const sig = req.headers.get('stripe-signature');
    const whSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
    const payload = await req.text();
    const event = await stripe.webhooks.constructEventAsync(payload, sig!, whSecret, undefined, cryptoProvider);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
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
      const session = event.data.object as Stripe.Checkout.Session;
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
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('webhook error', err);
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 });
  }
});
