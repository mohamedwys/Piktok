import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requirePro } from '@/lib/pro/auth';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchSellerOrderById } from '@/lib/pro/data';
import { Container } from '@/components/ui/Container';
import { Link } from '@/i18n/routing';
import { OrderStatusPill } from '@/components/pro/OrderStatusPill';

/**
 * Single order detail page (Track 4).
 *
 * Read-only — sellers fulfill out-of-band in v1, so no edit affordance.
 * Four sections:
 *   1. Product snapshot — thumbnail + localized title + order amount.
 *   2. Buyer — name + clickable tel: link for the phone.
 *   3. Shipping — flattened from the jsonb `shipping_address` projection.
 *   4. Status — order created_at + pill.
 *
 * Forged or other-seller ids resolve to `null` via the seller_id eq
 * filter inside `fetchSellerOrderById` (RLS catches it too) → `notFound`.
 */
export const dynamic = 'force-dynamic';

function numberLocaleTag(locale: string): string {
  if (locale === 'fr') return 'fr-FR';
  if (locale === 'ar') return 'ar-AE';
  return 'en-US';
}

function titleFor(
  title: { fr?: string; en?: string } | null,
  locale: string,
): string {
  if (!title) return '—';
  const primary = locale === 'fr' ? title.fr : title.en;
  const fallback = locale === 'fr' ? title.en : title.fr;
  return primary ?? fallback ?? '—';
}

export default async function ProOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const { sellerId } = await requirePro(locale);
  const supabase = await getSupabaseServer();

  const [order, t] = await Promise.all([
    fetchSellerOrderById(supabase, sellerId, id),
    getTranslations('pro.orders'),
  ]);

  if (!order) {
    notFound();
  }

  const localeTag = numberLocaleTag(locale);
  const dateFmt = new Intl.DateTimeFormat(localeTag, {
    dateStyle: 'long',
    timeStyle: 'short',
  });
  const moneyFmt = new Intl.NumberFormat(localeTag, {
    style: 'currency',
    currency: order.currency.toUpperCase(),
    maximumFractionDigits: 2,
  });

  const productTitle = titleFor(order.productTitle, locale);
  const shipping = order.shippingAddress;

  // Stripe-collected E.164 phone — strip spaces for the tel: href, keep
  // the original for display.
  const phoneHref = order.buyerPhone
    ? `tel:${order.buyerPhone.replace(/\s+/g, '')}`
    : null;

  return (
    <main className="py-8">
      <Container>
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-semibold text-text-primary">
            {t('detail.heading')}
          </h1>
          <Link
            href="/pro/orders"
            className="text-sm font-semibold text-brand hover:underline"
          >
            {t('detail.backLink')}
          </Link>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="space-y-4 rounded-xl border border-border bg-surface-elevated p-6">
            <h2 className="font-display text-lg font-semibold text-text-primary">
              {t('detail.productSection')}
            </h2>
            <div className="flex items-start gap-4">
              {order.productThumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={order.productThumbnail}
                  alt=""
                  className="size-20 rounded-lg object-cover"
                />
              ) : (
                <div className="size-20 rounded-lg bg-surface" />
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="font-medium text-text-primary">
                  {productTitle}
                </div>
                <div className="text-lg font-semibold text-text-primary">
                  {moneyFmt.format(order.amount)}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-border bg-surface-elevated p-6">
            <h2 className="font-display text-lg font-semibold text-text-primary">
              {t('detail.statusSection')}
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-text-tertiary">{t('column.date')}</dt>
                <dd className="font-medium text-text-primary">
                  {dateFmt.format(new Date(order.createdAt))}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-text-tertiary">{t('column.status')}</dt>
                <dd>
                  <OrderStatusPill status={order.status} />
                </dd>
              </div>
            </dl>
          </section>

          <section className="space-y-4 rounded-xl border border-border bg-surface-elevated p-6">
            <h2 className="font-display text-lg font-semibold text-text-primary">
              {t('detail.buyerSection')}
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-text-tertiary">{t('column.buyer')}</dt>
                <dd className="font-medium text-text-primary">
                  {order.buyerName ?? '—'}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-text-tertiary">{t('detail.buyerPhone')}</dt>
                <dd className="font-medium text-text-primary">
                  {phoneHref ? (
                    <a
                      href={phoneHref}
                      className="text-brand hover:underline"
                    >
                      {order.buyerPhone}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section className="space-y-4 rounded-xl border border-border bg-surface-elevated p-6">
            <h2 className="font-display text-lg font-semibold text-text-primary">
              {t('detail.shippingSection')}
            </h2>
            {shipping ? (
              <address className="not-italic text-sm text-text-primary">
                {shipping.name ? <div>{shipping.name}</div> : null}
                {shipping.line1 ? <div>{shipping.line1}</div> : null}
                {shipping.line2 ? <div>{shipping.line2}</div> : null}
                {shipping.city || shipping.postal_code ? (
                  <div>
                    {[shipping.postal_code, shipping.city]
                      .filter((s): s is string => Boolean(s))
                      .join(' ')}
                  </div>
                ) : null}
                {shipping.state ? <div>{shipping.state}</div> : null}
                {shipping.country ? <div>{shipping.country}</div> : null}
              </address>
            ) : (
              <p className="text-sm text-text-tertiary">
                {t('detail.shippingEmpty')}
              </p>
            )}
          </section>
        </div>
      </Container>
    </main>
  );
}
