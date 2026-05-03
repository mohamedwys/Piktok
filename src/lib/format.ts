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
 *     ("299,00 €").
 *   - formatCount(n, locale) — abbreviated count for tight chips and
 *     headers ("1,2k", "12,3k", "1,2M").
 *   - formatActionCount(n, locale) — full Intl-formatted count for
 *     action-rail counters where the reference design shows full
 *     numbers ("2 453", "128"). Added in Step 5.
 *   - formatDistance(km, locale) — added in Phase G.7 for the Près de
 *     toi rail and any future per-card distance UI.
 */

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
