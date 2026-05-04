import {
  CURRENCY_API_BASE_KEY,
  CURRENCY_API_FALLBACK_URL,
  CURRENCY_API_URL,
  CURRENCY_CACHE_TTL_MS,
} from './constants';

export type ExchangeRateSnapshot = {
  base: string;
  rates: Record<string, number>;
  fetchedAt: number;
};

type CurrencyApiResponse = {
  date?: string;
  // Index signature for the base-keyed rates map (e.g. `eur`).
  // Values may be numbers, nulls, or undefined for thinly-traded
  // codes — the parser filters down to finite numbers.
  [key: string]: unknown;
};

/**
 * Fetch + parse a single jsdelivr-shape rates document. The
 * response shape is:
 *   { date: "YYYY-MM-DD", eur: { usd: 1.17, aed: 4.30, ... } }
 * with lowercase ISO 4217 keys. The parser uppercases all codes
 * before storing in the internal `rates` Record (the rest of the
 * codebase uses uppercase).
 *
 * Preserves H'.2's `[base]: 1` synthesis so the formatter's
 * `rates[product] / rates[display]` math works uniformly even
 * when the response happens to omit the self-rate (it doesn't
 * with this provider, but the synthesis is defensive and
 * load-bearing for the EUR-EUR fast path's `rates[productCurrency]
 * !== undefined` guard).
 */
async function fetchFromURL(url: string): Promise<ExchangeRateSnapshot> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Exchange rates fetch failed: ${res.status} (${url})`);
  }
  const json = (await res.json()) as CurrencyApiResponse;
  const lowercaseRates = json[CURRENCY_API_BASE_KEY];

  if (
    !lowercaseRates ||
    typeof lowercaseRates !== 'object' ||
    Array.isArray(lowercaseRates)
  ) {
    throw new Error(`Exchange rates: invalid response shape from ${url}`);
  }

  const rates: Record<string, number> = {};
  for (const [code, value] of Object.entries(
    lowercaseRates as Record<string, unknown>,
  )) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      rates[code.toUpperCase()] = value;
    }
  }
  // Defensive [base]: 1 synthesis — load-bearing for the
  // EUR-EUR fast path. The provider already returns this, but
  // the explicit assignment guards against future shape drift.
  rates[CURRENCY_API_BASE_KEY.toUpperCase()] = 1;

  return {
    base: CURRENCY_API_BASE_KEY.toUpperCase(),
    rates,
    fetchedAt: Date.now(),
  };
}

/**
 * Fetch the latest EUR-based exchange rates. Tries the primary
 * jsdelivr CDN first, then the Cloudflare Pages mirror on
 * failure. Surfaces the primary error if both hosts fail; the
 * caller (the rates store) catches and fail-softs by keeping
 * the last known cached snapshot.
 */
export async function fetchExchangeRates(): Promise<ExchangeRateSnapshot> {
  try {
    return await fetchFromURL(CURRENCY_API_URL);
  } catch (primaryErr) {
    try {
      return await fetchFromURL(CURRENCY_API_FALLBACK_URL);
    } catch {
      throw primaryErr;
    }
  }
}

/**
 * True when the snapshot is missing or older than the cache
 * TTL. Used by the store's `refreshIfStale` action and by the
 * AppState-aware refresh hook on resume.
 */
export function isStale(snapshot: ExchangeRateSnapshot | null): boolean {
  if (!snapshot) return true;
  return Date.now() - snapshot.fetchedAt > CURRENCY_CACHE_TTL_MS;
}
