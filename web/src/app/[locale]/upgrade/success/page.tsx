import {
  getTranslations,
  setRequestLocale,
} from 'next-intl/server';
import { CircleCheck } from 'lucide-react';
import { Link, redirect } from '@/i18n/routing';
import { getSupabaseServer } from '@/lib/supabase/server';
import { Container } from '@/components/ui/Container';

/**
 * /upgrade/success — Stripe redirects here after a successful
 * Checkout (H.8).
 *
 * Auth-gated. The `?session_id={CHECKOUT_SESSION_ID}` query
 * param is captured for future telemetry (mapping the user's
 * confirmation moment to a specific Checkout Session) but not
 * displayed in v1.
 *
 * **"Processing" copy is deliberate.** This page is reached
 * before the H.9 webhook has necessarily landed — the Stripe
 * `customer.subscription.created` event fires asynchronously
 * after the Checkout Session completes, and the webhook handler
 * upserts into `public.subscriptions`, which then triggers the
 * H.2 SQL trigger that flips `sellers.is_pro = true`. Typical
 * webhook propagation under test mode is under 2 seconds, but
 * we should never claim "you are now Pro" until the database
 * row exists. The "your subscription is being activated" copy
 * communicates the in-flight nature without overpromising.
 *
 * Future polish (H.10+): poll `useMySubscription` from a
 * Client Component on this page to detect the moment
 * `is_pro = true`, then swap copy to "You are now Pro!" with
 * a confetti or similar celebratory beat.
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

  const t = await getTranslations('upgrade.success');

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <Container>
        <div className="mx-auto max-w-md space-y-6 text-center">
          <CircleCheck
            className="mx-auto text-feedback-success"
            size={64}
            aria-hidden
          />
          <h1 className="font-display text-4xl font-semibold text-text-primary">
            {t('title')}
          </h1>
          <p className="text-text-secondary">{t('processing')}</p>
          <p className="text-sm text-text-tertiary">{t('returnHint')}</p>
          <Link
            href="/dashboard"
            className="inline-block font-semibold text-brand"
          >
            {t('dashboardLink')} →
          </Link>
        </div>
      </Container>
    </main>
  );
}
