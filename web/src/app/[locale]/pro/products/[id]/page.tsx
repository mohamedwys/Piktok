import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requirePro } from '@/lib/pro/auth';
import { getSupabaseServer } from '@/lib/supabase/server';
import {
  fetchProductForEdit,
  fetchProductsWithStats,
} from '@/lib/pro/data';
import { Container } from '@/components/ui/Container';
import { Link } from '@/i18n/routing';
import { ProductEditor } from '@/components/pro/ProductEditor';

/**
 * Single product editor page (Track 3).
 *
 * Two reads from the cookie-authed SSR client:
 *   1. `fetchProductForEdit` — the row to edit (RLS-scoped + explicit
 *      seller_id eq for defense in depth). NULL → notFound().
 *   2. `fetchProductsWithStats` — pulls the seller's full product list
 *      so we can find this product's view / revenue aggregates for the
 *      read-only stats panel. Acceptable v1 overfetch since a seller's
 *      listing count is small; a future iteration could add a narrower
 *      single-product stats RPC.
 *
 * The Server Component renders the read-only stats panel directly and
 * delegates the editable form fields to <ProductEditor /> (Client).
 */
export const dynamic = 'force-dynamic';

function numberLocaleTag(locale: string): string {
  if (locale === 'fr') return 'fr-FR';
  if (locale === 'ar') return 'ar-AE';
  return 'en-US';
}

export default async function ProProductEditorPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const { sellerId } = await requirePro(locale);
  const supabase = await getSupabaseServer();

  const [product, statsRows, t] = await Promise.all([
    fetchProductForEdit(supabase, id, sellerId),
    fetchProductsWithStats(supabase),
    getTranslations('pro.editor'),
  ]);

  if (!product) {
    notFound();
  }

  const stats = statsRows.find((row) => row.product_id === id) ?? null;

  const localeTag = numberLocaleTag(locale);
  const moneyFmt = new Intl.NumberFormat(localeTag, {
    style: 'currency',
    currency: product.currency.toUpperCase(),
    maximumFractionDigits: 2,
  });
  const numFmt = new Intl.NumberFormat(localeTag);
  const dateFmt = new Intl.DateTimeFormat(localeTag, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const featuredUntilLabel = product.featured_until
    ? dateFmt.format(new Date(product.featured_until))
    : '—';
  const createdAtLabel = dateFmt.format(new Date(product.created_at));

  return (
    <main className="py-8">
      <Container>
        <header className="mb-6 flex items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-semibold text-text-primary">
            {t('heading')}
          </h1>
          <Link
            href="/pro/products"
            className="text-sm font-semibold text-brand hover:underline"
          >
            {t('backToList')}
          </Link>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ProductEditor product={product} />
          </div>

          <aside className="space-y-6">
            <section className="space-y-4 rounded-xl border border-border bg-surface-elevated p-6">
              <h2 className="font-display text-lg font-semibold text-text-primary">
                {t('statsHeading')}
              </h2>
              {product.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.thumbnail_url}
                  alt=""
                  className="w-full rounded-lg object-cover"
                />
              ) : null}
              <dl className="space-y-3 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-text-tertiary">{t('statViews7d')}</dt>
                  <dd className="font-medium text-text-primary">
                    {numFmt.format(stats?.views_7d ?? 0)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-text-tertiary">{t('statRevenue')}</dt>
                  <dd className="font-medium text-text-primary">
                    {moneyFmt.format(stats?.gross_revenue ?? 0)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-text-tertiary">{t('statSalesCount')}</dt>
                  <dd className="font-medium text-text-primary">
                    {numFmt.format(stats?.paid_sales_count ?? 0)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-text-tertiary">
                    {t('statFeaturedUntil')}
                  </dt>
                  <dd className="font-medium text-text-primary">
                    {featuredUntilLabel}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-text-tertiary">{t('statCreatedAt')}</dt>
                  <dd className="font-medium text-text-primary">
                    {createdAtLabel}
                  </dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      </Container>
    </main>
  );
}
