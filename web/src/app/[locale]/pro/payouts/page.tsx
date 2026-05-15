import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requirePro } from '@/lib/pro/auth';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchSellerConnectState } from '@/lib/pro/data';
import { Container } from '@/components/ui/Container';
import { ConnectStartForm } from '@/components/pro/ConnectStartForm';
import { ConnectOnboardButton } from '@/components/pro/ConnectOnboardButton';
import { PayoutsStatusCard } from '@/components/pro/PayoutsStatusCard';
import type { ConnectCountry } from '@/components/pro/ConnectCountryPicker';
import { CONNECT_ALLOWED_COUNTRIES } from '@/components/pro/ConnectCountryPicker';

/**
 * /pro/payouts — Stripe Connect onboarding surface (Track F.C.2).
 *
 * Three states branched off `fetchSellerConnectState`:
 *   - 'not_started' — never connected. Render the country picker +
 *     "Connect Stripe" CTA pair. Default country = FR (primary market).
 *   - 'in_progress' — created an Express account but didn't finish
 *     Stripe's form (or KYC pending). Render a "Resume onboarding" CTA
 *     that re-mints an account link against the existing account.
 *     The country picker is omitted because the country was already
 *     fixed at account creation.
 *   - 'connected' — `charges_enabled = true`. Render
 *     `<PayoutsStatusCard />` with the Stripe Dashboard CTA.
 *
 * Auth gate uses `requirePro` (NOT `requireProConnected`) — this IS the
 * page that requireProConnected redirects unsatisfied callers TO.
 *
 * Force-dynamic — every render depends on the auth cookie + the Stripe
 * Connect state, both of which the Stripe webhook may flip mid-session.
 */
export const dynamic = 'force-dynamic';

const DEFAULT_COUNTRY: ConnectCountry = 'FR';

export default async function PayoutsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { sellerId } = await requirePro(locale);
  const supabase = await getSupabaseServer();
  const [state, t] = await Promise.all([
    fetchSellerConnectState(supabase, sellerId),
    getTranslations('pro.payouts'),
  ]);

  // Resume CTA needs a country to send. The edge function ignores the
  // value when the seller row already has a stripe_account_id (the
  // existing account's country wins), but the body validator still
  // requires a 2-letter ISO. Use the persisted country if present,
  // otherwise fall back to the default — both are safe.
  const resumeCountry: ConnectCountry = ((): ConnectCountry => {
    const persisted = state.country;
    if (
      persisted &&
      (CONNECT_ALLOWED_COUNTRIES as readonly string[]).includes(persisted)
    ) {
      return persisted as ConnectCountry;
    }
    return DEFAULT_COUNTRY;
  })();

  return (
    <main className="py-8">
      <Container>
        <header className="mb-6 space-y-2">
          <h1 className="font-display text-3xl font-semibold text-text-primary">
            {t('heading')}
          </h1>
          <p className="text-text-secondary">
            {state.status === 'not_started'
              ? t('subhead.notStarted')
              : state.status === 'connected'
                ? t('subhead.connected')
                : state.detailsSubmitted
                  ? t('subhead.inProgressVerifying')
                  : t('subhead.inProgress')}
          </p>
        </header>

        <section className="mb-8">
          {state.status === 'not_started' ? (
            <div className="rounded-2xl border border-border bg-surface-elevated p-6">
              <ConnectStartForm defaultCountry={DEFAULT_COUNTRY} />
            </div>
          ) : null}

          {state.status === 'in_progress' ? (
            <div className="rounded-2xl border border-border bg-surface-elevated p-6">
              <ConnectOnboardButton country={resumeCountry} isResume={true} />
            </div>
          ) : null}

          {state.status === 'connected' ? (
            <PayoutsStatusCard state={state} locale={locale} />
          ) : null}
        </section>

        <section className="rounded-2xl border border-border p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold text-text-primary">
            {t('howItWorks.title')}
          </h2>
          <p className="text-sm text-text-secondary">
            {t('howItWorks.commissionBody')}
          </p>
          <p className="text-sm text-text-secondary">
            {t('howItWorks.payoutBody')}
          </p>
        </section>
      </Container>
    </main>
  );
}
