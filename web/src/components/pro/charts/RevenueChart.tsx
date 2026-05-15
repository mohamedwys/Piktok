'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * Revenue timeseries line chart (Track 8).
 *
 * Sister to ViewsChart — same shape, different formatting on the Y axis
 * (currency instead of plain count). The seller's display currency is
 * resolved server-side from the NEXT_CURRENCY cookie and passed in
 * uppercase so `Intl.NumberFormat({ style: 'currency', currency })`
 * picks the right symbol + fraction-digit rules.
 *
 * The aggregate sums orders across whatever currencies the seller has
 * transacted in, then formats the result against the visitor's display
 * currency — same simplification HomeKpiTiles ships. Multi-currency
 * revenue would split the underlying RPC by currency and render one
 * series per currency; not in scope for v1.
 */

type Props = {
  data: Array<{ day: string; value: number; paidSalesCount: number }>;
  locale: string;
  currency: 'EUR' | 'USD' | 'AED';
};

function numberLocaleTag(locale: string): string {
  if (locale === 'fr') return 'fr-FR';
  if (locale === 'ar') return 'ar-AE';
  return 'en-US';
}

export function RevenueChart({ data, locale, currency }: Props) {
  const t = useTranslations('pro.analytics');
  const localeTag = numberLocaleTag(locale);

  const dateLabelFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(localeTag, {
        month: 'short',
        day: 'numeric',
      }),
    [localeTag],
  );
  const moneyFmt = useMemo(
    () =>
      new Intl.NumberFormat(localeTag, {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }),
    [localeTag, currency],
  );
  // Compact currency formatter for the Y-axis ticks so labels like
  // "1.2k €" / "€1.2K" fit without crowding the chart area. Tooltip
  // continues to use the full formatter so the seller sees exact
  // amounts on hover.
  const moneyCompactFmt = useMemo(
    () =>
      new Intl.NumberFormat(localeTag, {
        style: 'currency',
        currency,
        notation: 'compact',
        maximumFractionDigits: 1,
      }),
    [localeTag, currency],
  );

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart
        data={data}
        margin={{ top: 16, right: 16, bottom: 0, left: 4 }}
      >
        <CartesianGrid
          stroke="rgba(255,255,255,0.08)"
          strokeDasharray="3 3"
          vertical={false}
        />
        <XAxis
          dataKey="day"
          tickFormatter={(value: string) =>
            dateLabelFmt.format(new Date(value))
          }
          tick={{ fill: 'rgba(255,255,255,0.42)', fontSize: 11 }}
          stroke="rgba(255,255,255,0.08)"
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          tick={{ fill: 'rgba(255,255,255,0.42)', fontSize: 11 }}
          stroke="rgba(255,255,255,0.08)"
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => moneyCompactFmt.format(v)}
          width={64}
        />
        <Tooltip
          cursor={{ stroke: 'rgba(255,255,255,0.16)' }}
          contentStyle={{
            backgroundColor: '#161616',
            border: '1px solid rgba(255,255,255,0.16)',
            borderRadius: 12,
            color: '#FFFFFF',
            fontSize: 12,
          }}
          labelStyle={{ color: 'rgba(255,255,255,0.68)' }}
          labelFormatter={(label) =>
            dateLabelFmt.format(new Date(String(label)))
          }
          formatter={(value: number) => [
            moneyFmt.format(value),
            t('tooltip.revenue'),
          ]}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#8B5CF6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
