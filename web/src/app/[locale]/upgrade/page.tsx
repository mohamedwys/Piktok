import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect, Link } from '@/i18n/routing';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * Upgrade — H.6 placeholder, locale-aware (H.7.1).
 *
 * Auth-gated. Unauthenticated visitors are redirected to `/` (in
 * the current locale) rather than shown a sign-in form — sign-in
 * for the web side happens via the magic-link bounce from the
 * mobile app (issue-web-session → /auth/callback).
 *
 * `getUser()` (not `getSession()`) is the correct gate —
 * `getUser()` revalidates the JWT cryptographically, while
 * `getSession()` only reads from cookies which a determined user
 * can tamper. Auth-gated pages MUST use `getUser()`.
 *
 * The real Stripe Checkout integration lands in H.8. H.6's
 * placeholder body — translated copy + the user's email — stays
 * for now, confirming the magic-link auth-bridge is end-to-end
 * working through the locale router.
 *
 * Note: this route is currently dynamic-rendered (auth-gated; the
 * `getUser()` call uses request cookies). `setRequestLocale` is
 * still called for symmetry and to be future-proof if the auth
 * gate ever moves to the layout.
 */
export default async function UpgradePage({
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

  // next-intl's `redirect()` throws (returns `never`) but the
  // signature TypeScript sees from the type re-export doesn't
  // always carry that, so we capture the email up-front while
  // user is in scope as the narrowed branch.
  if (!user) {
    redirect({ href: '/', locale });
  }
  const email = user?.email ?? '';

  const t = await getTranslations('upgrade');

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-surface-elevated p-8">
        <h1 className="font-display text-xxxl font-semibold text-text-primary">
          {t('title')}
        </h1>
        <p className="text-text-secondary">
          {t('welcomeWith', { email })} {t('comingSoonBody')}
        </p>
        <Link
          href="/dashboard"
          className="inline-block text-brand underline underline-offset-4"
        >
          {t('goToDashboard')}
        </Link>
      </div>
    </main>
  );
}
