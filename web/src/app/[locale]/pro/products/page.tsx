import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requirePro } from '@/lib/pro/auth';
import { getSupabaseServer } from '@/lib/supabase/server';
import {
  fetchProductsWithStats,
  fetchSellerConnectState,
} from '@/lib/pro/data';
import { Container } from '@/components/ui/Container';
import { Link } from '@/i18n/routing';
import { ProductsTable } from '@/components/pro/ProductsTable';

/**
 * Pro products list page (Track 3).
 *
 * Fetches every product owned by the caller (server-side aggregate join
 * via `get_seller_products_with_stats`) and renders a row per product
 * with per-row stats: views_7d, gross_revenue, paid_sales_count. The
 * `?mode=` and `?q=` query params filter the in-memory result set —
 * acceptable for v1 since a Pro seller's listing count is small. When a
 * seller crosses ~1k listings, this fetch + filter should move to a
 * server-side WHERE clause (RPC arg or direct query).
 *
 * Bulk-select state lives in the Client Component below; the server
 * just hands over the list and lets the table own toggle + toolbar.
 *
 * Force-dynamic — `requirePro()` reads cookies and the RPC's result
 * depends on the authenticated caller.
 */
export const dynamic = 'force-dynamic';

type FilterMode = 'all' | 'buy_now' | 'contact_only';

function normalizeMode(raw: string | string[] | undefined): FilterMode {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === 'buy_now' || value === 'contact_only' ? value : 'all';
}

function normalizeQuery(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value.trim() : '';
}

export default async function ProProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[]; mode?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { sellerId } = await requirePro(locale);

  const sp = await searchParams;
  const mode = normalizeMode(sp.mode);
  const query = normalizeQuery(sp.q);
  const queryLc = query.toLowerCase();

  const supabase = await getSupabaseServer();
  // Connect state is fetched alongside the products list so the bulk
  // toolbar can short-circuit the buy_now action when the seller isn't
  // Connect-ready. Reading on every render avoids stale state when a
  // Stripe-side flip (e.g., account disabled) needs to surface here.
  const [allRows, connectState, t] = await Promise.all([
    fetchProductsWithStats(supabase),
    fetchSellerConnectState(supabase, sellerId),
    getTranslations('pro.products'),
  ]);
  const isConnected = connectState.status === 'connected';

  const filtered = allRows.filter((row) => {
    if (mode !== 'all' && row.purchase_mode !== mode) return false;
    if (queryLc.length === 0) return true;
    const fr = (row.title?.fr ?? '').toLowerCase();
    const en = (row.title?.en ?? '').toLowerCase();
    return fr.includes(queryLc) || en.includes(queryLc);
  });

  const pills: { value: FilterMode; label: string }[] = [
    { value: 'all', label: t('filterAll') },
    { value: 'buy_now', label: t('filterBuyNow') },
    { value: 'contact_only', label: t('filterContactOnly') },
  ];

  return (
    <main className="py-8">
      <Container>
        <header className="mb-6 space-y-4">
          <h1 className="font-display text-3xl font-semibold text-text-primary">
            {t('heading')}
          </h1>

          <form method="get" className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder={t('searchPlaceholder')}
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface-elevated px-4 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
            />
            {/* Preserve mode across search submits via hidden input. */}
            <input type="hidden" name="mode" value={mode} />
            <button
              type="submit"
              className="rounded-lg border border-border-strong bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-primary hover:bg-surface"
            >
              {t('searchSubmit')}
            </button>
          </form>

          <nav
            aria-label={t('filterNavLabel')}
            className="flex flex-wrap gap-2"
          >
            {pills.map((pill) => {
              const active = pill.value === mode;
              const href = (() => {
                const sp = new URLSearchParams();
                if (query.length > 0) sp.set('q', query);
                if (pill.value !== 'all') sp.set('mode', pill.value);
                const qs = sp.toString();
                return qs.length > 0 ? `/pro/products?${qs}` : `/pro/products`;
              })();
              return (
                <Link
                  key={pill.value}
                  href={href}
                  className={
                    active
                      ? 'rounded-pill border border-brand bg-brand/10 px-4 py-1.5 text-sm font-semibold text-brand'
                      : 'rounded-pill border border-border bg-surface-elevated px-4 py-1.5 text-sm text-text-secondary hover:bg-surface'
                  }
                >
                  {pill.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <ProductsTable
          products={filtered}
          locale={locale}
          isConnected={isConnected}
        />
      </Container>
    </main>
  );
}
