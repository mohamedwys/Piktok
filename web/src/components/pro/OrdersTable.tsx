import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import type { SellerOrderRow } from '@/lib/pro/data';
import { OrderStatusPill } from './OrderStatusPill';

/**
 * Orders list table (Track 4).
 *
 * Server Component — rows are pre-filtered upstream (DB-side filters in
 * `fetchSellerOrders`, in-memory text search in the page). The table is
 * purely presentational: thumbnail + title, buyer, amount, status pill,
 * and an "Open" link to the per-order detail.
 *
 * Title display: locale's title field with the opposite locale as
 * fallback (same rule as ProductsTable). Empty title → '—'. Amount uses
 * the order's currency (each order carries the currency it was paid in;
 * the seller's display-currency cookie does NOT normalize it).
 */
type Props = {
  orders: SellerOrderRow[];
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

export async function OrdersTable({ orders, locale }: Props) {
  const t = await getTranslations('pro.orders');
  const localeTag = numberLocaleTag(locale);

  const dateFmt = new Intl.DateTimeFormat(localeTag, {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const moneyFmtCache = new Map<string, Intl.NumberFormat>();
  const moneyFmt = (currency: string) => {
    const key = currency.toUpperCase();
    const cached = moneyFmtCache.get(key);
    if (cached) return cached;
    const created = new Intl.NumberFormat(localeTag, {
      style: 'currency',
      currency: key,
      maximumFractionDigits: 2,
    });
    moneyFmtCache.set(key, created);
    return created;
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface-elevated text-xs uppercase tracking-wider text-text-tertiary">
          <tr>
            <th scope="col" className="px-4 py-3 text-start font-semibold">
              {t('column.date')}
            </th>
            <th scope="col" className="px-4 py-3 text-start font-semibold">
              {t('column.product')}
            </th>
            <th scope="col" className="px-4 py-3 text-start font-semibold">
              {t('column.buyer')}
            </th>
            <th scope="col" className="px-4 py-3 text-end font-semibold">
              {t('column.amount')}
            </th>
            <th scope="col" className="px-4 py-3 text-start font-semibold">
              {t('column.status')}
            </th>
            <th scope="col" className="px-4 py-3 text-end font-semibold">
              {t('column.actions')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface">
          {orders.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-12 text-center text-text-tertiary"
              >
                {t('empty')}
              </td>
            </tr>
          ) : (
            orders.map((row) => {
              const displayTitle = titleFor(row.productTitle, locale);
              return (
                <tr key={row.id} className="hover:bg-surface-elevated">
                  <td className="px-4 py-3 text-text-secondary">
                    {dateFmt.format(new Date(row.createdAt))}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {row.productThumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.productThumbnail}
                          alt=""
                          className="size-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="size-10 rounded-lg bg-surface-elevated" />
                      )}
                      <div className="min-w-0 truncate font-medium text-text-primary">
                        {displayTitle}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    {row.buyerName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-end text-text-primary">
                    {moneyFmt(row.currency).format(row.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusPill status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Link
                      href={`/pro/orders/${row.id}`}
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
  );
}
