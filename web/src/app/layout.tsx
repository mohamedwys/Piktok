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

export const metadata: Metadata = {
  title: 'Mony',
  description: 'Mony — modern marketplace.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${fraunces.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
