import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ChevronLeft, MessageSquare } from 'lucide-react';
import { requirePro } from '@/lib/pro/auth';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getCurrency } from '@/i18n/getCurrency';
import {
  fetchCustomerOrders,
  fetchCustomerSummary,
} from '@/lib/pro/data';
import type { Currency } from '@/i18n/currency';
import { Link } from '@/i18n/routing';
import { Container } from '@/components/ui/Container';
import { OrdersTable } from '@/components/pro/OrdersTable';

/**
 * Single customer detail page (Track 5).
 *
 * Shows the per-buyer header card (name + aggregates), the buyer's full
 * order history with this seller (all statuses — the detail surface is
 * where the seller goes to inspect everything, not just the paid leg
 * that put the buyer on the customers list), and a conversation-stub
 * card when the buyer has an active conversation thread.
 *
 * Conversation affordance — web stub, not a deep link. The web
 * companion has no messaging surface in v1; rather than emit a fake
 * `mony://` URL that nothing on the OS would resolve, surface a
 * one-liner pointing at the mobile app. Matches RecentActivityFeed's
 * treatment of inbound-message rows (unlinked).
 *
 * Order history is rendered with the existing OrdersTable component —
 * the row shape matches (fetchCustomerOrders mirrors fetchSellerOrders)
 * and the table is purely presentational, so reusing it keeps the
 * order-row affordance (thumbnail, title, amount, status, "Open" link)
 * consistent across surfaces.
 *
 * Force-dynamic — `requirePro` reads cookies and every fetch depends
 * on the authenticated caller's seller_id.
 */
export const dynamic = 'force-dynamic';

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

export default async function ProCustomerDetailPage({
  params,
}: {
  params: Promise<{ locale: string; buyerId: string }>;
}) {
  const { locale, buyerId } = await params;
  setRequestLocale(locale);

  const { sellerId } = await requirePro(locale);

  const supabase = await getSupabaseServer();
  const [summary, orders, currency, t] = await Promise.all([
    fetchCustomerSummary(supabase, sellerId, buyerId),
    fetchCustomerOrders(supabase, sellerId, buyerId),
    getCurrency(),
    getTranslations('pro.customers.detail'),
  ]);

  if (summary === null) {
    notFound();
  }

  const localeTag = numberLocaleTag(locale);
  const moneyFmt = new Intl.NumberFormat(localeTag, {
    style: 'currency',
    currency: toUpperCurrency(currency),
    maximumFractionDigits: 2,
  });
  const numberFmt = new Intl.NumberFormat(localeTag);
  const dateFmt = new Intl.DateTimeFormat(localeTag, {
    dateStyle: 'long',
  });

  const buyerDisplay = summary.buyerName ?? '—';

  return (
    <main className="py-8">
      <Container>
        <header className="mb-6 space-y-4">
          <Link
            href="/pro/customers"
            className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            {t('backLink')}
          </Link>
          <h1 className="font-display text-3xl font-semibold text-text-primary">
            {buyerDisplay}
          </h1>
        </header>

        <section
          aria-label={t('heading')}
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <article className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              {t('summaryLabel.totalSpend')}
            </h2>
            <p className="mt-2 font-display text-2xl font-semibold text-text-primary">
              {moneyFmt.format(summary.totalSpend)}
            </p>
          </article>
          <article className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              {t('summaryLabel.orderCount')}
            </h2>
            <p className="mt-2 font-display text-2xl font-semibold text-text-primary">
              {numberFmt.format(summary.orderCount)}
            </p>
          </article>
          <article className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              {t('summaryLabel.lastOrder')}
            </h2>
            <p className="mt-2 font-display text-2xl font-semibold text-text-primary">
              {dateFmt.format(new Date(summary.lastOrderAt))}
            </p>
          </article>
        </section>

        {summary.conversationId !== null ? (
          <section className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-surface-elevated p-5">
            <MessageSquare
              size={20}
              className="mt-0.5 shrink-0 text-text-secondary"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-text-primary">
                {t('conversationButton')}
              </h2>
              <p className="text-sm text-text-secondary">
                {t('conversationStub')}
              </p>
            </div>
          </section>
        ) : null}

        <section className="mt-10 space-y-4">
          <h2 className="font-display text-xl font-semibold text-text-primary">
            {t('ordersHeading')}
          </h2>
          <OrdersTable orders={orders} locale={locale} />
        </section>
      </Container>
    </main>
  );
}
