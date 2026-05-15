import { setRequestLocale } from 'next-intl/server';
import { requirePro } from '@/lib/pro/auth';
import { Container } from '@/components/ui/Container';
import { ReturnPollClient } from '@/components/pro/ReturnPollClient';

/**
 * /pro/payouts/return — landing after Stripe Express onboarding completes
 * (Track F.C.2). Stripe redirects here on the F.C.1 edge function's
 * `return_url`. The page does NOT trust the user-side state: instead it
 * polls the Connect status endpoint until the `account.updated` webhook
 * flips `charges_enabled = true` (or 30 s elapse, in which case the
 * client surfaces a manual-refresh fallback).
 *
 * Auth gate is `requirePro` — the user IS Pro by construction (only
 * Pro sellers ever start Connect onboarding) but might not yet be
 * "Connected" until the webhook lands. `requireProConnected` would
 * redirect them away from the very surface they need.
 *
 * Force-dynamic — every render depends on the auth cookie + future
 * activation.
 */
export const dynamic = 'force-dynamic';

export default async function PayoutsReturnPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Gate first — anonymous callers get redirected home.
  await requirePro(locale);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <Container>
        <div className="mx-auto max-w-2xl">
          <ReturnPollClient />
        </div>
      </Container>
    </main>
  );
}
