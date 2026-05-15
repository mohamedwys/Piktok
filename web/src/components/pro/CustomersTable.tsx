import { getTranslations } from 'next-intl/server';
import { MessageSquare } from 'lucide-react';
import { Link } from '@/i18n/routing';
import type { SellerCustomerRow } from '@/lib/pro/data';
import type { Currency } from '@/i18n/currency';

/**
 * Customers list table (Track 5).
 *
 * Server Component — rows are pre-filtered upstream (in-memory buyer-name
 * search applied in the page). Presents one row per distinct buyer with
 * total spend (formatted in the visitor's display currency), order count,
 * last-order timestamp (relative), an inline message-bubble glyph when
 * the buyer has an active conversation with this seller, and an "Open"
 * link to the per-buyer detail.
 *
 * Conversation glyph (no link): the web companion has no messaging
 * surface in v1 — the mobile app owns the conversation UI. Matches the
 * RecentActivityFeed precedent of indicating cross-surface signal
 * without offering a dead-end deep link.
 *
 * Currency: the customers RPC sums `orders.amount` across whatever
 * currencies the seller has transacted in (the orders.currency dimension
 * is dropped at aggregation). This mirrors the analytics revenue
 * timeseries posture — render in the caller's display currency without
 * FX conversion.
 */
type Props = {
  customers: SellerCustomerRow[];
  currency: Currency;
  locale: string;
};

function numberLocaleTag(locale: string): string {
  if (locale === 'fr') return 'fr-FR';
  if (locale === 'ar') return 'ar-AE';
  return 'en-US';
}

function toUpperCurrency(currency: Currency): 'EUR' | 'USD' | 'AED' {
  if (currency === 'eur') return 'EUR';
  if (currency === 'usd') return 'USD';
  return 'AED';
}

/**
 * Pick the largest time unit that fits the elapsed duration and format
 * it via `Intl.RelativeTimeFormat`. Same shape as RecentActivityFeed's
 * helper — kept local rather than extracted to keep each surface
 * self-contained until a third caller appears.
 */
function formatRelative(
  nowMs: number,
  pastMs: number,
  formatter: Intl.RelativeTimeFormat,
): string {
  const diffSeconds = Math.round((pastMs - nowMs) / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 60) return formatter.format(diffSeconds, 'second');
  if (absSeconds < 3600) {
    return formatter.format(Math.round(diffSeconds / 60), 'minute');
  }
  if (absSeconds < 86400) {
    return formatter.format(Math.round(diffSeconds / 3600), 'hour');
  }
  return formatter.format(Math.round(diffSeconds / 86400), 'day');
}

export async function CustomersTable({ customers, currency, locale }: Props) {
  const t = await getTranslations('pro.customers');
  const localeTag = numberLocaleTag(locale);

  const moneyFmt = new Intl.NumberFormat(localeTag, {
    style: 'currency',
    currency: toUpperCurrency(currency),
    maximumFractionDigits: 2,
  });
  const numberFmt = new Intl.NumberFormat(localeTag);
  const relativeFmt = new Intl.RelativeTimeFormat(localeTag, {
    numeric: 'auto',
  });
  const now = Date.now();

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface-elevated text-xs uppercase tracking-wider text-text-tertiary">
          <tr>
            <th scope="col" className="px-4 py-3 text-start font-semibold">
              {t('column.buyer')}
            </th>
            <th scope="col" className="px-4 py-3 text-end font-semibold">
              {t('column.totalSpend')}
            </th>
            <th scope="col" className="px-4 py-3 text-end font-semibold">
              {t('column.orderCount')}
            </th>
            <th scope="col" className="px-4 py-3 text-start font-semibold">
              {t('column.lastOrder')}
            </th>
            <th scope="col" className="px-4 py-3 text-end font-semibold">
              {t('column.actions')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface">
          {customers.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-12 text-center text-text-tertiary"
              >
                {t('empty')}
              </td>
            </tr>
          ) : (
            customers.map((row) => (
              <tr key={row.buyerUserId} className="hover:bg-surface-elevated">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 text-text-primary">
                    <span className="truncate font-medium">
                      {row.buyerName ?? '—'}
                    </span>
                    {row.conversationId !== null ? (
                      <MessageSquare
                        size={14}
                        className="shrink-0 text-text-tertiary"
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-end text-text-primary">
                  {moneyFmt.format(row.totalSpend)}
                </td>
                <td className="px-4 py-3 text-end text-text-primary">
                  {numberFmt.format(row.orderCount)}
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {formatRelative(
                    now,
                    new Date(row.lastOrderAt).getTime(),
                    relativeFmt,
                  )}
                </td>
                <td className="px-4 py-3 text-end">
                  <Link
                    href={`/pro/customers/${row.buyerUserId}`}
                    className="font-semibold text-brand hover:underline"
                  >
                    {t('openLink')}
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
