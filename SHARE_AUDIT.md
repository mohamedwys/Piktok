# SHARE_AUDIT.md

Phase E.1 — Read-only discovery of the share button surface, the
denormalized `products.shares_count` counter, deep-link / scheme
configuration, and the parallel patterns this work should mirror.

Companion to [`PROJECT_AUDIT.md`](PROJECT_AUDIT.md),
[`CATEGORIES_AUDIT.md`](CATEGORIES_AUDIT.md),
[`FOLLOWING_AUDIT.md`](FOLLOWING_AUDIT.md), and
[`COMMENTS_AUDIT.md`](COMMENTS_AUDIT.md).

No source files modified. This audit informs E.2's schema + RN Share
wiring; it does not propose migrations.

---

## 1. Existing Share Code

The share surface is **decorative-only** today. There is no producer
of `products.shares_count`, no helper around the RN `Share` API, and
no reference to `expo-sharing`. The action-rail button is a no-op.

### 1.1 The action-rail button

[`src/features/marketplace/components/ProductActionRail.tsx:46`](src/features/marketplace/components/ProductActionRail.tsx)
defines the handler:

```tsx
const onPressShare = (): void => {};
```

Wired to a `Pressable` with a paper-plane icon at line 93–99:

```tsx
<Pressable
  onPress={onPressShare}
  style={({ pressed }) => [styles.button, pressed && styles.pressed]}
>
  <Ionicons name="paper-plane" size={30} color="#fff" />
  <Text style={styles.label}>{shareLabel}</Text>
</Pressable>
```

`shareLabel` (lines 48–51) reads
`product.engagement.shares` and renders either the formatted count
(if > 0) or the localized literal `t('marketplace.share')`. Because
nothing writes `shares_count`, the label is permanently `"Share"`
(or `"Partager"` in FR).

Notably the share button does **not** call `lightHaptic()` or
`requireAuth()` — both of which the like / comment / buy buttons in
the same file do call. Any E.2 wiring should add both.

### 1.2 Search results — full sweep

Case-insensitive `'share'` across `src/`:

| File | Hits | Role |
| --- | --- | --- |
| [`src/features/marketplace/components/ProductActionRail.tsx`](src/features/marketplace/components/ProductActionRail.tsx) | `onPressShare`, `shareLabel`, `t('marketplace.share')` | Stub button (above). |
| [`src/types/supabase.ts:331,362,393,933`](src/types/supabase.ts) | `shares_count: number` | Generated column type. |
| [`src/features/marketplace/services/products.ts:60,105`](src/features/marketplace/services/products.ts) | `shares_count: number;` and `shares: row.shares_count,` in `rowToProduct`. | Read-only mapping. |
| [`src/features/marketplace/types/product.ts:49`](src/features/marketplace/types/product.ts) | `shares: number` on `ProductEngagement`. | Domain type. |
| [`src/features/marketplace/components/ProductFeedItem.tsx`](src/features/marketplace/components/ProductFeedItem.tsx) | `useSharedValue` (Reanimated) | Unrelated. |
| [`src/features/marketplace/components/ProductBottomPanel.tsx`](src/features/marketplace/components/ProductBottomPanel.tsx) | `useSharedValue` | Unrelated. |
| [`src/features/marketplace/components/MarketplaceFeedSkeleton.tsx`](src/features/marketplace/components/MarketplaceFeedSkeleton.tsx) | `useSharedValue` | Unrelated. |
| [`src/features/marketplace/components/SellerProductCardSkeleton.tsx`](src/features/marketplace/components/SellerProductCardSkeleton.tsx) | `useSharedValue` | Unrelated. |
| [`src/components/ui/Pressable.tsx`](src/components/ui/Pressable.tsx) | `useSharedValue` | Unrelated. |
| [`src/features/marketplace/data/categories.ts`](src/features/marketplace/data/categories.ts) | `useSharedValue` | Unrelated. |
| [`src/types/types.ts`](src/types/types.ts), [`src/data/posts.json`](src/data/posts.json) | legacy mock fields (`shares`) | Unrelated to wired code. |
| [`src/i18n/locales/en.json:50`](src/i18n/locales/en.json) / [`src/i18n/locales/fr.json`](src/i18n/locales/fr.json) | `"share": "Share"` / `"Partager"` | Single string. No "shared" / "share via" / "copy link" strings exist. |

`Share\.share` across `src/`: **No matches**. The RN `Share` API is
unused anywhere in the app.

`from 'expo-sharing'` across `src/`: **No matches**. The package is
not installed (see §5; only `expo-web-browser` and `expo-linking`
exist in [`package.json`](package.json)).

`shares_count` across the whole repo: confirms read-only consumers
above plus the schema migrations and one PROJECT_AUDIT line at
[`PROJECT_AUDIT.md:482`](PROJECT_AUDIT.md) noting *"No share tracking
— `shares_count` on `products` is never written; the share button
only triggers a haptic"* (the audit overstates — current code does
not even fire a haptic).

`share_event` across the whole repo: **No matches**. No
`share_events` table, no analytics scaffold.

### 1.3 What ships today

| Behavior | State |
| --- | --- |
| Share button visible on every feed card | Yes ([`ProductActionRail.tsx:93`](src/features/marketplace/components/ProductActionRail.tsx)) |
| Tap does anything | No (`() => {}`) |
| Share count rendered | Yes — but always `0`, so label always reads `"Share"` |
| Auth gate on share | No (`useRequireAuth` not called) |
| Haptic on share | No |
| `shares_count` writer (DB or app) | None — greenfield |

---

## 2. Products Schema — `shares_count` & Grants

### 2.1 Column definition

Defined in [`supabase/migrations/20260501_initial_marketplace_schema.sql:54`](supabase/migrations/20260501_initial_marketplace_schema.sql):

```sql
shares_count integer not null default 0,
```

Same shape as `likes_count`, `comments_count`, `bookmarks_count` on
the same row (counter quartet). All are `not null default 0`.

### 2.2 Generated TypeScript surface

[`src/types/supabase.ts`](src/types/supabase.ts) renders the column
as `shares_count: number` on `Database['public']['Tables']['products']['Row']`
(line 331), and `shares_count?: number` on `Insert` (line 362) and
`Update` (line 393). It also appears as `shares_count: number` on the
`products_within_radius` RPC `Returns` type (line 933).

The `Update` type still lists `shares_count?: number` because column-
level grants do not surface in generated types — see
[`20260519_tighten_products_update_grants.sql:49-53`](supabase/migrations/20260519_tighten_products_update_grants.sql):

> *"Type regen: NOT REQUIRED. Column-level grants do not surface in
> the generated type. Runtime impact: any UPDATE that includes a
> disallowed column throws Postgres 'permission denied for column X'
> at query time."*

This means the JS client will **type-check** an attempt to UPDATE
`shares_count` from the app, but the request will **fail at the
database** with "permission denied for column shares_count".

### 2.3 D.1.5 column-level grant — current security posture

[`supabase/migrations/20260519_tighten_products_update_grants.sql:31-39`](supabase/migrations/20260519_tighten_products_update_grants.sql)
documents the user-controlled allowlist. `shares_count` is
**deliberately excluded**:

> *"Disallowed (no longer writable by the JS client, only by
> service_role): id, seller_id, created_at, **likes_count,
> comments_count, shares_count, bookmarks_count**"*

The `GRANT UPDATE (...)` block (lines 75–97) lists exactly 21
columns; `shares_count` is not among them.

| Allowed for `authenticated` UPDATE | Disallowed (system-managed) |
| --- | --- |
| `attributes`, `category`, `category_id`, `currency`, `description`, `dimensions`, `latitude`, `location`, `location_updated_at`, `longitude`, `media_type`, `media_url`, `pickup_available`, `price`, `shipping_free`, `shipping_label`, `stock_available`, `stock_label`, `subcategory_id`, `thumbnail_url`, `title` | `id`, `seller_id`, `created_at`, `likes_count`, `comments_count`, `shares_count`, `bookmarks_count` |

**Implication for E.2:** Any path that increments `shares_count`
must run with elevated privileges. The two viable approaches are:

1. A `SECURITY DEFINER` RPC (mirrors B.4's `delete_my_account` RPC
   shape — [`supabase/migrations/20260517_delete_my_account_rpc.sql`](supabase/migrations/20260517_delete_my_account_rpc.sql)).
2. A `SECURITY DEFINER` trigger function on a new `share_events`
   table (mirrors D.2's `handle_comment_change()` and C.2's
   `handle_follow_change()`).

Both bypass the column-level grant by running as the migration owner
(`postgres`). `service_role` is the third option but is server-side
only.

### 2.4 No related table exists

`share_events` — not present. `shares` — not present. The only
artefact related to the concept is the bare counter column. This is
a true greenfield for the data model.

---

## 3. Counter Trigger Reference (cite `handle_comment_change`)

The most recent and most directly applicable counter pattern is
D.2's `handle_comment_change()`, defined at
[`supabase/migrations/20260520_comments_schema.sql:190-215`](supabase/migrations/20260520_comments_schema.sql):

```sql
create or replace function public.handle_comment_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if (TG_OP = 'INSERT') then
    update public.products
      set comments_count = comments_count + 1
      where id = NEW.product_id;
    return NEW;
  elsif (TG_OP = 'DELETE') then
    update public.products
      set comments_count = greatest(comments_count - 1, 0)
      where id = OLD.product_id;
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists comments_change_trigger on public.comments;
create trigger comments_change_trigger
  after insert or delete on public.comments
  for each row execute function public.handle_comment_change();
```

Three load-bearing properties this audit notes for E.2's S2/S3
direction (§8):

| Property | Why it matters for shares |
| --- | --- |
| `security definer` | Bypasses D.1.5's column-level grant on `products.shares_count`. Identical justification to comments. |
| `set search_path = public, pg_catalog` | Defeats the SECURITY DEFINER hijack vector (a malicious user planting a `public.products` shadow object in their own schema). Mandatory for any new SECURITY DEFINER function landing post-B.1.5. |
| `greatest(x - 1, 0)` clamp | Prevents negative counter drift if DELETE ever races ahead of INSERT (e.g., a service_role bulk op that bypasses the trigger). For shares, DELETE is unlikely (sharing is one-shot — see §7) but the clamp costs nothing and matches the idiom. |

The same shape is older in C.2's `handle_follow_change()` at
[`supabase/migrations/20260518_follows_schema_and_counters.sql:158-184`](supabase/migrations/20260518_follows_schema_and_counters.sql)
and the older (pre-B.1.5, lacks the `search_path` lock) shape lives
in `on_like_change` / `on_bookmark_change` at
[`supabase/migrations/20260502_engagement_triggers.sql:17,44`](supabase/migrations/20260502_engagement_triggers.sql).

If E.2 chooses a trigger-based approach for shares, it should mirror
**`handle_comment_change`** specifically (the most recent and
fully-hardened reference).

If E.2 chooses an RPC-only approach (no `share_events` table), the
nearest reference is the SECURITY DEFINER RPC pattern in B.4 at
[`supabase/migrations/20260517_delete_my_account_rpc.sql`](supabase/migrations/20260517_delete_my_account_rpc.sql)
(same `set search_path` hardening, same `security definer` clause).

---

## 4. App Scheme / Deep Link Configuration

### 4.1 Scheme

[`app.json:8`](app.json):

```json
"scheme": "client"
```

`app.config.ts` does not exist — only the static `app.json`.

The scheme is the project's **default placeholder** (Expo template
slug `"client"` — see [`app.json:4`](app.json), `"slug": "client"`).
The display `name` is `"Pictok"` ([`app.json:3`](app.json)) and the
bundle / package IDs at [`app.json:12`](app.json) and
[`app.json:38`](app.json) use `com.pictok.client`. The `client`
scheme value is functional but generic — a deep link constructed via
`Linking.createURL('product/123')` will resolve to:

```
client://product/123        (custom scheme, dev + production)
exp://<host>/--/product/123 (Expo Go / dev client when applicable)
```

This is an **open question** for the product team — see §11 — but
not blocking for E.2: a working URL only needs to round-trip back
into the app, and `client://product/...` does so.

### 4.2 Universal links / app links

iOS `associatedDomains`: **Not configured.** No `associatedDomains`
key exists under `ios` in [`app.json:10-25`](app.json).

Android `intentFilters`: **Not configured.** No `intentFilters` key
exists under `android` in [`app.json:26-39`](app.json). The Android
block declares only camera/audio permissions and the package name.

There is no public web app at any known host (`web.output: "static"`
at [`app.json:40-43`](app.json) configures the web build target, but
the app is shipped as native; no URL is documented for a hosted
build).

**Implication for E.2:** Universal/web links are out of scope — the
shared URL must use the custom scheme (`client://...`). Recipients
without the app installed will get an "open in app" failure. This is
acceptable for v1 and matches the audit's recommended scope.

### 4.3 Existing `Linking` usage

Single call site: [`src/app/(protected)/seller/[id]/index.tsx:11`](src/app/(protected)/seller/[id]/index.tsx)
imports `* as Linking from 'expo-linking'` and uses
`Linking.openURL(...)` three times (lines 168, 180, 192) for
website / `tel:` / `mailto:` outbound links from the seller card.
**No use of `Linking.createURL` anywhere in the app.**

| Call | Purpose |
| --- | --- |
| `Linking.openURL(seller.website)` (l.168) | Open seller website. |
| `Linking.openURL(`tel:${seller.phonePublic}`)` (l.180) | Place phone call. |
| `Linking.openURL(`mailto:${seller.emailPublic}`)` (l.192) | Open mail composer. |

No URL handler / parser exists. There is no listener wired with
`Linking.addEventListener('url', ...)`, no `useURL()` hook from
`expo-linking`, and no entry in the Expo Router that responds to a
`/product/:id` deep-link path (see §4.4).

### 4.4 Product detail surface — sheet, not a route

The product detail UI is a **bottom sheet driven by a Zustand
store**, not a route file. From
[`src/stores/useProductSheetStore.ts`](src/stores/useProductSheetStore.ts):

```ts
type ProductSheetStore = {
  productId: string | null;
  open: (productId: string) => void;
  close: () => void;
};

export const useProductSheetStore = create<ProductSheetStore>((set) => ({
  productId: null,
  open: (productId) => set({ productId }),
  close: () => set({ productId: null }),
}));
```

Five call sites consume it — confirmed by grep:

- [`src/features/marketplace/components/ProductActionRail.tsx:40`](src/features/marketplace/components/ProductActionRail.tsx) (Buy / Contact tap)
- [`src/app/(protected)/(tabs)/friends.tsx`](src/app/(protected)/(tabs)/friends.tsx)
- [`src/components/categories/NearbyProductsRail.tsx`](src/components/categories/NearbyProductsRail.tsx)
- [`src/features/marketplace/components/ProductDetailSheet.tsx`](src/features/marketplace/components/ProductDetailSheet.tsx)
- [`src/features/marketplace/components/SellerProductCard.tsx`](src/features/marketplace/components/SellerProductCard.tsx)

The route directory tree confirms there is **no** `product/[id]`
route file — the only nested routes under `(protected)` are:

```
src/app/(protected)/
  (tabs)/        index.tsx, friends.tsx, inbox.tsx, newPost.tsx, profile.tsx
  account/
  conversation/
  edit-seller-profile.tsx
  seller/[id]/   index.tsx
```

A deep link of `client://product/123` therefore has **no destination
today**. The recipient would be dropped at Expo Router's default
fallback (likely the home tab) with no product opened. See §10 for
the recommended routing strategy.

### 4.5 `expo-linking` version

[`package.json:41`](package.json):

```json
"expo-linking": "~8.0.12",
```

Installed and current. `expo-sharing` is **not** installed (the only
related Expo package is `expo-web-browser ~15.0.11` at
[`package.json:51`](package.json), which serves a different purpose
— in-app browser tabs, not OS-level share sheets).

The audit confirms Phase G's note: `expo-linking` covers URL
construction; the React Native built-in `Share` API (no extra
package) covers the share-sheet invocation.

---

## 5. RN Share API Behavior

The React Native `Share` module ships as part of React Native core
(no extra dependency). Signature and behavior — not currently used
in this codebase, so this section is primary documentation for E.2.

### 5.1 Signature

```ts
import { Share } from 'react-native';

Share.share(
  content: { message?: string; url?: string; title?: string },
  options?: { dialogTitle?: string; subject?: string; tintColor?: string }
): Promise<ShareAction>;

type ShareAction =
  | { action: 'sharedAction'; activityType?: string | null }
  | { action: 'dismissedAction' };
```

### 5.2 Platform divergence

| Behavior | iOS | Android |
| --- | --- | --- |
| `message` and `url` as separate fields | Both displayed; the share sheet shows the URL as a link preview and the message as a caption. | `url` is **silently appended** to `message`. Some apps will only forward whichever is non-empty. |
| `title` field | Ignored (iOS share sheet uses its own title). | Used as the chooser dialog title. |
| `subject` option | Ignored in `Share.share` (iOS uses `activityType`). | Used when sharing via email apps. |
| Return value `dismissedAction` | Reliable — returned when user taps "Cancel". | Only reliable when share sheet is dismissed via back button; some OEM share sheets return `sharedAction` with no `activityType` regardless. |
| Return value `activityType` | Returned (e.g., `com.apple.UIKit.activity.Message`). | Almost always `null` or absent on Android. |

**Cross-platform recommendation for E.2:** Construct the message
*including* the URL as a single string, AND pass `url` separately:

```ts
const url = Linking.createURL(`product/${productId}`);
const message = `${title} — ${formattedPrice}\n${url}`;
await Share.share({ message, url, title });
```

iOS will show both nicely; Android will produce slight URL
duplication in the appended string but never fail to include the
link. The cost (one duplicated URL on Android) is preferable to the
alternative (link missing on iOS-only configurations).

### 5.3 Errors

`Share.share()` rejects with an `Error` if the share sheet cannot be
shown (e.g., iPad simulator without a `Share` extension installed,
or invalid arguments). E.2 should `try`/`catch` and fall back to
copying the URL to clipboard or showing a toast — this is also
relevant to the open question in §11 about iPad simulator behavior.

---

## 6. Tracking Strategy Recommendation (T1 / T2 / T3)

| ID | Strategy | When does the counter increment? | Pros | Cons |
| --- | --- | --- | --- | --- |
| **T1** | **Track on intent (every tap)** | Immediately on tap, before `Share.share()` (or in parallel). | Matches Twitter / Instagram convention. Counter is platform-symmetric (Android's unreliable return value doesn't lose signal). Optimistic UI is trivial. Simplest. | Counts taps the user dismissed without sharing. In practice indistinguishable from "interest" — fine for a vanity counter. |
| T2 | Track on `sharedAction` only | After `Share.share()` resolves with `action: 'sharedAction'`. | More accurate — counts actual completions. | iOS reliably returns the action; Android occasionally doesn't (returns `sharedAction` regardless, or doesn't return at all on some OEM share sheets). Loses signal on Android. Counter feels inert when users tap-then-dismiss. |
| T3 | Track both | Two separate events: `share_intent` and `share_completed`. | Useful for analytics funnels. | Heavier — two round-trips per share. Requires an `events` table. Out of scope for v1. |

### Recommendation: **T1 — track on intent.**

Reasons:

1. Matches industry convention (Twitter, Instagram, TikTok all
   count taps, not completions).
2. Symmetric across iOS and Android — no platform-specific
   conditional in the optimistic-update path.
3. Minimum-scope: a single RPC call alongside `Share.share()`, no
   awaiting the share-sheet resolution.
4. The "abuse" surface (a user tapping share repeatedly to inflate
   their own counter) is theoretical and unincentivized — see §7.

E.2 should fire `Share.share(...)` and `increment_share_count(...)`
in parallel, treating the RPC as fire-and-forget for UX latency
(the share sheet should appear instantly; the counter update can
race the user's choice).

---

## 7. Deduplication Decision

**v1 design choice: NO deduplication. Each tap = +1.**

### Rationale

| Question | Answer |
| --- | --- |
| Should "same user shares same product N times" count N or 1? | N. |
| Should self-share count? | Yes — promotion is a legitimate use. |
| Inflation risk? | Theoretical. The counter is a public vanity metric (visible on the action rail), not a leaderboard or monetized signal. There is no user incentive to inflate the share count of their own listing beyond the natural behavior of sharing it once. |
| Server-side rate limit? | Not for v1. If abuse emerges, the simplest mitigation is a per-user-per-product cooldown (e.g., 1 share per minute) implemented in the RPC body. |

### What this means for the schema (§8)

- **S1 (RPC-only):** No state needed; the RPC simply increments.
- **S2/S3 (`share_events` table):** Must NOT enforce a unique
  constraint on `(product_id, sharer_id)` — would prevent re-shares.
  The table should be append-only INSERT-per-tap.

### What this means for the JS layer (§9)

- No client-side debouncing beyond standard tap-debounce (a single
  `Pressable` already prevents double-fires within a frame).
- No per-product local cache of "I already shared this" — the user
  can share again, and the counter goes up again.

---

## 8. Schema Directions

Three directions, ordered from minimum scope to maximum analytics
surface. All three address the constraint from §2 that
`shares_count` cannot be UPDATEd by `authenticated` directly.

### S1 — RPC-only (recommended for v1)

A single SECURITY DEFINER RPC, no new table.

```sql
create or replace function public.increment_share_count(
  p_product_id uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  update public.products
    set shares_count = shares_count + 1
    where id = p_product_id;
end;
$$;

revoke all on function public.increment_share_count(uuid) from public;
grant execute on function public.increment_share_count(uuid) to authenticated;
```

**Pros:**
- Smallest migration. No new table, no new RLS policies, no realtime
  publication wiring.
- Mirrors B.4's RPC pattern (`delete_my_account` at
  [`supabase/migrations/20260517_delete_my_account_rpc.sql`](supabase/migrations/20260517_delete_my_account_rpc.sql))
  for shape and hardening.
- The JS client calls
  `supabase.rpc('increment_share_count', { p_product_id })` —
  symmetrical with one round-trip per share.
- Matches the v1 scope: a working share button with a working
  counter, no analytics overhead.

**Cons:**
- No analytics. No "who shared what when" history.
- No way to retroactively reconstruct the counter if it drifts.
- Future "shared by X" or "trending shares" features need a schema
  change later.
- Self-promotion abuse cannot be rate-limited without per-caller
  state (would need a side table anyway).

### S2 — `share_events` table + AFTER INSERT trigger

A `share_events` (`id`, `product_id`, `sharer_id`, `created_at`)
table. RLS allows authenticated users to INSERT with
`sharer_id = (select id from sellers where user_id = auth.uid())`.
A SECURITY DEFINER trigger function `handle_share_change()` mirrors
`handle_comment_change()` exactly (INSERT branch only — no DELETE
branch needed if shares are immutable, see below).

**Pros:**
- Analytics surface: "shares per day", "top sharers", "shared by
  this user", "trending shares".
- Symmetry with `comments` and `follows` (each engagement type has
  its own event table).
- Future "shared by X" / "via X" attribution — store referrer event.
- Trigger pattern is well-established (D.2 / C.2).

**Cons:**
- Larger migration (table + indexes + RLS policies + trigger +
  grants) — roughly the size of [20260520_comments_schema.sql](supabase/migrations/20260520_comments_schema.sql).
- Storage cost: every share = one row, no compaction.
- Counter accuracy still depends on trigger correctness — the
  trigger is the only writer of `shares_count`.
- DELETE semantics: should users be able to "unshare"? If yes, need
  a DELETE branch (and an index on `(product_id, sharer_id)` for
  the lookup). If no, the table is append-only and the trigger has
  one branch — but RLS must forbid DELETE.

### S3 — `share_events` + RPC-as-only-writer

Same as S2 but no JS-direct INSERT path. RLS on `share_events`
denies INSERT for `authenticated`; only a SECURITY DEFINER RPC
`record_share(p_product_id uuid)` can write rows. The RPC INSERTs
into `share_events` and the trigger fires the counter update.

**Pros:**
- Tightest control: the RPC is the only ingress; can enforce per-user
  rate limits, dedup, etc., in one place.
- Defense-in-depth — RLS denies the side table even if a future
  policy change widens auth.

**Cons:**
- Heaviest migration of the three.
- Two layers of indirection (RPC → trigger → counter) for one
  conceptual op.
- Over-engineered for v1: no rate-limit requirement exists yet
  (§7).

### Comparison

| Dimension | S1 | S2 | S3 |
| --- | --- | --- | --- |
| Migration size | ~30 lines | ~200 lines | ~250 lines |
| New tables | 0 | 1 | 1 |
| Analytics | None | Full | Full |
| RPC required | Yes | No | Yes |
| Trigger required | No | Yes | Yes |
| Post-launch flexibility | Schema change to add events later | Already done | Already done |
| Risk surface | Smallest — one function | Medium — RLS + trigger + grants | Largest — RLS + RPC + trigger + grants |

### Recommendation: **S1**

- Matches the v1 scope (a working button with a working counter, no
  analytics requirement).
- Lowest risk (one new SECURITY DEFINER function, well-precedented
  by B.4).
- Future-extensible: if analytics become needed, a follow-on
  migration adds `share_events` + trigger AND keeps S1's RPC as a
  thin wrapper that INSERTs into `share_events` (which then
  trigger-updates the counter). The migration path is additive.

E.2 should ship S1. Document a TODO in the migration header pointing
to S2 as the future analytics extension.

---

## 9. UI Integration Directions

Three options for the JS / React Native side. All assume S1 schema
(an `increment_share_count` RPC).

### U1 — Action rail wires to RN `Share` + RPC (recommended for v1)

Replace the no-op `onPressShare` in
[`ProductActionRail.tsx:46`](src/features/marketplace/components/ProductActionRail.tsx)
with:

```tsx
const incrementShares = useIncrementShareCount(product.id);

const onPressShare = async (): Promise<void> => {
  if (!requireAuth()) return;
  void lightHaptic();

  const url = Linking.createURL(`product/${product.id}`);
  const title = getLocalized(product.title);
  const price = formatCurrency(product.price, product.currency);
  const message = t('marketplace.shareMessage', { title, price, url });

  // Fire-and-forget — don't block share sheet on counter latency.
  incrementShares.mutate();

  try {
    await Share.share({ message, url, title });
  } catch {
    // Swallow — Share rejects on iPad sim or invalid args; UX-wise
    // the haptic + counter update already happened.
  }
};
```

Counter UX via TanStack Query: an `useIncrementShareCount` hook
following the `useToggleLike` shape at
[`src/features/marketplace/hooks/useToggleLike.ts`](src/features/marketplace/hooks/useToggleLike.ts) —
optimistic `setQueryData` to bump the local product's
`engagement.shares` by 1, RPC call in `mutationFn`, rollback on
error, invalidate the products list on settled.

**Pros:**
- Single tap, single sheet. Native and familiar.
- Reuses the proven optimistic-mutation idiom.
- Auth-gated and haptic — matches the like / comment buttons in the
  same component.
- No new UI code beyond the hook.

**Cons:**
- Uses the OS share sheet — design has no project-styling room.
- The system sheet is platform-default; can look slightly different
  per device.

### U2 — Custom in-app share sheet (Copy link / Share via / Send to friend)

Open a project-styled `BottomSheet` with options:

1. "Share to..." → invokes `Share.share` (delegates to OS sheet).
2. "Copy link" → `Clipboard.setStringAsync(url)` + toast.
3. "Send to friend" → opens a DM / conversation picker
   (uses messaging from [`20260509_messaging.sql`](supabase/migrations/20260509_messaging.sql)).

**Pros:**
- Higher polish — branded interaction.
- Adds "Send to friend" funnel that keeps the share inside the app.
- Copy-to-clipboard fallback for cases where OS sheet is unavailable
  (iPad simulator).

**Cons:**
- Significant new UI: bottom sheet, item rows, theming, copy
  toasts, conversation picker.
- "Send to friend" requires picking from the existing
  conversations / followers list — a non-trivial new view.
- Higher tap count for the most common path (Share-to-X).
- Out of scope for v1 — better fit for a polish phase.

### U3 — Action rail share with no link (text-only message)

Same wiring as U1 but the message has no URL — only title + price.
Useful as a stop-gap if the routing decision in §10 can't be made
in the E.2 timeframe.

```tsx
const message = t('marketplace.shareMessageNoLink', { title, price });
await Share.share({ message, title }); // no `url`
```

Counter still increments per tap (T1 still applies).

**Pros:**
- No deep-link routing work needed — E.2 ships independent of §10's
  decision.
- Avoids confusing UX of "shared link goes nowhere" if the route
  destination isn't ready.

**Cons:**
- Defeats much of the point of sharing. Recipients can't bounce back
  into the app.
- Once a deep-link route is added later, every previously-shared
  message is permanently link-less.

### Comparison

| Dimension | U1 | U2 | U3 |
| --- | --- | --- | --- |
| New components | 0 (modify rail handler) | ~3 (sheet, rows, toast) | 0 |
| Includes URL in message | Yes | Yes | No |
| OS share sheet | Yes | Yes (one option) | Yes |
| Implementation effort | ~1 hour | ~1 day | ~30 min |
| Polish | Stock | High | Stock |
| Depends on §10 routing decision | Yes (a or b) | Yes (a or b) | No (any) |

### Recommendation: **U1**

- Fits v1 scope.
- Reuses an established mutation pattern (`useToggleLike` /
  `useToggleBookmark`).
- The OS share sheet is the platform-correct UI — users expect it.
- The polish surface (custom sheet, "Send to friend") is a clear
  follow-on extension, not a blocker.

E.2 should also add the missing `useRequireAuth` gate and
`lightHaptic` call — the share button is the only action-rail
button without them.

---

## 10. Deep Link Routing Decision

The constraint from §4.4: there is no `product/[id]` route. The
product detail surface is a Zustand-driven sheet
([`useProductSheetStore`](src/stores/useProductSheetStore.ts))
opened from inside the feed. A shared `client://product/<id>` link
has no destination today.

### Option (a) — Add `(protected)/product/[id].tsx` that opens the sheet

A thin route file under the existing `(protected)` group that
mounts, calls `useProductSheetStore.getState().open(id)`, and
renders a placeholder splash. The recipient is gated by the existing
auth check on the `(protected)` layout — unauthenticated users hit
the auth wall first, which is acceptable behavior for a v1
marketplace app.

**Pros:**
- Smallest change. One route file, one effect, one splash placeholder.
- Reuses the existing sheet — no parallel detail UI.
- Auth-gated for free.
- Works with Expo Router's existing `typedRoutes` config
  ([`app.json:88`](app.json)) — types regenerate automatically.

**Cons:**
- Recipient must be signed in. A non-user clicking a shared link
  hits the auth wall instead of seeing the listing — slight friction
  for marketplace virality.
- The "route → open sheet" pattern is a one-off; if more routes
  start doing this, an abstraction will be wanted.

### Option (b) — Public-facing top-level route outside `(protected)`

Place the route at `src/app/product/[id].tsx`, outside the
`(protected)` group. Renders a minimal product preview (title,
photo, price) plus a sign-up CTA. After auth, the user lands inside
the app at the product detail.

**Pros:**
- Full marketplace virality — non-users can preview the product
  before signing up.
- Better acquisition funnel for shares.

**Cons:**
- Significantly more work — a public-mode product fetch (no auth
  context), a new minimal-preview UI, sign-up handoff that
  remembers the destination.
- Requires the products fetch to allow `anon` reads (current RLS
  policy posture for `products` would need confirmation; this
  audit did not deep-dive it for E.2's scope).
- Touches auth flow, which is risky.

### Option (c) — Defer routing, ship U3 (text-only share)

The button works, the counter increments, the message has no URL.
A separate phase ships routing.

**Pros:**
- Unblocks E.2 immediately.
- Decouples schema work from routing work.

**Cons:**
- Most of the value of sharing is lost.
- Sets a bad precedent (shipping a link-less share).
- Migration friction — every text-only share is a permanent
  miss.

### Recommendation: **(a)** — add `(protected)/product/[id].tsx`

- Lowest cost above zero. Single route file, single effect.
- Acceptable v1 friction (recipients must sign in to view, which
  doubles as a user-acquisition gate).
- Keeps the share message useful (URL works → recipient lands on
  the actual listing).
- Defers the (b) decision — public-preview routes — until product
  validates that share-driven sign-ups are a real funnel worth
  optimizing.

E.2 should bundle this thin route file as part of the same change.
The migration is small enough that splitting it into a separate
phase adds more coordination overhead than it saves.

If there is concern about route bloat under `(protected)`, the file
is genuinely small (~30 lines: imports, mount effect calling
`open()`, splash) and the precedent is benign.

---

## 11. Open Questions

For product / design to answer before or during E.2:

| # | Question | Default if unanswered |
| --- | --- | --- |
| 1 | **Localized share message** — should the message respect the **viewer's** locale (FR/EN at tap time) or the **listing's authored** locale? | Viewer's locale via `i18next` `t('marketplace.shareMessage', ...)`. The recipient may be in a different locale anyway; viewer-locale is what the sender sees in the share preview, which is the only locale they care about. |
| 2 | **What goes in the message?** Title only, title + price, title + price + photo URL, or full description? | Title + price + URL. Price is high-signal; the photo URL would render as a broken-looking second link in most apps; the description is too long. |
| 3 | **Currency formatting in the message** — locale-formatted (`12,99 €`) or raw (`12.99 EUR`)? | Locale-formatted via the existing `formatCount` / currency helper at [`src/lib/format.ts`](src/lib/format.ts). |
| 4 | **iPad simulator / Share-unavailable fallback** — copy URL to clipboard + toast, or silent failure? | Silent failure for v1 (the haptic and counter already fired). Clipboard fallback is a nice polish but requires a toast component. |
| 5 | **Self-share** — does sharing your own listing count toward `shares_count`? | Yes (per §7). Sellers promoting their own listings is legitimate. |
| 6 | **Share-back attribution** — when a user opens a shared link, do we track the source share for funnel analytics? | No for v1 (requires S2/S3 schema + a referrer column on `share_events`). Punt to a phase that decides on analytics surface. |
| 7 | **Scheme rename** — the Expo scheme is `client` (template default). Should it be rebranded to `pictok` to match the bundle ID `com.pictok.client`? | Rename to `pictok` is a one-line change in [`app.json:8`](app.json) but invalidates all previously-shared links (none exist today, so the cost is zero — a perfect time to do it). |
| 8 | **Universal links / web app** — is there a planned hosted web destination (e.g., `pictok.com/product/<id>`) that would unlock OS-level smart-banner behavior (open-in-app)? | Out of scope for v1 (no domain configured per §4.2). Decide later. |
| 9 | **Auth-gate behavior** — should the share button fail closed for guests (current `useRequireAuth` pattern) or be the one button that works without auth? | Match the rest of the action rail: gate it. Guests can browse but can't share. Marketplace UX is consistent that way. |
| 10 | **Counter staleness window** — after a share, how soon does the counter on other clients reflect the new value? | Lazy: the next `marketplace.products.list` invalidation. Realtime push for `shares_count` would require subscribing to product UPDATEs, which is heavier and out of scope for v1. |

---

## Summary — Recommendations Table

| Decision | Recommendation | Section |
| --- | --- | --- |
| Tracking strategy | **T1** — track on intent (every tap) | §6 |
| Deduplication | **None** — each tap = +1 | §7 |
| Schema | **S1** — `increment_share_count` RPC, no new table | §8 |
| UI integration | **U1** — action rail wires to RN `Share` + RPC, optimistic counter | §9 |
| Routing | **(a)** — add `(protected)/product/[id].tsx` thin route | §10 |

E.2 ships:

1. One migration: `increment_share_count` RPC (SECURITY DEFINER,
   pinned `search_path`, GRANT EXECUTE to authenticated). Mirrors
   B.4's RPC shape.
2. One hook: `useIncrementShareCount(productId)` — TanStack
   mutation, optimistic `engagement.shares` bump, rollback on error,
   list invalidation on settled. Mirrors `useToggleLike`.
3. Edit to [`ProductActionRail.tsx`](src/features/marketplace/components/ProductActionRail.tsx):
   wire `onPressShare` to `useRequireAuth` + `lightHaptic` +
   `Share.share` + the new hook.
4. New thin route file `src/app/(protected)/product/[id].tsx` that
   opens the existing product sheet on mount.
5. Two i18n strings (`marketplace.shareMessage` in EN + FR with
   `{{title}}`, `{{price}}`, `{{url}}` interpolation).

Open questions in §11 should be resolved with the product owner
before the strings land — particularly questions 1, 2, and 7.
