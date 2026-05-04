import type { Metadata } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

/**
 * Locale-aware NESTED layout.
 *
 * Wraps locale-prefixed routes ('/', '/fr', '/ar', etc.) in:
 *   - `setRequestLocale(locale)` — exposes the resolved locale
 *     to nested Server Components, required for static rendering
 *     of locale-aware translations.
 *   - `NextIntlClientProvider` — makes messages available to
 *     `useTranslations()` in nested Client Components.
 *
 * Does NOT render `<html>` / `<body>` — those live in the
 * top-level root layout at `web/src/app/layout.tsx`. Nested
 * layouts cannot duplicate them in Next.js's App Router.
 *
 * `generateStaticParams` returns the three locale codes so
 * `next build` prerenders /, /fr, /ar at build time rather than
 * rendering on demand — important for fast TTFB on Vercel.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Per-locale metadata. The translated `<title>` and
 * `<meta description>` come from the locale's catalog so shared
 * link previews on Twitter / iMessage / LinkedIn carry the right
 * language. `metadataBase` and the OG image path stay shared
 * across locales.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale = hasLocale(routing.locales, locale)
    ? locale
    : routing.defaultLocale;

  const t = await getTranslations({
    locale: safeLocale,
    namespace: 'brand',
  });
  const title = `${t('name')} — ${t('tagline')}`;
  const description = t('tagline');

  const ogLocaleByLocale: Record<string, string> = {
    en: 'en_US',
    fr: 'fr_FR',
    ar: 'ar_AR',
  };

  return {
    title,
    description,
    metadataBase: new URL('https://mony.vercel.app'),
    openGraph: {
      title,
      description,
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
      locale: ogLocaleByLocale[safeLocale] ?? 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-image.png'],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      {children}
    </NextIntlClientProvider>
  );
}
