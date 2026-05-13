# Following / Followers Audit — Step C.1

Read-only reconnaissance of follow-adjacent code, the `sellers` table (looking for follower/following counters), the closest existing precedent (`likes`), the seller profile screen (where a `FollowButton` will integrate), the marketplace feed (where a future "Following" feed surface might live), and the inbox / push-notification infrastructure (where a "X started following you" event would plug in). No source files were modified. C.2 reads this audit and ships the schema + trigger + RLS migration without re-discovering anything.

> **Cross-references.** Schema columns and `sellers` RLS / grant facts are cited from [PROFILE_AUDIT.md](PROFILE_AUDIT.md) §2 / §3 and [supabase/migrations/20260515_tighten_sellers_update_grants.sql](supabase/migrations/20260515_tighten_sellers_update_grants.sql) rather than re-derived. The likes-table reference pattern is taken from [supabase/migrations/20260501_initial_marketplace_schema.sql](supabase/migrations/20260501_initial_marketplace_schema.sql) and [supabase/migrations/20260502_engagement_triggers.sql](supabase/migrations/20260502_engagement_triggers.sql).

---

## 1. Existing Follow Code

**Greenfield.** No follower / following functionality exists anywhere in the codebase or migrations.

| Search | Result |
| --- | --- |
| `rg -i 'follow' src/` | One hit at [src/app/(protected)/(tabs)/newPost.tsx:211](src/app/(protected)/(tabs)/newPost.tsx#L211) — a comment that says `"see G.8 changelog follow-ups"`. Unrelated to social-graph follow. |
| `rg -i 'follower' src/` | Zero matches. |
| `rg -i 'following' src/` | Zero matches. |
| `rg -i 'follow' supabase/` | Three hits — all the literal English word "follow(s)" in unrelated migration comments ([20260516_create_avatars_bucket.sql:12](supabase/migrations/20260516_create_avatars_bucket.sql#L12), [20260517_delete_my_account_rpc.sql:32](supabase/migrations/20260517_delete_my_account_rpc.sql#L32), [config.toml:178](supabase/config.toml#L178)). No `follows` / `followers` / `following` table. |
| Tables in `public.*` | `sellers`, `products`, `likes`, `bookmarks`, `conversations`, `messages`, `orders`, `push_tokens` — verified by grepping `create table public\.` across `supabase/migrations/`. No `follows`, `followers`, `subscriptions`, `social_graph`, or similar. |

C.2 is a true greenfield migration — there is no prior partial work to reconcile, no stub to delete, and no half-wired service file.

---

## 2. Sellers Schema — Follow-Related Columns

**No follow-related columns exist on `sellers`.** Re-confirms [PROFILE_AUDIT.md §2](PROFILE_AUDIT.md) — the table has identity, profile, geo, marketplace stats (`rating`, `sales_count`), and Stripe columns. Verified against the generated types at [src/types/supabase.ts:367-437](src/types/supabase.ts#L367):

```
Row keys on `sellers`:
  id, user_id, name, avatar_url, verified, is_pro,
  rating, sales_count,
  bio, website, phone_public, email_public,
  latitude, longitude, location_text, location_updated_at, location_point,
  stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled,
  created_at
```

No `followers_count`, no `following_count`, no `subscriber_count`, no `follow_*` of any kind. Original migration [20260501_initial_marketplace_schema.sql:21-30](supabase/migrations/20260501_initial_marketplace_schema.sql#L21) and follow-on migrations (`20260503` sell setup, `20260508` seller_contact, `20260511` seller_stripe, `20260513` geo_columns) introduce no social-graph columns.

**Critical constraint for C.2.** B.1.5 ([20260515_tighten_sellers_update_grants.sql](supabase/migrations/20260515_tighten_sellers_update_grants.sql#L53)) revoked the table-wide UPDATE grant on `sellers` and re-granted column-level UPDATE only on the user-controlled allowlist:

```
name, avatar_url, bio, website, phone_public, email_public,
latitude, longitude, location_text, location_updated_at
```

Counter columns we add in C.2 (`followers_count`, `following_count`) **must NOT** be added to this allowlist. They must be maintained exclusively by a `SECURITY DEFINER` trigger that bypasses grants — the JS client must never `UPDATE` them directly. This mirrors how `products.likes_count` / `products.bookmarks_count` work today (§3 below).

---

## 3. Likes Pattern Reference

The `likes` table is the **closest existing precedent** for the `follows` table. C.2 should mirror it conventionally unless there is a specific reason to diverge.

### 3.1 Schema

[supabase/migrations/20260501_initial_marketplace_schema.sql:64-70](supabase/migrations/20260501_initial_marketplace_schema.sql#L64):

```sql
create table public.likes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index likes_product_idx on public.likes(product_id);
```

| Property | Value | Notes for `follows` design |
| --- | --- | --- |
| PK shape | Composite `(user_id, product_id)` | Natural anti-duplicate (re-like is an idempotent unique-violation, swallowed client-side; see §3.4). |
| FK targets | `auth.users(id)` and `products(id)` | Mixed convention — likes references `auth.users` directly, **not** `sellers`. The product side references `products` (not `sellers`). C.2's choice between `sellers.id` vs `auth.users.id` for follows has precedent in both directions in this codebase. See §9. |
| ON DELETE | CASCADE on both FKs | Account deletion via `delete_my_account` RPC ([20260517](supabase/migrations/20260517_delete_my_account_rpc.sql#L92)) cascades through. |
| Single-direction index | `likes_product_idx ON likes(product_id)` | The reverse direction (`user_id`) is already covered by the composite PK's leading column, so no second index is needed. For follows, the equivalent single extra index would be on `following_id` (the "who follows me" lookup). |
| RLS enabled | Yes | `alter table public.likes enable row level security;` |

### 3.2 RLS policies

[supabase/migrations/20260501_initial_marketplace_schema.sql:94-96](supabase/migrations/20260501_initial_marketplace_schema.sql#L94):

```sql
create policy "likes select own" on public.likes for select using (auth.uid() = user_id);
create policy "likes insert own" on public.likes for insert with check (auth.uid() = user_id);
create policy "likes delete own" on public.likes for delete using (auth.uid() = user_id);
```

> **Likes are private.** A user can only see their own likes. This is **not** the right shape for follows: a public follower count on a seller profile (or a public "followers" list) requires SELECT to be visible to anyone, not just the follower. C.2 should diverge here — see §9 (recommend public SELECT, owner-scoped INSERT/DELETE).

There is no UPDATE policy (the row is immutable — re-liking is an INSERT, un-liking is a DELETE).

### 3.3 Counter trigger

[supabase/migrations/20260502_engagement_triggers.sql:17-41](supabase/migrations/20260502_engagement_triggers.sql#L17):

```sql
create or replace function public.on_like_change()
returns trigger
language plpgsql
security definer       -- <-- bypasses the column grant on products
as $$
begin
  if (TG_OP = 'INSERT') then
    update public.products
    set likes_count = likes_count + 1
    where id = NEW.product_id;
    return NEW;
  elsif (TG_OP = 'DELETE') then
    update public.products
    set likes_count = greatest(likes_count - 1, 0)   -- <-- clamp at zero
    where id = OLD.product_id;
    return OLD;
  end if;
  return null;
end;
$$;

create trigger likes_count_sync
after insert or delete on public.likes
for each row execute function public.on_like_change();
```

**Conventions to mirror in `on_follow_change()`:**

1. `security definer` — bypasses the column grant tightening from B.1.5 so `followers_count` / `following_count` can be updated even though they will not be in the user-grant allowlist.
2. `greatest(x - 1, 0)` clamp — guards against a delete racing ahead of an insert.
3. Single trigger handling both `INSERT` and `DELETE` via `TG_OP`.
4. `after insert or delete` — only after the row mutation commits.
5. No UPDATE branch (the join row is immutable; toggling = INSERT/DELETE).

### 3.4 Client write path

Service-layer at [src/features/marketplace/services/products.ts:343-364](src/features/marketplace/services/products.ts#L343):

```ts
const PG_UNIQUE_VIOLATION = '23505';

export async function likeProduct(productId: string): Promise<void> {
  const userId = await getCurrentUserIdOrThrow();
  const { error } = await supabase
    .from('likes')
    .insert({ user_id: userId, product_id: productId });
  if (error && error.code !== PG_UNIQUE_VIOLATION) throw error;
}

export async function unlikeProduct(productId: string): Promise<void> {
  const userId = await getCurrentUserIdOrThrow();
  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId);
  if (error) throw error;
}
```

> **Idempotent re-like / re-bookmark.** The PK guarantees uniqueness; a duplicate INSERT raises Postgres unique-violation `23505`, which the client swallows so the optimistic UI toggle doesn't desync. C.2's `followSeller` / `unfollowSeller` should adopt the same `23505`-swallow behaviour for `followSeller`.

### 3.5 Engagement read path

[src/features/marketplace/services/products.ts:389-407](src/features/marketplace/services/products.ts#L389) — `listUserEngagement()` returns a single `{ likedIds: Set<string>; bookmarkedIds: Set<string> }` keyed by the current user. A natural extension is `followingIds: Set<string>` on the same query, so a single round-trip primes both like-state and follow-state for the home feed and seller cards. Cache key `USER_ENGAGEMENT_QUERY_KEY = ['marketplace', 'engagement']` ([useUserEngagement.ts:7](src/features/marketplace/hooks/useUserEngagement.ts#L7)).

---

## 4. Notifications / Inbox Infrastructure

### 4.1 Inbox tab — DMs only

[src/app/(protected)/(tabs)/inbox.tsx](src/app/(protected)/(tabs)/inbox.tsx) renders a single-column FlatList of DM threads via `useConversations()`. The row component (`ConversationRow`, [inbox.tsx:122-183](src/app/(protected)/(tabs)/inbox.tsx#L122)) shows: product thumbnail, other-party name + verified/PRO badges, last-message preview, and `timeAgo`. There is no system-event row, no badge row, no notifications inbox, no segmented control between "Messages" and "Activity".

**Verdict: the inbox tab is purely DM-driven.** No "X started following you" event has anywhere natural to land here without restructuring the screen.

### 4.2 No `notifications` table

Verified by grepping `create table public\.` across `supabase/migrations/`. The full table inventory is:

```
sellers, products, likes, bookmarks, orders,
conversations, messages, push_tokens
```

Plus PostGIS's `spatial_ref_sys` (managed by the extension). **There is no `notifications` table, no `events` table, no `activity` table, no `inbox` table.**

### 4.3 Push notification path (out-of-band)

The codebase ships push notifications via Expo Push, not via a DB-side notifications log. Components:

| Layer | File | Purpose |
| --- | --- | --- |
| `push_tokens` table | [supabase/migrations/20260512_push_tokens.sql:1-10](supabase/migrations/20260512_push_tokens.sql#L1) | Stores `(user_id, expo_push_token, platform)` per device. Owner-scoped RLS for SELECT / INSERT / UPDATE / DELETE. |
| Token registration | [src/services/pushNotifications.ts:15-66](src/services/pushNotifications.ts#L15) | `registerForPushNotificationsAsync()` + `savePushToken()` — upsert keyed on `expo_push_token`. |
| Send dispatch | [src/services/pushNotifications.ts:68-82](src/services/pushNotifications.ts#L68) | `sendPushNotification()` invokes Edge Function `send-push-notification` with `{ user_id, title, body, data }`. |
| Edge Function | [supabase/functions/send-push-notification/index.ts](supabase/functions/send-push-notification/index.ts) | Looks up tokens for `user_id`, posts to Expo's push endpoint. Stateless — does not log the event anywhere. |

**Implication for follow notifications.** A "X started following you" push notification can ride this infrastructure cheaply (call `sendPushNotification({ recipientUserId: followingUserId, title, body })` from `useToggleFollow.onSuccess` or — better — from a `SECURITY DEFINER` trigger on `follows` insert that calls a server-side helper). The notification is **fire-and-forget**; nothing in the app today persists it for an in-app activity feed.

### 4.4 Realtime subscription pattern

The messaging service uses Supabase realtime via channel subscriptions on `postgres_changes`:

```ts
// src/features/marketplace/services/messaging.ts:233-249
export function subscribeToConversations(onChange: () => void) {
  const channel = supabase
    .channel('conversations:user')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => onChange())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => onChange())
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
```

`conversations` and `messages` are added to the realtime publication in [20260509_messaging.sql:133-134](supabase/migrations/20260509_messaging.sql#L133). For C.2, **adding `follows` to the realtime publication is optional** — follow-counts on a profile do not need to update sub-second; a stale-while-revalidate React Query refetch is acceptable. Defer to C.3+.

### 4.5 Verdict for the audit brief

> "If yes, document it so a future 'X started following you' notification can plug in. If no, surface as out-of-scope follow-up."

**Push** notifications can plug into the existing `sendPushNotification()` helper for free.
**In-app activity-feed** notifications (a persistent inbox of "X followed you" events) require a new `notifications` table + UI surface in the inbox tab — **out-of-scope for Phase C.** Surface as a follow-up if/when the product needs a notifications inbox; until then, push is sufficient.

---

## 5. Seller Profile Screen

### 5.1 Route + structure

[src/app/(protected)/seller/[id].tsx](src/app/(protected)/seller/[id].tsx) — full-screen stack route, public read view of any seller. The layout is a `<FlatList>` of the seller's products with a custom `ListHeaderComponent`:

```
<View root, paddingTop: insets.top, bg #000>
  <Pressable backBtn (absolute top-left chevron)>
  <FlatList products data, numColumns 2 (3 on tablet)>
    ListHeaderComponent = Header
      <View header, paddingTop:56, gap:6, alignItems:center>
        <View avatarRing brand-bordered>
          <Avatar size=96, name + uri>
        <View nameRow row>
          <Text name 22px 800>           // seller.name
          {verified ? checkmark-circle 18 } // [id].tsx:71-73
          {isPro    ? proPill }              // [id].tsx:74-78
        <Text memberSince>                 // "Member since Jan 2026"
        <View statsRow row>                // ★ rating · 564 sales
          <Ionicons star 14 yellow>
          <Text rating>
          <View statDot>
          <Text salesCount>
        {bio    ? <Text bio centered>}    // [id].tsx:91
        {isPro && (website|phone|email) ?
          <View contactCard>              // [id].tsx:92-132
            <Text contactLabel "Contact pro">
            {website ? globe row}
            {phone   ? call row}
            {email   ? mail row}
        }
        <Text sectionTitle "LISTINGS">    // [id].tsx:133
    renderItem = SellerProductCard
```

### 5.2 Stats already displayed

| Stat | Source | Displayed | Citation |
| --- | --- | --- | --- |
| Verified badge | `seller.verified` | Yes (blue checkmark, 18px) | [seller/[id].tsx:71-73](src/app/(protected)/seller/[id].tsx#L71) |
| PRO badge | `seller.isPro` | Yes (purple pill) | [seller/[id].tsx:74-78](src/app/(protected)/seller/[id].tsx#L74) |
| Member since | `seller.createdAt` | Yes ("Member since Jan 2026") | [seller/[id].tsx:80](src/app/(protected)/seller/[id].tsx#L80) |
| Rating | `seller.rating` | Yes (★ + decimal) | [seller/[id].tsx:83-85](src/app/(protected)/seller/[id].tsx#L83) |
| Sales | `seller.salesCount` | Yes (separated by dot) | [seller/[id].tsx:87-89](src/app/(protected)/seller/[id].tsx#L87) |
| Bio | `seller.bio` | Yes (centered, conditional) | [seller/[id].tsx:91](src/app/(protected)/seller/[id].tsx#L91) |
| Followers | — | **Not displayed (no data)** | greenfield |
| Following | — | **Not displayed (no data)** | greenfield |

### 5.3 Where a `FollowButton` would naturally sit

Three plausible positions, in priority order:

1. **Header-right action button (recommended).** Add a horizontal action row immediately under the `statsRow` and above the `bio` — a `FollowButton` (filled primary when not-following, outlined when following) and an inline secondary "Message" button. This mirrors the canonical Twitter / Instagram profile pattern and gives the action the visual weight it deserves on a profile that's otherwise centered. The current layout's `gap:6` vertical rhythm accommodates a 36px button row cleanly.
2. **Top-right floating button next to the back chevron.** A round 40px filled-primary "Follow" button mirroring the back-button geometry at [seller/[id].tsx:139-145](src/app/(protected)/seller/[id].tsx#L139). Pro: always visible during scroll. Con: no room for a "Message" sibling without crowding the chevron, and breaks the visual symmetry of a centered profile header.
3. **Sticky bottom bar.** A 56px sticky bottom bar with `[Follow] [Message]`, lifted above the tab bar. Pro: reachability on tall phones. Con: this stack route has no tab bar (it's a `Stack`, not `Tabs`) so a sticky bottom bar is foreign to the rest of this surface.

The sub-route `/seller/[id]/followers` and `/seller/[id]/following` would mount cleanly alongside `[id].tsx` at `src/app/(protected)/seller/[id]/followers.tsx` and `.../following.tsx` once we move from a leaf route to a folder route. Today `[id].tsx` is a leaf — C.2 / C.4 would need to convert it to `[id]/index.tsx` to add siblings (Expo Router convention).

### 5.4 SellerPill inline FollowButton (for C.4 to decide)

[src/components/feed/SellerPill.tsx:32-155](src/components/feed/SellerPill.tsx) renders a compact pill at the top of every feed item: `Avatar(36) + name + verified + PRO + rating + sales`. The pill already maxes at `width: 320` and uses `flexShrink: 1` ([SellerPill.tsx:53](src/components/feed/SellerPill.tsx#L53)) — there is room for a tiny inline `Follow` chip on the right edge before the rating row, but it would tighten an already-busy pill. Recommend C.4 adds a small `+` icon variant (40×24) as an opt-in prop on `SellerPillProps` rather than always-on, so the standard feed pill stays visually quiet. **Decision deferred to C.4.**

---

## 6. Marketplace Feed — Following Surface Options

### 6.1 Current `mainTab` state

The home tab swaps between two surfaces via a Zustand store:

```ts
// src/stores/useMainTabStore.ts
export type MainTabId = 'pour-toi' | 'marketplace';
```

[src/components/feed/MarketplaceHeader.tsx:28](src/components/feed/MarketplaceHeader.tsx#L28) re-declares this type as `MarketplaceTabId` and renders two `<TabItem>` instances with active-underline styling. The home screen [src/app/(protected)/(tabs)/index.tsx:71-104](src/app/(protected)/(tabs)/index.tsx#L71) renders both `<View>`s and toggles `display: 'none'` based on `mainTab` (so neither view unmounts on tab switch — preserves scroll position). "Pour toi" is currently a vertical-pager FlatList of static `posts.json` (TikTok-style); "Marketplace" is the real `MarketplaceScreen` (filtered product feed).

### 6.2 Three options for a "Following" feed

| Option | Mechanism | Pros | Cons |
| --- | --- | --- | --- |
| **(a) Third tab** | Extend `MainTabId = 'pour-toi' \| 'marketplace' \| 'following'`. Add `<TabItem>` to header. Adds a third hidden `<View>` to home screen with a new `<FollowingFeed />`. | Discoverable; preserves both existing surfaces; matches the current pattern verbatim. | Three tabs are visually crowded in the centered cluster (header maxes at 640px content width, [MarketplaceHeader.tsx:26](src/components/feed/MarketplaceHeader.tsx#L26)); two short labels fit, three start to feel busy. Requires a "Following" empty-state for users who follow nobody. |
| **(b) Replace "Pour toi" semantically** | "Pour toi" → "Recommended" (or stays as today's algo), "Following" becomes the new explicit follow-graph feed in its slot. | No header crowding; clearest mental model — Following IS the personal feed. | Today's "Pour toi" already exists as a static stub; rebranding it requires a content / product call. Without "Pour toi" the algorithmic / discovery surface has no home unless folded into "Marketplace". |
| **(c) Sub-section on profile** | Section on the user's own profile or a `/(protected)/feed/following` route — "Recent activity from people I follow". Not part of the home tab. | Zero header / tab impact; works as a v0.1. | Low discoverability — users who don't visit their own profile won't see it. Doesn't replace the addictive top-of-app "what's new" surface that makes a Following feed valuable in marketplaces. |

### 6.3 Recommendation for C.5 / C.6

**Defer the Following-feed decision to C.5+.** The schema (C.2) does not depend on which surface ships first. A reasonable phasing:

- **C.2 / C.3 / C.4** ship the schema, the `useToggleFollow` mutation, and the `FollowButton` on the seller profile. No feed.
- **C.5** ships the followers / following list sub-routes on the profile.
- **C.6** ships the Following feed as **option (a) — a third tab**, with a graceful empty-state ("Follow a few sellers to see their newest listings here").

This phasing leaves the marketplace feed untouched while the social graph fills out, and converts the Following feed into a proper "stream" surface only once enough users have follows for the surface to feel populated.

---

## 7. Block / Mute / Privacy Patterns

**No user-to-user content controls exist.** Verified by grepping `\b(block|mute|report)\b` across `src/` (zero non-trivial hits — the few matches are unrelated noise like "block" in "code block", "report" in error reporting, etc.). No `blocks` / `mutes` / `reports` table in `supabase/migrations/` (verified by full table inventory in §4.2).

PROFILE_AUDIT.md §6.4 also lists "Block / report user" as **not implemented**.

**Implication for the follow design.**

- C.2 can ship `follows` without a block-table dependency. The implicit semantics ("can I follow someone who blocked me?") is not a question the codebase needs to answer today.
- A future `blocks` table (composite PK `(blocker_id, blocked_id)` referencing `auth.users(id)` or `sellers.id`) can be added without refactoring `follows` — the join would be in a `WHERE NOT EXISTS (SELECT 1 FROM blocks ...)` clause inside the followers/following list query and feed query, not a hard FK on `follows`.
- The "Report user" affordance is deferred indefinitely — flag for any future T&S work.

**Surface as future scope, not Phase C scope.**

---

## 8. React Query Mutation Pattern (for `useToggleFollow`)

The codebase has two mature optimistic-toggle mutation hooks that `useToggleFollow` should mirror exactly. The shared shape:

`onMutate` snapshot → optimistic patch via `setQueryData` → `onError` rollback → `onSettled` invalidation.

### 8.1 Reference: `useToggleLike`

[src/features/marketplace/hooks/useToggleLike.ts:15-45](src/features/marketplace/hooks/useToggleLike.ts#L15):

```ts
export function useToggleLike(productId: string): UseMutationResult<void, Error, boolean, Ctx> {
  const qc = useQueryClient();
  return useMutation<void, Error, boolean, Ctx>({
    mutationFn: async (currentlyLiked) => {
      if (currentlyLiked) await unlikeProduct(productId);
      else await likeProduct(productId);
    },
    onMutate: async (currentlyLiked) => {
      await qc.cancelQueries({ queryKey: USER_ENGAGEMENT_QUERY_KEY });
      const prev = qc.getQueryData<UserEngagement>(USER_ENGAGEMENT_QUERY_KEY);
      if (prev) {
        const next = new Set(prev.likedIds);
        if (currentlyLiked) next.delete(productId);
        else next.add(productId);
        qc.setQueryData<UserEngagement>(USER_ENGAGEMENT_QUERY_KEY, {
          ...prev,
          likedIds: next,
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(USER_ENGAGEMENT_QUERY_KEY, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['marketplace', 'products', 'list'] });
    },
  });
}
```

### 8.2 Reference: `useToggleBookmark`

[src/features/marketplace/hooks/useToggleBookmark.ts:15-45](src/features/marketplace/hooks/useToggleBookmark.ts#L15) — identical shape, swapping `likedIds` → `bookmarkedIds` and `like/unlike` → `bookmark/unbookmark`.

### 8.3 Anti-pattern (do not mirror): `useUpdateMySeller`

[src/features/marketplace/hooks/useUpdateMySeller.ts:9-22](src/features/marketplace/hooks/useUpdateMySeller.ts#L9) uses a simpler `onSuccess` setQueryData pattern with no `onMutate` snapshot or `onError` rollback. That's appropriate for a low-frequency form save; **not** appropriate for a high-frequency toggle button.

### 8.4 Specification for `useToggleFollow`

```ts
// Conceptual — actual implementation lands in C.3.
export function useToggleFollow(targetSellerId: string)
  : UseMutationResult<void, Error, boolean, Ctx> {
  // mutationFn:  if currentlyFollowing -> unfollowSeller(targetSellerId)
  //              else                   -> followSeller(targetSellerId)
  // onMutate:    cancelQueries(USER_ENGAGEMENT_QUERY_KEY)
  //              snapshot prev, optimistically toggle followingIds Set
  //              setQueryData with patched UserEngagement
  // onError:     rollback to prev
  // onSettled:   invalidateQueries(['seller', 'byId'])     // refresh follower count
  //              invalidateQueries(['seller', 'followers']) // refresh list if open
}
```

**Two extensions over the like/bookmark template:**

1. The follow-state should join `UserEngagement` as a third `followingSellerIds: Set<string>` field, primed by the same single `listUserEngagement()` query. This means C.2's schema work and C.3's service work need to extend the existing engagement query rather than introducing a parallel one.
2. `onSettled` invalidates `['seller', 'byId', targetSellerId]` so the public seller profile's follower count refreshes (the like/bookmark equivalent invalidates the products list for `likes_count`).

`followSeller(targetSellerId)` should adopt the same `PG_UNIQUE_VIOLATION = '23505'` swallow seen in [products.ts:346, 353](src/features/marketplace/services/products.ts#L346) so re-follow taps stay idempotent under network jitter.

---

## 9. Schema Directions

All three options assume:
- `follows` is a new public-schema table.
- ON DELETE CASCADE handles account deletion via the existing `delete_my_account` RPC chain ([20260517_delete_my_account_rpc.sql:92-98](supabase/migrations/20260517_delete_my_account_rpc.sql#L92)).
- Counter columns (`followers_count`, `following_count`) are added to `sellers` and maintained by a `SECURITY DEFINER` trigger that bypasses the B.1.5 grant tightening. They are **not** added to the user-controlled grant allowlist.

### S1 — Composite PK on `sellers.id` *(recommended)*

```sql
create table public.follows (
  follower_id  uuid not null references public.sellers(id) on delete cascade,
  following_id uuid not null references public.sellers(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follows_following_idx on public.follows(following_id);  -- "who follows me" lookup
-- "who I follow" is covered by the PK's leading column (follower_id).

alter table public.follows enable row level security;
create policy "follows public read" on public.follows for select using (true);
create policy "follows insert own"   on public.follows for insert with check (
  follower_id in (select id from public.sellers where user_id = auth.uid())
);
create policy "follows delete own"   on public.follows for delete using (
  follower_id in (select id from public.sellers where user_id = auth.uid())
);

alter table public.sellers
  add column followers_count integer not null default 0,
  add column following_count integer not null default 0;

-- on_follow_change() — security definer trigger, mirrors on_like_change().
-- INSERT: bump followers on following_id, bump following on follower_id.
-- DELETE: greatest(x - 1, 0) clamp.
```

- Composite PK doubles as the anti-duplicate constraint and the (follower → following) index.
- Single extra index on `following_id` covers the reverse lookup.
- `CHECK (follower_id <> following_id)` blocks self-follow at the DB layer.
- Public SELECT (anyone can read the social graph) — diverges from likes' private-SELECT because public follower lists are a core social-app affordance.
- INSERT / DELETE scoped to "my own seller row" — note the subquery pattern is needed because `auth.uid()` returns an `auth.users.id`, not a `sellers.id`; the policy translates via the `sellers.user_id` 1:1 mapping.

### S2 — Surrogate UUID PK + UNIQUE

```sql
create table public.follows (
  id           uuid primary key default uuid_generate_v4(),
  follower_id  uuid not null references public.sellers(id) on delete cascade,
  following_id uuid not null references public.sellers(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follows_follower_idx  on public.follows(follower_id);
create index follows_following_idx on public.follows(following_id);
```

- Identical RLS / trigger / counter strategy to S1.
- Surrogate `id` is harmless but **adds 16 bytes per row** for no current use case.
- Slightly more flexible if we ever soft-delete (`deleted_at` instead of hard DELETE) or store follow events as immutable audit rows. Neither is on the roadmap.
- The UNIQUE constraint is functionally equivalent to S1's PK; the second BTREE index on `follower_id` is needed because UNIQUE doesn't double as a leading-column index for the `follower_id`-only filter. Two BTREE indexes vs S1's one.

### S3 — Reference `auth.users.id` directly

```sql
create table public.follows (
  follower_user_id  uuid not null references auth.users(id) on delete cascade,
  following_user_id uuid not null references auth.users(id) on delete cascade,
  created_at        timestamptz not null default now(),
  primary key (follower_user_id, following_user_id),
  check (follower_user_id <> following_user_id)
);
create index follows_following_user_idx on public.follows(following_user_id);
```

- Mirrors `likes` ([20260501_initial_marketplace_schema.sql:64-69](supabase/migrations/20260501_initial_marketplace_schema.sql#L64)) exactly — both reference `auth.users(id)`.
- RLS becomes simpler — INSERT policy is `with check (auth.uid() = follower_user_id)` directly, no `sellers.user_id` subquery.
- **Breaks marketplace semantics.** The `sellers` row is the de-facto user profile (G.1, PROFILE_AUDIT.md §1). A user with no `sellers` row would have a follow record but no profile to render — the join from `follows.following_user_id → sellers.user_id` would return null and need defensive handling everywhere. Counter columns on `sellers` would still need a `WHERE user_id = NEW.follower_user_id` subquery in the trigger.
- Schema-level inconsistency with `products.seller_id → sellers(id)` (the marketplace's relational backbone).

### Recommendation: **S1**

S1 is the closest fit to the marketplace's semantic model — the social graph references `sellers`, the same table that owns `name`, `avatar_url`, `verified`, `rating`, `sales_count`, and the location columns. Every join from a follow row back to a renderable profile is a single `id` equality on `sellers`, identical to the existing `products.seller_id → sellers(id)` pattern. The composite PK and the single supplementary `(following_id)` index match the storage shape of `likes` (one BTREE plus the PK) so the storage budget is the smallest of the three. S2's surrogate `id` solves no current problem and costs ~16 bytes per row; S3's `auth.users` reference saves an RLS subquery but breaks the `seller-as-profile` convention used by every other table in the app, and would require the counter trigger to do the very lookup it was meant to avoid. The tradeoff is one extra `select id from sellers where user_id = auth.uid()` per insert/delete RLS check, which is trivially cached on a single-row equality and runs once per mutation.

---

## 10. UI Integration Directions

### U1 — Conservative *(recommended)*

- `FollowButton` on the seller profile header only, in a horizontal action row immediately under the stats row, paired with an inline "Message" button (which already exists in functionality via `start_or_get_conversation` RPC).
- Followers / Following lists as stack sub-routes: `/(protected)/seller/[id]/followers` and `.../following`. Requires converting `[id].tsx` from a leaf route to a folder route (`[id]/index.tsx` + siblings).
- **No** Following feed in this phase — defer to C.6 follow-up.
- **No** inline FollowButton on the SellerPill in the feed.
- Public follower / following counts displayed in the stats row alongside rating and sales.

### U2 — Aggressive

- `FollowButton` on the profile header AND inline on `SellerPill` (every feed item gains a tiny `+`-icon variant).
- Sub-routes for followers / following lists.
- Following feed as the third tab in `MarketplaceHeader` (option (a) from §6.2).
- Pushes the social graph to the front of the app immediately.

### U3 — Light-touch

- `FollowButton` on the profile header only.
- Followers / Following lists in `@gorhom/bottom-sheet` modals (no new routes), reusing the existing sheet pattern from `MarketplaceFilterSheet`, `LocationSheet`.
- No Following feed.
- Smallest surface change; no Expo Router restructure.

### Recommendation: **U1**

U1 calibrates correctly to a follow feature that nobody is asking for yet. Shipping it on the profile header gives the action a visible home; the sub-routes for followers/following are conventional enough that the navigation feels native (matching every other social app); and **deferring the Following feed avoids building a stream surface against an empty social graph** — the feed has no shape until at least a few hundred follows exist. U2 over-reaches: putting the FollowButton on every feed pill clutters the busiest UI in the app and pre-commits to a Following feed before any data exists to populate it. U3's bottom-sheet lists are cheaper but lose the deep-linkability of a stack route — followers/following pages benefit from being shareable URLs (`/seller/[id]/followers`) for both engagement and growth-loop reasons.

---

## 11. Open Questions

1. **Should follows be visible to non-authenticated viewers?** S1 / S2 / S3 all default to public SELECT, but the policy could be tightened to `using (auth.uid() is not null)` if we want a sign-in wall on the social graph. Recommend public — discoverability for SEO / sharing; matches Instagram, X, Pinterest defaults.

2. **Should follower counts on `sellers` be publicly displayed, or only to the owner?** The recommended trigger maintains them on every row regardless. The **display** decision is a UI choice C.4 should make explicitly. Recommend public — same rationale as Q1.

3. **Should there be a notification when someone follows you?** §4 establishes that push (Expo) is cheap and ready; an in-app activity feed would be a new surface. Recommend push only for v1; defer in-app notifications inbox to its own phase.

4. **Should "private accounts" be a future privacy feature (follow requests + approval flow)?** Adds a `follow_requests` table parallel to `follows`, plus an `is_private` boolean on `sellers`. Out of scope for Phase C; flag for Trust & Safety roadmap.

5. **What happens to a seller's follows when their account is deleted via B.4's `delete_my_account` RPC?** S1 / S2 / S3 all use `ON DELETE CASCADE` on both FKs to `sellers(id)`. The cascade chain in `delete_my_account` ([20260517_delete_my_account_rpc.sql:11-28](supabase/migrations/20260517_delete_my_account_rpc.sql#L11)) goes `auth.users → sellers (CASCADE on user_id) → follows (CASCADE on follower_id and following_id)`. **No additional RPC change is required**, but C.2 should re-verify by adding a comment in the RPC's cascade-map header listing `follows.follower_id` and `follows.following_id` as new CASCADE-direct paths. The follower counts on remaining sellers will be decremented automatically by the `on_follow_change()` DELETE branch as the cascade unwinds.

6. **Should `follows` be added to the `supabase_realtime` publication?** [20260509_messaging.sql:133-134](supabase/migrations/20260509_messaging.sql#L133) shows the precedent for `messages` / `conversations`. Follow-counts don't need sub-second updates; React Query invalidation in `onSettled` is enough. Defer realtime to C.6+ if/when the Following feed needs live-updates.

7. **Can `sellers.id` change?** Today no — the `id` is `uuid primary key default uuid_generate_v4()` and is never re-keyed in any migration. CASCADE FKs assume immutability. Worth re-confirming in C.2 that no future migration plans to re-key `sellers.id`.

8. **Should the `UserEngagement` query be extended in-place to include `followingSellerIds`, or should follow-state be a parallel query?** Recommend extend in-place (one round-trip primes everything for the home feed, the seller profile, and the followers list). C.3 should re-shape `listUserEngagement()` and the cache key stays the same.

9. **Does the `SellerPill` need a `FollowButton` variant?** Deferred from §5.4 — C.4's call. Recommend NO until U.1 ships and we have evidence the seller profile button isn't enough.

10. **Should `useToggleFollow` `onSuccess` fire a push notification to `following_id`?** Cleaner option is to fire from a `SECURITY DEFINER` trigger on `follows` insert that invokes the `send-push-notification` Edge Function via `pg_net` — the client never has to know. Either way is feasible. Recommend trigger-side for v1 so client-side accidental skips (e.g., offline submit retry) don't cause silent missing notifications.
