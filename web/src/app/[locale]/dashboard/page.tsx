import {
  getTranslations,
  setRequestLocale,
} from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getSupabaseServer } from '@/lib/supabase/server';
import { Container } from '@/components/ui/Container';
import { SubscriptionSummaryCard } from '@/components/dashboard/SubscriptionSummaryCard';
import { EmptyDashboard } from '@/components/dashboard/EmptyDashboard';

/**
 * /dashboard — real subscription management surface (H.10).
 *
 * Replaces H.6's "shipping soon" placeholder. Auth-gated. Reads
 * the user's subscription row via the SSR cookie-authed client
 * (RLS-scoped per the H.2 `subscriptions_self_select` policy).
 * No service-role client here — the dashboard is a personal
 * surface, the visitor reads only their own row.
 *
 * Force-dynamic because:
 *   - `getUser()` reads cookies (auth gate)
 *   - `setRequestLocale(locale)` + RLS-scoped query are
 *     per-request
 *
 * Two render paths:
 *   - With subscription → `<SubscriptionSummaryCard />` (plan,
 *     status, renewal date, manage button)
 *   - Without subscription → `<EmptyDashboard />` (CTA to
 *     /upgrade)
 *
 * Cancel/reactivate flows aren't built inline — the manage
 * button opens Stripe's Customer Portal, which handles all
 * billing UX (cancel, change plan, payment-method updates,
 * invoice download, reactivation).
 */
export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect({ href: '/', locale });
  }
  const email = user?.email ?? '';

  // Resolve seller row (1:1 with auth.users via H.2 schema's
  // sellers.user_id). Subscription is then RLS-scoped to
  // seller_id ∈ {sellers.id where user_id = auth.uid()}.
  const { data: seller } = await supabase
    .from('sellers')
    .select('id')
    .eq('user_id', user!.id)
    .maybeSingle();

  const { data: subscription } = seller
    ? await supabase
        .from('subscriptions')
        .select('*')
        .eq('seller_id', seller.id)
        .maybeSingle()
    : { data: null };

  const t = await getTranslations('dashboard');

  return (
    <main className="min-h-screen bg-background py-12 text-text-primary">
      <Container>
        <div className="mx-auto max-w-2xl space-y-8">
          <header className="space-y-2">
            <h1 className="font-display text-4xl font-semibold">
              {t('title')}
            </h1>
            <p className="text-text-secondary">
              {t('signedInAs', { email })}
            </p>
          </header>

          {subscription ? (
            <SubscriptionSummaryCard
              subscription={subscription}
              locale={locale}
            />
          ) : (
            <EmptyDashboard />
          )}
        </div>
      </Container>
    </main>
  );
}
