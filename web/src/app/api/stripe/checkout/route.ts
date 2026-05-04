import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { hasLocale } from 'next-intl';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getStripePriceId, stripe, type Cadence } from '@/lib/stripe';
import {
  CURRENCY_COOKIE,
  DEFAULT_CURRENCY,
  isCurrency,
  type Currency,
} from '@/i18n/currency';
import { routing } from '@/i18n/routing';

/**
 * Stripe Checkout session creation — H.8.
 *
 * Composes a `mode: 'subscription'` Checkout Session that
 * routes the visitor to Stripe-hosted payment. Resolution
 * chain on every POST:
 *
 *   1. Auth — `getUser()` (cryptographic JWT verification, NOT
 *      `getSession()`). Anonymous callers cannot create
 *      subscriptions.
 *   2. Cadence — read from request body. Defaults to monthly
 *      for any unrecognized value (forgiving but bounded).
 *   3. Currency — read from `NEXT_CURRENCY` cookie (set by the
 *      H.7.3 CurrencyPicker). Falls back to `DEFAULT_CURRENCY`
 *      (EUR) if missing or unrecognized.
 *   4. Locale — read from `NEXT_LOCALE` cookie (set by next-intl
 *      middleware + LanguageSwitcher). Drives both the redirect
 *      URL prefix AND Stripe Checkout's hosted-page locale.
 *   5. Seller — looked up via `sellers.user_id = auth.uid()`. The
 *      relationship is enforced by H.2's schema; if missing,
 *      something's broken upstream.
 *   6. Stripe customer — looked up by existing
 *      `subscriptions.stripe_customer_id`; created if absent
 *      with `metadata: { seller_id, user_id }`. The webhook
 *      (H.9) is the writer of `subscriptions.*`; this route
 *      only reads.
 *   7. Price — composed via `getStripePriceId(currency, cadence)`
 *      from one of six env vars per H.7.3.
 *   8. Session — created with locale-aware success/cancel URLs
 *      respecting H.7.1's 'as-needed' prefix (EN at /, FR at
 *      /fr, AR at /ar).
 *
 * The route is at `/api/stripe/checkout` — outside `[locale]/`
 * because it's a technical endpoint, not user-facing localized
 * content. The H.7.1 middleware matcher already excludes `/api`.
 *
 * Race condition: this route returns the Stripe Checkout URL but
 * does NOT write to `public.subscriptions`. The H.9 webhook is
 * the writer. The success page deliberately shows "processing"
 * copy because the subscription row may not exist yet when the
 * user lands there (typical webhook propagation < 2s).
 */
const LOCALE_COOKIE = 'NEXT_LOCALE';

export async function POST(req: Request) {
  // ── 1. Auth ──────────────────────────────────────────────────
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // ── 2. Cadence ───────────────────────────────────────────────
  let cadence: Cadence;
  try {
    const body = (await req.json()) as { cadence?: unknown };
    cadence = body.cadence === 'yearly' ? 'yearly' : 'monthly';
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // ── 3. Currency + Locale ─────────────────────────────────────
  const cookieStore = await cookies();
  const currencyRaw = cookieStore.get(CURRENCY_COOKIE)?.value;
  const currency: Currency = isCurrency(currencyRaw)
    ? currencyRaw
    : DEFAULT_CURRENCY;

  const localeRaw = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = hasLocale(routing.locales, localeRaw)
    ? localeRaw
    : routing.defaultLocale;

  // ── 4. Seller lookup ─────────────────────────────────────────
  const { data: seller } = await supabase
    .from('sellers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!seller) {
    return NextResponse.json(
      { error: 'seller_not_found' },
      { status: 404 },
    );
  }

  // ── 5. Stripe customer (lookup or create) ────────────────────
  // The `subscriptions` table's `stripe_customer_id` is the
  // canonical source — the webhook upserts it on the first
  // subscription event. For first-time upgraders the row
  // doesn't exist yet, so we create the customer here and
  // pass its id to Stripe; the webhook will then upsert the
  // row WITH the same customer id (idempotent on
  // stripe_subscription_id, plus we set the customer on the
  // session).
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('seller_id', seller.id)
    .maybeSingle();

  let customerId = existingSub?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: {
        seller_id: seller.id,
        user_id: user.id,
      },
    });
    customerId = customer.id;
  }

  // ── 6. Locale-aware redirect URLs ────────────────────────────
  // H.7.1's 'as-needed' prefix: EN URLs at /, FR at /fr, AR at
  // /ar. The localePath segment is empty for the default locale.
  const origin =
    req.headers.get('origin') ??
    process.env.NEXT_PUBLIC_WEB_BASE_URL ??
    'https://mony-psi.vercel.app';

  const localePath = locale === routing.defaultLocale ? '' : `/${locale}`;
  const successUrl =
    `${origin}${localePath}/upgrade/success` +
    `?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}${localePath}/upgrade/canceled`;

  // ── 7. Resolve Stripe price ──────────────────────────────────
  let priceId: string;
  try {
    priceId = getStripePriceId(currency, cadence);
  } catch (err) {
    return NextResponse.json(
      {
        error: 'price_unavailable',
        details: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 },
    );
  }

  // ── 8. Stripe Checkout locale ────────────────────────────────
  // Stripe natively supports 'en' and 'fr' for hosted Checkout;
  // does NOT ship 'ar'. For AR visitors we use 'auto' which lets
  // Stripe browser-detect (likely lands on 'en' for most AR
  // browsers, occasionally 'fr' depending on Accept-Language).
  // Acceptable v1 — Stripe Checkout with EN copy on an
  // AR-flagged page is intelligible; better than no Checkout.
  const stripeLocale: 'en' | 'fr' | 'auto' =
    locale === 'en' || locale === 'fr' ? locale : 'auto';

  // ── 9. Create session ────────────────────────────────────────
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    locale: stripeLocale,
    subscription_data: {
      metadata: {
        seller_id: seller.id,
        user_id: user.id,
        currency,
      },
    },
  });

  if (!session.url) {
    return NextResponse.json(
      { error: 'session_creation_failed' },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url });
}
