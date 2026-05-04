import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * Dashboard — H.6 placeholder, locale-aware (H.7.1).
 *
 * Auth-gated symmetrically with /upgrade. Real subscription
 * management UI (current plan, renewal date, cancel-state, link
 * to Stripe Customer Portal) lands in H.10. For H.6 we show the
 * authenticated user's email — same pattern as /upgrade — so the
 * placeholder confirms the auth flow without committing to a UI.
 */
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

  const t = await getTranslations('dashboard');

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-surface-elevated p-8">
        <h1 className="font-display text-xxxl font-semibold text-text-primary">
          {t('title')}
        </h1>
        <p className="text-text-secondary">
          {t('greetingWith', { email })} {t('comingSoonBody')}
        </p>
      </div>
    </main>
  );
}
