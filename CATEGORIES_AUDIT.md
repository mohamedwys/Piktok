# Categories Page — Audit & Design Directions (Step A.1)

Read-only reconnaissance of the Categories tab, the taxonomy that backs it,
existing geo data (Phase G preview), and existing filter UX. No source files
were modified. The next step (A.2) reads this audit and designs +
implements the new Categories page.

---

## 1. Current State

**Tab → route mapping.** The bottom tab bar's "Catégories" / "Categories"
slot is wired to the route literally named `friends`. The route file is
named `friends.tsx` purely for legacy reasons — its component, content, and
behaviour are 100% category-related. It is misnamed; the file should
eventually be renamed to `categories.tsx`, but A.1 does **not** rename
anything.

| Aspect | Value |
| --- | --- |
| Tab label key | `tabs.categories` (`src/app/(protected)/(tabs)/_layout.tsx:32`) |
| Tab icon | `grid` / `grid-outline` Ionicons (`src/components/navigation/CustomTabBar.tsx:57-64`) |
| Route file | [src/app/(protected)/(tabs)/friends.tsx](src/app/(protected)/(tabs)/friends.tsx) |
| Component name | `CategoriesScreen` (file:18) |

**Component tree.**

```
CategoriesScreen (View, paddingTop = insets.top + 16)
├─ Text (title, "Catégories")
└─ FlatList (numColumns = 2 phone / 3 tablet, gap 12)
   └─ CategoryCard (per CATEGORIES item)
      ├─ Ionicons (size 48, colors.brand)
      └─ Text (label, fontSize 14)
```

`numColumns` toggles via `useDeviceLayout().isTablet`
([friends.tsx:24-25](src/app/(protected)/(tabs)/friends.tsx:24)). Cards
have `aspectRatio: 1`, radius 16, translucent white background
(`rgba(255,255,255,0.06)`), thin hairline border, with the icon centered
and the label underneath. The screen background is hardcoded `#000`, and
the title is hardcoded `#fff` 28px 800-weight — both raw values, not theme
tokens (BRAND.md flags this as a contract violation that A.2 should fix).

**Data fetched.** None. The page has zero React Query hooks, zero Supabase
calls, and zero Zustand reads other than `setFilters` and `setMainTab`. Its
content comes entirely from the static `CATEGORIES` constant
([categories.ts:11](src/features/marketplace/data/categories.ts:11)).

**Interactions.** A single tap handler (`onPressCategory`,
[friends.tsx:28-33](src/app/(protected)/(tabs)/friends.tsx:28)):

1. Fires `mediumHaptic()`.
2. Sets `categoryId` on the marketplace filters store, clears
   `subcategoryId`.
3. Sets the home main-tab to `'marketplace'` (vs `'pour-toi'`).
4. Navigates to `/(protected)/(tabs)` — i.e. the home feed, which then
   reads the filters store.

There is no subcategory drill-in, no search bar, no "near me", no images,
no breadcrumbs, no horizontal rails, no header, no badges, no filtering of
the grid itself. The page is a flat 8-cell grid that funnels back to the
home feed with one filter pre-applied.

**One-paragraph user-facing summary.** Today the Categories tab shows a
plain dark 2-column grid of eight icon cards (Vehicles, Real Estate, Home
& Decor, Fashion, Electronics, Sports & Leisure, Books & Media, Other).
Tapping a card jumps the user back to the marketplace home tab with that
category filter applied. There is no subcategory navigation on the page
itself — drill-in is only available later via the filter sheet on home.
The page is functional but visually flat, doesn't feel premium, and does
no discovery work (no trending, no "near me", no imagery).

---

## 2. Categories Taxonomy

**Storage.** The taxonomy is **hardcoded in TypeScript**, not in Supabase.
There is no `categories` table, no join table, no enum. Data lives at
[src/features/marketplace/data/categories.ts](src/features/marketplace/data/categories.ts)
as `CATEGORIES: CategoryDef[]` (file:11).

| Layer | Where |
| --- | --- |
| Type definitions | `CategoryDef`, `SubcategoryDef` ([categories.ts:3-9](src/features/marketplace/data/categories.ts:3)) |
| Source of truth (UI) | `CATEGORIES` array ([categories.ts:11-105](src/features/marketplace/data/categories.ts:11)) |
| Helper | `findCategory(id)` ([categories.ts:107](src/features/marketplace/data/categories.ts:107)) |
| Storage on `products` | `category_id text`, `subcategory_id text` (free-form, no FK, no enum) — added in [supabase/migrations/20260505_category_ids.sql](supabase/migrations/20260505_category_ids.sql) |
| Legacy display field | `products.category jsonb` (`{primary:{fr,en}, secondary:{fr,en}}`) — see [20260501_initial_marketplace_schema.sql:40](supabase/migrations/20260501_initial_marketplace_schema.sql:40) |

The only DB constraint on category id is the `text` column — anything
fits. The TS array is the de-facto whitelist. There is **no** referential
integrity between `products.category_id` and the TS list; mismatches will
silently filter to zero rows.

**Hierarchy.** Two levels: top-level category, then subcategories. No
deeper drill-in. Localized labels in `{fr, en}` shape via
`LocalizedString`.

**Tree (en labels, 8 categories / 33 subcategories total):**

```
auto          Vehicles
              ├─ auto-cars             Cars
              ├─ auto-motorcycles      Motorcycles & Scooters
              ├─ auto-utility          Commercial vehicles
              ├─ auto-rv               RVs & Caravans
              ├─ auto-parts            Parts & Accessories
              └─ auto-tires            Tires & Wheels
immo          Real Estate
              ├─ immo-apartments-sale  Apartments for sale
              ├─ immo-houses-sale      Houses for sale
              ├─ immo-rentals          Rentals
              ├─ immo-shared           Shared housing
              ├─ immo-land             Land
              ├─ immo-commercial       Commercial spaces
              └─ immo-parking          Parking & Garages
home          Home & Decor
              ├─ home-armchairs        Armchairs
              ├─ home-tables           Tables
              ├─ home-lighting         Lighting
              ├─ home-decor            Decor
              └─ home-storage          Storage
fashion       Fashion
              ├─ fashion-clothing      Clothing
              ├─ fashion-shoes         Shoes
              ├─ fashion-bags          Bags
              ├─ fashion-accessories   Accessories
              └─ fashion-jewelry       Jewelry
electronics   Electronics
              ├─ elec-phones           Phones
              ├─ elec-computers        Computers
              ├─ elec-audio            Audio
              ├─ elec-cameras          Photo & Video
              └─ elec-gaming           Gaming
sports        Sports & Leisure
              ├─ sports-fitness        Fitness
              ├─ sports-outdoor        Outdoor
              ├─ sports-bikes          Bikes
              └─ sports-team           Team sports
books         Books & Media
              ├─ books-books           Books
              ├─ books-music           Music
              ├─ books-movies          Movies & Series
              └─ books-games           Games & Toys
other         Other
              └─ other-misc            Misc
```

**Icons.** Each top-level category carries a single Ionicons name
(`car-outline`, `business-outline`, `home-outline`, `shirt-outline`,
`phone-portrait-outline`, `fitness-outline`, `book-outline`,
`cube-outline`). Subcategories have **no** icons. No category has cover
imagery in the data layer.

**Indexes.**
`products_category_idx ON products(category_id)`,
`products_subcategory_idx ON products(subcategory_id)` — both b-tree
indexes added in 20260505. No unique constraints, no FK.

---

## 3. Product-to-Category Mapping

A product carries category info in **two parallel ways** — a denormalized
JSONB display field and a normalized id pair. The query path uses the ids;
the rendered UI breadcrumb uses the JSONB.

| Carrier | Type | Example | Used by |
| --- | --- | --- | --- |
| `products.category_id` | `text` | `'home'` | filter query (`searchProducts`) |
| `products.subcategory_id` | `text` | `'home-armchairs'` | filter query |
| `products.category` (legacy) | `jsonb` | `{"primary":{"fr":"Maison & Déco","en":"Home & Decor"},"secondary":{"fr":"Fauteuils","en":"Armchairs"}}` | rendered breadcrumb |

The Product type carries both shapes
([src/features/marketplace/types/product.ts:57-76](src/features/marketplace/types/product.ts:57)):

```ts
export type Product = {
  ...
  category: ProductCategory;       // legacy display
  categoryId?: string;             // optional normalized id
  subcategoryId?: string;
  ...
};
```

**Query hooks.**

| Hook / function | File | Filtering |
| --- | --- | --- |
| `listProducts({ limit })` | [products.ts:121](src/features/marketplace/services/products.ts:121) | none |
| `searchProducts(filters, limit)` | [products.ts:135](src/features/marketplace/services/products.ts:135) | category_id, subcategory_id, price max, pickup_available, location ilike, query (title/description ilike fr+en) |
| `useProducts()` | `src/features/marketplace/hooks/useProducts.ts` | wraps `listProducts`; key `['marketplace', 'products', 'list']` |
| `useFilteredProducts()` | `src/features/marketplace/hooks/useFilteredProducts.ts` | wraps `searchProducts(filters)`; key `['marketplace', 'products', 'list', filters]` |
| `listMyProducts()` | [products.ts:172](src/features/marketplace/services/products.ts:172) | seller-scoped |

**Filter shape applied in the query (Supabase JS):**

```ts
// src/features/marketplace/services/products.ts:157-164
if (filters.categoryId)    query = query.eq('category_id', filters.categoryId);
if (filters.subcategoryId) query = query.eq('subcategory_id', filters.subcategoryId);
if (filters.priceMax !== null) query = query.lte('price', filters.priceMax);
if (filters.pickupOnly)    query = query.eq('pickup_available', true);
if (filters.locationQuery.trim().length > 0) {
  const loc = filters.locationQuery.trim().replace(/[%_]/g, '');
  query = query.ilike('location', `%${loc}%`);
}
```

**Breadcrumb rendering.** The reference image's
"Maison & Déco > Fauteuils" pill is rendered inside the expanded bottom
panel of each feed card, **not** the collapsed state — it appears only
once the user taps the chevron.
[ProductBottomPanel.tsx:91-103](src/features/marketplace/components/ProductBottomPanel.tsx:91):

```tsx
{expanded ? (
  <Animated.View style={styles.breadcrumb} ...>
    <Ionicons name="home" size={11} color="#fff" />
    <Text style={styles.breadcrumbText}>
      {` ${categoryPrimary} > ${categorySecondary}`}
    </Text>
  </Animated.View>
) : null}
```

The breadcrumb text is built from the legacy JSONB field
(`product.category.primary` / `.secondary`,
[ProductBottomPanel.tsx:60-61](src/features/marketplace/components/ProductBottomPanel.tsx:60)),
not from looking up `category_id` in the TS array. This means the
breadcrumb works even if `category_id` is null, and it can drift from the
canonical taxonomy. A.2 should decide whether to keep the legacy field as
the display source or migrate to id-lookup.

**Existing "browse by category" code.** The Categories tab itself
([friends.tsx](src/app/(protected)/(tabs)/friends.tsx)) is the only browse
surface. The filter sheet has category chip rows but is a filter, not a
browse landing. There is no per-category landing page route, no
"trending in X" rail, and no category cover images anywhere in the data.

---

## 4. Location Data Today (Phase G Preview)

**Phase G is not implemented and the codebase is essentially geo-greenfield.**
A.2 should not propose any geo work; this section exists so Phase G
starts informed.

**What exists.**

| Layer | Field | Type | Notes |
| --- | --- | --- | --- |
| DB column | `products.location` | `text` | Free-form string. Added in [20260504_pickup_location.sql](supabase/migrations/20260504_pickup_location.sql). No index. |
| DB column | `products.pickup_available` | `boolean` | Same migration. Independent flag. |
| Filter store | `MarketplaceFilters.locationQuery` | `string` | [src/stores/useMarketplaceFilters.ts:11](src/stores/useMarketplaceFilters.ts:11) |
| Filter store | `MarketplaceFilters.pickupOnly` | `boolean` | [src/stores/useMarketplaceFilters.ts:10](src/stores/useMarketplaceFilters.ts:10) |
| Query | `query.ilike('location', '%loc%')` | substring match | [products.ts:163](src/features/marketplace/services/products.ts:163) |
| TS type | `Product.location?: string` | optional | [product.ts:72](src/features/marketplace/types/product.ts:72) |
| TS type | `Product.pickup?.available: boolean` | nested | [product.ts:53-55](src/features/marketplace/types/product.ts:53) |

**What does NOT exist.**

- No `latitude`, `longitude`, `lat`, `lng`, `coordinates`, `point`,
  `geography`, `geometry`, or PostGIS-related field on any table. Verified
  by grepping `supabase/` for `\b(lat|lng|latitude|longitude|coordinates|postal|zip|address|city|country)\b` (zero hits other than `last_message_at`/`_preview` in messaging migrations) and `postgis|geography|ST_|earth_distance|earthdistance|cube` (zero hits).
- No `CREATE EXTENSION postgis` in any migration. PostGIS is **not**
  enabled on the Supabase project (per migrations).
- No structured address fields anywhere — no `city`, `country`, `postal_code`, `street`.
- No `expo-location`, `@react-native-community/geolocation`, or any
  geocoding SDK in [package.json](package.json). The only geo-adjacent
  Expo module present is `expo-localization` (i18n locale detection,
  not GPS).
- The `sellers` table has no geo columns
  ([20260501_initial_marketplace_schema.sql:21-30](supabase/migrations/20260501_initial_marketplace_schema.sql:21)).
  Migrations 20260508 (`seller_contact`) and 20260511 (`seller_stripe`)
  add `bio`, `website`, `phone_public`, `email_public`, and Stripe
  account fields — no addresses, no geo.

**Implications for Phase G.**

1. Phase G will need a real schema decision (PostGIS vs lat/lng numeric
   columns vs a `location_geo` JSONB blob). There is no legacy schema to
   migrate from — only the free-text `products.location`.
2. The free-text `products.location` field is currently doing double duty
   as both display ("Lyon, France") and search key (substring match).
   Phase G can either deprecate it or treat it as the human label paired
   with structured coordinates.
3. The seller side is completely empty — Phase G will need to choose
   between per-product location (current) or per-seller location (more
   common for marketplaces). Both are valid; the choice has UX
   consequences.
4. No client-side permission flow exists yet for `expo-location`. Phase
   G will own that flow end-to-end (permission request, fallback for
   denied state, manual-entry alternative).

---

## 5. Existing Search / Filter Patterns

**Entry point.** The home tab has a search button in
`MarketplaceHeader`, which opens a global filter sheet:

```ts
// src/app/(protected)/(tabs)/index.tsx:27-30
const onPressSearch = (): void => {
  void mediumHaptic();
  useFilterSheetStore.getState().open();
};
```

The category badge count from the filter store is shown on the search
button via `filterCount` ([index.tsx:25, 44](src/app/(protected)/(tabs)/index.tsx:25)).

**UI pattern.** A bottom sheet
([MarketplaceFilterSheet.tsx](src/features/marketplace/components/MarketplaceFilterSheet.tsx))
using `@gorhom/bottom-sheet` with snap points `['50%', '90%']`. Layout
top-to-bottom: title row + reset link, free-text query input, **category
chip row (horizontal scroll)**, **subcategory chip row (horizontal scroll,
shown only after a category is picked)**, price max input, pickup-only
switch, free-text location input, footer with Reset / Apply buttons.

The chip pattern is the canonical filter UI in the app and the only place
subcategory drill-in lives today. Active chip is filled `colors.brand`,
inactive is bordered transparent
([MarketplaceFilterSheet.tsx:370-377](src/features/marketplace/components/MarketplaceFilterSheet.tsx:370)).

**State.** Two stores:

| Store | File | Persistence | Purpose |
| --- | --- | --- | --- |
| `useMarketplaceFilters` | [src/stores/useMarketplaceFilters.ts](src/stores/useMarketplaceFilters.ts) | AsyncStorage (`marketplace-filters`) | Filter values — query, categoryId, subcategoryId, priceMax, pickupOnly, locationQuery |
| `useFilterSheetStore` | [src/stores/useFilterSheetStore.ts](src/stores/useFilterSheetStore.ts) | none (in-memory) | Sheet open/close |

Filters live globally and persist across sessions — applying a category
on the Categories tab will still be active after relaunch. This is a
**load-bearing UX behaviour** any new design must respect or
deliberately change.

**React Query integration.** The `filters` object is the cache key
suffix:

```ts
// useFilteredProducts.ts (paraphrased from agent recon)
useQuery({
  queryKey: ['marketplace', 'products', 'list', filters],
  queryFn: () => searchProducts(filters),
})
```

Any field of `filters` that changes invalidates the query — including
the free-text `query` string. There is no debouncing layer (the sheet
applies on tap of "Apply", not per keystroke, so this is fine in
practice today).

**Consumers of the filter store.**

- [src/app/(protected)/(tabs)/index.tsx:24](src/app/(protected)/(tabs)/index.tsx:24) — reads filters for the badge count.
- [MarketplaceFilterSheet.tsx:42-44](src/features/marketplace/components/MarketplaceFilterSheet.tsx:42) — reads/writes (apply, reset).
- `src/features/marketplace/hooks/useFilteredProducts.ts` — reads filters as the query key + arg.
- [friends.tsx:22, 28-33](src/app/(protected)/(tabs)/friends.tsx:22) — writes (`setFilters({categoryId, subcategoryId: null})`) on category card tap.

**No standalone search route.** There is no `/(protected)/search` route.
Search is part of the home tab.

---

## 6. Design Directions

All three directions assume:
- Reuse `CATEGORIES` from [categories.ts](src/features/marketplace/data/categories.ts) as-is. No backend schema change in A.2.
- Reuse the marketplace filter store as the funnel target, preserving the existing "tap → filter applied → home feed" round-trip.
- Comply with BRAND.md — only `theme` tokens, no raw colors or spacing.
- Defer all real geo work to Phase G. Any "Près de moi" affordance in A.2 is **either omitted entirely or wired to the existing free-text `locationQuery` field** (no GPS, no PostGIS).

### D1 — Hero header + image-led category cards (Depop / Pinterest style)

A `glass.darkStrong` hero header at top with the screen title and an
optional search-button affordance. Below it, a 2-column FlatList of large
square cards that lean on imagery: each card shows a top-3 product photo
collage (or a single representative product) drawn from
`searchProducts({ categoryId })` for the freshest item per category.
Category name overlaid bottom-left with a subtle scrim for legibility.
Tap → existing filter-and-jump funnel.

- **Surfaces** `surface` for the page background; `glass.darkStrong` for
  the header; `Card` (existing GlassCard variant) for each cell with a
  `radii.xl` corner.
- **Taxonomy surfaced:** top-level only. Subcategory drill-in stays in the
  filter sheet (or is reached by re-tapping a card on the home feed).
- **Risks:** Each card needs a per-category image. No cover images exist
  in the data layer today. Either A.2 derives them from a
  `most-recent-product-per-category` query (cheap, but a category with no
  listings shows an empty state) or A.2 hardcodes 8 curated assets (high
  visual quality, requires an asset pipeline / brand-team handoff).
- **Trade-off.** Highest visual payoff, highest content cost. Without
  cover images this direction collapses to "icon in a fancy frame."

### D2 — Compact list with subcategory drill-in (iOS Settings style)

A scrollable list of 8 rows, each a row item
(icon + label + chevron + count badge). Tapping a row pushes a sub-route
showing that category's subcategories as a second list, again with
chevrons. Tapping a leaf subcategory applies the filter and pops back to
home. Optionally, the top-level row could show product counts per
category (cheap aggregate query).

- **Surfaces** `surface` background; row items use `surfaceElevated` with
  `border` hairline; `radii.lg` on the list container, no per-row radius.
- **Taxonomy surfaced:** full hierarchy via drill-in.
- **Visual primitives:** no GlassCard needed; `IconButton`/Ionicons +
  `Text` body + chevron right. Resembles iOS Settings / Telegram
  category drawers.
- **Risks:** Visually quiet. Doesn't carry the "premium video-first
  marketplace" promise from BRAND.md. Will feel utilitarian against the
  rest of the app.
- **Trade-off.** Best for users who already know what they want; worst
  for discovery. Cheapest to build. Easiest to extend (deep hierarchy
  costs nothing to add).

### D3 — Curated rails above a category grid (Apple Music + Whatnot blend)

Top: `glass.darkStrong` header with title and a "Près de moi" pill chip
(deferred to Phase G — in A.2, this chip either ships hidden behind a
flag or wires to `locationQuery` to filter by user-entered city).
Below: 2–3 horizontal rails — "Trending now" (top-N products by
likes_count desc), "Récemment ajouté" (newest), and optionally
"Près de chez vous" (Phase G placeholder). Below the rails: a 2-column
grid of category cards (D1-style but smaller, 1.4 aspect, fewer-frills),
8 cells.

- **Surfaces:** `surface` page bg; rails use `Card` with `radii.lg`
  thumbnails; grid cells `radii.lg` with the existing icon + label
  pattern (no cover image dependency for the grid cells).
- **Taxonomy surfaced:** top-level grid + product-level rails. Subcategory
  drill-in is still funnel-into-filter-sheet (or A.2 may add a small
  subcategory chip row inside each category route — but that's a separate
  screen, not this page).
- **Risks:** More queries on mount (rails). Mixes discovery (rails) with
  navigation (grid) — risk of a busy first impression on a small phone.
  Deferring "Près de moi" to Phase G means the chip is either present
  but a no-op or hidden, which is a UX loose-end.
- **Trade-off.** Most "premium video-first marketplace"-flavored of the
  three. Best discovery work. Highest implementation cost (multiple
  queries, rail virtualization, scroll behaviour).

### Recommendation: D3 — Curated rails above a category grid

D3 is the closest fit to BRAND.md's "Apple Music restraint with Whatnot
conversion energy" — the rails do the discovery work that justifies the
tab existing as a destination rather than a glorified filter shortcut,
while the grid below is a utility users will reach for when they have
intent. D1 is too dependent on cover-image content the project does not
yet own; D2 is brand-incoherent. D3 also reuses query primitives that
already exist (`searchProducts` with `categoryId` for category cards,
plain `listProducts` ordered by `likes_count desc` for trending) so no
schema work is required. The "Près de moi" loose-end is acceptable: A.2
can ship the chip wired to the existing free-text `locationQuery`, or
hidden, and Phase G upgrades it to GPS later without redesigning the
page.

---

## 7. Open Questions for A.2

1. **Cover images.** Does any direction require per-category cover imagery
   (D1 hard-requires; D3 soft-requires for rails)? If yes — does the
   project want product-derived covers (cheap, may be empty) or curated
   8-asset bundle (high quality, needs assets)? This is the single
   biggest content question.
2. **Subcategory drill-in surface.** Is subcategory navigation a job for
   the new Categories page, or does it stay only in the filter sheet?
   D2 needs it on-page; D1 and D3 can keep it in the sheet.
3. **Search bar at top.** The home tab already has the filter-sheet
   search button. Should the Categories page also expose one (clean
   parity), or is search strictly a home-tab affordance?
4. **Funnel destination.** Today, tapping a category jumps to the home
   feed with the filter applied. Should this remain (current behavior),
   or should each category have its own dedicated landing route
   (`/category/[id]`) that A.2 introduces? The latter unlocks D3-style
   rails per category but is a much bigger surface.
5. **Tab route rename.** The route is `friends` for legacy reasons. A.2
   should decide whether to rename to `categories` (a touch-everything
   refactor) or leave the misnomer (cosmetic-only debt).
6. **"Trending" definition.** D3's "Trending now" rail — order by
   `likes_count desc`, `bookmarks_count desc`, or a velocity metric
   (likes per day since `created_at`)? Velocity is more honest but
   requires either a derived column or a real-time aggregate.
7. **"Près de moi" affordance.** Hide the pill behind a feature flag,
   ship it wired to free-text `locationQuery`, or omit it entirely and
   wait for Phase G? Each option has different downstream costs.
8. **Theme-token cleanup.** The current page hardcodes `#000`, `#fff`,
   `rgba(255,255,255,0.06)`, `28px`, `16px`, `48px`. A.2 must replace
   every one with `colors`/`spacing`/`typography`/`radii` tokens — this
   is non-negotiable per BRAND.md. Worth budgeting time for it.
9. **`Product.category` legacy JSONB field.** Should A.2 deprecate the
   denormalized JSONB and switch the breadcrumb renderer to look up
   `category_id` in the TS array? Or leave the legacy field as the UI
   source-of-truth and let `category_id` live as a query-only key? (Both
   are coherent; mixing them silently is the worst option.)
10. **Empty-state behavior.** What does a category card look like when
    its category has zero matching products? In D1/D3 with derived
    covers, this will hit constantly during early data states.
