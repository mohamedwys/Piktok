import { cookies, headers } from 'next/headers';
import {
  COUNTRY_CURRENCY,
  CURRENCY_COOKIE,
  DEFAULT_CURRENCY,
  isCurrency,
  type Currency,
} from './currency';

/**
 * Server-side currency resolution.
 *
 * Detection priority — mirrors the locale chain in shape (cookie
 * → header → default) so visitor preferences are consistently
 * sticky across both axes:
 *
 *   1. `NEXT_CURRENCY` cookie — explicit user choice from the
 *      CurrencyPicker. Always wins. Lifetime is one year.
 *   2. `Accept-Language` country tag — the visitor's first locale
 *      with a `xx-CC` country segment that maps via
 *      `COUNTRY_CURRENCY`. Reads in priority order so a user with
 *      `Accept-Language: en-US,fr-FR` gets USD (their primary
 *      language's country wins).
 *   3. `DEFAULT_CURRENCY` — EUR fallback for visitors with no
 *      cookie and no recognizable country tag.
 *
 * Called from Server Components (Pricing, Header) and the
 * upcoming H.8 Stripe Checkout API route. Cheap — two header /
 * cookie reads per call. Could be wrapped in React's `cache()` if
 * a single render needs many calls, but v1's call sites are few.
 */
export async function getCurrency(): Promise<Currency> {
  // 1. Cookie
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(CURRENCY_COOKIE)?.value;
  if (isCurrency(fromCookie)) {
    return fromCookie;
  }

  // 2. Accept-Language
  const headerStore = await headers();
  const acceptLang = headerStore.get('accept-language');
  if (acceptLang) {
    // Examples that should resolve correctly:
    //   "fr-FR,fr;q=0.9,en;q=0.8"  → 'eur' via FR
    //   "en-US,en;q=0.9"            → 'usd' via US
    //   "ar-AE,ar;q=0.9,en;q=0.8"   → 'aed' via AE
    //   "en;q=0.9"                  → no country tag → fallthrough
    const countries = acceptLang
      .split(',')
      .map((s) => s.split(';')[0].trim())
      .map((s) => s.split('-')[1])
      .filter((part): part is string => Boolean(part))
      .map((c) => c.toUpperCase());

    for (const country of countries) {
      const mapped = COUNTRY_CURRENCY[country];
      if (mapped) return mapped;
    }
  }

  // 3. Fallback
  return DEFAULT_CURRENCY;
}
