import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requirePro } from '@/lib/pro/auth';
import { getSupabaseServer } from '@/lib/supabase/server';
import {
  fetchSellerOrders,
  filterOrdersByQuery,
  type SellerOrderStatus,
} from '@/lib/pro/data';
import { Container } from '@/components/ui/Container';
import { OrderFilters } from '@/components/pro/OrderFilters';
import { OrdersTable } from '@/components/pro/OrdersTable';

/**
 * Pro orders list page (Track 4).
 *
 * Reads four searchParams:
 *   - status: 'paid' | 'pending' | 'refunded' | 'failed' | 'cancelled' | 'all'
 *   - from / to: YYYY-MM-DD bounds on `created_at` (inclusive)
 *   - q: in-memory text filter against buyer name + product title (both
 *        locales)
 *
 * Filters that the DB can scope (status, from, to) are pushed into
 * `fetchSellerOrders`; the text search is applied in-memory afterwards so
 * the same fetcher feeds the CSV export route without divergence.
 *
 * Force-dynamic — `requirePro` reads cookies and the query depends on the
 * authenticated caller's seller_id (RLS-scoped + explicit eq filter).
 */
export const dynamic = 'force-dynamic';

const STATUS_VALUES = new Set<SellerOrderStatus>([
  'paid',
  'pending',
  'refunded',
  'failed',
  'cancelled',
]);

function normalizeStatus(
  raw: string | string[] | undefined,
): SellerOrderStatus | 'all' {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value === 'string' && STATUS_VALUES.has(value as SellerOrderStatus)) {
    return value as SellerOrderStatus;
  }
  return 'all';
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDate(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && ISO_DATE_RE.test(value) ? value : '';
}

function normalizeQuery(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value.trim() : '';
}

export default async function ProOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    status?: string | string[];
    from?: string | string[];
    to?: string | string[];
    q?: string | string[];
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { sellerId } = await requirePro(locale);

  const sp = await searchParams;
  const status = normalizeStatus(sp.status);
  const from = normalizeDate(sp.from);
  const to = normalizeDate(sp.to);
  const query = normalizeQuery(sp.q);

  const supabase = await getSupabaseServer();
  const [allRows, t] = await Promise.all([
    fetchSellerOrders(supabase, sellerId, {
      status: status === 'all' ? undefined : status,
      from: from || undefined,
      to: to || undefined,
    }),
    getTranslations('pro.orders'),
  ]);

  const filtered = filterOrdersByQuery(allRows, query);

  // Forward the active filters to the CSV export endpoint so the file
  // mirrors what the seller sees on screen.
  const exportHref = (() => {
    const usp = new URLSearchParams();
    if (status !== 'all') usp.set('status', status);
    if (from) usp.set('from', from);
    if (to) usp.set('to', to);
    if (query) usp.set('q', query);
    const qs = usp.toString();
    return qs.length > 0
      ? `/api/pro/orders/export?${qs}`
      : '/api/pro/orders/export';
  })();

  return (
    <main className="py-8">
      <Container>
        <header className="mb-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="font-display text-3xl font-semibold text-text-primary">
              {t('heading')}
            </h1>
            <a
              href={exportHref}
              className="rounded-lg border border-border-strong bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-primary hover:bg-surface"
            >
              {t('exportCsv')}
            </a>
          </div>

          <OrderFilters status={status} from={from} to={to} q={query} />
        </header>

        <OrdersTable orders={filtered} locale={locale} />
      </Container>
    </main>
  );
}
