// deno-lint-ignore-file
//
// =============================================================================
// Edge Function: create-account-link
// Purpose:       Track F.C.1 -- mint a Stripe Connect Express onboarding URL
//                for the authenticated seller. First call creates the Express
//                account via stripe.accounts.create and persists the returned
//                account ID + country on the seller row. Subsequent calls
//                reuse the existing account and only mint a fresh account
//                link (account links are single-use and short-lived, so each
//                "Resume onboarding" click invokes this function again).
//
// Auth model:    Authenticated mobile / web caller. The function refuses
//                anonymous callers (401) and writes seller_id resolution
//                via the verified user_id from the JWT -- not from the
//                request body. service_role is used only for writes that
//                bypass the 20260515 column-allowlist (stripe_account_id,
//                stripe_country).
//
// Country:       Required client-supplied ISO-3166-1 alpha-2 code, validated
//                against the F.C.1 allow-list (FR, BE, CH, LU, MC, GB, IE,
//                DE, NL, IT, ES, PT, US, CA). Stripe enforces a country at
//                accounts.create time and we mirror it onto sellers.stripe_country
//                so the payouts dashboard can show it later without a
//                round-trip to Stripe.
//
// Style:         Matches create-checkout-session and issue-web-session:
//                  - deno-lint-ignore-file header
//                  - https://esm.sh imports
//                  - Module-level supabase admin client + stripe client
//                  - corsHeaders shape with explicit Origin allow-list
//                  - Plain-string 4xx responses, JSON 5xx
// =============================================================================

import Stripe from 'https://esm.sh/stripe@22.1.1?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { initEdgeSentry, captureEdgeException } from '../_shared/sentry.ts';

initEdgeSentry();

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2026-04-22.dahlia',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const ALLOWED_ORIGINS = new Set([
  'https://mony.app',
  'https://mony-psi.vercel.app',
  'http://localhost:3000',
]);

// F.C.1 country allow-list. Mirrors the shipping_address_collection
// allow-list in create-checkout-session and the geographic scope locked
// in Phase F.B. Stripe Express supports all of these; if a new country
// is added here, also confirm Stripe coverage in the Connect dashboard.
const ALLOWED_COUNTRIES = new Set([
  'FR', 'BE', 'CH', 'LU', 'MC',
  'GB', 'IE',
  'DE', 'NL', 'IT', 'ES', 'PT',
  'US', 'CA',
]);

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
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  // Hoisted so the catch block can include them in the Sentry capture.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null;
  let sellerId: string | undefined;
  let country: string | undefined;
  try {
    // 1. Verify the caller is authenticated.
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    const authRes = await supabase.auth.getUser(auth);
    user = authRes.data.user;
    if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

    // 2. Parse + validate body.
    let body: { country?: unknown };
    try {
      body = await req.json();
    } catch {
      return new Response('invalid_body', { status: 400, headers: corsHeaders });
    }
    if (typeof body.country !== 'string' || body.country.length !== 2) {
      return new Response('invalid_country', { status: 400, headers: corsHeaders });
    }
    country = body.country.toUpperCase();
    if (!ALLOWED_COUNTRIES.has(country)) {
      return new Response('country_not_supported', { status: 400, headers: corsHeaders });
    }

    // 3. Resolve the seller row for the verified user. Every authenticated
    //    user has a seller row (provisioned at signup), but be defensive.
    const { data: seller, error: sErr } = await supabase
      .from('sellers')
      .select('id, stripe_account_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!seller) {
      return new Response('seller_not_found', { status: 404, headers: corsHeaders });
    }
    sellerId = seller.id as string;

    // 4. Create the Express account once. The stripe_account_id is sticky --
    //    if the seller restarts onboarding partway through Stripe's flow,
    //    we mint a fresh account link against the SAME account. Re-creating
    //    accounts would orphan KYC progress and confuse the
    //    account.updated webhook.
    let accountId = (seller.stripe_account_id as string | null) ?? null;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country,
        email: user.email ?? undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          seller_id: seller.id as string,
          user_id: user.id,
        },
      });
      accountId = account.id;

      // Persist the new account id + country immediately. Doing this BEFORE
      // minting the account link means that if the link mint fails for any
      // reason the next call still finds the existing account and resumes
      // onboarding instead of creating a duplicate account at Stripe.
      const { error: updErr } = await supabase
        .from('sellers')
        .update({
          stripe_account_id: accountId,
          stripe_country: country,
        })
        .eq('id', seller.id);
      if (updErr) throw updErr;
    }

    // 5. Mint the onboarding link. account.application links are single-use
    //    and short-lived (~5 minutes), so this endpoint is called fresh
    //    each time the user clicks "Continue onboarding".
    const webBaseUrl = Deno.env.get('WEB_BASE_URL') ?? 'https://mony-psi.vercel.app';
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${webBaseUrl}/pro/payouts/refresh`,
      return_url: `${webBaseUrl}/pro/payouts/return`,
      type: 'account_onboarding',
    });

    return new Response(
      JSON.stringify({ url: link.url, account_id: accountId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('create-account-link error', err);
    await captureEdgeException(err, {
      function: 'create-account-link',
      user_id: user?.id,
      seller_id: sellerId,
      country,
    });
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
