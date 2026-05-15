import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requirePro } from '@/lib/pro/auth';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getCurrency } from '@/i18n/getCurrency';
import {
  fetchSellerCustomers,
  filterCustomersByQuery,
} from '@/lib/pro/data';
import { Container } from '@/components/ui/Container';
import { CustomersSearch } from '@/components/pro/CustomersSearch';
import { CustomersTable } from '@/components/pro/CustomersTable';

/**
 * Pro customers list page (Track 5).
 *
 * Reads one searchParam:
 *   - q: in-memory text filter against buyer_name (case-insensitive
 *        substring).
 *
 * One server-scoped fetch (`get_seller_customers` RPC) + the display
 * currency cookie in parallel. The text search is an in-memory pass on
 * the returned page so the same fetcher can feed a future CSV export
 * (mirrors the orders-list architecture).
 *
 * Tab visibility is gated by the PostHog `show_pro_customers_tab` flag
 * on the layout above — this page is reachable by direct URL even when
 * the tab is hidden, which is intentional: it lets the page ship before
 * the flag flips without exposing the entry point.
 *
 * Force-dynamic — `requirePro` reads cookies and the RPC result depends
 * on the authenticated caller's seller_id (resolved server-side via
 * auth.uid()).
 */
export const dynamic = 'force-dynamic';

function normalizeQuery(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value.trim() : '';
}

export default async function ProCustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requirePro(locale);

  const sp = await searchParams;
  const query = normalizeQuery(sp.q);

  const supabase = await getSupabaseServer();
  const [allRows, currency, t] = await Promise.all([
    fetchSellerCustomers(supabase),
    getCurrency(),
    getTranslations('pro.customers'),
  ]);

  const filtered = filterCustomersByQuery(allRows, query);

  return (
    <main className="py-8">
      <Container>
        <header className="mb-6 space-y-4">
          <h1 className="font-display text-3xl font-semibold text-text-primary">
            {t('heading')}
          </h1>
          <CustomersSearch q={query} />
        </header>

        <CustomersTable
          customers={filtered}
          currency={currency}
          locale={locale}
        />
      </Container>
    </main>
  );
}
