/**
 * Currency localization constants for Step H'.
 *
 * Display-only conversion (Feature A): wallet/Stripe always
 * settle in product currency. The display layer can prefix
 * the converted amount with `≈` to communicate that the
 * shown number is an estimate.
 *
 * Provider history:
 *   - H'.1/H'.2 originally selected `api.exchangerate.host`,
 *     but the host rotated to a paid keyed API.
 *   - H'.2 shipped Frankfurter (`api.frankfurter.dev`) as the
 *     no-key fallback, but Frankfurter only covers ~30
 *     currencies — no AED, SAR, QAR, KWD, MAD. MENA/GCC
 *     users hit the graceful no-rates fallback, which the
 *     original feature brief specifically calls out as the
 *     gap to close (Dubai → AED).
 *   - H'.2.1 (this revision) swaps to the jsdelivr-hosted
 *     fawazahmed0/currency-api: free, key-less, CDN-cached,
 *     two-host redundant, ~300 currencies including all
 *     Gulf/Maghreb codes.
 */

export const CURRENCY_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * jsdelivr-hosted fawazahmed0/currency-api, EUR-based.
 *
 * Coverage: ~300 currencies including AED, SAR, QAR, KWD, MAD,
 * BHD, OMR, plus all Frankfurter codes (USD, GBP, JPY, CHF,
 * CAD, AUD, NZD, BRL, MXN, INR, CNY, KRW, ZAR, …) and most
 * EU minors.
 *
 * Response shape:
 *   { date: "YYYY-MM-DD", eur: { usd: 1.17, aed: 4.30, ... } }
 *
 * Currency codes are LOWERCASE in the response. The parser
 * uppercases before storing in the internal `rates` Record
 * (which uses ISO 4217 uppercase everywhere else).
 */
export const CURRENCY_API_URL =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json';

/**
 * Cloudflare Pages mirror of the same dataset, used as a
 * fallback when jsdelivr's CDN node is unreachable. Identical
 * payload — `fetchExchangeRates()` retries here on primary
 * failure before throwing.
 */
export const CURRENCY_API_FALLBACK_URL =
  'https://latest.currency-api.pages.dev/v1/currencies/eur.json';

/**
 * Lowercase as it appears in the API response under the
 * base-currency key. UPPERCASE only when storing in the
 * internal rates Record.
 */
export const CURRENCY_API_BASE_KEY = 'eur';

export const CURRENCY_RATES_CACHE_KEY = 'currency-rates-v1';

export const CURRENCY_PREFERENCE_KEY = 'display-currency-v1';

export const CURRENCY_PREFERENCE_VERSION = 2;

export const CURRENCY_RATES_VERSION = 2;

export const DEFAULT_CURRENCY = 'EUR';

export const APPROX_PREFIX = '≈ ';
