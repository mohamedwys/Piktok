import './globals.css';
import { Suspense } from 'react';
import { Inter, Fraunces } from 'next/font/google';
import { cookies, headers } from 'next/headers';
import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { PostHogProvider } from '@/components/analytics/PostHogProvider';
import { PostHogPageView } from '@/components/analytics/PostHogPageView';

/**
 * Top-level root layout.
 *
 * One html/body wrapper for the entire app. Routes both inside
 * (`[locale]/...`) and outside (`auth/callback`, `auth/error`)
 * the locale tree go through here.
 *
 * Why root + nested instead of route groups:
 *   - Next.js requires every route to descend from a layout that
 *     renders <html>/<body>. Putting layout.tsx under [locale]/
 *     only would leave the auth tree without one.
 *   - Route groups ((public) / (technical)) split the app into
 *     independent root layouts but force more file shuffling and
 *     duplicate the html/body/fonts boilerplate. A single root +
 *     nested locale layout is simpler.
 *
 * `<html lang>` and `<html dir>` are both resolved server-side
 * from the same signals next-intl middleware uses (NEXT_LOCALE
 * cookie → first Accept-Language match → defaultLocale). The
 * dir resolution is the H.7.2 addition: AR is the only RTL
 * locale, everything else is LTR. Setting `dir` on `<html>` lets
 * Tailwind's logical-property utilities (`ms-*`, `me-*`,
 * `text-start`, `text-end`, etc.) flip layout automatically
 * across the entire tree without per-component conditionals.
 *
 * The fallback chain (both lang and dir):
 *
 *   1. NEXT_LOCALE cookie (set by the LanguageSwitcher).
 *   2. The `x-next-intl-locale` header set by next-intl's
 *      middleware on locale-resolved requests.
 *   3. defaultLocale 'en'.
 *
 * For non-locale routes (auth/error), the lang/dir attributes
 * follow the visitor's most recent locale choice — the
 * auth/error copy is English-only, so AR users will see EN copy
 * with `lang="ar" dir="rtl"`. The English text reads correctly
 * either way (LTR within an RTL document is well-supported in
 * browsers), so this is a benign v1 trade-off.
 */
const RTL_LOCALES = new Set(['ar']);
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

async function resolveLocale(): Promise<string> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  if (hasLocale(routing.locales, cookieLocale)) {
    return cookieLocale;
  }

  const headersList = await headers();
  const intlHeader = headersList.get('x-next-intl-locale');
  if (hasLocale(routing.locales, intlHeader)) {
    return intlHeader;
  }

  return routing.defaultLocale;
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await resolveLocale();
  const dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
  return (
    <html
      lang={locale}
      dir={dir}
      className={`dark ${inter.variable} ${fraunces.variable}`}
    >
      <body>
        <PostHogProvider>
          <Suspense fallback={null}>
            <PostHogPageView />
          </Suspense>
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
