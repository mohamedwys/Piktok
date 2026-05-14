import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requirePro } from '@/lib/pro/auth';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getCurrency } from '@/i18n/getCurrency';
import { Container } from '@/components/ui/Container';
import { HomeKpiTiles } from '@/components/pro/HomeKpiTiles';
import { RecentActivityFeed } from '@/components/pro/RecentActivityFeed';
import { ProHomeViewedBeacon } from '@/components/pro/ProHomeViewedBeacon';
import {
  fetchDashboardSummary,
  fetchRecentActivity,
} from '@/lib/pro/data';

/**
 * Pro dashboard home (Track 2).
 *
 * Renders the seller's KPI surface + the recent-activity feed. Both
 * data fetches run in parallel against the cookie-authed SSR Supabase
 * client; RLS scopes every read to the calling user. The Server
 * Component repeats the `requirePro` gate (defense in depth) — the
 * layout above also gates, but a future bug there should not silently
 * expose data.
 *
 * Force-dynamic — every read depends on the request cookies (auth,
 * currency, locale).
 */
export const dynamic = 'force-dynamic';

export default async function ProHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { userId, sellerId } = await requirePro(locale);

  const supabase = await getSupabaseServer();
  const [summary, activity, sellerRow, currency, t] = await Promise.all([
    fetchDashboardSummary(supabase, sellerId),
    fetchRecentActivity(supabase, sellerId, 10),
    supabase
      .from('sellers')
      .select('name')
      .eq('id', sellerId)
      .single(),
    getCurrency(),
    getTranslations('pro.home'),
  ]);

  const sellerName =
    (sellerRow.data?.name as string | undefined) ??
    t('greetingFallbackName');

  return (
    <main className="py-8">
      <Container>
        <header className="mb-8 space-y-1">
          <h1 className="font-display text-3xl font-semibold text-text-primary">
            {t('greeting', { name: sellerName })}
          </h1>
        </header>

        <HomeKpiTiles summary={summary} currency={currency} />

        <section className="mt-10 space-y-4">
          <h2 className="font-display text-xl font-semibold text-text-primary">
            {t('recentActivityHeading')}
          </h2>
          <RecentActivityFeed events={activity} locale={locale} />
        </section>
      </Container>

      <ProHomeViewedBeacon userId={userId} />
    </main>
  );
}
