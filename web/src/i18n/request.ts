import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

/**
 * Per-request next-intl config — resolves the active locale and
 * loads its message catalog from `/web/messages/<locale>.json`.
 *
 * Wired to next-intl via the plugin in `next.config.ts` which
 * points at this file. Called on every Server Component render
 * inside the [locale] tree; the resulting messages are made
 * available to `getTranslations()` (server) and to
 * `useTranslations()` (client) via the `NextIntlClientProvider`
 * boundary in [locale]/layout.tsx.
 *
 * Falls back to the default locale if `requestLocale` is missing
 * or unrecognized — defends against routing edge cases and
 * mistyped path params (`/foo/page` should not 500, just render
 * the default locale's catalog).
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
