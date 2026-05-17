import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { CurrencyPicker } from '@/components/ui/CurrencyPicker';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { getCurrency } from '@/i18n/getCurrency';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * Sticky landing header.
 *
 * Locale-aware via next-intl's `getTranslations`. The Logo and
 * auth CTA use the locale-aware `Link` from `@/i18n/routing` so
 * the current locale is preserved on navigation. Anchor links
 * (`#features`, `#pricing`, `#faq`) use plain `<a>` because they
 * scroll within the same page; the locale prefix is irrelevant.
 *
 * The right-edge cluster carries the visitor's preference axes:
 *   - LanguageSwitcher (Globe icon, EN/FR/AR)
 *   - CurrencyPicker (Coins icon, EUR/USD/AED) — H.7.3 addition
 *   - Auth CTA — "Sign in" (anon), "Dashboard" (authed non-Pro),
 *     or "Pro dashboard" (authed Pro). Routing each user to the
 *     surface that's most useful for them instead of always
 *     bouncing through /sign-in.
 *
 * Both pickers are Client Components owning their own dropdown
 * state. The Header itself stays a Server Component so it can
 * resolve the initial currency via `getCurrency()` AND read the
 * auth/Pro state via `getSupabaseServer()`. The parent landing
 * page is already `force-dynamic` so the per-request cookie reads
 * here add no incremental rendering cost.
 *
 * Pro check reads `sellers.is_pro` (the trigger-maintained boolean
 * that mirrors `subscriptions.status`) — same source of truth used
 * by `requirePro()` in `@/lib/pro/auth`. We use `getUser()` not
 * `getSession()` for the cryptographic JWT revalidation.
 */
export async function Header() {
  const t = await getTranslations('nav');
  const tBrand = await getTranslations('brand');
  const currency = await getCurrency();

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let authCta: { href: '/sign-in' | '/dashboard' | '/pro'; label: string } = {
    href: '/sign-in',
    label: t('signIn'),
  };
  if (user) {
    const { data: seller } = await supabase
      .from('sellers')
      .select('is_pro')
      .eq('user_id', user.id)
      .maybeSingle();
    const isPro = seller?.is_pro === true;
    authCta = isPro
      ? { href: '/pro', label: t('proDashboard') }
      : { href: '/dashboard', label: t('dashboard') };
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/70 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center">
          <span className="font-display text-2xl font-semibold text-text-primary">
            {tBrand('name')}
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            className="text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            {t('features')}
          </a>
          <a
            href="#pricing"
            className="text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            {t('pricing')}
          </a>
          <a
            href="#faq"
            className="text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            {t('faq')}
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <CurrencyPicker initial={currency} />
          <Link href={authCta.href} className="ms-2">
            <Button variant="outline" size="md">
              {authCta.label}
            </Button>
          </Link>
        </div>
      </Container>
    </header>
  );
}
