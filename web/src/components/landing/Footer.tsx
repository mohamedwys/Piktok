import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Container } from '@/components/ui/Container';

const PRODUCT_LINKS = [
  { labelKey: 'linkAbout', href: '#' },
  { labelKey: 'linkPricing', href: '#pricing' },
  { labelKey: 'linkPro', href: '#pricing' },
] as const;

const CONTACT_LINKS = [
  { labelKey: 'linkSupport', href: '#' },
  { labelKey: 'linkTwitter', href: '#' },
  { labelKey: 'linkInstagram', href: '#' },
] as const;

export async function Footer() {
  const t = await getTranslations('footer');
  const tBrand = await getTranslations('brand');
  const tLegal = await getTranslations('legal.footer');

  return (
    <footer className="border-t border-border bg-surface py-16">
      <Container>
        <div className="grid grid-cols-1 gap-12 md:grid-cols-4">
          <div>
            <Link href="/" className="inline-block">
              <span className="font-display text-2xl font-semibold text-text-primary">
                {tBrand('name')}
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-text-tertiary">
              {t('tagline')}
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              {t('productHeading')}
            </h4>
            <ul className="mt-4 space-y-3">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.labelKey}>
                  <a
                    href={link.href}
                    className="text-sm text-text-secondary transition-colors hover:text-text-primary"
                  >
                    {t(link.labelKey)}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              {t('legalHeading')}
            </h4>
            <ul className="mt-4 space-y-3">
              <li>
                <Link
                  href="/legal/terms"
                  className="text-sm text-text-secondary transition-colors hover:text-text-primary"
                >
                  {tLegal('terms')}
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/privacy"
                  className="text-sm text-text-secondary transition-colors hover:text-text-primary"
                >
                  {tLegal('privacy')}
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/child-safety"
                  className="text-sm text-text-secondary transition-colors hover:text-text-primary"
                >
                  {tLegal('childSafety')}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              {t('contactHeading')}
            </h4>
            <ul className="mt-4 space-y-3">
              {CONTACT_LINKS.map((link) => (
                <li key={link.labelKey}>
                  <a
                    href={link.href}
                    className="text-sm text-text-secondary transition-colors hover:text-text-primary"
                  >
                    {t(link.labelKey)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-8">
          <p className="text-xs text-text-tertiary">{t('copyright')}</p>
        </div>
      </Container>
    </footer>
  );
}
