import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link, redirect } from '@/i18n/routing';
import { getSupabaseServer } from '@/lib/supabase/server';
import { Container } from '@/components/ui/Container';
import { SuccessActivationPoll } from '@/components/upgrade/SuccessActivationPoll';

/**
 * /upgrade/success — Stripe lands the user here after a successful
 * Checkout. Track 7 redesign: instead of a static "processing" copy
 * the page now polls for activation and transitions through three
 * states (polling → activated → timeout) handled by the Client
 * Component below.
 *
 * Auth gate uses `getUser` directly (not `requirePro`). At the moment
 * this page renders, the Stripe webhook may not have flipped
 * `is_pro=true` yet — using `requirePro` would redirect the user to
 * /upgrade in a frustrating loop. The user IS authenticated though
 * (Stripe Checkout enforces it via the customer email), so an
 * unauthenticated visitor here is a misroute and goes home.
 *
 * Force-dynamic because every render depends on the auth cookie + a
 * future activation may require fresh data — Next's static pipeline
 * would otherwise serve a stale snapshot.
 */
export const dynamic = 'force-dynamic';

export default async function SuccessPage({
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

  const t = await getTranslations('pro.success');

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <Container>
        <div className="mx-auto max-w-2xl space-y-8">
          <SuccessActivationPoll locale={locale} />

          <div className="border-t border-border pt-6 text-center">
            <Link
              href="/"
              className="text-sm font-medium text-text-secondary hover:text-text-primary"
            >
              {t('secondaryCta')}
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}
