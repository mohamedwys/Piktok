import './globals.css';
import type { Metadata } from 'next';
import { Inter, Fraunces } from 'next/font/google';

/**
 * Mirror the mobile font stack:
 *   - Inter as the sans default (body, captions, labels, CTAs).
 *   - Fraunces as the display serif (hero moments only).
 * Both are loaded via next/font/google for automatic self-hosting,
 * preloading, and zero layout-shift. The CSS variables
 * `--font-inter` / `--font-fraunces` are consumed by the Tailwind
 * config's `fontFamily` extension so utility classes like
 * `font-sans` / `font-display` resolve to the correct family.
 *
 * `display: 'swap'` lets the system fallback render immediately;
 * Inter / Fraunces swap in once loaded. On a paid Vercel plan we
 * could pre-cache via `display: 'optional'` but for v1 'swap' is
 * the safer default.
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  weight: ['400', '500', '600'],
});

/**
 * Site-wide metadata — SEO + Open Graph + Twitter Card.
 *
 * `metadataBase` is required by Next.js to resolve absolute URLs
 * for OG image references; it points at the production deploy.
 * If the Vercel URL changes (e.g., custom brand domain lands),
 * update here in lockstep with the mobile-side `WEB_BASE_URL`
 * constant and the Supabase secret of the same name.
 *
 * The OG image (`/og-image.png`) is a TODO — H.7 references the
 * path but does not ship the asset. Two paths to close it:
 *   (a) Static asset committed to /web/public/og-image.png
 *       (1200×630, brand mark on the dark stack).
 *   (b) Dynamic generation via next/og at /api/og.
 * Both are post-H.7 work. Until one lands, share previews on
 * Twitter / LinkedIn / iMessage will fall back to a plain link
 * card with the title + description.
 *
 * Locale: French only for v1 (matches mobile's primary market).
 * `lang="fr"` and `locale: 'fr_FR'` for OG. English alternates
 * land when Phase F or H.X internationalizes the site.
 */
export const metadata: Metadata = {
  title: 'Mony — Marketplace vidéo',
  description:
    "Vendez et achetez sur Mony, la marketplace vidéo. Vendeurs Pro avec paiement direct, mise en avant hebdomadaire et frais réduits.",
  metadataBase: new URL('https://mony.vercel.app'),
  openGraph: {
    title: 'Mony — Marketplace vidéo',
    description:
      'Marketplace vidéo. Vendez, découvrez, connectez-vous.',
    url: 'https://mony.vercel.app',
    siteName: 'Mony',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Mony',
      },
    ],
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mony — Marketplace vidéo',
    description:
      'Marketplace vidéo. Vendez, découvrez, connectez-vous.',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      className={`dark ${inter.variable} ${fraunces.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
