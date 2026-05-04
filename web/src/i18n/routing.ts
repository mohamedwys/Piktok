import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

/**
 * Locale routing configuration.
 *
 * Three locales for v1:
 *   - en (default) — most international visitors land here.
 *   - fr           — primary launch market, mobile precedent.
 *   - ar           — Arabic, content-only for H.7.1 (RTL polish
 *                    is H.7.2, multi-currency is H.7.3).
 *
 * `localePrefix: 'as-needed'` keeps the default locale at `/` (no
 * prefix) and prefixes only the non-default ones (`/fr`, `/ar`).
 * The alternative `'always'` would force every URL to carry a
 * locale prefix including the default — better for analytics
 * symmetry but worse for the "clean canonical URL" instinct, and
 * worse for SEO since `/` and `/en` would compete as canonicals.
 *
 * Locale detection priority (handled by next-intl middleware):
 *   1. URL path (/fr, /ar take precedence — explicit choice).
 *   2. NEXT_LOCALE cookie (sticky once user picks via switcher).
 *   3. Accept-Language header (initial fallback for fresh visits).
 *   4. defaultLocale 'en'.
 */
export const routing = defineRouting({
  locales: ['en', 'fr', 'ar'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
});

/**
 * Locale-aware navigation primitives — `Link`, `redirect`,
 * `usePathname`, `useRouter`, `getPathname` from next-intl,
 * automatically wired to the routing config above.
 *
 * Use these instead of next/link / next/navigation in any
 * component that lives under [locale]/ — they preserve the
 * current locale across navigations and let the
 * LanguageSwitcher swap locales without losing the path.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
