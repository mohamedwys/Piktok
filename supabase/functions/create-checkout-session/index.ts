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

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Phase 6 / B3: replace `*` with an explicit allow-list. See B3 note in
// send-push-notification/index.ts for the mobile-vs-browser rationale.
const ALLOWED_ORIGINS = new Set([
  'https://mony.app',
  'https://mony-psi.vercel.app',
  'http://localhost:3000',
]);

// Phase 6 / B2: closed allowlist of return_url prefixes. Any client-
// supplied return_url that does not start with one of these falls back
// to the default. The previous code echoed whatever the client passed
// (and used the unowned example.com domain as the fallback, which is a
// phishing pivot waiting to happen).
const ALLOWED_RETURN_PREFIXES = [
  'https://mony.app/',
  'https://mony-psi.vercel.app/',
  'client://',
];
const DEFAULT_RETURN_BASE = 'https://mony-psi.vercel.app/orders';

Deno.serve(async (req) => {
  const reqOrigin = req.headers.get('Origin') ?? '';
  const allowOrigin = ALLOWED_ORIGINS.has(reqOrigin) ? reqOrigin : '';
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  // Hoisted so the catch block can include them in the Sentry capture.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null;
  let productId: string | undefined;
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    const authRes = await supabase.auth.getUser(auth);
    user = authRes.data.user;
    if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

    const { product_id, return_url } = await req.json();
    if (!product_id || typeof product_id !== 'string') {
      return new Response('Missing product_id', { status: 400, headers: corsHeaders });
    }
    productId = product_id;

    const { data: product, error: pErr } = await supabase
      .from('products')
      .select('id, seller_id, price, currency, title, media_url, thumbnail_url, purchase_mode')
      .eq('id', product_id)
      .maybeSingle();
    if (pErr || !product) {
      return new Response('Product not found', { status: 404, headers: corsHeaders });
    }
    // Phase 8 / Track B: server-side guard. The client UI gates on
    // purchase_mode in the action rail, but a forged client could POST
    // here for a contact_only listing. Reject before creating a Stripe
    // session OR an orders row.
    if (product.purchase_mode !== 'buy_now') {
      return new Response('not_purchasable', { status: 403, headers: corsHeaders });
    }

    const productName = (product.title?.fr || product.title?.en || 'Product') as string;

    // Validate return_url against the closed allowlist; fall back to the
    // owned default when missing, non-string, or outside the allowlist.
    const candidate = typeof return_url === 'string' ? return_url : null;
    const isAllowed =
      candidate !== null &&
      ALLOWED_RETURN_PREFIXES.some((p) => candidate.startsWith(p));
    const baseUrl = isAllowed ? (candidate as string) : DEFAULT_RETURN_BASE;
    const successUrl = `${baseUrl}?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}?cancelled=1`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: (product.currency as string).toLowerCase(),
          product_data: {
            name: productName,
            images: product.thumbnail_url ? [product.thumbnail_url as string] : undefined,
          },
          unit_amount: Math.round(Number(product.price) * 100),
        },
        quantity: 1,
      }],
      // Phase 8 / Track B: collect shipping address + phone for buy_now
      // listings. Country allow-list is Western EU + UK + Ireland + US +
      // Canada -- adjust only when the platform has legally cleared a
      // new destination for cross-border shipping.
      shipping_address_collection: {
        allowed_countries: [
          'FR', 'BE', 'CH', 'LU', 'MC',
          'GB', 'IE',
          'DE', 'NL', 'IT', 'ES', 'PT',
          'US', 'CA',
        ],
      },
      phone_number_collection: { enabled: true },
      customer_creation: 'always',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        product_id: product.id as string,
        buyer_id: user.id,
        seller_id: product.seller_id as string,
      },
    });

    const { data: order, error: oErr } = await supabase
      .from('orders')
      .insert({
        buyer_id: user.id,
        product_id: product.id,
        seller_id: product.seller_id,
        amount: product.price,
        currency: product.currency,
        stripe_session_id: session.id,
        status: 'pending',
      })
      .select('id')
      .single();
    if (oErr) throw oErr;

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id, order_id: order.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('create-checkout-session error', err);
    await captureEdgeException(err, {
      function: 'create-checkout-session',
      user_id: user?.id,
      product_id: productId,
    });
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
