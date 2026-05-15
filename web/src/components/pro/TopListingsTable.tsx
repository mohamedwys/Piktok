import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import type { Currency } from '@/i18n/currency';
import type { TopListingRow } from '@/lib/pro/data';

/**
 * Top-5 listings leaderboard for /pro/analytics (Track 8).
 *
 * Pure Server Component — receives an already-sorted+sliced array and
 * renders the table. Locale-aware title pick + currency formatting
 * mirror the Products tab (ProductsTable) so a seller toggling between
 * surfaces sees consistent formatting.
 *
 * Currency posture: the page passes the visitor's display-currency
 * cookie. Like the rest of the Pro surfaces, this is NOT FX-converted
 * — products authored in EUR / USD / AED all roll up under a single
 * formatter. Multi-currency revenue display would split per-currency
 * upstream and isn't in scope for v1.
 *
 * Each row links to `/pro/products/[id]` (the listing editor surface
 * from Track 3) so clicking a top-performer drills into its detail.
 */

type Props = {
  rows: TopListingRow[];
  locale: string;
  currency: Currency;
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

export async function TopListingsTable({ rows, locale, currency }: Props) {
  const t = await getTranslations('pro.analytics.topListings');
  const localeTag = numberLocaleTag(locale);
  const numFmt = new Intl.NumberFormat(localeTag);
  const moneyFmt = new Intl.NumberFormat(localeTag, {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  });

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface-elevated text-xs uppercase tracking-wider text-text-tertiary">
          <tr>
            <th scope="col" className="px-4 py-3 text-start font-semibold">
              {t('column.product')}
            </th>
            <th scope="col" className="px-4 py-3 text-end font-semibold">
              {t('column.views7d')}
            </th>
            <th scope="col" className="px-4 py-3 text-end font-semibold">
              {t('column.revenue')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface">
          {rows.map((row) => {
            const displayTitle = titleFor(row.title, locale);
            return (
              <tr key={row.productId} className="hover:bg-surface-elevated">
                <td className="px-4 py-3">
                  <Link
                    href={`/pro/products/${row.productId}`}
                    className="flex items-center gap-3"
                  >
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
                    <span className="min-w-0 truncate font-medium text-text-primary">
                      {displayTitle}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-end text-text-secondary">
                  {numFmt.format(row.views_7d)}
                </td>
                <td className="px-4 py-3 text-end text-text-primary">
                  {moneyFmt.format(row.gross_revenue)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
