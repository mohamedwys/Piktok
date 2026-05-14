import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * Admin layout for the moderation subtree (`/admin/reports/*`).
 *
 * Scoped to `/admin/reports` rather than `/admin` so the existing
 * H.11 subscriptions admin (`[locale]/admin/page.tsx` + its
 * subscription detail pages) is untouched -- it has its own
 * full-bleed visual treatment via `requireAdmin()` in each page.
 * The reports surface gets its own minimal shell here.
 *
 * Auth gate inlined (not via `requireAdmin()` from
 * `@/lib/admin/auth`) because the spec asks for a `/admin/forbidden`
 * landing on failure rather than a redirect to `/`. We don't want
 * to change `requireAdmin()`'s contract since the subscriptions
 * admin still relies on the redirect-to-home behavior.
 *
 * v1 admin UI is English-only -- no `getTranslations()` and no
 * `next-intl` `useTranslations()` consumed in the children. The
 * `setRequestLocale(locale)` call still fires because the locale
 * is a path param and Next.js's static-rendering pass for
 * `[locale]` segments requires it.
 */
export default async function AdminReportsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect({ href: '/admin/forbidden', locale });
  }

  const { data: seller } = await supabase
    .from('sellers')
    .select('is_admin')
    .eq('user_id', user!.id)
    .maybeSingle();

  if (!seller || !seller.is_admin) {
    redirect({ href: '/admin/forbidden', locale });
  }

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <header className="border-b border-border bg-surface-elevated">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 lg:px-8">
          <h1 className="font-display text-xl font-semibold">
            Mony — Admin
          </h1>
          <div className="flex items-center gap-6 text-sm">
            <a
              href={locale === 'en' ? '/admin' : `/${locale}/admin`}
              className="text-text-secondary hover:text-text-primary"
            >
              Subscriptions
            </a>
            <a
              href={locale === 'en' ? '/admin/reports' : `/${locale}/admin/reports`}
              className="font-medium text-text-primary"
            >
              Reports
            </a>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8 lg:px-8">{children}</main>
    </div>
  );
}
