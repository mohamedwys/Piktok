/**
 * French-locale format helpers.
 *
 * Note on duplication: `src/features/marketplace/utils/formatCount.ts`
 * already exports a `formatCount` that produces English-style "1.2k".
 * The reference design requires French-style "1,2k". Per Step 4 spec
 * the legacy helper is left in place for now and the new helper lives
 * here under the same name (different module). Step 4+ consumers go
 * through this module; the legacy helper will be retired in a later
 * cleanup pass once all consumers have migrated.
 *
 * Helpers exposed:
 *   - formatPrice(amount, currency, locale) — currency formatting
 *     in the given currency ("299,00 €"). Use for transactional
 *     surfaces where the displayed amount must match the actual
 *     money flow (order history, share strings, conversation
 *     offers).
 *   - formatDisplayPrice(amount, productCurrency, displayCurrency,
 *     locale, rates) — display-currency conversion with "≈" prefix
 *     when source ≠ target. Added in Phase H'.2. Use for marketplace
 *     surfaces where the user's preferred display currency may
 *     differ from the listing currency. The wallet still settles
 *     in product currency; this is purely cosmetic.
 *   - formatCount(n, locale) — abbreviated count for tight chips and
 *     headers ("1,2k", "12,3k", "1,2M").
 *   - formatActionCount(n, locale) — full Intl-formatted count for
 *     action-rail counters where the reference design shows full
 *     numbers ("2 453", "128"). Added in Step 5.
 *   - formatDistance(km, locale) — added in Phase G.7 for the Près de
 *     toi rail and any future per-card distance UI.
 */

import { APPROX_PREFIX } from '@/lib/currency/constants'

export function formatPrice(
  amount: number,
  currency = 'EUR',
  locale = 'fr-FR',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount)
}

/**
 * Display-currency formatter. The wallet always settles in
 * `productCurrency`; this returns what the user *sees*.
 *
 * Behaviour:
 *   • Fast path: if `productCurrency === displayCurrency`, defers
 *     directly to `formatPrice` — no conversion math, no prefix.
 *     This is the dominant case today (every product is EUR).
 *   • Convert path: when both rates are present, computes
 *     `amount * (rates[display] / rates[product])` and prefixes
 *     the result with "≈ " to flag the approximation.
 *   • Fallback: if rates are missing or one of the currencies isn't
 *     covered by the upstream rate provider, displays the original
 *     amount in `productCurrency` with no prefix. Better to show
 *     the real listing price than a stale or invented number.
 */
export function formatDisplayPrice(
  amount: number,
  productCurrency: string,
  displayCurrency: string,
  locale = 'fr-FR',
  rates: Record<string, number> | null = null,
): string {
  if (productCurrency === displayCurrency) {
    return formatPrice(amount, productCurrency, locale)
  }

  if (
    !rates ||
    rates[productCurrency] === undefined ||
    rates[displayCurrency] === undefined
  ) {
    return formatPrice(amount, productCurrency, locale)
  }

  const productRate = rates[productCurrency] as number
  const displayRate = rates[displayCurrency] as number
  if (productRate === 0) {
    return formatPrice(amount, productCurrency, locale)
  }
  const converted = amount * (displayRate / productRate)
  return APPROX_PREFIX + formatPrice(converted, displayCurrency, locale)
}

export function formatCount(n: number, locale = 'fr-FR'): string {
  if (!Number.isFinite(n)) return '0'
  if (n < 1000) {
    return new Intl.NumberFormat(locale).format(n)
  }
  if (n < 1_000_000) {
    return formatAbbreviated(n / 1000, 'k', locale)
  }
  return formatAbbreviated(n / 1_000_000, 'M', locale)
}

function formatAbbreviated(value: number, suffix: 'k' | 'M', locale: string): string {
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value)
  return `${formatted}${suffix}`
}

/**
 * Full-number action counts ("2 453", "128") for the action rail and
 * other surfaces where abbreviation would obscure intent. Distinct
 * from `formatCount`, which abbreviates to "1,2k" / "12,3k" / "1,2M".
 */
export function formatActionCount(n: number, locale = 'fr-FR'): string {
  if (!Number.isFinite(n) || n < 0) return '0'
  return new Intl.NumberFormat(locale).format(Math.trunc(n))
}

export function formatDistance(km: number, locale = 'fr-FR'): string {
  if (!Number.isFinite(km) || km < 0) return ''
  if (km < 1) {
    const meters = Math.round(km * 1000)
    return `${meters} m`
  }
  if (km < 100) {
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(km)
    return `${formatted} km`
  }
  return `${Math.round(km)} km`
}
