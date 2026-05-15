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
 * Views timeseries line chart (Track 8).
 *
 * Client Component — Recharts mounts SVG via React-DOM internals that
 * don't run cleanly in Server Components, so every Recharts import
 * stays behind a `'use client'` boundary. The page Server Component
 * fetches the data and hands it across as serializable strings/numbers.
 *
 * Layout: fixed 280px height inside a parent-controlled width (the
 * page wraps each chart in a card and the ResponsiveContainer fills
 * the card's content width). Margins are tuned so the Y-axis labels
 * have just enough room without pushing the line off-card.
 *
 * Locale: tick + tooltip dates render via `Intl.DateTimeFormat(locale,
 * { month: 'short', day: 'numeric' })`. The page passes the active UI
 * locale ('en' | 'fr' | 'ar') and we map it to a regional tag for
 * formatting so an Arabic UI gets Arabic numerals where expected.
 */

type Props = {
  data: Array<{ day: string; value: number }>;
  locale: string;
};

function numberLocaleTag(locale: string): string {
  if (locale === 'fr') return 'fr-FR';
  if (locale === 'ar') return 'ar-AE';
  return 'en-US';
}

export function ViewsChart({ data, locale }: Props) {
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
  const numFmt = useMemo(
    () => new Intl.NumberFormat(localeTag),
    [localeTag],
  );

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart
        data={data}
        margin={{ top: 16, right: 16, bottom: 0, left: -8 }}
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
          tickFormatter={(v: number) => numFmt.format(v)}
          allowDecimals={false}
          width={48}
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
            numFmt.format(value),
            t('tooltip.views'),
          ]}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#FF5A5C"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
