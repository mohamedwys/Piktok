'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import type { SellerProductStatsRow } from '@/lib/pro/data';
import { ProductBulkToolbar } from './ProductBulkToolbar';

/**
 * Products list table (Track 3).
 *
 * Client Component — owns the ephemeral selection set (Set<string> of
 * product ids) and renders the bulk-action toolbar when ≥1 row is
 * selected. Selection clears on a router.refresh or full reload; that
 * is the intended scope (per-session, never persisted).
 *
 * Title display: uses the locale's title field, falling back to the
 * opposite locale when missing. Empty title → '—'.
 *
 * Money / number formatting: a single Intl.NumberFormat instance per
 * render, scoped by the page locale. Currency comes off the row itself
 * (each product is authored in EUR / USD / GBP independently of the
 * viewer's display-currency cookie).
 */
type Props = {
  products: SellerProductStatsRow[];
  locale: string;
};

function titleFor(
  title: { fr?: string; en?: string } | null,
  locale: string,
): string {
  if (!title) return '—';
  const primary = locale === 'fr' ? title.fr : title.en;
  const fallback = locale === 'fr' ? title.en : title.fr;
  return primary ?? fallback ?? '—';
}

function numberLocaleTag(locale: string): string {
  if (locale === 'fr') return 'fr-FR';
  if (locale === 'ar') return 'ar-AE';
  return 'en-US';
}

export function ProductsTable({ products, locale }: Props) {
  const t = useTranslations('pro.products');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const numFmt = useMemo(
    () => new Intl.NumberFormat(numberLocaleTag(locale)),
    [locale],
  );

  // One currency formatter per currency that appears on this page —
  // memoized so we don't re-instantiate per row.
  const moneyFmt = useMemo(() => {
    const cache = new Map<string, Intl.NumberFormat>();
    return (currency: string) => {
      const key = currency.toUpperCase();
      const existing = cache.get(key);
      if (existing) return existing;
      const created = new Intl.NumberFormat(numberLocaleTag(locale), {
        style: 'currency',
        currency: key,
        maximumFractionDigits: 2,
      });
      cache.set(key, created);
      return created;
    };
  }, [locale]);

  const allIds = useMemo(
    () => products.map((p) => p.product_id),
    [products],
  );
  const allSelected =
    products.length > 0 && selected.size === products.length;

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  };

  const clearSelection = () => setSelected(new Set());

  const nowMs = Date.now();
  const isFeatured = (until: string | null) =>
    until !== null && new Date(until).getTime() > nowMs;

  return (
    <div className="space-y-4">
      {selected.size > 0 ? (
        <ProductBulkToolbar
          selectedIds={Array.from(selected)}
          onClear={clearSelection}
        />
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-elevated text-xs uppercase tracking-wider text-text-tertiary">
            <tr>
              <th scope="col" className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  aria-label={t('selectAllAria')}
                  checked={allSelected}
                  onChange={toggleAll}
                />
              </th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">
                {t('columnTitle')}
              </th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">
                {t('columnStatus')}
              </th>
              <th scope="col" className="px-4 py-3 text-end font-semibold">
                {t('columnPrice')}
              </th>
              <th scope="col" className="px-4 py-3 text-end font-semibold">
                {t('columnViews7d')}
              </th>
              <th scope="col" className="px-4 py-3 text-end font-semibold">
                {t('columnRevenue')}
              </th>
              <th scope="col" className="px-4 py-3 text-end font-semibold">
                {t('columnActions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {products.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-text-tertiary"
                >
                  {t('empty')}
                </td>
              </tr>
            ) : (
              products.map((row) => {
                const checked = selected.has(row.product_id);
                const displayTitle = titleFor(row.title, locale);
                const featured = isFeatured(row.featured_until);
                return (
                  <tr
                    key={row.product_id}
                    className={
                      checked
                        ? 'bg-brand/5'
                        : 'hover:bg-surface-elevated'
                    }
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        aria-label={t('selectRowAria', {
                          title: displayTitle,
                        })}
                        checked={checked}
                        onChange={() => toggleOne(row.product_id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {row.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.thumbnail_url}
                            alt=""
                            className="size-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="size-10 rounded-lg bg-surface-elevated" />
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-medium text-text-primary">
                            {displayTitle}
                          </div>
                          {featured ? (
                            <div className="mt-0.5 inline-flex items-center rounded-pill bg-feedback-warning/10 px-2 py-0.5 text-xs font-semibold text-feedback-warning">
                              {t('featuredBadge')}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {row.purchase_mode === 'buy_now' ? (
                        <span className="inline-flex items-center rounded-pill bg-feedback-success/10 px-3 py-1 text-xs font-semibold text-feedback-success">
                          {t('statusBuyNow')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-pill bg-surface-elevated px-3 py-1 text-xs font-semibold text-text-secondary">
                          {t('statusContactOnly')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end text-text-primary">
                      {moneyFmt(row.currency).format(row.price)}
                    </td>
                    <td className="px-4 py-3 text-end text-text-secondary">
                      {numFmt.format(row.views_7d)}
                    </td>
                    <td className="px-4 py-3 text-end text-text-primary">
                      {moneyFmt(row.currency).format(row.gross_revenue)}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Link
                        href={`/pro/products/${row.product_id}`}
                        className="font-semibold text-brand hover:underline"
                      >
                        {t('openLink')}
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
