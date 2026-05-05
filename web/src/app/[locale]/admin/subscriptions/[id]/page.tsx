import { notFound } from 'next/navigation';
import {
  getTranslations,
  setRequestLocale,
} from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { requireAdmin } from '@/lib/admin/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { Container } from '@/components/ui/Container';
import {
  StatusPill,
  type SubscriptionStatus,
} from '@/components/dashboard/StatusPill';
import { AdminActions } from '@/components/admin/AdminActions';

/**
 * Admin subscription detail (H.11).
 *
 * Shows everything we have on a single subscription + the
 * destructive-action panel (cancel-period-end, cancel-immediate,
 * refund-last-charge). Reached via "Open" link from the admin
 * list page.
 *
 * Same defense-in-depth as the list page: `requireAdmin()`
 * check first, service-role data fetch second, the API routes
 * called by AdminActions check `is_admin` independently.
 *
 * Stripe IDs are shown truncated (first 14 chars + "…") to
 * communicate "this is a real Stripe object" without dumping
 * 30-char IDs into the layout. Hover on the truncated ID
 * reveals the full value via title attribute.
 */
export const dynamic = 'force-dynamic';

type DetailRow = {
  id: string;
  seller_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  stripe_price_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  trial_end: string | null;
  created_at: string;
  updated_at: string | null;
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

function truncateId(id: string): string {
  if (id.length <= 18) return id;
  return id.slice(0, 14) + '…';
}

function formatDate(value: string | null, localeTag: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(localeTag, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function AdminSubscriptionDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  await requireAdmin(locale);

  const t = await getTranslations('admin');
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('subscriptions')
    .select(
      `
        id, seller_id, stripe_subscription_id,
        stripe_customer_id, stripe_price_id, status,
        current_period_start, current_period_end,
        cancel_at_period_end, canceled_at, trial_end,
        created_at, updated_at,
        seller:sellers!seller_id(
          id, user_id, name, avatar_url, email_public
        )
      `,
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[H.11] subscription detail query failed:', error.message);
  }
  if (!data) {
    notFound();
  }

  const row = data as unknown as DetailRow;
  const seller = Array.isArray(row.seller) ? row.seller[0] : row.seller;
  const dateLocaleTag =
    locale === 'fr' ? 'fr-FR' : locale === 'ar' ? 'ar-AE' : 'en-US';

  const alreadyCanceled = row.status === 'canceled';
  const alreadyCancelingAtPeriodEnd = row.cancel_at_period_end;

  return (
    <main className="min-h-screen bg-background py-8 text-text-primary">
      <Container>
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="space-y-2">
            <Link
              href="/admin"
              className="text-sm text-text-tertiary hover:text-text-primary"
            >
              ← {t('backToList')}
            </Link>
            <h1 className="font-display text-3xl font-semibold">
              {t('detailTitle')}
            </h1>
          </div>

          {/* Seller card */}
          <section className="space-y-4 rounded-xl border border-border bg-surface-elevated p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              {t('sectionSeller')}
            </h2>
            <div className="flex items-center gap-4">
              {seller?.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={seller.avatar_url}
                  alt=""
                  className="size-14 rounded-pill"
                />
              ) : (
                <div className="size-14 rounded-pill bg-surface" />
              )}
              <div>
                <div className="font-display text-xl font-semibold">
                  {seller?.name ?? '—'}
                </div>
                <div className="text-sm text-text-secondary">
                  {seller?.email_public ?? '—'}
                </div>
              </div>
            </div>
          </section>

          {/* Subscription state */}
          <section className="space-y-4 rounded-xl border border-border bg-surface-elevated p-6">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                {t('sectionState')}
              </h2>
              <StatusPill status={row.status as SubscriptionStatus} />
            </div>

            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-text-tertiary">
                  {t('fieldStarted')}
                </dt>
                <dd className="mt-1 font-medium text-text-primary">
                  {formatDate(row.current_period_start, dateLocaleTag)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-text-tertiary">
                  {alreadyCancelingAtPeriodEnd
                    ? t('cancelsOnLabel')
                    : t('renewsOnLabel')}
                </dt>
                <dd className="mt-1 font-medium text-text-primary">
                  {formatDate(row.current_period_end, dateLocaleTag)}
                </dd>
              </div>
              {row.canceled_at ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-text-tertiary">
                    {t('fieldCanceledAt')}
                  </dt>
                  <dd className="mt-1 font-medium text-text-primary">
                    {formatDate(row.canceled_at, dateLocaleTag)}
                  </dd>
                </div>
              ) : null}
              {row.trial_end ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-text-tertiary">
                    {t('fieldTrialEnd')}
                  </dt>
                  <dd className="mt-1 font-medium text-text-primary">
                    {formatDate(row.trial_end, dateLocaleTag)}
                  </dd>
                </div>
              ) : null}
            </dl>

            {alreadyCancelingAtPeriodEnd ? (
              <div className="rounded-lg bg-feedback-warning/10 p-4 text-sm text-feedback-warning">
                {t('cancelingNoticeAdmin')}
              </div>
            ) : null}
          </section>

          {/* Stripe IDs */}
          <section className="space-y-4 rounded-xl border border-border bg-surface-elevated p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              {t('sectionStripe')}
            </h2>
            <dl className="grid grid-cols-1 gap-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-text-tertiary">
                  {t('fieldSubscriptionId')}
                </dt>
                <dd
                  className="font-mono text-text-secondary"
                  title={row.stripe_subscription_id}
                >
                  {truncateId(row.stripe_subscription_id)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-text-tertiary">
                  {t('fieldCustomerId')}
                </dt>
                <dd
                  className="font-mono text-text-secondary"
                  title={row.stripe_customer_id}
                >
                  {truncateId(row.stripe_customer_id)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-text-tertiary">{t('fieldPriceId')}</dt>
                <dd
                  className="font-mono text-text-secondary"
                  title={row.stripe_price_id}
                >
                  {truncateId(row.stripe_price_id)}
                </dd>
              </div>
            </dl>
          </section>

          {/* Actions */}
          <section className="space-y-4 rounded-xl border border-border bg-surface-elevated p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              {t('sectionActions')}
            </h2>
            <AdminActions
              stripeSubscriptionId={row.stripe_subscription_id}
              stripeCustomerId={row.stripe_customer_id}
              alreadyCancelingAtPeriodEnd={alreadyCancelingAtPeriodEnd}
              alreadyCanceled={alreadyCanceled}
            />
          </section>
        </div>
      </Container>
    </main>
  );
}
