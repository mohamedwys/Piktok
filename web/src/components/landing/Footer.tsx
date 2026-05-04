import Link from 'next/link';
import { Container } from '@/components/ui/Container';

/**
 * Marketing footer — minimal legal + nav columns.
 *
 * Three columns of links plus a brand block on the left. Most
 * destinations are placeholders pointing to "#" because the
 * underlying pages (Terms, Privacy, Cookies, Support) aren't
 * built yet — H.X ships them as legal launch prep. The tabular
 * structure is in place so adding real hrefs later is a one-line
 * edit each.
 *
 * Background steps DOWN to `bg-surface` (one layer below the
 * sections above) — visually anchors the page bottom and gives a
 * clear "here ends the marketing" signal.
 */
type LinkColumn = { heading: string; links: { label: string; href: string }[] };

const COLUMNS: LinkColumn[] = [
  {
    heading: 'Produit',
    links: [
      { label: 'À propos', href: '#' },
      { label: 'Tarifs', href: '#pricing' },
      { label: 'Mony Pro', href: '#pricing' },
    ],
  },
  {
    heading: 'Légal',
    links: [
      { label: 'Conditions d’utilisation', href: '#' },
      { label: 'Confidentialité', href: '#' },
      { label: 'Cookies', href: '#' },
    ],
  },
  {
    heading: 'Contact',
    links: [
      { label: 'Support', href: '#' },
      { label: 'Twitter', href: '#' },
      { label: 'Instagram', href: '#' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface py-16">
      <Container>
        <div className="grid grid-cols-1 gap-12 md:grid-cols-4">
          <div>
            <Link href="/" className="inline-block">
              <span className="font-display text-2xl font-semibold text-text-primary">
                Mony
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-text-tertiary">
              La marketplace vidéo. Vendez, découvrez, connectez-vous.
            </p>
          </div>

          {COLUMNS.map(({ heading, links }) => (
            <div key={heading}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                {heading}
              </h4>
              <ul className="mt-4 space-y-3">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="text-sm text-text-secondary transition-colors hover:text-text-primary"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-border pt-8">
          <p className="text-xs text-text-tertiary">
            © 2026 Mony — Tous droits réservés.
          </p>
        </div>
      </Container>
    </footer>
  );
}
