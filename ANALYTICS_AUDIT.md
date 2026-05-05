# ANALYTICS_AUDIT.md

Phase H.13 — Pro-gated product-view analytics. Audit notes captured before
and during implementation. The full changelog summary is appended to
`PROJECT_AUDIT.md` at the end of the step; this file holds the load-bearing
design decisions and their rationale so they remain greppable independent of
the larger audit.

---

## 1. Scope

Per the H.13 prompt:

- **In:** product-detail view tracking (anon + authed), owner self-view
  exclusion, owner-only aggregate read RPC, mobile UI showing 24h / 7d /
  30d view counts in 3 stat tiles for Pro sellers, soft Pro upsell teaser
  for free-tier sellers viewing their own product, i18n in mobile (en/fr)
  + web (en/fr/ar).
- **Out:** click-through, conversion, watch-time, country breakdowns,
  charts, web admin surface. Counts only. Graphs/breakdowns are deferred
  to a later phase. **No reduced transaction fee work** — that is also
  deferred (H.12 changelog).

---

## 2. Source-of-truth decisions (and where they deviate from the literal
prompt)

The H.13 prompt is a rough sketch — its code snippets reference symbols
that do not exist in this repo verbatim. The decisions below are the
"as-built" version aligned with the existing codebase conventions.

### 2.1 No `useSupabase()` hook — use the imported singleton

**Prompt code:** `const supabase = useSupabase();`

**Repo reality:** every service file in
`src/features/marketplace/services/` imports `supabase` directly from
`@/lib/supabase`. There is no `useSupabase` hook in the repo (grep
returns zero matches). The singleton client is initialised once at app
boot and shared across the tree.

**Decision:** the new hooks (`useTrackProductView`,
`useProductAnalytics`) and the new service file
(`src/features/marketplace/services/analytics.ts`) call the imported
`supabase` singleton, not a hooked variant. Rationale: the spec's
`useSupabase` was generic; deviating from a 12-file convention to
introduce a one-off hook would create churn for zero benefit.

### 2.2 `useIsPro()` returns `boolean`, not `{ data: boolean }`

**Prompt code:** `const { data: isPro } = useIsPro();`

**Repo reality (per `src/features/marketplace/hooks/useIsPro.ts`):**

```ts
export function useIsPro(): boolean { ... }
```

It already coalesces the underlying `useMySeller` query and returns a
plain bool. The H.4 / H.12 callers all consume it that way.

**Decision:** consume `useIsPro()` as a boolean directly in
`useProductAnalytics`. The spec's destructured form would have produced
a type error at compile time.

### 2.3 `useUpgradeFlow()` returns the handler directly, not `{ start }`

**Prompt code:** `useUpgradeFlow().start()`

**Repo reality (per `src/hooks/useUpgradeFlow.ts`):**

```ts
export function useUpgradeFlow(): () => Promise<void> { ... }
```

Already wired by H.3 cap-modal, H.4 banners, H.4 action-rail
checkout-gate, and H.12 BoostButton.

**Decision:** call `useUpgradeFlow()()` (or `void upgrade()`) on tap of
the analytics teaser CTA, exactly like the other Pro upsell surfaces.

### 2.4 `uuid_generate_v4()` over `gen_random_uuid()`

**Prompt code:** `default gen_random_uuid()`

**Repo reality:** every previous migration (H.2 / D.2 / D.5 / H.12) uses
`uuid_generate_v4()` from the `uuid-ossp` extension already installed at
`20260501_initial_marketplace_schema.sql:16`. The 20260520 and 20260522
migration headers explicitly call out this convention.

**Decision:** use `uuid_generate_v4()` for `product_views.id` to match
the codebase. `gen_random_uuid()` (pgcrypto) would have required
enabling a new extension just for one column. Same precedent decision
captured in H.12 reconnaissance.

### 2.5 Migration shape — BEGIN/COMMIT, idempotent guards, inline rollback

**Prompt code:** raw `create table public.product_views (...)` with no
transaction wrapping or rollback notes.

**Repo convention:** every migration since 20260518 wraps DDL in
`BEGIN;` / `COMMIT;`, uses `CREATE TABLE IF NOT EXISTS` /
`CREATE INDEX IF NOT EXISTS` / `CREATE OR REPLACE FUNCTION` /
`DROP POLICY IF EXISTS + CREATE POLICY` so re-running is a no-op, and
documents an inline rollback SQL block at the top of the file.

**Decision:** match the convention. The H.13 migration is wrapped, all
DDL is idempotent, and the rollback block is at the top.

### 2.6 SECURITY DEFINER `set search_path` hardening

**Prompt code:** `set search_path = public`

**Repo convention (per C.2 / D.2 / E.2 / H.12):** every SECURITY DEFINER
function uses `set search_path = public, pg_catalog`. The `pg_catalog`
suffix matters — without it, `RAISE EXCEPTION` and other built-ins
become hijackable by a malicious user planting a `pg_catalog` shadow
schema.

**Decision:** use `set search_path = public, pg_catalog` on both new
RPCs.

### 2.7 RLS on `product_views`: enabled but no policies (intentional)

**Prompt:** "no policies — only service-role and SECURITY DEFINER RPCs
touch this table"

**Decision (kept):** enable RLS without any policies. Effect:
`authenticated` and `anon` cannot SELECT / INSERT / UPDATE / DELETE
directly. Only:
- the `service_role` (Edge Functions, admin web) bypasses RLS
- the SECURITY DEFINER RPCs `track_product_view` and
  `get_product_analytics` run as the migration owner and bypass RLS

Belt-and-suspenders: also revoke `ALL` from `public` on the table grant
side, so even if a future RLS policy is added accidentally it cannot
expose raw rows.

This is the same lock-down pattern used for any append-only event log
that is not meant to be tailable from the JS client.

### 2.8 Pro gate: client-side only, plus server-side ownership check

The prompt explicitly notes:
> "Pro gate enforced two ways: client (useIsPro) + server (RPC
> ownership check; Pro check itself is client-side because aggregates
> aren't sensitive — only revealing them is)."

**Decision (kept):** the `get_product_analytics` RPC verifies *ownership*
(seller_id matches caller's auth.uid via the sellers table) but does
NOT verify Pro state. The Pro state is gated client-side in
`useProductAnalytics`. Rationale:
- View counts on a public product are not legally sensitive — the
  "value" of the perk is the polished UI and immediate readability,
  not the raw count.
- A free seller who somehow constructs a Supabase shell call to
  `get_product_analytics(my_product_id)` and gets numbers back is a
  perfectly acceptable failure mode. They still don't get the
  in-app Pro UI.
- Removing the server-side Pro check keeps the RPC stable across
  future Pro/free-tier changes (e.g., grandfathering, regional
  pricing) — no migration churn when the rules shift.

### 2.9 Owner self-view exclusion

**Decision (kept):** the SECURITY DEFINER `track_product_view` RPC
inserts a row only if the calling seller (resolved via
`sellers.user_id = auth.uid()`) is NOT the owner of the product.
Anonymous callers (`auth.uid() IS NULL`) always insert because they
cannot be the owner by definition.

This prevents owners from "padding" their own view counts simply by
opening their listing repeatedly. The exclusion is server-side rather
than client-side because client-side gating could be bypassed.

### 2.10 Dedup window — none

The prompt says "debounced so a flicker open/close doesn't double-count".
The mobile hook implements client-side dedup via a `useRef<Set<string>>()`
that records every product whose detail has fired a `track_product_view`
in this app session. There is **no server-side dedup**:

- A user closing and reopening the app produces a new in-memory ref →
  the same product's open will track again.
- A second device or browser tab will track independently.
- Multiple visits over hours/days legitimately register as multiple
  views.

This is the right default for a v1 view counter — naive enough to be
useful, simple enough to ship. Real "unique visitors" semantics is
deferred to a later phase if the product team requests it.

### 2.11 Tracking RPC failure mode — silent

The hook fires the RPC fire-and-forget; errors are caught and ignored.
A failed track is invisible to the user (the screen still renders) and
costs us at most one undercount. Logging or surfacing the error here
would be worse: it'd add a permission prompt for analytics that doesn't
help the user.

### 2.12 AnalyticsCard placement — inside the detail sheet, owner-only

The card is rendered inside `ProductDetailSheet` directly below the
H.12 BoostButton and is fully gated by the same `isOwn` check. A
non-owner viewing someone else's listing never sees the analytics
section, and a Pro non-owner doesn't either.

This keeps analytics where the seller already operates on their listing
(boost, edit/delete from MyListings, contact buyer in messages) rather
than introducing a new screen.

### 2.13 Web messages: `analytics.*` namespace added but no UI surface

The H.13 prompt explicitly says "No web admin surface in H.13". The
web messages are updated for parity (en/fr/ar) so the namespace is
ready for a future H.14 or admin console without a second i18n PR. No
React/Next.js code is added on the web side.

The Arabic strings carry the same caveat as H.7.1: pending
native-speaker review. Marker comment: `_arNote` is added to the AR
file's `analytics` block per the existing convention used by H.7.1.

---

## 3. Schema design

### 3.1 `public.product_views`

```sql
create table public.product_views (
  id                uuid        primary key default uuid_generate_v4(),
  product_id        uuid        not null
                                references public.products(id) on delete cascade,
  viewer_seller_id  uuid        references public.sellers(id) on delete set null,
  viewed_at         timestamptz not null default now()
);
```

Notes on the FK choices:

- `product_id ON DELETE CASCADE`: when a listing is deleted (B.4
  account-deletion sweep, owner manual delete) its view log is
  meaningless and should disappear with it.
- `viewer_seller_id ON DELETE SET NULL`: a deleted viewer (account
  deletion) should NOT cascade-delete the view rows — the OWNER's
  aggregate still legitimately owes a count for that view (it was a
  real view; the viewer just no longer exists). SET NULL preserves the
  count while severing the viewer-PII link.
- `viewer_seller_id NULL`: anonymous (signed-out) views. By design.

### 3.2 Index `product_views_product_id_viewed_at_idx`

```sql
(product_id, viewed_at desc)
```

The hot read path is "aggregate views for a single product over the
last N days". `(product_id, viewed_at desc)` matches the
`get_product_analytics` query plan exactly: equality on product_id,
range on viewed_at. The DESC suffix keeps the most-recent rows at the
front, which matches the natural query direction.

No `viewer_seller_id` index — the analytics RPC does not group by
viewer; future "unique-views" or "your-followers-viewed-this" features
would add a separate index then.

### 3.3 RPC `track_product_view(p_product_id uuid)`

SECURITY DEFINER. Resolves the caller's seller_id (NULL for anon),
fetches the product owner, returns early if owner is missing (deleted
listing) or if caller is the owner. Otherwise inserts.

Granted to BOTH `anon` and `authenticated`. The implicit `public` grant
is revoked first to keep grants explicit.

### 3.4 RPC `get_product_analytics(p_product_id uuid)`

SECURITY DEFINER. Verifies ownership via the same
sellers↔auth.uid() pattern used in H.12's `feature_product`. On
mismatch, raises `'not_authorized'`. On success, returns a single-row
table with three integer columns: `views_24h`, `views_7d`, `views_30d`.

The `count(*) FILTER (WHERE viewed_at >= now() - interval '...')`
pattern is a single-table-scan three-way aggregate — no UNION, no
subqueries, one index seek per product.

Granted to `authenticated` only (not anon — anon has no concept of
"my own product").

---

## 4. Mobile hooks

### 4.1 `useTrackProductView(productId)`

- Effect-based, fires once per `productId` per app session.
- Dedup via `useRef<Set<string>>` populated synchronously inside the
  effect before the RPC call. A double-mount of the same sheet (e.g.,
  React strict mode) is harmless.
- Errors are caught and dropped — view-tracking failure must never
  surface to the user.
- No return value. The hook is purely side-effecting.

### 4.2 `useProductAnalytics(productId, isOwner)`

- `enabled: !!productId && !!isOwner && isPro` — three-way gate. If any
  is false the query never fires; React Query simply returns
  `data: undefined`.
- 60s `staleTime` per spec. Re-fetch on focus is the React Query
  default, which is what we want — opening the sheet fresh after a
  background period reads the latest counts.
- Returns the raw `{ views_24h, views_7d, views_30d }` shape from the
  RPC, with a zero-fallback for the (impossible-in-practice) empty
  array case.
- Error → React Query `isError` state. The card shows a minimal "—"
  placeholder rather than crashing or surfacing an Alert.

---

## 5. UI

### 5.1 `<AnalyticsCard productId isOwner />` (shared mobile component)

State machine:

1. `!isOwner` → renders `null`. Caller can mount unconditionally; the
   gate is internal.
2. `!isPro` → renders `<ProUpgradeBanner emphasis="soft" />` with the
   `analytics.upgradeTeaser` body and `analytics.upgradeCta` label
   wired to `useUpgradeFlow()`.
3. `isLoading` → 3 placeholder tiles with skeleton dots.
4. `data` → 3 stat tiles (24h / 7d / 30d) showing the count + a tiny
   localized label.
5. `isError` → 3 tiles each rendering "—" (no Alert; analytics
   visibility errors are not user-actionable).

The component is pure — no Pressables, no haptics. The only
interactive surface is the upgrade banner CTA, and that delegation
happens through `useUpgradeFlow`.

---

## 6. i18n

### 6.1 Mobile (`src/i18n/locales/{en,fr}.json`)

New top-level namespace `analytics`:

| key                | en                                              | fr                                                              |
| ---                | ---                                             | ---                                                             |
| `title`            | Analytics                                       | Statistiques                                                    |
| `views24h`         | Views (24h)                                     | Vues (24h)                                                      |
| `views7d`          | Views (7d)                                      | Vues (7j)                                                       |
| `views30d`         | Views (30d)                                     | Vues (30j)                                                      |
| `upgradeTeaser`    | Upgrade to Pro to see who's viewing your listings. | Passez Pro pour voir qui consulte vos annonces.            |
| `upgradeCta`       | View analytics                                  | Voir les statistiques                                           |
| `errorPlaceholder` | —                                               | —                                                               |
| `loadingPlaceholder` | —                                             | —                                                               |

### 6.2 Web (`web/messages/{en,fr,ar}.json`)

Identical key set, AR added under the same caveat as H.7.1
(`_arNote`).

---

## 7. Open questions / handoffs

- **Dedup hardening.** v1 ships naive dedup. If support reports inflated
  counts, add a `(product_id, viewer_seller_id, day_bucket)` unique
  constraint or a hash-based session bucket and harden the RPC.
- **Anon viewer attribution.** anon views all roll up under
  `viewer_seller_id IS NULL`. If the product team later wants
  "registered vs anonymous" breakdown the column is already there.
- **Time zones.** The intervals are evaluated in the database TZ
  (`now() - interval '24 hours'`). For v1 this is fine — the UI shows
  rolling windows, not "today vs yesterday". When/if calendar-day
  bucketing arrives, switch to `now() AT TIME ZONE seller.timezone`
  with a column on sellers.
- **Reduced transaction fee** is still deferred from H.12. H.13 does
  not address it.
- **Click-through / scroll-depth / dwell** all deferred to a future
  phase (H.14+ or post-launch). The `product_views` table is
  intentionally light so that adding a sibling event log
  (`product_clicks`, `product_dwell_seconds`) later is a clean,
  additive migration.
