import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import {
  StatusPill,
  type SubscriptionStatus,
} from '@/components/dashboard/StatusPill';

/**
 * Admin subscription list table (H.11).
 *
 * Server Component. Filter controls (search input + status
 * select) are rendered as a plain `<form method="get">` that
 * submits to the same URL with updated `?q=&status=` query
 * params — server re-renders with the new filter. No JS needed
 * for filtering.
 *
 * Each row links to `/admin/subscriptions/<id>` for the detail
 * view + destructive actions.
 *
 * The seller join shape comes from PostgREST's embedded select
 * syntax (`seller:sellers!seller_id(...)`). Without web's
 * generated types, we cast the join shape at the column level
 * — narrow scope, documented.
 */
export type AdminSubscriptionRow = {
  id: string;
  seller_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  seller:
    | {
        id: string;
        user_id: string | null;
        name: string;
        avatar_url: string;
        email_public: string | null;
      }
    | { id: string; user_id: string | null; name: string; avatar_url: string; email_public: string | null }[]
    | null;
};

type Props = {
  subscriptions: AdminSubscriptionRow[];
  currentStatus: string;
  currentQuery: string;
  locale: string;
};

const STATUS_FILTERS = [
  'all',
  'active',
  'trialing',
  'past_due',
  'canceled',
  'unpaid',
] as const;

function getSeller(row: AdminSubscriptionRow) {
  // Supabase's PostgREST sometimes returns the embedded join as
  // an object, sometimes (when typed) as an array. Normalize.
  if (Array.isArray(row.seller)) return row.seller[0] ?? null;
  return row.seller;
}

export async function AdminSubscriptionTable({
  subscriptions,
  currentStatus,
  currentQuery,
  locale,
}: Props) {
  const t = await getTranslations('admin');

  const dateLocaleTag =
    locale === 'fr' ? 'fr-FR' : locale === 'ar' ? 'ar-AE' : 'en-US';

  return (
    <div className="space-y-6">
      {/* Filter bar — pure HTML form, server-rendered. */}
      <form method="get" className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          defaultValue={currentQuery}
          placeholder={t('searchPlaceholder')}
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface-elevated px-4 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
        />
        <select
          name="status"
          defaultValue={currentStatus}
          className="rounded-lg border border-border bg-surface-elevated px-4 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option} value={option}>
              {option === 'all'
                ? t('filterAll')
                : t(`status.${option}` as 'status.active')}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-border-strong bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-primary hover:bg-surface"
        >
          {t('applyFilters')}
        </button>
      </form>

      {/* Table — desktop. Mobile-narrow viewports get a card list
          via the `lg:` breakpoint. For v1 admin (internal staff),
          desktop is the primary surface. */}
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-elevated text-xs uppercase tracking-wider text-text-tertiary">
            <tr>
              <th className="px-4 py-3 text-start font-semibold">
                {t('columns.seller')}
              </th>
              <th className="px-4 py-3 text-start font-semibold">
                {t('columns.status')}
              </th>
              <th className="px-4 py-3 text-start font-semibold">
                {t('columns.renews')}
              </th>
              <th className="px-4 py-3 text-end font-semibold">
                {t('columns.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {subscriptions.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-12 text-center text-text-tertiary"
                >
                  {t('emptyResults')}
                </td>
              </tr>
            ) : (
              subscriptions.map((row) => {
                const seller = getSeller(row);
                const renewsAt = row.current_period_end
                  ? new Date(row.current_period_end).toLocaleDateString(
                      dateLocaleTag,
                      { day: 'numeric', month: 'short', year: 'numeric' },
                    )
                  : '—';
                return (
                  <tr key={row.id} className="hover:bg-surface-elevated">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {seller?.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={seller.avatar_url}
                            alt=""
                            className="size-8 rounded-pill"
                          />
                        ) : (
                          <div className="size-8 rounded-pill bg-surface-elevated" />
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-medium text-text-primary">
                            {seller?.name ?? '—'}
                          </div>
                          <div className="truncate text-xs text-text-tertiary">
                            {seller?.email_public ?? '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill
                        status={row.status as SubscriptionStatus}
                      />
                      {row.cancel_at_period_end ? (
                        <div className="mt-1 text-xs text-feedback-warning">
                          {t('cancelingFlag')}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {renewsAt}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Link
                        href={`/admin/subscriptions/${row.id}`}
                        className="font-semibold text-brand hover:underline"
                      >
                        {t('openDetail')}
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
