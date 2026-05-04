import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';

/**
 * Sticky landing header. Logo + anchor nav (Fonctionnalités /
 * Tarifs / FAQ) + a single outline CTA on the trailing edge.
 *
 * `sticky top-0` with `backdrop-blur-md` creates the iOS-style
 * glass surface from BRAND.md §Glass — the header rides above the
 * scrolling content without being a full opaque bar. The
 * background is a 70% black wash so the brand is readable but the
 * page still breathes through.
 *
 * Anchor links use plain `<a href="#…">` because the targets are
 * sections on the same page; `next/link` would add unnecessary
 * routing overhead for fragment navigation.
 *
 * The "Connexion" CTA points to `/upgrade` rather than rendering
 * a sign-in form on the marketing site — the H.6 page redirects
 * unauth'd visitors to `/`, which sends them back here. The
 * primary path to authentication is the mobile app's magic-link
 * flow (H.5), so this CTA is mostly a "you're already in the
 * app, click here from there" nudge.
 */
export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/70 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center">
          <span className="font-display text-2xl font-semibold text-text-primary">
            Mony
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            className="text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            Fonctionnalités
          </a>
          <a
            href="#pricing"
            className="text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            Tarifs
          </a>
          <a
            href="#faq"
            className="text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            FAQ
          </a>
        </nav>

        <Link href="/upgrade">
          <Button variant="outline" size="md">
            Connexion
          </Button>
        </Link>
      </Container>
    </header>
  );
}
