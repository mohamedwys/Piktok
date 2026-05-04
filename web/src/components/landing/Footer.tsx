import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Container } from '@/components/ui/Container';

/**
 * Marketing footer — minimal legal + nav columns.
 *
 * Three columns of links plus a brand block on the left. Most
 * destinations are placeholders pointing to "#" because the
 * underlying pages (Terms, Privacy, Cookies, Support) aren't
 * built yet — H.X ships them as legal launch prep.
 *
 * Background steps DOWN to `bg-surface` (one layer below the
 * sections above) — visually anchors the page bottom and gives a
 * clear "here ends the marketing" signal.
 *
 * Localized copy via the `footer` and `brand` namespaces. The
 * link labels translate; the hrefs stay shared across locales
 * (links to `#pricing` work the same on every locale variant
 * because the pricing section ID is universal).
 */
const COLUMNS = [
  {
    headingKey: 'productHeading',
    links: [
      { labelKey: 'linkAbout', href: '#' },
      { labelKey: 'linkPricing', href: '#pricing' },
      { labelKey: 'linkPro', href: '#pricing' },
    ],
  },
  {
    headingKey: 'legalHeading',
    links: [
      { labelKey: 'linkTerms', href: '#' },
      { labelKey: 'linkPrivacy', href: '#' },
      { labelKey: 'linkCookies', href: '#' },
    ],
  },
  {
    headingKey: 'contactHeading',
    links: [
      { labelKey: 'linkSupport', href: '#' },
      { labelKey: 'linkTwitter', href: '#' },
      { labelKey: 'linkInstagram', href: '#' },
    ],
  },
] as const;

export async function Footer() {
  const t = await getTranslations('footer');
  const tBrand = await getTranslations('brand');

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

          {COLUMNS.map((col) => (
            <div key={col.headingKey}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                {t(col.headingKey)}
              </h4>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
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
          ))}
        </div>

        <div className="mt-12 border-t border-border pt-8">
          <p className="text-xs text-text-tertiary">{t('copyright')}</p>
        </div>
      </Container>
    </footer>
  );
}
