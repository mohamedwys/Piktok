// deno-lint-ignore-file
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    const { data: { user } } = await supabase.auth.getUser(auth);
    if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

    const { product_id, return_url } = await req.json();
    if (!product_id || typeof product_id !== 'string') {
      return new Response('Missing product_id', { status: 400, headers: corsHeaders });
    }

    const { data: product, error: pErr } = await supabase
      .from('products')
      .select('id, seller_id, price, currency, title, media_url, thumbnail_url')
      .eq('id', product_id)
      .maybeSingle();
    if (pErr || !product) {
      return new Response('Product not found', { status: 404, headers: corsHeaders });
    }

    const productName = (product.title?.fr || product.title?.en || 'Product') as string;
    const successUrl = `${return_url ?? 'https://example.com/success'}?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${return_url ?? 'https://example.com/cancel'}?cancelled=1`;

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
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
