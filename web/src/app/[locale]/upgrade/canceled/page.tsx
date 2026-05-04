import {
  getTranslations,
  setRequestLocale,
} from 'next-intl/server';
import { Link, redirect } from '@/i18n/routing';
import { getSupabaseServer } from '@/lib/supabase/server';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';

/**
 * /upgrade/canceled — Stripe redirects here when the user
 * cancels Checkout (clicks the back button on the hosted page,
 * closes the Checkout tab, etc.) (H.8).
 *
 * Auth-gated symmetrically with /upgrade and /upgrade/success.
 * Copy is intentionally low-friction: the user explicitly chose
 * to cancel, so we don't pressure them — just confirm "no
 * charge" and offer a path back to /upgrade if they change
 * their mind.
 *
 * No Stripe Session inspection needed — the cancel URL doesn't
 * receive a session_id query param (Stripe only adds that on
 * success). The page renders the same regardless of why
 * Checkout was abandoned.
 */
export const dynamic = 'force-dynamic';

export default async function CanceledPage({
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

  const t = await getTranslations('upgrade.canceled');

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <Container>
        <div className="mx-auto max-w-md space-y-6 text-center">
          <h1 className="font-display text-4xl font-semibold text-text-primary">
            {t('title')}
          </h1>
          <p className="text-text-secondary">{t('body')}</p>
          <Link href="/upgrade" className="inline-block">
            <Button variant="primary" size="lg">
              {t('retry')}
            </Button>
          </Link>
        </div>
      </Container>
    </main>
  );
}
