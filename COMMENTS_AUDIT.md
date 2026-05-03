# Comments Audit — Step D.1

Read-only reconnaissance of comment-adjacent code, the `products.comments_count` denormalized counter, parallel patterns (`likes` for trigger shape, `follows` for RLS / SECURITY DEFINER shape), the Supabase realtime infrastructure already in use for messaging, the gorhom v5 + Zustand bottom-sheet idiom, the Expo push edge-function, and the current state of the comment button in `ProductActionRail`. No source files were modified. D.2 reads this audit and ships the schema + trigger + RLS migration without re-discovering anything.

> **Cross-references.** Schema columns and `products` RLS / grant facts are cited from [PROJECT_AUDIT.md](PROJECT_AUDIT.md) §10 / §13 and [supabase/migrations/20260501_initial_marketplace_schema.sql](supabase/migrations/20260501_initial_marketplace_schema.sql). The `likes` reference trigger and the `follows` SECURITY DEFINER + `search_path` template are taken from [supabase/migrations/20260502_engagement_triggers.sql](supabase/migrations/20260502_engagement_triggers.sql) and [supabase/migrations/20260518_follows_schema_and_counters.sql](supabase/migrations/20260518_follows_schema_and_counters.sql). Realtime, push, and bottom-sheet patterns are taken from the live codebase at the citations below.

---

## 1. Existing Comment Code

**Mostly greenfield.** There is no `comments` table, no service module, no hook, no sheet, no route, and no realtime subscription. The only live comment-adjacent surfaces are:

| File / Line | Role |
| --- | --- |
| [src/features/marketplace/components/ProductActionRail.tsx:41](src/features/marketplace/components/ProductActionRail.tsx#L41) | `const onPressComment = (): void => {};` — **decorative no-op handler** wired to the comment button. |
| [src/features/marketplace/components/ProductActionRail.tsx:79-87](src/features/marketplace/components/ProductActionRail.tsx#L79) | The `Pressable` that calls `onPressComment` and renders `Ionicons name="chatbubble"` + `formatCount(product.engagement.comments)`. The displayed count comes from `product.engagement.comments` which is hydrated from `products.comments_count` (currently zero across the seeded rows in [supabase/migrations/20260501_initial_marketplace_schema.sql](supabase/migrations/20260501_initial_marketplace_schema.sql) — see §2). |
| [src/features/marketplace/services/products.ts:59,104](src/features/marketplace/services/products.ts#L59) | `ProductRow.comments_count: number` and the `engagement.comments: row.comments_count` map in `rowToProduct`. Read-only — no INSERT / UPDATE path. |
| [src/features/marketplace/types/product.ts:48](src/features/marketplace/types/product.ts#L48) | `engagement.comments: number` on the domain `Product` type. |

**Stale code, unrelated to D.** The old TikTok-clone scaffolding has stub types that confuse a literal grep but are not on the marketplace path:

| File / Line | Role |
| --- | --- |
| [src/types/types.ts:23-35](src/types/types.ts#L23) | `export type Comment = { id, post_id, user_id, comment, created_at }` and `NewCommentInput`. **Stub from the legacy posts feed.** No usage anywhere — `rg "Comment\b" src/ \| grep -v supabase` returns only this file plus a CSS-class match in `CustomTabBar.tsx`. **Do not** consume this type for D.2 / D.3 — the new comments domain type belongs under `src/features/marketplace/types/comment.ts`. |
| [src/components/PostListItem.tsx:16,63](src/components/PostListItem.tsx#L16) | `nrOfComments` rendering for the legacy `Post` (posts.json) feed — disconnected from products. |
| [src/data/posts.json:12,25,38,51,64](src/data/posts.json#L12) | Hard-coded `nrOfComments` values in the legacy posts seed. |
| [src/components/navigation/CustomTabBar.tsx:16](src/components/navigation/CustomTabBar.tsx#L16) | The literal English word "comment" inside a code comment. False-positive grep hit. |

**Searches run.**

```
rg -i 'comment' src/                             # 8 files, all classified above
rg -i 'comments_count' src/ supabase/            # ProductRow + Database typegen + 5 INSERTs in initial migration
rg "from\\('comments'\\)" src/                   # zero matches
rg 'reply\|threading\|parent_id' src/            # zero matches
```

**What the comment button does today.** Tapping `<Pressable onPress={onPressComment}>` invokes an empty arrow function. There is no `Alert`, no router push, no toast, no haptic, no analytics. The button is **decorative**. PROJECT_AUDIT.md §13 #3 already flagged this: *"comments_count exists on products but there is no table, RLS, mutation, or list hook. The 'comment' button in ProductActionRail is decorative."* Step 5 (action-rail redesign with a placeholder comments sheet) was specced but never shipped — the current rail is the legacy one (per PROJECT_AUDIT.md:977,1033 — *"action rail (Step 5 not yet done) — untouched"*).

---

## 2. Products Schema — `comments_count` and Grants

The denormalized counter has shipped since day one but is never written from the application path.

**Column declaration** ([supabase/migrations/20260501_initial_marketplace_schema.sql:53](supabase/migrations/20260501_initial_marketplace_schema.sql#L53)):

```sql
comments_count integer not null default 0,
```

**Generated TS types** confirm the shape ([src/types/supabase.ts:272,303,334](src/types/supabase.ts#L272)):

| Block | Type |
| --- | --- |
| `Database['public']['Tables']['products']['Row']` | `comments_count: number` (NOT NULL — no `\| null` union). |
| `Insert` | `comments_count?: number` (optional — server default 0 applies). |
| `Update` | `comments_count?: number`. |

**Seeded values** ([20260501_initial_marketplace_schema.sql:155,183,211,239,267](supabase/migrations/20260501_initial_marketplace_schema.sql#L155)). The five mock products were seeded with hand-picked counts (`128, 23, 96, 42, 58`) — purely cosmetic, since no comment rows exist to back them. **D.2 should leave these seeded values alone**: they animate the existing UI's comment-count badge so the rail does not look uniformly zero in screenshots, and once D.3 lands the trigger will increment from these seed bases (no observable bug — the counter is "cosmetic + drift" until first real INSERT, after which it is true counter + drift).

**RLS / grant audit on `products`.** Walking the migrations from oldest to newest:

| Migration | Effect on `products` |
| --- | --- |
| [20260501](supabase/migrations/20260501_initial_marketplace_schema.sql#L92) | `enable row level security`. `"products public read"` for SELECT (anyone). |
| [20260503:39-45](supabase/migrations/20260503_sell_setup.sql#L39) | `"products insert own"` — INSERT WITH CHECK that `seller_id` is in the calling user's seller rows. |
| [20260506:2-8](supabase/migrations/20260506_owner_delete.sql#L2) | `"products delete own"` — DELETE USING the same seller-id ownership check. |
| [20260507:1-10](supabase/migrations/20260507_owner_update.sql#L1) | `"products update own"` — UPDATE USING + WITH CHECK both gate on seller-id ownership. **No column-level GRANT restriction was ever applied to `public.products`.** A grep for `revoke update on public.products` and `grant update (` against products returns zero hits across `supabase/migrations/`. |

**Self-elevation hole — flag for D.2.** The `products` table has the same shape today that `sellers` had **before** B.1.5 ([20260515_tighten_sellers_update_grants.sql](supabase/migrations/20260515_tighten_sellers_update_grants.sql#L53)). A seller can issue:

```ts
supabase.from('products').update({ comments_count: 999_999 }).eq('id', myProductId)
```

…and PostgREST will accept it because the `"products update own"` RLS policy is satisfied (they own the row) and there is no column-level grant blocking the column write. They can also self-set `likes_count`, `bookmarks_count`, `shares_count`, and any other counter column on **their own** listings.

**D.2 should fix this in the same migration that adds the `comments` table.** The fix mirrors B.1.5 mechanically: `revoke update on public.products from authenticated;` then re-grant column-level UPDATE on the user-controlled allowlist (`title, description, category, attributes, dimensions, price, currency, media_type, media_url, thumbnail_url, stock_available, stock_label, shipping_free, shipping_label, pickup_available, location, latitude, longitude, location_text, location_updated_at, category_id, subcategory_id`). The four `*_count` columns and `seller_id`, `id`, `created_at`, `location_point` (generated) are deliberately excluded. This work is small, mechanical, and is the right time to do it because D.2's counter trigger will be SECURITY DEFINER (and therefore bypass the new grant) — without the tightening, the trigger is doing correct work alongside a forged-counter side channel from clients.

---

## 3. Likes / Follows Reference Patterns

Two precedents map cleanly onto comments. D.2 mirrors **`likes`** for the table + counter-trigger shape and **`follows`** for SECURITY DEFINER hardening.

### 3.1 `likes` — closest precedent for the trigger / counter shape

[supabase/migrations/20260502_engagement_triggers.sql:17-41](supabase/migrations/20260502_engagement_triggers.sql#L17):

```sql
create or replace function public.on_like_change()
returns trigger
language plpgsql
security definer
as $$
begin
  if (TG_OP = 'INSERT') then
    update public.products
    set likes_count = likes_count + 1
    where id = NEW.product_id;
    return NEW;
  elsif (TG_OP = 'DELETE') then
    update public.products
    set likes_count = greatest(likes_count - 1, 0)
    where id = OLD.product_id;
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists likes_count_sync on public.likes;
create trigger likes_count_sync
after insert or delete on public.likes
for each row execute function public.on_like_change();
```

**Reusable as-is for comments**: `INSERT/DELETE` only, `greatest(- 1, 0)` clamp, SECURITY DEFINER so the trigger writes through column-level UPDATE grants the caller does not have. Comments deviate in two places:
1. The trigger key is `NEW.product_id` (not `NEW.user_id`) — same shape; commenting key is also `product_id`.
2. **`likes` does not pin `search_path`.** It pre-dates B.1.5 and relies on the default. New triggers landing post-B.1.5 should mirror **`follows`** (next subsection) instead.

### 3.2 `follows` — most recent reference, the one to copy literally

[supabase/migrations/20260518_follows_schema_and_counters.sql:158-184](supabase/migrations/20260518_follows_schema_and_counters.sql#L158):

```sql
create or replace function public.handle_follow_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if (TG_OP = 'INSERT') then
    update public.sellers
      set followers_count = followers_count + 1
      where id = NEW.following_id;
    -- ...
  elsif (TG_OP = 'DELETE') then
    update public.sellers
      set followers_count = greatest(followers_count - 1, 0)
      where id = OLD.following_id;
    -- ...
  end if;
  return null;
end;
$$;
```

The non-negotiable detail is `set search_path = public, pg_catalog`. Without it, SECURITY DEFINER is vulnerable to a malicious user creating a `public.products` shadow object in their own schema and tricking the trigger into resolving it. D.2's `handle_comment_change()` MUST set `search_path` for the same reason.

### 3.3 RLS shape comparison

| Aspect | `likes` (legacy) | `follows` (recent) | `comments` (D.2 target) |
| --- | --- | --- | --- |
| SELECT visibility | private (`auth.uid() = user_id`) | public-to-authenticated (`using (true)`) | **public-to-authenticated** (everyone reads the conversation) |
| INSERT scope | own row only | own seller row only | **own row only** (`author_id = auth.uid()`) |
| UPDATE scope | not allowed (rows immutable) | not allowed (rows immutable) | **author-only** if comment editing is in scope (see §10 / §12) |
| DELETE scope | own row only | own seller row only | **author-only** |
| Grants to `authenticated` | SELECT, INSERT, DELETE | SELECT, INSERT, DELETE | **SELECT, INSERT, DELETE** (and UPDATE only if editing supported) |
| Has body / payload | no | no | **yes** — `body text` with length CHECK |
| Has FK CASCADE chain | `auth.users → likes` (on `user_id`) and `products → likes` (on `product_id`) | `sellers → follows` (on both ends) | **`auth.users → comments` (on `author_id`) and `products → comments` (on `product_id`)** — both ON DELETE CASCADE so account-deletion (B.4) and product-deletion compose automatically |

**Account-deletion composition**. The B.4 RPC ([supabase/migrations/20260517_delete_my_account_rpc.sql](supabase/migrations/20260517_delete_my_account_rpc.sql)) does `delete from auth.users` and lets cascades unwind. With `comments.author_id` ON DELETE CASCADE → `auth.users.id`, deleting an account automatically removes the user's comments and the trigger's DELETE branch decrements `comments_count` on each affected product. **D.2's RPC needs no change**, just like C.2's `follows` table.

---

## 4. Realtime Infrastructure

**Reusable as-is.** Supabase realtime is already wired through the standard `postgres_changes` channel pattern in messaging.

**Subscription shape** ([src/features/marketplace/services/messaging.ts:233-272](src/features/marketplace/services/messaging.ts#L233)):

```ts
export function subscribeToMessages(
  conversationId: string,
  onInsert: (m: ChatMessage) => void,
) {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onInsert(rowToMessage(payload.new as MessageRow)),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
```

**Hook lifecycle** ([src/features/marketplace/hooks/useMessages.ts:20-31](src/features/marketplace/hooks/useMessages.ts#L20)) — mount → subscribe → on-insert merge into the React Query cache (with id-dedup so an optimistic temp-row isn't re-prepended) → cleanup on unmount.

**Publication setup** ([supabase/migrations/20260509_messaging.sql:133-134](supabase/migrations/20260509_messaging.sql#L133)):

```sql
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
```

D.2 / D.5 will need the analogous one-liner:

```sql
alter publication supabase_realtime add table public.comments;
```

**D.5 mapping (preview, not in scope for D.1).** A `useComments(productId)` hook should:
- Subscribe via `supabase.channel(\`comments:${productId}\`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: \`product_id=eq.${productId}\` }, payload => …)`.
- In `onInsert`, merge into `qc.getQueryData(['comments', productId])` with the same id-dedup pattern in `useMessages.ts:23-26` so the local optimistic row (created by `onMutate` in §7) does not duplicate the realtime echo.

The pattern is **identical** to messaging modulo table name and filter column — no new infrastructure work for D.5.

---

## 5. Notifications Infrastructure (preview for future)

**Ready, out of scope for Phase D core but worth recording.** A future "X commented on your listing" push would land in D.6+ as a follow-up, not in D.1–D.5.

**Edge function call site** ([src/services/pushNotifications.ts:68-86](src/services/pushNotifications.ts#L68)):

```ts
export async function sendPushNotification(input: {
  recipientUserId: string;
  title: string;
  body: string;
  data?: PushNotificationData;
}): Promise<void> {
  try {
    await supabase.functions.invoke('send-push-notification', {
      body: {
        user_id: input.recipientUserId,
        title: input.title,
        body: input.body,
        data: input.data ?? {},
      },
    });
  } catch (err) {
    console.warn('sendPushNotification error', err);
  }
}
```

**Reference call** ([src/features/marketplace/hooks/useSendMessage.ts:36-49](src/features/marketplace/hooks/useSendMessage.ts#L36)) — fired in `onSuccess` of the send-message mutation, with the recipient's auth user id (resolved upstream) and a 80-char body preview. The same shape applies for a comment-notification:

```ts
// in useCreateComment onSuccess (D.6 follow-up, NOT D.1–D.5):
void sendPushNotification({
  recipientUserId: productOwnerUserId, // resolve via products.seller_id → sellers.user_id
  title: t('notifications.commentTitle', { name: senderName }),
  body: bodyPreview,
  data: { product_id: productId, comment_id: serverRow.id },
});
```

**Push-token storage** ([supabase/migrations/20260512_push_tokens.sql](supabase/migrations/20260512_push_tokens.sql)) is keyed on `expo_push_token` and the edge function looks up the recipient's tokens — **no new schema work needed** for the comment-notification follow-up. The author-self-notify case (don't push when the commenter is the listing owner) needs an early return in the call site, copying the messaging convention.

---

## 6. Bottom Sheet Patterns

**Confirmed: base `BottomSheet` from `@gorhom/bottom-sheet` v5.2.13 + a Zustand `isOpen` store.** No `BottomSheetModal` usage anywhere — `rg 'BottomSheetModal' src/` returns zero matches.

**Dependency** ([package.json](package.json)): `"@gorhom/bottom-sheet": "^5.2.13"`.

**Idiomatic example** — `ProductDetailSheet` ([src/features/marketplace/components/ProductDetailSheet.tsx:11-17,100-135,419-434](src/features/marketplace/components/ProductDetailSheet.tsx#L11)):

```tsx
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
// ...
const productId = useProductSheetStore((s) => s.productId);
const close     = useProductSheetStore((s) => s.close);
const sheetRef  = useRef<BottomSheet>(null);
const snapPoints = useMemo(() => ['50%', '90%'], []);
// ...
<BottomSheet
  key={productId ?? 'idle'}
  ref={sheetRef}
  index={productId ? 0 : -1}
  snapPoints={snapPoints}
  enablePanDownToClose
  onChange={handleSheetChange}
  backdropComponent={renderBackdrop}
  footerComponent={renderFooter}
  backgroundStyle={styles.sheetBackground}
  handleIndicatorStyle={styles.handleIndicator}
>
  {renderContent()}
</BottomSheet>
```

**Zustand store** ([src/stores/useProductSheetStore.ts](src/stores/useProductSheetStore.ts:1)):

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

The sheet is mounted once at app level and driven by reading `productId` from the store — `index = productId ? 0 : -1`.

**Other matching sheets** — same idiom, all using base `BottomSheet`:
- [src/features/marketplace/components/MarketplaceFilterSheet.tsx](src/features/marketplace/components/MarketplaceFilterSheet.tsx)
- [src/components/feed/LocationSheet.tsx](src/components/feed/LocationSheet.tsx)
- [src/components/profile/EditProfileLocationSheet.tsx](src/components/profile/EditProfileLocationSheet.tsx)

**D.4 mapping (preview).** A `CommentsSheet` for a product should:
- Have its own `useCommentsSheetStore` keyed on `productId: string \| null`.
- Be mounted at app level (alongside `ProductDetailSheet` in [src/app/(protected)/_layout.tsx](src/app/(protected)/_layout.tsx) — same root the existing sheet is mounted in).
- Use `snapPoints = ['90%']` (single snap, near-full-screen — Instagram / TikTok comments idiom).
- Use `BottomSheetFooter` for a sticky bottom input row, `BottomSheetFlatList` (or `BottomSheetScrollView` for v1 simplicity) for the list.
- The action-rail comment button calls `useCommentsSheetStore.getState().open(product.id)` instead of the empty `onPressComment` handler.

The existing comments-related sheet mentioned in Step 5's spec was **never shipped** — the current comment button does NOT open a sheet (confirmed in §1).

---

## 7. Mutation Pattern (optimistic prepend, not toggle)

`useToggleLike` / `useToggleFollow` / `useToggleBookmark` are toggles. Comments are **not** — each post is a unique row, not a state-flip. The optimistic shape differs.

**Toggle reference** ([src/features/marketplace/hooks/useToggleLike.ts:24-44](src/features/marketplace/hooks/useToggleLike.ts#L24)):

```ts
onMutate: async (currentlyLiked) => {
  await qc.cancelQueries({ queryKey: USER_ENGAGEMENT_QUERY_KEY });
  const prev = qc.getQueryData<UserEngagement>(USER_ENGAGEMENT_QUERY_KEY);
  if (prev) {
    const next = new Set(prev.likedIds);
    if (currentlyLiked) next.delete(productId);
    else next.add(productId);
    qc.setQueryData(USER_ENGAGEMENT_QUERY_KEY, { ...prev, likedIds: next });
  }
  return { prev };
},
onError: (_err, _vars, ctx) => {
  if (ctx?.prev) qc.setQueryData(USER_ENGAGEMENT_QUERY_KEY, ctx.prev);
},
```

**Comments shape D.3 should land** — optimistic prepend with id-swap on success:

```ts
type CommentsCtx = { prev: Comment[] | undefined; tempId: string };

useMutation<Comment, Error, { body: string }, CommentsCtx>({
  mutationFn: async ({ body }) => createComment(productId, body),
  onMutate: async ({ body }) => {
    const key = ['comments', productId];
    await qc.cancelQueries({ queryKey: key });
    const prev = qc.getQueryData<Comment[]>(key);
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: Comment = {
      id: tempId,
      productId,
      authorId: currentUserId,
      authorName: currentUserName,
      authorAvatarUrl: currentUserAvatarUrl,
      body,
      createdAt: new Date().toISOString(),
      pending: true, // UI tag; not persisted server-side
    };
    qc.setQueryData<Comment[]>(key, (old) => [optimistic, ...(old ?? [])]);
    return { prev, tempId };
  },
  onSuccess: (serverRow, _vars, ctx) => {
    const key = ['comments', productId];
    qc.setQueryData<Comment[]>(key, (old) =>
      (old ?? []).map((c) => (c.id === ctx?.tempId ? serverRow : c)),
    );
  },
  onError: (_err, _vars, ctx) => {
    if (!ctx) return;
    const key = ['comments', productId];
    qc.setQueryData<Comment[]>(key, (old) =>
      (old ?? []).filter((c) => c.id !== ctx.tempId),
    );
  },
  onSettled: () => {
    // products list staleness — comments_count badge in feed
    qc.invalidateQueries({ queryKey: ['marketplace', 'products', 'list'] });
  },
});
```

**Realtime composition with optimistic mutations**. The realtime echo from §4 will INSERT-event the same row the JS client just wrote. The `useMessages.ts:24-26` precedent is the safe handler: dedup by id. With the optimistic prepend, the temp-id is replaced in `onSuccess` **before** the realtime echo arrives (the echo carries the server id, so the dedup check `prev.find(m => m.id === msg.id)` correctly skips). This is mechanical — D.5 inherits the messaging implementation.

---

## 8. Threading Model Recommendation

**Recommended: T1 — Flat (no replies).**

| Model | Schema cost | UI cost | Marketplace fit | Recommendation |
| --- | --- | --- | --- | --- |
| **T1 — Flat** | minimal | minimal | strong | **✅ ship this for v1** |
| T2 — 1-level nested | one column (`parent_id` nullable, FK to self ON DELETE CASCADE) + app-enforced max depth = 1 | reply UI, indented row, nested list slice | medium — useful but not load-bearing | defer |
| T3 — Fully threaded | `parent_id` + `path` (ltree or array) | tree-render, expand/collapse, "load more replies" | weak — Reddit-style overkill for a marketplace product page | reject |

**Why flat for v1:** Depop, Vinted, and Whatnot product pages are flat. Etsy is flat. Threading adds reply-UI surface area, indentation rules, and an extra "depth" rule the trigger has to enforce, for what is — on a marketplace product — usually a question/answer pair the seller can reply to inline by mentioning the asker by username (or by switching to DM, which the action rail already supports). T1's schema is forward-compatible with T2: D.2 can land with no `parent_id` column and a follow-up migration can `add column parent_id uuid null references public.comments(id) on delete cascade` without backfill (existing rows are top-level, NULL is correct).

---

## 9. Soft-Delete vs Hard-Delete Recommendation

**Recommended: hard-delete.**

For T1 (flat) the only argument for soft-delete is preserving thread context — irrelevant when there are no threads. Hard-delete is simpler:
- One DELETE policy: author-scoped (`using (auth.uid() = author_id)`).
- Trigger DELETE branch decrements `comments_count` automatically (already in §3.2's template).
- The cascade chain is clean: `auth.users` → `comments` (account deletion wipes), `products` → `comments` (listing deletion wipes), and the trigger composes through both.

If a future requirement reintroduces threading and "[deleted]" placeholders, soft-delete becomes easy to retrofit (add `deleted_at timestamptz null`, change SELECT policy to `using (deleted_at is null)` or, if you want to preserve thread context with placeholders, project `case when deleted_at is null then body else null end as body`, and wire the UPDATE-when-deleted_at-flips trigger branch). v1 should not pre-pay this complexity.

---

## 10. Schema Directions

| | S1 — Flat, hard-delete | S2 — Flat, soft-delete | S3 — 1-level nested |
| --- | --- | --- | --- |
| Body length CHECK | `length(body) between 1 and 1000` | same | same |
| `parent_id` | — | — | `uuid null references comments(id) on delete cascade` + app-side max depth = 1 |
| `deleted_at` | — | `timestamptz null` | — |
| Counter trigger | INSERT/DELETE | INSERT + UPDATE-when-deleted_at-flips + DELETE | INSERT/DELETE |
| SELECT policy | `using (true)` to `authenticated` | `using (deleted_at is null)` to `authenticated` | `using (true)` to `authenticated` |
| INSERT/UPDATE/DELETE | author-only (`auth.uid() = author_id`) | author-only | author-only |
| Indices | `(product_id, created_at desc)` composite | same | same + `(parent_id)` for reply lookup |
| Forward-compat to threading | retro-add `parent_id` later | retro-add `parent_id` later | already there |

### Recommended — **S1 (Flat, hard-delete)**.

```sql
create table public.comments (
  id          uuid primary key default uuid_generate_v4(),
  product_id  uuid not null references public.products(id) on delete cascade,
  author_id   uuid not null references auth.users(id)      on delete cascade,
  body        text not null check (length(body) between 1 and 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index comments_product_created_idx
  on public.comments (product_id, created_at desc);

alter table public.comments enable row level security;

create policy "comments authenticated read"
  on public.comments for select to authenticated using (true);
create policy "comments author insert"
  on public.comments for insert to authenticated
  with check (auth.uid() = author_id);
create policy "comments author update"
  on public.comments for update to authenticated
  using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "comments author delete"
  on public.comments for delete to authenticated
  using (auth.uid() = author_id);

grant select, insert, update, delete on public.comments to authenticated;

-- Counter trigger — copy follows' search_path discipline (§3.2).
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

alter publication supabase_realtime add table public.comments;
```

**Why S1.** It matches §8 (flat) + §9 (hard-delete), uses `follows` as the SECURITY DEFINER + `search_path` template (§3.2), uses `likes` as the CASCADE + counter shape (§3.1), and is forward-compatible with both T2 (add `parent_id`) and soft-delete (add `deleted_at`) via additive migrations. The composite index `(product_id, created_at desc)` matches the only read pattern: paginated list of comments for a product, newest- or oldest-first. The same migration should fix §2's self-elevation hole on `products`.

---

## 11. UI Integration Directions

| | U1 — Bottom sheet (90% snap) | U2 — Dedicated route | U3 — Inline expand below product |
| --- | --- | --- | --- |
| Idiom match | strong (matches every existing sheet — §6) | weak (no comparable route in app) | weak (would crowd the video-first feed item) |
| Context preserved | yes — product visible behind backdrop | no — full-screen route loses product | partial — product clipped above |
| Implementation cost | low (copy `ProductDetailSheet` skeleton) | medium (new route, header, back-nav, shared element) | medium (FlatList layout intrusion, swipe interactions) |
| Sticky compose input | trivial (`BottomSheetFooter`) | trivial (`KeyboardAvoidingView`) | hard (footer must avoid feed swipe) |
| Industry alignment | Instagram / TikTok / Whatnot | Etsy / Twitter | none |

### Recommended — **U1 (bottom sheet)**.

Tap the action-rail comment button → `useCommentsSheetStore.getState().open(product.id)` → `<CommentsSheet />` opens at 90% snap with:
- Header row: "Commentaires (n)" + close icon.
- Body: `BottomSheetFlatList` of comments, ordered `created_at desc` (or asc with auto-scroll-to-bottom — D.4 picks one).
- Footer: `BottomSheetFooter` with avatar + text input + send button. Disabled when `body.length === 0` or `> 1000`.
- Auth-gated send: reuse `useRequireAuth` like the like / bookmark buttons in `ProductActionRail` ([ProductActionRail.tsx:31-35](src/features/marketplace/components/ProductActionRail.tsx#L31)).

Step 5 (action-rail redesign) status — confirmed not shipped (§1; PROJECT_AUDIT.md:977,1033). D.6 wires the new sheet into the **legacy** action rail at [ProductActionRail.tsx:79-87](src/features/marketplace/components/ProductActionRail.tsx#L79) — replace `onPressComment = () => {}` with `useCommentsSheetStore.getState().open(product.id)`. When Step 5 lands, the new rail can plug into the same store with a one-line edit.

---

## 12. Open Questions

1. **Action-rail dependency on Step 5.** Step 5 was specced but not shipped (§1, §11). D.6 should plug into the legacy `ProductActionRail` and we revisit when Step 5 ships. Confirm: ship D against the legacy rail?
2. **Pagination strategy.** Cursor-based (created_at + id tiebreak) composes better with realtime INSERTs that all carry `created_at = now()` and arrive at the head. Offset is simpler. Recommendation: cursor for D.5, but D.3 can ship with a single page (default `limit = 50` + `order created_at desc`) and defer the cursor cookie until comment volume on a single product justifies it.
3. **Comment editing.** Out of scope for D.3 unless explicitly added. The S1 schema includes `updated_at` and the RLS includes a UPDATE policy so editing can ship later without a migration; the trigger does not handle UPDATE because counter is unaffected by edits. Confirm: defer or include?
4. **Body length cap.** S1 uses `length(body) between 1 and 1000`. Twitter uses 280 (too short for marketplace Q&A — "what are the dimensions of the side panel and does it ship to Belgium?" is already 80 chars). 500 risks cropping a serious question. **1000 recommended** unless a different number is stated.
5. **Mention support (`@username`).** Out of scope for D, but worth not foreclosing: do not add a `mentions jsonb` column in D.2 — adding it later is a non-breaking ALTER. If we want mentions in D.3+, the JSON shape `[{ user_id, username, offset, length }]` is conventional.
6. **Profanity / moderation.** Out of scope for D. Note for the future: Supabase has no built-in moderation; adding it means either an edge function on insert (sync, can reject) or a post-insert review queue.
7. **Read receipts / "seen by author".** Out of scope.
8. **`seller_id` denormalization.** Should `comments` carry `seller_id` for per-seller "all comments on my listings" queries? D.6+ "X commented on your listing" push needs this lookup; doing it via `comments → products → sellers` is two joins. Recommendation: keep S1 as-is (no `seller_id`) because the join is already cheap with the existing indices, and the lookup happens once per push (not in a hot loop).
9. **Should D.2 also tighten products grants** (§2 self-elevation)? Recommendation: **yes, in the same migration** — minimal, mechanical, and naturally co-located with the new SECURITY DEFINER trigger that needs the tightening to be load-bearing.
10. **Where is the `CommentsSheet` mounted at app level?** Likely in the same root that mounts `ProductDetailSheet`. D.4 should confirm and mount alongside.

---

## TL;DR for D.2 onward

- Comment-related code is greenfield except for the read-only `comments_count` column (§1, §2). The action-rail comment button is a no-op.
- `products.comments_count` is in scope for the same self-elevation cleanup that `sellers` got in B.1.5; tighten in D.2 (§2).
- Mirror **`follows`** for the trigger (SECURITY DEFINER + pinned `search_path`); mirror **`likes`** for the counter math and CASCADE chain (§3).
- Realtime is reusable as-is (§4). Push infra is ready for a future "X commented on your listing" follow-up (§5).
- Keep the existing base-`BottomSheet` + Zustand idiom (§6).
- Optimistic shape is **prepend with id-swap**, not toggle (§7).
- Recommended schema: **S1 — flat, hard-delete** (§8, §9, §10).
- Recommended UI: **U1 — bottom sheet at 90% snap** (§11).
