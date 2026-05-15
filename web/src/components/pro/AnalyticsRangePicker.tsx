'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/routing';

/**
 * Date-window range picker for /pro/analytics (Track 8).
 *
 * URL state is the source of truth: clicking a pill writes
 * `?range=7d|30d|90d` while preserving any other query params, then
 * the Server Component re-renders against the new window. No local
 * React state — the active pill is read from the URL via
 * `useSearchParams` (which the parent has already validated and
 * passes back as `active`).
 *
 * Three preset windows match the `get_seller_*_timeseries` RPC's
 * supported p_days range (1..90).
 */

const RANGES = ['7d', '30d', '90d'] as const;
type Range = (typeof RANGES)[number];

export function AnalyticsRangePicker({ active }: { active: Range }) {
  const t = useTranslations('pro.analytics.range');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onClick = useCallback(
    (next: Range) => {
      const sp = new URLSearchParams(searchParams.toString());
      sp.set('range', next);
      router.push(`${pathname}?${sp.toString()}`);
    },
    [router, pathname, searchParams],
  );

  return (
    <nav className="flex gap-2" aria-label={t('navLabel')}>
      {RANGES.map((value) => {
        const isActive = value === active;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onClick(value)}
            aria-pressed={isActive}
            className={
              isActive
                ? 'rounded-pill border border-brand bg-brand/10 px-4 py-1.5 text-sm font-semibold text-brand'
                : 'rounded-pill border border-border bg-surface-elevated px-4 py-1.5 text-sm text-text-secondary hover:bg-surface'
            }
          >
            {t(value)}
          </button>
        );
      })}
    </nav>
  );
}
