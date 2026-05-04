/**
 * Web-side currency configuration (H.7.3).
 *
 * Three currencies for v1 launch:
 *   - EUR: Europe-region default, original launch market.
 *   - USD: international fallback, English-speaking markets.
 *   - AED: UAE / Gulf launch market.
 *
 * Pricing is per-currency-authored (€19, $19, AED 79 for monthly)
 * — no live FX-rate conversion on web. Mobile's H' arc fetches
 * jsdelivr rates because the marketplace lists products in the
 * seller's local currency and the buyer sees a converted display.
 * Web's pricing is the platform's own subscription, fixed per
 * currency, so live conversion is unnecessary.
 *
 * Six Stripe Prices (3 currencies × 2 cadences) back this on the
 * server side. The IDs land in env vars per the convention
 * documented in `.env.local.example`:
 *
 *     STRIPE_PRICE_EUR_MONTHLY  STRIPE_PRICE_EUR_YEARLY
 *     STRIPE_PRICE_USD_MONTHLY  STRIPE_PRICE_USD_YEARLY
 *     STRIPE_PRICE_AED_MONTHLY  STRIPE_PRICE_AED_YEARLY
 *
 * H.8 (revised post-H.7.3) reads `NEXT_CURRENCY` from cookies +
 * a cadence param to pick the matching env var.
 */
export const CURRENCIES = ['eur', 'usd', 'aed'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = 'eur';

/**
 * Cookie key. Same shape as next-intl's `NEXT_LOCALE` so the two
 * choice cookies live side-by-side and rotate independently.
 * Lifetime is one year (set on every CurrencyPicker write).
 */
export const CURRENCY_COOKIE = 'NEXT_CURRENCY';

export const CURRENCY_LABELS: Record<
  Currency,
  { code: string; symbol: string; label: string }
> = {
  eur: { code: 'EUR', symbol: '€', label: 'Euro' },
  usd: { code: 'USD', symbol: '$', label: 'US Dollar' },
  aed: { code: 'AED', symbol: 'AED', label: 'UAE Dirham' },
};

/**
 * Country (ISO 3166-1 alpha-2) → currency mapping for the
 * Accept-Language fallback in `getCurrency()`. Pragmatic, not
 * exhaustive — countries the v1 launch hasn't prioritized fall
 * through to `DEFAULT_CURRENCY`.
 *
 * Simplifications worth flagging:
 *   - GB falls under `usd` rather than `gbp` (we don't ship GBP
 *     yet; an English-speaking visitor sees USD which reads
 *     correctly even if not their native unit).
 *   - JP, SG, HK → `usd` for the same reason (no JPY/SGD/HKD
 *     until those markets are prioritized).
 *   - SA, QA, KW, BH, OM, JO, LB all roll up to `aed` for the
 *     UAE launch — local currencies (SAR, QAR, KWD, BHD, OMR,
 *     JOD, LBP) are different but routing them to AED keeps the
 *     pricing card readable for the Gulf-region customer until
 *     dedicated currencies are warranted by signup signal.
 */
export const COUNTRY_CURRENCY: Record<string, Currency> = {
  // Eurozone + EU
  FR: 'eur',
  BE: 'eur',
  DE: 'eur',
  IT: 'eur',
  ES: 'eur',
  NL: 'eur',
  PT: 'eur',
  IE: 'eur',
  AT: 'eur',
  FI: 'eur',
  LU: 'eur',
  GR: 'eur',
  // Gulf region
  AE: 'aed',
  SA: 'aed',
  QA: 'aed',
  KW: 'aed',
  BH: 'aed',
  OM: 'aed',
  JO: 'aed',
  LB: 'aed',
  // English-speaking + Asia-Pacific routed to USD until
  // dedicated currencies are prioritized
  US: 'usd',
  CA: 'usd',
  GB: 'usd',
  AU: 'usd',
  JP: 'usd',
  SG: 'usd',
  HK: 'usd',
};

/**
 * Type-guard helper used by both the server-side `getCurrency`
 * and the client-side `CurrencyPicker` to safely narrow a
 * possibly-untrusted string into a `Currency`.
 */
export function isCurrency(value: unknown): value is Currency {
  return (
    typeof value === 'string' &&
    (CURRENCIES as readonly string[]).includes(value)
  );
}
