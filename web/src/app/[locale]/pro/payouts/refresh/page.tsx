import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requirePro } from '@/lib/pro/auth';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchSellerConnectState } from '@/lib/pro/data';
import { Container } from '@/components/ui/Container';
import { ConnectOnboardButton } from '@/components/pro/ConnectOnboardButton';
import {
  CONNECT_ALLOWED_COUNTRIES,
  type ConnectCountry,
} from '@/components/pro/ConnectCountryPicker';

/**
 * /pro/payouts/refresh — landing when a Stripe onboarding link expires
 * mid-flow (Track F.C.2). Stripe redirects here on the F.C.1 edge
 * function's `refresh_url`. Account links are short-lived (~5 min) and
 * single-use, so this page just re-mints one against the existing
 * account.
 *
 * Mirrors the `in_progress` branch of /pro/payouts: same auth gate, same
 * Resume CTA, no country picker (the country was fixed at account
 * creation time).
 *
 * Force-dynamic — depends on the auth cookie + seller row state.
 */
export const dynamic = 'force-dynamic';

const DEFAULT_COUNTRY: ConnectCountry = 'FR';

export default async function PayoutsRefreshPage({
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
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <Container>
        <div className="mx-auto max-w-2xl space-y-6 text-center">
          <h1 className="font-display text-3xl font-semibold text-text-primary">
            {t('refresh.heading')}
          </h1>
          <p className="text-text-secondary">{t('refresh.body')}</p>
          <div className="flex justify-center">
            <ConnectOnboardButton country={resumeCountry} isResume={true} />
          </div>
        </div>
      </Container>
    </main>
  );
}
