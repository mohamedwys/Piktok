import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { CurrencyPicker } from '@/components/ui/CurrencyPicker';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { getCurrency } from '@/i18n/getCurrency';

/**
 * Sticky landing header.
 *
 * Locale-aware via next-intl's `getTranslations`. The Logo and
 * "Sign in" link use the locale-aware `Link` from `@/i18n/routing`
 * so the current locale is preserved on navigation. Anchor links
 * (`#features`, `#pricing`, `#faq`) use plain `<a>` because they
 * scroll within the same page; the locale prefix is irrelevant.
 *
 * The right-edge cluster carries the visitor's preference axes:
 *   - LanguageSwitcher (Globe icon, EN/FR/AR)
 *   - CurrencyPicker (Coins icon, EUR/USD/AED) — H.7.3 addition
 *   - Sign-in CTA
 *
 * Both pickers are Client Components owning their own dropdown
 * state. The Header itself stays a Server Component so it can
 * resolve the initial currency via `getCurrency()` and seed the
 * picker's `initial` prop — this avoids a flash of "wrong"
 * currency on first paint between SSR and hydration.
 */
export async function Header() {
  const t = await getTranslations('nav');
  const tBrand = await getTranslations('brand');
  const currency = await getCurrency();

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
          <Link href="/sign-in" className="ms-2">
            <Button variant="outline" size="md">
              {t('signIn')}
            </Button>
          </Link>
        </div>
      </Container>
    </header>
  );
}
