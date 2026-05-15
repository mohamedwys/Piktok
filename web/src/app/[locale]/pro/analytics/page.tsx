import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { requirePro } from '@/lib/pro/auth';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getCurrency } from '@/i18n/getCurrency';
import {
  fetchRevenueTimeseries,
  fetchTopListings,
  fetchViewsTimeseries,
  type AnalyticsRange,
} from '@/lib/pro/data';
import type { Currency } from '@/i18n/currency';
import { Container } from '@/components/ui/Container';
import { AnalyticsRangePicker } from '@/components/pro/AnalyticsRangePicker';
import { ViewsChart } from '@/components/pro/charts/ViewsChart';
import { RevenueChart } from '@/components/pro/charts/RevenueChart';
import { TopListingsTable } from '@/components/pro/TopListingsTable';

/**
 * Pro analytics page (Track 8).
 *
 * Reads one searchParam:
 *   - range: '7d' | '30d' | '90d', default '30d'. Invalid values
 *     redirect to the canonical 30d URL so the chart fetches always
 *     run against a valid `p_days` argument (1..90).
 *
 * Three parallel fetches feed the page:
 *   - views timeseries (line chart, top-left)
 *   - revenue timeseries (line chart, top-right)
 *   - top-5 listings by views_7d (table below)
 * Plus a cookie-resolved display currency for the revenue formatter.
 *
 * Tab visibility is gated by the PostHog `show_pro_analytics_tab`
 * flag on the layout above — this page is reachable by direct URL
 * even when the tab is hidden, which is intentional: it lets the
 * page ship before the flag flips without exposing the entry point.
 *
 * Force-dynamic — `requirePro` reads cookies, RPC results depend on
 * the authenticated caller, and the display currency is per-request.
 */
export const dynamic = 'force-dynamic';

type RangeKey = '7d' | '30d' | '90d';

function normalizeRange(
  raw: string | string[] | undefined,
): { days: AnalyticsRange; key: RangeKey } | 'invalid' | 'default' {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined) return 'default';
  if (value === '7d') return { days: 7, key: '7d' };
  if (value === '30d') return { days: 30, key: '30d' };
  if (value === '90d') return { days: 90, key: '90d' };
  return 'invalid';
}

function toUpperCurrency(currency: Currency): 'EUR' | 'USD' | 'AED' {
  if (currency === 'eur') return 'EUR';
  if (currency === 'usd') return 'USD';
  return 'AED';
}

export default async function ProAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requirePro(locale);

  const sp = await searchParams;
  const normalized = normalizeRange(sp.range);
  if (normalized === 'invalid') {
    redirect({ href: '/pro/analytics?range=30d', locale });
  }
  const resolved: { days: AnalyticsRange; key: RangeKey } =
    normalized === 'default'
      ? { days: 30, key: '30d' }
      : normalized === 'invalid'
        ? { days: 30, key: '30d' } // unreachable — redirect throws above
        : normalized;
  const { days, key: activeRangeKey } = resolved;

  const supabase = await getSupabaseServer();
  const [views, revenue, topListings, currency, t] = await Promise.all([
    fetchViewsTimeseries(supabase, days),
    fetchRevenueTimeseries(supabase, days),
    fetchTopListings(supabase, 5),
    getCurrency(),
    getTranslations('pro.analytics'),
  ]);

  // Empty state: both timeseries return all-zero days. We check both
  // (rather than the OR) because a brand-new seller has zero views AND
  // zero revenue — there's no useful chart to render. A seller with
  // views but no sales (or vice versa) still gets the dual-chart view
  // with one flat line.
  const viewsAllZero = views.every((p) => p.value === 0);
  const revenueAllZero = revenue.every((p) => p.value === 0);
  const isEmpty = viewsAllZero && revenueAllZero;

  return (
    <main className="py-8">
      <Container>
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-semibold text-text-primary">
            {t('heading')}
          </h1>
          <AnalyticsRangePicker active={activeRangeKey} />
        </header>

        {isEmpty ? (
          <section
            aria-labelledby="pro-analytics-empty-heading"
            className="rounded-xl border border-border bg-surface-elevated p-8 text-center"
          >
            <h2
              id="pro-analytics-empty-heading"
              className="font-display text-xl font-semibold text-text-primary"
            >
              {t('empty.heading')}
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              {t('empty.body')}
            </p>
          </section>
        ) : (
          <section
            aria-label={t('chartsGridLabel')}
            className="grid grid-cols-1 gap-4 lg:grid-cols-2"
          >
            <article className="rounded-xl border border-border bg-surface p-5">
              <h2 className="mb-3 text-sm font-semibold text-text-secondary">
                {t('viewsChartTitle')}
              </h2>
              <ViewsChart data={views} locale={locale} />
            </article>
            <article className="rounded-xl border border-border bg-surface p-5">
              <h2 className="mb-3 text-sm font-semibold text-text-secondary">
                {t('revenueChartTitle')}
              </h2>
              <RevenueChart
                data={revenue}
                locale={locale}
                currency={toUpperCurrency(currency)}
              />
            </article>
          </section>
        )}

        {topListings.length > 0 ? (
          <section className="mt-10 space-y-4">
            <h2 className="font-display text-xl font-semibold text-text-primary">
              {t('topListingsHeading')}
            </h2>
            <TopListingsTable
              rows={topListings}
              locale={locale}
              currency={currency}
            />
          </section>
        ) : null}
      </Container>
    </main>
  );
}
