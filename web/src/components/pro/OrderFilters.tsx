'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/routing';
import type { SellerOrderStatus } from '@/lib/pro/data';

/**
 * Orders list filter bar (Track 4).
 *
 * URL state is the source of truth. The page Server Component reads
 * `?status`, `?from`, `?to`, `?q` from searchParams and renders the
 * filtered table; this Client Component pushes URL updates when the
 * seller interacts with the controls. Local React state is limited to
 * input values + a single debounce-timer ref, so the URL → render
 * round trip stays the canonical write path.
 *
 * Debounce: 500ms idle for the text/date inputs so a seller typing
 * "marie" doesn't trigger five navigations. Enter on the search input
 * submits immediately (clears the debounce). The status pills push
 * synchronously since they're one-shot taps.
 *
 * Re-syncs input state to URL on every searchParams change via useEffect
 * — this handles the back/forward case where the URL changes externally.
 */
type StatusValue = SellerOrderStatus | 'all';

const STATUS_VALUES: StatusValue[] = [
  'all',
  'paid',
  'pending',
  'refunded',
  'failed',
  'cancelled',
];

export function OrderFilters({
  status,
  from,
  to,
  q,
}: {
  status: StatusValue;
  from: string;
  to: string;
  q: string;
}) {
  const t = useTranslations('pro.orders');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [fromInput, setFromInput] = useState(from);
  const [toInput, setToInput] = useState(to);
  const [qInput, setQInput] = useState(q);

  // Keep inputs in sync when the URL changes externally (back/forward,
  // pill tap which only changes `status` should not clobber other inputs
  // mid-typing — but the simpler rule is: every URL change resets the
  // inputs to whatever's in the URL).
  useEffect(() => {
    setFromInput(from);
    setToInput(to);
    setQInput(q);
  }, [from, to, q]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildHref = useCallback(
    (overrides: Record<string, string | undefined>): string => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(overrides)) {
        const isStatusAll = key === 'status' && value === 'all';
        if (value === undefined || value === '' || isStatusAll) {
          sp.delete(key);
        } else {
          sp.set(key, value);
        }
      }
      const qs = sp.toString();
      return qs.length > 0 ? `${pathname}?${qs}` : pathname;
    },
    [searchParams, pathname],
  );

  const pushNow = useCallback(
    (overrides: Record<string, string | undefined>) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      router.push(buildHref(overrides));
    },
    [router, buildHref],
  );

  const pushDebounced = useCallback(
    (overrides: Record<string, string | undefined>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        router.push(buildHref(overrides));
      }, 500);
    },
    [router, buildHref],
  );

  const onStatusClick = (next: StatusValue) => {
    pushNow({ status: next });
  };

  const onFromChange = (value: string) => {
    setFromInput(value);
    pushDebounced({ from: value });
  };

  const onToChange = (value: string) => {
    setToInput(value);
    pushDebounced({ to: value });
  };

  const onQChange = (value: string) => {
    setQInput(value);
    pushDebounced({ q: value });
  };

  const onQSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    pushNow({ q: qInput });
  };

  return (
    <div className="space-y-4">
      <nav aria-label={t('filter.navLabel')} className="flex flex-wrap gap-2">
        {STATUS_VALUES.map((value) => {
          const active = value === status;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onStatusClick(value)}
              className={
                active
                  ? 'rounded-pill border border-brand bg-brand/10 px-4 py-1.5 text-sm font-semibold text-brand'
                  : 'rounded-pill border border-border bg-surface-elevated px-4 py-1.5 text-sm text-text-secondary hover:bg-surface'
              }
            >
              {t(`filter.${value}`)}
            </button>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-text-tertiary">
          {t('filter.from')}
          <input
            type="date"
            value={fromInput}
            onChange={(e) => onFromChange(e.target.value)}
            className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-text-tertiary">
          {t('filter.to')}
          <input
            type="date"
            value={toInput}
            onChange={(e) => onToChange(e.target.value)}
            className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
          />
        </label>
        <form onSubmit={onQSubmit} className="flex-1 min-w-[12rem]">
          <input
            type="search"
            value={qInput}
            onChange={(e) => onQChange(e.target.value)}
            placeholder={t('search.placeholder')}
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
          />
        </form>
      </div>
    </div>
  );
}
