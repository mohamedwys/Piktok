import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { hasLocale } from 'next-intl';
import { getSupabaseServer } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { routing } from '@/i18n/routing';

/**
 * Stripe Customer Portal session creation — H.10.
 *
 * Mints a one-time Customer Portal URL for the authenticated
 * user's Stripe customer record. The portal handles billing
 * UX (cancel, change plan, update payment method, view
 * invoices, reactivate canceled subscriptions). We don't
 * duplicate any of that — Stripe's hosted portal is the
 * single source of truth for billing flows.
 *
 * Configuration of what the portal exposes lives in Stripe
 * Dashboard → Settings → Billing → Customer portal (one-time
 * setup, separate per test/live mode). See README §Stripe
 * Customer Portal for the configuration runbook.
 *
 * Resolution chain on every POST:
 *
 *   1. Auth — `getUser()` (cryptographic JWT verification).
 *      Anonymous callers get 401.
 *   2. Seller — looked up via `sellers.user_id = auth.uid()`.
 *   3. Subscription — RLS-scoped read of
 *      `stripe_customer_id` from the H.2 subscriptions table.
 *      404 if absent (user with no subscription can't open
 *      portal).
 *   4. Locale — read from `NEXT_LOCALE` cookie for the
 *      `return_url` so the user lands back on
 *      `/[locale]/dashboard` in their preferred language.
 *      Falls back to `defaultLocale` if missing.
 *   5. Session — `stripe.billingPortal.sessions.create({
 *      customer, return_url })`. Returns `{ url }`.
 *
 * Lives at `/api/stripe/portal` — outside `[locale]/`,
 * matching the H.7.1 middleware's `/api` exclusion.
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

  // ── 2. Seller ────────────────────────────────────────────────
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

  // ── 3. Subscription (RLS-scoped via H.2 self-select policy) ──
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('seller_id', seller.id)
    .maybeSingle();
  if (!subscription?.stripe_customer_id) {
    return NextResponse.json(
      { error: 'no_subscription' },
      { status: 400 },
    );
  }

  // ── 4. Locale-aware return URL ───────────────────────────────
  const cookieStore = await cookies();
  const localeRaw = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = hasLocale(routing.locales, localeRaw)
    ? localeRaw
    : routing.defaultLocale;

  const origin =
    req.headers.get('origin') ??
    process.env.NEXT_PUBLIC_WEB_BASE_URL ??
    'https://mony-psi.vercel.app';
  const localePath = locale === routing.defaultLocale ? '' : `/${locale}`;
  const returnUrl = `${origin}${localePath}/dashboard`;

  // ── 5. Create portal session ─────────────────────────────────
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: returnUrl,
    });
    if (!session.url) {
      return NextResponse.json(
        { error: 'session_creation_failed' },
        { status: 500 },
      );
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'stripe_error',
        details: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 },
    );
  }
}
