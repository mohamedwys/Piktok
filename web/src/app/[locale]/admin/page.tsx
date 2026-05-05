import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireAdmin } from '@/lib/admin/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { Container } from '@/components/ui/Container';
import {
  AdminSubscriptionTable,
  type AdminSubscriptionRow,
} from '@/components/admin/AdminSubscriptionTable';

/**
 * Admin home — subscription list (H.11).
 *
 * Auth + admin gated. After `requireAdmin()` verifies the
 * caller's `is_admin` flag, the page uses the service-role
 * client (`getSupabaseAdmin()` from H.9) to read
 * `subscriptions` ACROSS all sellers — RLS would block this
 * via the `subscriptions_self_select` policy, so service-role
 * is the right tool here. Critical: service-role only AFTER
 * the gate.
 *
 * Filters via query string (`?q=&status=`). Server re-renders
 * with new params; no JS for filtering — the form in
 * AdminSubscriptionTable does a plain GET submission.
 *
 * v1 simplicity: 100-row limit + in-memory search across
 * `seller.name` and `seller.email_public`. Switch to a paginated
 * cursor query + full-text index when subscription count > 1k.
 *
 * Force-dynamic — auth + cookie reads + per-request filter
 * params + service-role data fetch.
 */
export const dynamic = 'force-dynamic';

export default async function AdminHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { locale } = await params;
  const { q, status } = await searchParams;
  setRequestLocale(locale);

  await requireAdmin(locale);

  const t = await getTranslations('admin');
  const admin = getSupabaseAdmin();

  let query = admin
    .from('subscriptions')
    .select(
      `
        id, seller_id, stripe_subscription_id,
        stripe_customer_id, status, current_period_end,
        cancel_at_period_end, created_at,
        seller:sellers!seller_id(
          id, user_id, name, avatar_url, email_public
        )
      `,
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[H.11] admin list query failed:', error.message);
  }

  const rows = (data ?? []) as unknown as AdminSubscriptionRow[];

  // In-memory filter on name / email_public.
  const filtered = q
    ? rows.filter((row) => {
        const seller = Array.isArray(row.seller)
          ? row.seller[0]
          : row.seller;
        if (!seller) return false;
        const haystack =
          `${seller.name ?? ''} ${seller.email_public ?? ''}`.toLowerCase();
        return haystack.includes(q.toLowerCase());
      })
    : rows;

  return (
    <main className="min-h-screen bg-background py-8 text-text-primary">
      <Container>
        <header className="mb-8 space-y-2">
          <h1 className="font-display text-3xl font-semibold">
            {t('title')}
          </h1>
          <p className="text-sm text-text-secondary">
            {t('total', { count: filtered.length })}
          </p>
        </header>

        <AdminSubscriptionTable
          subscriptions={filtered}
          currentStatus={status ?? 'all'}
          currentQuery={q ?? ''}
          locale={locale}
        />
      </Container>
    </main>
  );
}
