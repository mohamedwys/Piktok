# Currency Localization — H'.1 Audit

Read-only reconnaissance for Step H' (display-currency
localization). No source files modified. References
[PROJECT_AUDIT.md](PROJECT_AUDIT.md) and [CATEGORIES_AUDIT.md](CATEGORIES_AUDIT.md)
where prior facts already stand.

**Decisions locked (per prior conversation):**

| Concern | Decision |
|---|---|
| Country detection | Device locale via `expo-localization` |
| Rate source | `https://api.exchangerate.host/latest?base=EUR` (free, no API key) |
| Override UI | In-app settings screen (Profile > Settings card) |
| Cache window | 12h + fetch-on-launch + fetch-on-foreground-after-window |
| Feature scope | DISPLAY-ONLY conversion. Wallet still settles in product currency. Display prefixes "≈" when display currency differs from product currency. |

---

## 1. Existing Currency Code (formatPrice + call sites)

The canonical formatter lives at [src/lib/format.ts:24](src/lib/format.ts:24):

```ts
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
```

**Defaults:** EUR + fr-FR — matches the dominant marketplace
configuration today.

### Call site inventory

The codebase has **two formatter populations** that need to
converge:

1. **Canonical helper** at [src/lib/format.ts:24](src/lib/format.ts:24) — accepts
   `(amount, currency, locale)`, used by newer call sites.
2. **Local `formatPrice` shadows / inline `Intl.NumberFormat`** —
   older call sites that hardcode `'fr-FR'` and pass currency
   only. These were written before the canonical helper landed.

| # | File:Line | Component | Source: amount | Source: currency | Source: locale | Complexity |
|---|---|---|---|---|---|---|
| 1 | [src/lib/format.ts:24](src/lib/format.ts:24) | `formatPrice` (canonical) | param | param (default `'EUR'`) | param (default `'fr-FR'`) | — definition — |
| 2 | [src/components/feed/PriceCard.tsx:50](src/components/feed/PriceCard.tsx:50) | `PriceCard` (feed) | `amount` prop | `currency` prop (default `'EUR'`) | `i18n.language` | Trivial — already locale-aware, swap to display formatter |
| 3 | [src/components/categories/RailProductCard.tsx:53](src/components/categories/RailProductCard.tsx:53) | `RailProductCard` | `product.price` | `product.currency` | (omitted, defaults to `fr-FR`) | Moderate — needs i18n locale + display currency |
| 4 | [src/features/marketplace/components/ProductActionRail.tsx:61](src/features/marketplace/components/ProductActionRail.tsx:61) | `ProductActionRail` (share) | `product.price` | `product.currency ?? 'EUR'` | `locale === 'fr' ? 'fr-FR' : 'en-US'` | Complex — interpolated into share string. **Should keep product currency** (the share text references the actual listing price, not a display estimate). |
| 5 | [src/features/marketplace/components/PriceCard.tsx:21,63](src/features/marketplace/components/PriceCard.tsx:21) | `PriceCard` (marketplace) — **local shadow**, hardcoded `'fr-FR'` | `price` prop | `currency` prop | hardcoded `'fr-FR'` | Moderate — drop local helper, route through display formatter |
| 6 | [src/features/marketplace/components/ProductDetailSheet.tsx:45,315](src/features/marketplace/components/ProductDetailSheet.tsx:45) | `ProductDetailSheet` — **local shadow**, hardcoded `'fr-FR'` | `product.price` | `product.currency` | hardcoded `'fr-FR'` | Moderate — drop local helper, route through display formatter |
| 7 | [src/features/marketplace/components/SellerProductCard.tsx:44](src/features/marketplace/components/SellerProductCard.tsx:44) | `SellerProductCard` — **inline `Intl.NumberFormat`**, hardcoded `'fr-FR'` | `product.price` | `product.currency` | hardcoded `'fr-FR'` | Moderate — replace inline call with display formatter |
| 8 | [src/app/(protected)/(tabs)/profile.tsx:60](src/app/(protected)/(tabs)/profile.tsx:60) | `formatOrderAmount` — **inline**, hardcoded `'fr-FR'` | `order.amount` | `order.currency` | hardcoded `'fr-FR'` | **Keep product currency.** This is order history — receipts must show what was actually charged. No "≈" / no display conversion. |
| 9 | [src/app/(protected)/conversation/[id].tsx:168](src/app/(protected)/conversation/[id].tsx:168) | Conversation offer message — **inline**, hardcoded `'EUR'` | `item.offerAmount` | hardcoded `'EUR'` (BUG: should follow product currency) | `lang === 'fr' ? 'fr-FR' : 'en-US'` | **Keep product currency** (message is about the listing). Existing hardcoded-`EUR` is a pre-existing latent bug; flag for future fix but out of H' scope. |

**Migration shape** (recommended for H'.2):

- Add `formatDisplayPrice(amount, productCurrency, displayCurrency, locale, rates)` as a sibling of `formatPrice` in `src/lib/format.ts` (or in a new `src/lib/currency/format.ts` if cleaner). Returns `{ text, isApproximation }` so call sites can render the "≈" prefix and (optionally) tooltip.
- Keep legacy `formatPrice` available — only migrate display surfaces (rows 2, 3, 5, 6, 7) in H'.3.
- **Do not** migrate rows 4 (share string), 8 (order history), 9 (offer message) — those must continue to use product currency. The rule: anything tied to a real money flow (Stripe/wallet/receipts/messages-about-the-listing) stays product-currency.

### Currency-related write sites (informational)

These set, not display, `currency` and are NOT migration targets:

- [src/app/(protected)/(tabs)/newPost.tsx:223,261](src/app/(protected)/(tabs)/newPost.tsx:223) — listing creation/edit hardcodes `currency: 'EUR'`. Confirms EUR-only listing today.
- [src/features/marketplace/services/sell.ts:120,159](src/features/marketplace/services/sell.ts:120) — pass-through to Supabase insert/update.
- [src/features/marketplace/services/products.ts:74](src/features/marketplace/services/products.ts:74) — `rowToProduct` reads `currency` from the row.
- [src/features/marketplace/services/messaging.ts:124,169](src/features/marketplace/services/messaging.ts:124) — copies product currency into conversation summaries.
- [src/features/marketplace/services/orders.ts:11,20,37](src/features/marketplace/services/orders.ts:11) — order rows carry their own `currency` (matches the product at checkout time).

---

## 2. Product Currency Distribution

### Schema

`products.currency` is `text` and **NOT NULL** in [src/types/supabase.ts:316](src/types/supabase.ts:316) (Insert at :347 makes it required; Update at :378 makes it optional). No default declared in the generated types — production likely has a `default 'EUR'` at the column level (cannot confirm from generated types alone).

`orders.currency` mirrors the same shape ([src/types/supabase.ts:251](src/types/supabase.ts:251), :266, :281).

### TypeScript narrowing

[src/features/marketplace/types/product.ts:3](src/features/marketplace/types/product.ts:3):

```ts
export type Currency = 'EUR' | 'USD' | 'GBP';
```

The DB column is `string` but the application narrows to a closed union of three currencies. Out-of-band currency values from the DB would be cast to this union without runtime validation — fine in practice today since every write site forces `'EUR'`.

### Production distribution (recommendation — read-only audit, query not run)

User can run on the dev/staging Supabase project (`mkofisdyebcnmhgkpqws` per Op.1):

```sql
SELECT currency, count(*) FROM products GROUP BY currency ORDER BY count DESC;
```

**Expected outcome from code recon:** every row is `'EUR'`. Justification:

- newPost.tsx hardcodes `currency: 'EUR'` on both create and edit paths ([src/app/(protected)/(tabs)/newPost.tsx:223,261](src/app/(protected)/(tabs)/newPost.tsx:223)).
- No UI exists to set a non-EUR currency.
- The seeding/dev paths don't deviate (grep shows only `'EUR'` literals).

**Implication for H'.2:** EUR is the dominant case to optimize the formatter for. The `≈` prefix logic should short-circuit when `productCurrency === 'EUR' === displayCurrency` (the no-op case for the entire current French user base).

---

## 3. Locale Detection Library Status

### Install status — INSTALLED

[package.json:43](package.json:43):

```json
"expo-localization": "~17.0.8"
```

Plugin already wired into [app.json:74](app.json:74). Already imported and used at [src/i18n/index.ts:3](src/i18n/index.ts:3) for language detection. **Per [PROJECT_AUDIT.md](PROJECT_AUDIT.md:76,411,1562) and [CATEGORIES_AUDIT.md](CATEGORIES_AUDIT.md:273)** — no install needed in H'.2.

### Existing usage as precedent

[src/i18n/index.ts:12-17](src/i18n/index.ts:12):

```ts
function detectInitialLanguage(): SupportedLanguage {
  const code = Localization.getLocales()[0]?.languageCode ?? 'fr';
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code)
    ? (code as SupportedLanguage)
    : 'fr';
}
```

Mirror this shape for currency detection (defensive `?.`, fallback to a sane default).

### API surface — recommended for H'.2

| API | Returns | Use |
|---|---|---|
| `Localization.getLocales()` | `Locale[]` array | First element is the most preferred locale; properties include `languageCode`, `regionCode`, `currencyCode`, `decimalSeparator`, etc. **Preferred entry point** — newer API, returns rich objects. |
| `Localization.currency` | `string \| null` (deprecated alias of `getLocales()[0].currencyCode`) | Apple/Google's authoritative region-default currency. Available without computation. |
| `Localization.region` | `string \| null` | ISO 3166-1 alpha-2 region (e.g., `"FR"`, `"AE"`). Use as fallback key into a country→currency map. |
| `Localization.locale` | `string` | Full locale string like `"fr-FR"`. Already used implicitly via `Intl.NumberFormat(i18n.language, ...)`. |

**Recommended detection strategy (locked in §7):**

1. `Localization.getLocales()[0]?.currencyCode` — Apple/Google's authoritative mapping.
2. Fall back to country→currency map keyed by `Localization.getLocales()[0]?.regionCode`.
3. Final fallback: `'EUR'` (matches the marketplace's dominant currency and the French market).

Stick with `getLocales()` (used by i18n already) rather than the older flat properties — aligns with existing code and avoids deprecation warnings from newer expo-localization releases.

---

## 4. Existing Conversion / Rate Code

### Greenfield

```bash
rg "exchangerate" src/      # No matches found
rg "exchange rate|currency conversion|fx rate" src/ -i   # No matches found
```

There is **no existing rate-fetching, rate-cache, or
multi-currency conversion logic** in the codebase. H'.2 builds
the entire pipeline from scratch.

### Closest precedent

The Intl.NumberFormat call sites listed in §1 — all of them format a single, given-as-input currency. None convert between currencies.

`useUserLocation` ([src/features/location/stores/useUserLocation.ts](src/features/location/stores/useUserLocation.ts)) is the closest architectural neighbor: persisted Zustand store with a service-layer (`geocoding`) for external calls. H'.2 should mirror it.

---

## 5. Settings Screen — Override UI Placement

The Profile screen at [src/app/(protected)/(tabs)/profile.tsx](src/app/(protected)/(tabs)/profile.tsx) already has a "Settings" section (lines 576-620) that today contains exactly one row: the language toggle. That section is the natural home for the currency picker.

### Existing language-toggle pattern (to mirror)

[src/app/(protected)/(tabs)/profile.tsx:576-620](src/app/(protected)/(tabs)/profile.tsx:576):

```tsx
<View style={styles.section}>
  <Text variant="caption" weight="bold" style={styles.sectionLabel}>
    {t('profile.settings')}
  </Text>
  <Surface variant="surfaceElevated" radius="lg" padding="md" border>
    <View style={styles.settingsRow}>
      <Text variant="body" weight="semibold">
        {t('profile.language')}
      </Text>
      <View style={styles.pillRow}>
        {SUPPORTED_LANGUAGES.map((lang) => {
          const isActive = lang === currentLang;
          return (
            <Pressable
              key={lang}
              onPress={() => onPressLang(lang)}
              haptic="light"
              style={[
                styles.pill,
                isActive ? styles.pillActive : styles.pillInactive,
              ]}
            >
              <Text style={[styles.pillText, isActive ? styles.pillTextActive : styles.pillTextInactive]}>
                {LANGUAGE_LABELS[lang]}
              </Text>
              {isActive ? <Ionicons name="checkmark" size={14} color={colors.brandText} style={styles.pillIcon} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  </Surface>
</View>
```

### Recommendation for H'.3

- Add a sibling row inside the same `<Surface>` (don't open a new Surface — keep them grouped as one Settings card).
- Two design options:
  - **Pill row** (mirror language) — works if we limit to ~3-5 currencies (EUR/USD/GBP/AED/auto). Cheap, consistent.
  - **Pressable row + chevron** opening a sheet — works if we expose a long list of currencies. More flexible, more code.
- **v1 recommendation:** pill row with `Auto • EUR • USD • GBP` (4 pills, matches the existing `Currency` type union). When `Auto` is active, the detected currency is shown as a hint underneath. This requires zero new sheet/screen surfaces.

### Strings to add to i18n locales

- `profile.currency` — section row label ("Devise" / "Currency")
- `profile.currencyAuto` — "Auto" pill label, identical in both locales
- `profile.currencyAutoHint` — "Détectée: {{code}}" / "Detected: {{code}}"

### Why NOT a full Settings sub-screen

The off-roadmap polish (per prompt context) wraps the language toggle in a `Surface` — there's no precedent for a multi-row settings sub-screen yet, and adding a route just for currency is overkill for v1. Keep it inline.

---

## 6. Persistence Pattern Reference

The canonical Zustand+AsyncStorage+versioned pattern lives at [src/features/location/stores/useUserLocation.ts:60-180](src/features/location/stores/useUserLocation.ts:60). Reproduced verbatim for H'.2 to mirror:

```ts
export const useUserLocation = create<UserLocationStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_DATA,
      // ...actions...
    }),
    {
      name: USER_LOCATION_STORAGE_KEY,        // 'user-location-v1'
      version: USER_LOCATION_STORE_VERSION,   // 1
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // explicit allowlist of fields to persist
        latitude: state.latitude,
        // ...etc...
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      migrate: (persistedState: any, _fromVersion: number) => {
        // No migrations needed at v1. Future schema changes land here.
        return persistedState;
      },
      onRehydrateStorage: () => (state) => {
        // Defensive: corrupted/legacy field → fall back to default.
        if (state && !isValidRadius(state.radiusKm)) {
          state.radiusKm = DEFAULT_RADIUS_KM;
        }
      },
    },
  ),
);
```

Constants live in a sibling file [src/features/location/constants.ts](src/features/location/constants.ts):

```ts
export const USER_LOCATION_STORAGE_KEY = 'user-location-v1';
export const USER_LOCATION_STORE_VERSION = 1;
```

There is also a simpler pattern at [src/stores/useMarketplaceFilters.ts:29-42](src/stores/useMarketplaceFilters.ts:29) which omits `version`, `partialize`, `migrate`, and `onRehydrateStorage`. For currency we want the **full** pattern (defensive rehydrate matters for cache shape, version matters for future schema evolution).

### H'.2 store shape (proposed for `useDisplayCurrency`)

```ts
type DisplayCurrencyData = {
  code: Currency;                            // 'EUR' | 'USD' | 'GBP' (or string if widened)
  source: 'auto' | 'manual';
  detectedCode: Currency | null;             // last auto-detected, kept even when source === 'manual'
};

type DisplayCurrencyActions = {
  setManual: (code: Currency) => void;       // source = 'manual'
  setAuto: () => void;                       // source = 'auto', code = detectedCode || fallback
  refreshDetection: () => void;              // re-run expo-localization detection
};
```

Storage key: `display-currency-v1`. Version: `1`. Same migration/rehydrate scaffolding as `useUserLocation`.

---

## 7. Country → Currency Mapping Approach

### Strategy (3-tier fallback)

1. **`Localization.getLocales()[0]?.currencyCode`** — Apple/Google supply this directly per the device's region settings. Authoritative for ~99% of real users. No hand-rolled mapping needed.
2. **Country→currency map keyed by `regionCode`** — fallback for edge cases (simulator with no currency set, region without a clear currency). Covers ~250 ISO 3166-1 alpha-2 codes mapped to ISO 4217 currencies.
3. **`'EUR'`** — final fallback. Matches the marketplace's dominant currency and the French market default.

### Recommendation: keep the map small in v1

The full ~250-country mapping is mostly unnecessary because tier 1 covers virtually every real device. **For v1, ship a curated subset (≈30 entries)** covering:

- France, Germany, Spain, Italy, Netherlands, Belgium, Portugal, Ireland (EUR — eurozone)
- US (USD)
- UK (GBP)
- UAE (AED), Saudi Arabia (SAR), Qatar (QAR), Kuwait (KWD), Egypt (EGP), Morocco (MAD), Tunisia (TND) — Marqe's MENA growth markets per recent activity
- Switzerland (CHF), Norway (NOK), Sweden (SEK), Denmark (DKK)
- Canada (CAD), Australia (AUD), Japan (JPY), China (CNY), India (INR), Brazil (BRL)

Anything not in the map falls through to `'EUR'`. Expand coverage later if telemetry shows real users hitting the fallback.

### File location

`src/lib/currency/country-currency-map.ts` — a new lib subdirectory keeps currency code grouped (`format.ts`, `country-currency-map.ts`, `service.ts`, `constants.ts`). Alternative: inline the constant in `service.ts` if it stays under ~30 entries.

---

## 8. Exchange Rate Service Architecture

### Endpoint

```
GET https://api.exchangerate.host/latest?base=EUR
```

- Free tier, no API key.
- `base=EUR` because the marketplace's dominant currency is EUR; means most lookups become a single division.
- 'USD' would work equivalently (the API normalizes server-side); EUR keeps the math intuitive for the dominant case.

### Sample response

```json
{
  "base": "EUR",
  "date": "2026-05-04",
  "rates": {
    "USD": 1.0843,
    "AED": 3.9836,
    "GBP": 0.8612,
    "JPY": 167.42,
    "CHF": 0.9521,
    "MAD": 10.873,
    "SAR": 4.066
  }
}
```

### Cache shape (AsyncStorage)

Key: `currency-rates-v1`. Value:

```ts
type CachedRates = {
  base: 'EUR';
  rates: Record<string, number>;   // Currency code → multiplier from base
  fetchedAt: number;               // Unix ms
};
```

### Conversion math

Rates are quoted against `base`. To convert from any source to any target:

```ts
function convert(
  amount: number,
  source: string,
  target: string,
  rates: Record<string, number>,
): number {
  if (source === target) return amount;
  const sourceRate = source === 'EUR' ? 1 : rates[source];
  const targetRate = target === 'EUR' ? 1 : rates[target];
  if (!sourceRate || !targetRate) return amount; // graceful degrade
  return amount * (targetRate / sourceRate);
}
```

(The `'EUR'` literal mirrors `base`. If H'.2 widens to a non-EUR base later, replace with `rates[base] ?? 1`.)

### Fetch triggers

| Trigger | When | What |
|---|---|---|
| App launch | After hydration of the rates store | If `now - fetchedAt > 12h` OR cache empty → fetch; else reuse |
| AppState → 'active' | RN `AppState` listener, on background → foreground | Same staleness check |
| Manual refresh | (Optional v2) Settings screen "Refresh rates" button | Force-fetch regardless of staleness |

The launch + foreground triggers cover essentially every realistic scenario without adding background-task complexity.

### Failure handling

| Failure | Behavior | UX |
|---|---|---|
| Network failure with cached rates | Keep cached rates silently | User sees converted prices using stale rates. Acceptable — "≈" prefix already communicates approximation. |
| Network failure with NO cache (cold first launch, offline) | Fall back to displaying product currency as-is | Same as today — no "≈", no conversion. Defensive default. |
| API returns invalid JSON / malformed shape | Treat same as network failure | Defensive parser; log silently in dev only. |
| API returns missing currency (target not in `rates`) | Fall back to product currency for that one item | Per-item degrade rather than global degrade. |

No user-facing error toast at this stage — silent degrade matches the ≈-already-approximate framing. If the user explicitly hits "Refresh rates" (v2 polish), surface the error there.

---

## 9. Cache Strategy (12h locked)

### Constants (proposed for H'.2 — `src/lib/currency/constants.ts`)

```ts
export const CURRENCY_CACHE_TTL_MS = 12 * 60 * 60 * 1000;   // 12h
export const CURRENCY_API_URL =
  'https://api.exchangerate.host/latest?base=EUR';
export const CURRENCY_CACHE_KEY = 'currency-rates-v1';
export const DISPLAY_CURRENCY_STORAGE_KEY = 'display-currency-v1';
export const DISPLAY_CURRENCY_STORE_VERSION = 1;
export const FALLBACK_DISPLAY_CURRENCY = 'EUR' as const;
```

### Rationale

- **12h** chosen per locked decision. Real exchange rates fluctuate ~0.1–1%/day under normal conditions; 12h-stale is well within the "≈" estimate accuracy the prefix already communicates.
- **Fetch on launch + foreground** keeps rates fresh in practice without background-task plumbing.
- **No revalidation on every product render** — the cache is read synchronously from the store; the network is touched at most twice per app session (launch + first foreground after 12h).

### Why not cache-on-stripe-checkout

Out of scope. Wallet/Stripe charges always settle in product currency; the display layer never feeds a real money flow.

---

## 10. Edge Cases

| Case | Behavior |
|---|---|
| Display currency = product currency | NO conversion, NO `≈` prefix, format identically to today via existing `formatPrice`. **This is the dominant case** (every product is currently EUR; most users are FR). |
| Display currency rate not in API response | Fall back to product currency as-is for that item. Log silently in dev. |
| Region without a clear currency mapping (simulator with no region, edge devices) | Fall back to `'EUR'` (matches dominant currency + French market). |
| Manual override conflicts with auto-detection | Manual setting WINS until cleared. Store carries `source: 'auto' \| 'manual'`. `setAuto()` re-detects and clears manual. |
| Currency code that `Intl.NumberFormat` doesn't recognize | Catch and degrade to `"AMOUNT CURRENCY"` ("1234.56 ZWL") without locale formatting. Belt-and-braces — the curated list in §7 only contains universally-supported codes. |
| App offline on cold first launch | No cache + no network → display product currency as-is. No `≈`. Prevents the user seeing a stale conversion that's never been validated against a real rate. |
| User changes device region mid-session | `refreshDetection()` re-runs detection on resume. Auto-mode picks up the new region; manual-mode is preserved. |
| Rate cache rehydrates with malformed shape (corrupted storage) | `onRehydrateStorage` defensively resets cache to empty; next fetch trigger refills. Mirrors the `useUserLocation` defensive rehydrate pattern. |
| Display currency = `'EUR'` (the cache base) | Conversion math short-circuits (`source === target` → return as-is). |

---

## 11. Migration Risks for H'.3

### Per-row risk assessment (from §1 table)

- **Rows 2, 3, 5, 6, 7** — display surfaces. 1-line swap from `formatPrice` (or local shadow) to `formatDisplayPrice` with the display-currency store + rates store. Read carefully — rows 5/6 declare a *local* `formatPrice` that shadows the import; remove the local helper as part of the swap.
- **Row 4** — share string. Keep product currency. The share text is a permanent message that other people will see; an "≈" prefix would be misleading.
- **Row 8** — order history. Keep product currency. This is a receipt of real money that changed hands.
- **Row 9** — conversation offer message. Keep product currency. Pre-existing latent bug (hardcoded `'EUR'` instead of conversation product currency) — flag for future cleanup but **not** fixed by H'.

### Generic risks

- **Local-shadow `formatPrice` declarations** (rows 5, 6) — the risk is leaving the local helper in place after introducing the display formatter, leading to half-migrated screens that silently bypass display-currency. H'.3 must delete the local shadow as part of the swap.
- **Inline `Intl.NumberFormat` calls** (rows 7, 8, 9) — easy to miss in grep if pattern changes. Re-run the grep before merging H'.3 to catch new arrivals.
- **Reactive recomputation** — display formatters depend on (rates, displayCurrency) which can change at runtime (rate refresh, manual override). Components that already use `useTranslation` for `i18n.language` will likely already re-render on store changes; verify with a quick smoke test in H'.3 that toggling the override updates open list rows.
- **Snapshot testing** (if any) — none found, low risk.
- **Backwards compat** — `formatPrice` stays exported untouched for the non-display call sites. No breaking change.

---

## 12. Open Questions

| Question | Recommendation |
|---|---|
| Should the override UI offer a "use auto" reset? | **Yes.** Single tap on the "Auto" pill clears manual override and reverts to detected. Free with the pill-row design. |
| Should we expose a "rates last refreshed N hours ago" indicator? | **No for v1.** Optional polish if users ask. The "≈" prefix already communicates approximation. |
| `≈` character vs `"approx"` text? | **`≈` character.** Universal symbol, takes minimal space, locale-neutral. |
| Round converted amounts for high-magnitude currencies (e.g., JPY)? | **Defer to `Intl.NumberFormat` defaults.** JPY auto-rounds to whole yen; EUR shows 2 decimals. The Intl spec's currency-specific minor-unit defaults are correct. |
| Allow sellers to LIST in non-EUR? | **Out of scope.** That's Feature B (multi-currency commerce / wallet). H' stays display-only. |
| Should conversation offer messages convert too? | **No.** Messages reference real listing prices. Plus there's a pre-existing bug (row 9) hardcoding `'EUR'`; H' should not pile on. Flag for separate fix. |
| Widen `Currency` union beyond `'EUR' \| 'USD' \| 'GBP'`? | **Defer.** The union is a *product* currency narrowing (legal listing currencies), not a *display* currency narrowing. H' introduces a separate `DisplayCurrency` type that can be wider (e.g., `string` constrained to `Intl.supportedValuesOf('currency')`). Don't widen `Currency` itself. |
| Where do display-currency-related strings live in i18n? | Add `profile.currency`, `profile.currencyAuto`, `profile.currencyAutoHint` keys to [src/i18n/locales/fr.json](src/i18n/locales/fr.json) and [src/i18n/locales/en.json](src/i18n/locales/en.json) in H'.3. |

---

## Summary for H'.2

H'.2 ships a foundation containing:

1. **`src/lib/currency/constants.ts`** — five constants from §9.
2. **`src/lib/currency/country-currency-map.ts`** — curated ~30-entry country→currency map per §7.
3. **`src/lib/currency/service.ts`** — `fetchRates()`, cache read/write against `currency-rates-v1`, freshness check.
4. **`src/stores/useDisplayCurrency.ts`** — Zustand+AsyncStorage store mirroring `useUserLocation` shape (§6).
5. **`src/stores/useCurrencyRates.ts`** — separate rates store (rates are fetched, not user-set; conceptually distinct).
6. **Extension to `src/lib/format.ts`** — add `formatDisplayPrice(amount, productCurrency, displayCurrency, locale, rates)` returning `{ text, isApproximation }`. Leave `formatPrice` untouched for non-display callers.
7. **Detection helper** — `detectInitialCurrency()` mirroring `detectInitialLanguage()` from [src/i18n/index.ts:12](src/i18n/index.ts:12), wrapping the §7 3-tier fallback.

H'.3 then migrates the 5 display call sites (rows 2, 3, 5, 6, 7 from §1) and adds the Profile Settings pill row (§5). Rows 4, 8, 9 stay as-is — anything tied to a real money flow keeps product currency.

No source files were modified by this audit.
