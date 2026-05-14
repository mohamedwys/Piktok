import { getTranslations } from 'next-intl/server';
import {
  DollarSign,
  Eye,
  Package,
  ShoppingBag,
  TrendingUp,
  Users,
  Sparkles,
} from 'lucide-react';
import type { Currency } from '@/i18n/currency';
import type { DashboardSummary } from '@/lib/pro/data';

/**
 * Six KPI tiles for the /pro home page (Track 2).
 *
 * Pure Server Component — receives the already-fetched summary row plus
 * the caller's preferred currency, formats locally, and renders. The
 * parent page owns the data fetch + currency resolution; the tiles own
 * presentation only.
 *
 * Currency posture (intentional v1 simplification): the summary's
 * revenue figures are sums of `orders.amount` across whatever currencies
 * the seller has transacted in (EUR / USD / GBP, per the orders table's
 * CHECK constraint). The tile renders that single number formatted with
 * the visitor's display-currency cookie. If a seller has multi-currency
 * orders the displayed number will not be FX-adjusted — same
 * simplification we ship in the existing pricing surface for the
 * platform's own subscriptions. A future track that wants multi-currency
 * revenue tiles would split the RPC return by currency and render one
 * sub-row per currency.
 *
 * Empty state: brand-new Pro sellers (zero listings AND zero sales) see
 * a single welcome card instead of the tile grid. Six "0" tiles feel
 * punitive on an empty account; the welcome card sets the expectation
 * that the dashboard fills in as the seller posts and sells.
 */
export async function HomeKpiTiles({
  summary,
  currency,
}: {
  summary: DashboardSummary;
  currency: Currency;
}) {
  const t = await getTranslations('pro');

  if (summary.total_listings === 0 && summary.total_paid_sales_count === 0) {
    return (
      <section
        aria-labelledby="pro-home-empty-heading"
        className="rounded-xl border border-border bg-surface-elevated p-8 text-center"
      >
        <Sparkles
          size={32}
          className="mx-auto mb-3 text-text-secondary"
          aria-hidden="true"
        />
        <h2
          id="pro-home-empty-heading"
          className="font-display text-xl font-semibold text-text-primary"
        >
          {t('home.emptyState.heading')}
        </h2>
        <p className="mt-2 text-sm text-text-secondary">
          {t('home.emptyState.body')}
        </p>
      </section>
    );
  }

  const currencyCode = currency.toUpperCase();
  // `Intl.NumberFormat` with `style: 'currency'` handles minimum / max
  // fraction digits per currency automatically (EUR/USD/GBP → 2 digits,
  // JPY → 0, etc.). We pin the locale to a per-currency tag rather than
  // the page's UI locale because revenue formatting should match the
  // seller's CURRENCY, not their UI language — a French-speaking seller
  // viewing USD totals wants "$1,234.50", not "1 234,50 $US".
  const moneyLocale =
    currency === 'eur' ? 'fr-FR' : currency === 'aed' ? 'ar-AE' : 'en-US';
  const moneyFormatter = new Intl.NumberFormat(moneyLocale, {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2,
  });
  const numberFormatter = new Intl.NumberFormat(moneyLocale);

  const tiles: {
    key: string;
    Icon: typeof DollarSign;
    label: string;
    value: string;
  }[] = [
    {
      key: 'revenueAllTime',
      Icon: DollarSign,
      label: t('kpi.revenueAllTime'),
      value: moneyFormatter.format(summary.gross_revenue_all_time),
    },
    {
      key: 'revenue30d',
      Icon: TrendingUp,
      label: t('kpi.revenue30d'),
      value: moneyFormatter.format(summary.gross_revenue_30d),
    },
    {
      key: 'salesCount',
      Icon: ShoppingBag,
      label: t('kpi.salesCount'),
      value: numberFormatter.format(summary.total_paid_sales_count),
    },
    {
      key: 'listings',
      Icon: Package,
      label: t('kpi.listings'),
      value: numberFormatter.format(summary.total_listings),
    },
    {
      key: 'followers',
      Icon: Users,
      label: t('kpi.followers'),
      value: numberFormatter.format(summary.followers_count),
    },
    {
      key: 'views30d',
      Icon: Eye,
      label: t('kpi.views30d'),
      value: numberFormatter.format(summary.total_views_30d),
    },
  ];

  return (
    <section
      aria-label={t('home.kpiGridLabel')}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
    >
      {tiles.map(({ key, Icon, label, value }) => (
        <div
          key={key}
          className="rounded-xl border border-border bg-surface-elevated p-5"
        >
          <Icon
            size={20}
            className="mb-3 text-text-secondary"
            aria-hidden="true"
          />
          <div className="text-2xl font-semibold tracking-tight text-text-primary">
            {value}
          </div>
          <div className="mt-1 text-xs uppercase tracking-wide text-text-tertiary">
            {label}
          </div>
        </div>
      ))}
    </section>
  );
}
