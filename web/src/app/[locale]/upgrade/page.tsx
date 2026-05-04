import {
  getTranslations,
  setRequestLocale,
} from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getCurrency } from '@/i18n/getCurrency';
import { Container } from '@/components/ui/Container';
import { UpgradeForm } from '@/components/upgrade/UpgradeForm';

/**
 * /upgrade — real Stripe Checkout entry point (H.8).
 *
 * Replaces H.6's "shipping soon" placeholder. Auth-gated (per
 * H.6 discipline — getUser() not getSession() for cryptographic
 * verification). Locale-aware (H.7.1) + currency-aware (H.7.3)
 * via the server-side helpers below.
 *
 * Force-dynamic because the page reads:
 *   - Auth cookies via `getSupabaseServer().auth.getUser()`
 *   - Currency cookie via `getCurrency()`
 *   - Locale param via `setRequestLocale(locale)`
 *
 * The actual Checkout Session creation happens server-side in
 * the API route (`POST /api/stripe/checkout`); this page renders
 * the form that POSTs to it. No Stripe SDK on the client side —
 * we redirect via `window.location.href` after receiving the
 * session URL.
 *
 * Race-condition note: the Stripe payment confirmation does NOT
 * mutate `public.subscriptions`. The H.9 webhook is the writer.
 * So the success page (linked from `success_url`) shows
 * "processing" copy, not "you are now Pro" — the row may not
 * exist yet when the user lands there. Webhook latency is
 * typically < 2s in Stripe test mode.
 */
export const dynamic = 'force-dynamic';

export default async function UpgradePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect({ href: '/', locale });
  }
  const email = user?.email ?? '';

  const currency = await getCurrency();
  const t = await getTranslations('upgrade');
  const tPricing = await getTranslations(`pricing.${currency}`);

  return (
    <main className="min-h-screen bg-background py-16 text-text-primary">
      <Container>
        <div className="mx-auto max-w-md space-y-8">
          <header className="space-y-3 text-center">
            <h1 className="font-display text-5xl font-semibold">
              {t('title')}
            </h1>
            <p className="text-text-secondary">{t('sub')}</p>
          </header>

          <UpgradeForm
            monthlyPrice={tPricing('priceMonthly')}
            monthlyCadence={tPricing('cadenceMonthly')}
            yearlyPrice={tPricing('priceYearly')}
            yearlyCadence={tPricing('cadenceYearly')}
            yearlySavings={tPricing('savings')}
          />

          <footer className="text-center text-sm text-text-tertiary">
            {t('signedInAs', { email })}
          </footer>
        </div>
      </Container>
    </main>
  );
}
