# Profile Audit — Step B.1

Read-only reconnaissance of the Profile tab, the `public.sellers` table (de-facto user profile per G.1), existing edit affordances, avatar handling, and adjacent auth flows. No code or schema changes. Recommends a design direction for the Edit Profile experience that B.2 / B.3 / B.4 will implement.

> **Source-of-truth note.** Schema columns are taken from the committed generated types at `src/types/supabase.ts` (Op.1). Defaults, constraints and policies are cross-referenced against the migration files under `supabase/migrations/`.

---

## 1. Current State

### 1.1 Tab route → file

The bottom-tab `profile` route renders a single screen for the **current user only**. There is no "view another user's profile" mode here — public seller profiles live at a different route (`/(protected)/seller/[id]`).

| Tab name (CustomTabBar) | Route slug | File |
| --- | --- | --- |
| Profil | `profile` | [src/app/(protected)/(tabs)/profile.tsx](src/app/(protected)/(tabs)/profile.tsx) |

Nav entry: [src/app/(protected)/(tabs)/_layout.tsx](src/app/(protected)/(tabs)/_layout.tsx) registers `profile` as a tab; the tab bar UI is `CustomTabBar` from [src/components/navigation/CustomTabBar.tsx](src/components/navigation/CustomTabBar.tsx).

### 1.2 Component tree

`ProfileScreen` ([profile.tsx:98](src/app/(protected)/(tabs)/profile.tsx#L98)) is a single `<ScrollView>` with conditional sections, no sub-routes, no bottom sheets:

```
<View bg=#000 paddingTop=safeArea>
  <ScrollView>
    if isAuthenticated:
      <Text>profile.title</Text>                      // "Profile"
      <Text>{user.email}</Text>
    else:
      guest header  → CTAs to /(auth)/login & /(auth)/register

    Section: profile.settings
      Row: profile.language → fr | en pill toggle

    if isAuthenticated:
      Section: myListings.title
        SellerProductCardSkeleton x4 (loading)
        | empty text
        | FlatList numColumns=2 of SellerProductCard (showOwnerActions)
            → onEdit  → router.push /(tabs)/newPost?editId=...
            → onDelete → Alert → useDeleteProduct mutation

      Section: orders.title
        ActivityIndicator (loading)
        | empty text
        | <View> map of OrderRow (thumb, title, amount, date, status pill)

      Section: profile.account
        <Pressable storefront-outline> "sellerProfile.edit"
            → router.push /(protected)/edit-seller-profile
        <Pressable> "auth.signOut"
            → useAuthStore.logout(), router.replace /(tabs)
  </ScrollView>
</View>
```

Local sub-component in the same file: `OrderRow` ([profile.tsx:59](src/app/(protected)/(tabs)/profile.tsx#L59)).

### 1.3 Data fetched

| Hook | File | Invoked at | Purpose |
| --- | --- | --- | --- |
| `useRequireAuth()` | [src/stores/useRequireAuth.ts](src/stores/useRequireAuth.ts) | [profile.tsx:102](src/app/(protected)/(tabs)/profile.tsx#L102) | Reads Zustand auth state; provides `isAuthenticated`, `user`. |
| `useMyProducts(isAuthenticated)` | [src/features/marketplace/hooks/useMyProducts.ts](src/features/marketplace/hooks/useMyProducts.ts) | [profile.tsx:104](src/app/(protected)/(tabs)/profile.tsx#L104) | Listings owned by current seller. |
| `useMyOrders(isAuthenticated)` | [src/features/marketplace/hooks/useMyOrders.ts](src/features/marketplace/hooks/useMyOrders.ts) | [profile.tsx:105](src/app/(protected)/(tabs)/profile.tsx#L105) | Orders placed by current user. |
| `useDeleteProduct()` | [src/features/marketplace/hooks/useDeleteProduct.ts](src/features/marketplace/hooks/useDeleteProduct.ts) | [profile.tsx:106](src/app/(protected)/(tabs)/profile.tsx#L106) | Owner delete from listing list. |

> **Notable:** the Profile screen does **not** read from `sellers` itself. It shows `user.email` from `auth.users` and lists products/orders. The seller row is only fetched inside the `edit-seller-profile` route via `useMySeller()`. This is a gap the Edit Profile redesign should consider — there is no avatar, display-name, bio, location, rating or sales count surfaced on the Profile tab today.

### 1.4 Plain-language description

> "When signed in, you see the word *Profile*, your email, a language toggle (French / English), a 2-column grid of your own listings (with edit/delete affordances per card), a vertical list of your purchase orders with status pills, and a section at the bottom with two buttons: *Edit seller profile* (opens a separate stack screen with bio/website/phone/email inputs) and *Sign out*. When signed out, the screen shows a CTA stack to sign in or create an account, plus the same language toggle."

### 1.5 My-profile vs other-user profile

The tab is **my-profile only**. Other users' profiles render via [src/app/(protected)/seller/[id].tsx](src/app/(protected)/seller/[id].tsx) (read-only public view). The Edit Profile redesign should not entangle these two — the public seller card is a consumer of the same `sellers` row that the Edit Profile screen writes to.

---

## 2. `sellers` Table Schema

Source: [src/types/supabase.ts:367-437](src/types/supabase.ts#L367) (Row / Insert / Update). Defaults pulled from migration files.

### 2.1 Identity

| Column | TS type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `string` | no | `uuid_generate_v4()` | PK. The seller-record id (NOT the auth user id). Referenced by `products.seller_id` and `messaging` joins. |
| `user_id` | `string \| null` | yes | NULL | FK → `auth.users(id) ON DELETE CASCADE UNIQUE`. Added in [supabase/migrations/20260503_sell_setup.sql:2-4](supabase/migrations/20260503_sell_setup.sql#L2). 1:1 with `auth.users`. |
| `name` | `string` | no | (none — required on insert) | Display name. Required by initial schema. |
| `created_at` | `string` | no | `now()` | Row creation timestamp. |

### 2.2 Profile / contact

| Column | TS type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| `avatar_url` | `string` | no | `''` (empty string) | Public URL string. Default empty string, not NULL. Added in initial schema. |
| `bio` | `string \| null` | yes | NULL | Free-form bio. Added in [supabase/migrations/20260508_seller_contact.sql:1-5](supabase/migrations/20260508_seller_contact.sql#L1). |
| `website` | `string \| null` | yes | NULL | Free-form URL. No format validation server-side. |
| `phone_public` | `string \| null` | yes | NULL | Public-facing phone (separate from `auth.users.phone`). |
| `email_public` | `string \| null` | yes | NULL | Public-facing email (separate from `auth.users.email`). |

### 2.3 Geo (G.1)

| Column | TS type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| `latitude` | `number \| null` | yes | NULL | Added in [supabase/migrations/20260513_geo_columns.sql](supabase/migrations/20260513_geo_columns.sql). Per G.6 / G.8: **no UI writes to this today.** |
| `longitude` | `number \| null` | yes | NULL | Same as above. |
| `location_text` | `string \| null` | yes | NULL | Reverse-geocoded label (city, country). |
| `location_updated_at` | `string \| null` | yes | NULL | Stale-marker for geo. |
| `location_point` | `unknown` | yes | (none) | PostGIS `geography(Point, 4326)`. Generated/maintained alongside lat/lng. |

### 2.4 Marketplace stats

| Column | TS type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| `verified` | `boolean` | no | `false` | Manually toggled (admin / future moderation). |
| `is_pro` | `boolean` | no | `false` | Pro-account flag. |
| `rating` | `number` | no | `0` | `numeric(3,2)`. No mutation pipeline yet. |
| `sales_count` | `number` | no | `0` | Currently no trigger/RPC mutates this. |

### 2.5 Stripe

| Column | TS type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| `stripe_account_id` | `string \| null` | yes | NULL | Connect account id. Added in [supabase/migrations/20260511_seller_stripe.sql](supabase/migrations/20260511_seller_stripe.sql). |
| `stripe_charges_enabled` | `boolean` | no | `false` | Mirrors Stripe capability state. |
| `stripe_payouts_enabled` | `boolean` | no | `false` | Mirrors Stripe capability state. |

### 2.6 Insert / Update variants

- **Insert** ([supabase.ts:391-413](src/types/supabase.ts#L391)) — only `name` is required; everything else is optional and falls back to its default.
- **Update** ([supabase.ts:414-436](src/types/supabase.ts#L414)) — all fields optional. No discriminator between server-managed (`rating`, `sales_count`, `stripe_*`) and user-editable columns; the policy layer is the only enforcement.

---

## 3. `sellers` RLS Policies

Source: migration files under `supabase/migrations/`. RLS is enabled on the table (initial migration enables it on every public table).

### 3.1 SELECT — public read

[supabase/migrations/20260501_initial_marketplace_schema.sql:91](supabase/migrations/20260501_initial_marketplace_schema.sql#L91)

```sql
create policy "sellers public read" on public.sellers for select using (true);
```

> Anyone (anon or authenticated) can read every row. This is intentional — public seller cards on listings need to render for unauthenticated browsers.

### 3.2 SELECT — user read own (redundant but explicit)

[supabase/migrations/20260503_sell_setup.sql:48-51](supabase/migrations/20260503_sell_setup.sql#L48)

```sql
create policy "sellers user read own" on public.sellers
  for select
  using (auth.uid() = user_id);
```

> Effectively a no-op given the public read policy already covers all SELECTs. Harmless.

### 3.3 UPDATE — own row

[supabase/migrations/20260508_seller_contact.sql:7-11](supabase/migrations/20260508_seller_contact.sql#L7)

```sql
create policy "sellers update own" on public.sellers
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

> The user can update **any column** on their own row, including server-managed fields (`rating`, `sales_count`, `verified`, `is_pro`, `stripe_*`). There is no column-level grant or policy guarding these. **Gap to flag for B.3:** if Edit Profile is the only writer, this is fine; if any client-side bug or malicious user attempts to set `verified=true` or bump `rating`, the DB will accept it. Mitigation options are revoking column-level UPDATE on sensitive columns or moving updates through a `SECURITY DEFINER` RPC that whitelists fields.

### 3.4 INSERT

> **No INSERT policy exists on `sellers`.** The only path that creates a seller row is the `SECURITY DEFINER` RPC `get_or_create_seller_for_current_user` ([supabase/migrations/20260503_sell_setup.sql:7-34](supabase/migrations/20260503_sell_setup.sql#L7)), which bypasses RLS by design. This is the right pattern; no client should INSERT directly.

### 3.5 DELETE

> **No DELETE policy exists on `sellers`.** Deletion happens via `ON DELETE CASCADE` from `auth.users(id)` (i.e., when the user is deleted from `auth`, their seller row is removed). The "delete account" flow does not exist client-side yet (see §6).

---

## 4. Existing Edit Affordances

> **An Edit Seller Profile screen already exists.** This was not flagged in the task brief, so worth surfacing first: B.2 is not greenfield — it is a redesign / replacement / expansion.

### 4.1 The route

[src/app/(protected)/edit-seller-profile.tsx](src/app/(protected)/edit-seller-profile.tsx) — full-screen stack route reached from the Profile tab via the *"Edit seller profile"* button at [profile.tsx:162-165](src/app/(protected)/(tabs)/profile.tsx#L162).

### 4.2 What it edits

Vanilla `useState` form with four fields:

| Form field | Bound to (seller column) | Input | Validation |
| --- | --- | --- | --- |
| Bio | `bio` | multiline `TextInput` (4 rows) | none |
| Website | `website` | URL `TextInput` | none |
| Phone | `phone_public` | phone-pad `TextInput` | none |
| Email | `email_public` | email `TextInput` | none |

### 4.3 Mutation pattern

Mutation hook: [src/features/marketplace/hooks/useUpdateMySeller.ts](src/features/marketplace/hooks/useUpdateMySeller.ts) wrapping the service `updateMySeller` at [src/features/marketplace/services/sellers.ts:95-118](src/features/marketplace/services/sellers.ts#L95).

The service:
1. Calls `auth.getUser()` to fetch the current user.
2. Calls RPC `get_or_create_seller_for_current_user` (idempotent) to ensure a seller row exists.
3. Builds a sparse `patch` containing only fields the caller passed (empty strings → NULL).
4. `from('sellers').update(patch).eq('user_id', u.user.id)`.

On success, both `useMySeller` and the `seller-by-id` query keys are invalidated.

### 4.4 What is NOT currently edited

The existing form does not write any of: `name`, `avatar_url`, `latitude`, `longitude`, `location_text`, `location_point`. These will need new form sections in B.2 / B.3 / B.4. There is also no form for changing email, password, or display name, and no destructive *delete account* flow.

### 4.5 Other writers of `sellers`

| File:line | Operation | Columns |
| --- | --- | --- |
| [src/features/marketplace/services/sellers.ts:113-116](src/features/marketplace/services/sellers.ts#L113) | UPDATE | `bio`, `website`, `phone_public`, `email_public` (only fields explicitly set) |
| RPC `get_or_create_seller_for_current_user` ([20260503_sell_setup.sql:7-34](supabase/migrations/20260503_sell_setup.sql#L7)) | INSERT (server-side, security definer) | `name`, `avatar_url`, `user_id` |

No other `from('sellers').update(...)` or `from('sellers').insert(...)` exists in the codebase.

---

## 5. Avatar / Image Handling

### 5.1 Schema

`sellers.avatar_url` exists as a `text NOT NULL DEFAULT ''` column ([20260501_initial_marketplace_schema.sql:21-30](supabase/migrations/20260501_initial_marketplace_schema.sql#L21)). It already accommodates a public URL — **no migration needed for the column itself**.

### 5.2 Read path

The mapper `rowToSeller` ([sellers.ts:35-50](src/features/marketplace/services/sellers.ts#L35)) maps `row.avatar_url` → `SellerProfile.avatarUrl: string` (passes through empty string verbatim, does not coerce to undefined).

`avatar_url` / `avatarUrl` is consumed in (non-exhaustive):

| File | Role |
| --- | --- |
| [src/components/GenericComponents/Avatar.tsx](src/components/GenericComponents/Avatar.tsx) | Renders avatar image with initial-letter fallback. |
| [src/components/feed/SellerPill.tsx](src/components/feed/SellerPill.tsx) | Seller pill on feed cards. |
| [src/features/marketplace/components/ProductFeedItem.tsx](src/features/marketplace/components/ProductFeedItem.tsx) | Product card in feed. |
| [src/features/marketplace/components/ProductDetailSheet.tsx](src/features/marketplace/components/ProductDetailSheet.tsx) | Bottom sheet showing seller. |
| [src/features/marketplace/components/SellerCard.tsx](src/features/marketplace/components/SellerCard.tsx) | Public seller card. |
| [src/app/(protected)/seller/[id].tsx](src/app/(protected)/seller/[id].tsx) | Public seller profile route. |
| [src/app/(protected)/conversation/[id].tsx](src/app/(protected)/conversation/[id].tsx) | Chat header / message authorship. |
| [src/features/marketplace/services/messaging.ts:105,156](src/features/marketplace/services/messaging.ts#L105) | Selects `name, avatar_url, verified, is_pro` for thread participants. |

### 5.3 `Avatar` component contract

[src/components/GenericComponents/Avatar.tsx](src/components/GenericComponents/Avatar.tsx)

Props:

```ts
type Props = {
  name: string;     // required — drives initial + fallback hue
  uri?: string;     // optional — direct URL (public, not signed)
  size?: number;    // optional — diameter in px (default 36)
};
```

Behavior:
- Renders `<Image source={{ uri }}>` when `uri` is truthy.
- On `onError` or empty `uri`, renders a colored circle with the first uppercase letter of `name`. Background colour is a deterministic hash over `name` from a 7-colour brand-leaning palette.
- **Expects a public URL.** No signed-URL refresh logic. Implication for B.3: avatars must come from a `public` Supabase Storage bucket, or the Edit screen must always normalise to a `getPublicUrl()` result before writing to `sellers.avatar_url`.

### 5.4 Write path — does not exist yet

No code in the codebase uploads an avatar:

- No `from('avatars')` reference anywhere.
- No `supabase.storage.from('avatars')` reference anywhere.
- The only storage usage is `supabase.storage.from('product-media').getPublicUrl(...)` ([sell.ts:67](src/features/marketplace/services/sell.ts#L67)) and `.remove(...)` from the same bucket ([products.ts:326](src/features/marketplace/services/products.ts#L326)).
- The `get_or_create_seller_for_current_user` RPC seeds the seller row with `avatar_url = ''`.

> **Gap to flag for B.3:** an `avatars` Storage bucket must be created with appropriate RLS (insert/update by owner, public read) before B.2 can ship a working avatar picker.

### 5.5 Image-picker dependencies

Already present in `package.json`:

| Package | Version | Purpose |
| --- | --- | --- |
| `expo-image-picker` | `~17.0.11` | Pick from camera roll / take photo. Wired in [newPost.tsx](src/app/(protected)/(tabs)/newPost.tsx). |
| `expo-camera` | `~17.0.10` | Used by newPost's camera flow. |

Not present (intentionally): `expo-document-picker`, `expo-file-system`, `react-native-image-crop-picker`, `react-hook-form`, `@tanstack/react-form`, `zod`. B.2 will need to either (a) reuse vanilla `useState` like every other form, or (b) introduce a form library — see §10.

### 5.6 `app.json` permissions

Permissions are already configured for image picking ([app.json](app.json)):

- `expo-image-picker` plugin: `photosPermission` string set.
- iOS `infoPlist`: `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`.
- Android: `CAMERA`, `RECORD_AUDIO`.

> No additional permission strings are required for an avatar picker — existing strings cover the case.

---

## 6. Auth-Adjacent Flows

The Zustand auth store is the single client-side gateway. There is **no** password-change, email-change, or delete-account UI.

### 6.1 Store

[src/stores/useAuthStore.ts](src/stores/useAuthStore.ts) — Zustand + `persist` (AsyncStorage). Exposes:

| Method | Supabase call | Used at |
| --- | --- | --- |
| `login(email, password)` | `supabase.auth.signInWithPassword` (line ~22) | [src/app/(auth)/login.tsx:36](src/app/(auth)/login.tsx#L36) |
| `register(email, password, username)` | `supabase.auth.signUp` (line ~47) | [src/app/(auth)/register.tsx:37](src/app/(auth)/register.tsx#L37) |
| `logout()` | `supabase.auth.signOut` (line ~76) | [profile.tsx:170](src/app/(protected)/(tabs)/profile.tsx#L170) |
| `syncAuthFromSupabase()` (free fn) | `supabase.auth.getSession` (~102) | [src/app/_layout.tsx:22](src/app/_layout.tsx#L22) |
| `subscribeToAuthChanges()` (free fn) | `supabase.auth.onAuthStateChange` (~124) | [src/app/_layout.tsx:22](src/app/_layout.tsx#L22) |

### 6.2 Guard

[src/stores/useRequireAuth.ts](src/stores/useRequireAuth.ts) — composes `useAuthStore` and exposes `requireAuth()` which `Alert`s an "Sign in" CTA pointing to `/(auth)/login` when called by an unauthenticated user. Profile screen consumes `{ isAuthenticated, user }`.

### 6.3 Sign-out UX

Current entry point: a pill button in the *Account* section ([profile.tsx:323-331](src/app/(protected)/(tabs)/profile.tsx#L323)). On tap → haptic, awaits `useAuthStore.getState().logout()`, then `router.replace('/(protected)/(tabs)')`. No confirmation dialog.

### 6.4 Missing flows (greenfield for B.2 / B.4)

| Flow | State | Notes |
| --- | --- | --- |
| Change password | Not implemented | Would call `supabase.auth.updateUser({ password })`. |
| Change email | Not implemented | Would call `supabase.auth.updateUser({ email })` → triggers Supabase verification email round-trip. |
| Forgot password / reset | Not implemented | Would call `supabase.auth.resetPasswordForEmail(email, { redirectTo })` from a reset screen. |
| Delete account | Not implemented | No client RPC and no admin endpoint exists. Requires a server-side function (`SECURITY DEFINER` Edge Function) to soft-delete from `auth.users`. |
| Block / report user | Not implemented | No `blocked_users` table exists. |

---

## 7. Related Sub-Screens

### 7.1 Settings

There is no `/settings` route. The text "Settings" appears as a section *label* in the Profile screen ([profile.tsx:217](src/app/(protected)/(tabs)/profile.tsx#L217)) under which only the language toggle lives. There is no notifications-prefs screen, no privacy screen, no blocked-users screen, no subscriptions screen. B.2 needs to decide whether to (a) lift these into a dedicated `/settings` stack, (b) keep folding them into the Profile tab as sections, or (c) split user-profile editing from app settings.

### 7.2 Auth screens

[src/app/(auth)/_layout.tsx](src/app/(auth)/_layout.tsx) — stack wrapper.
[src/app/(auth)/login.tsx](src/app/(auth)/login.tsx) — vanilla `useState` form (email + password). Loading flag, sync validation via `Alert`.
[src/app/(auth)/register.tsx](src/app/(auth)/register.tsx) — vanilla `useState` form (username + email + password). Same pattern.

### 7.3 Other protected stack routes

| Route | File | Status |
| --- | --- | --- |
| `/(protected)/edit-seller-profile` | [edit-seller-profile.tsx](src/app/(protected)/edit-seller-profile.tsx) | Functional — see §4. |
| `/(protected)/seller/[id]` | [seller/[id].tsx](src/app/(protected)/seller/[id].tsx) | Functional — public seller view. |
| `/(protected)/conversation/[id]` | [conversation/[id].tsx](src/app/(protected)/conversation/[id].tsx) | Functional — chat thread. |

### 7.4 Tab bar layout

[src/app/(protected)/(tabs)/_layout.tsx](src/app/(protected)/(tabs)/_layout.tsx) — Expo Router `<Tabs>` with custom bar from [src/components/navigation/CustomTabBar.tsx](src/components/navigation/CustomTabBar.tsx). `TAB_BAR_HEIGHT = 64`, raised central FAB for *Sell*. No header above the Profile screen — the Profile screen renders its own title text inline.

---

## 8. i18n Inventory

### 8.1 Defined keys (parity-checked)

`src/i18n/locales/en.json` and `src/i18n/locales/fr.json` define the same keys (no orphans).

**`profile.*`** (5 keys):
- `profile.title`
- `profile.settings`
- `profile.language`
- `profile.guestHeading`
- `profile.guestSubtitle`
- `profile.account`

**`sellerProfile.*`** (12 keys, all defined / all used):
- `sellerProfile.bio`
- `sellerProfile.website`
- `sellerProfile.phone`
- `sellerProfile.email`
- `sellerProfile.contactPro`
- `sellerProfile.edit`
- `sellerProfile.editTitle`
- `sellerProfile.editSubtitle`
- `sellerProfile.bioPlaceholder`
- `sellerProfile.websitePlaceholder`
- `sellerProfile.phonePlaceholder`
- `sellerProfile.emailPlaceholder`
- `sellerProfile.save`
- `sellerProfile.saving`
- `sellerProfile.saveSuccess`
- `sellerProfile.saveFail`

**`auth.*`** (relevant subset used on/around Profile):
- `auth.signIn`, `auth.createAccount`, `auth.signOut`, `auth.signInRequired.title`, `auth.signInRequired.message`, plus form-screen-specific keys.

### 8.2 Other namespaces touched by Profile screen

The Profile screen also reads keys from `myListings.*` and `orders.*`:

- `myListings.title`, `myListings.empty`, `myListings.delete`, `myListings.deleteConfirmTitle`, `myListings.deleteConfirmMessage`, `myListings.deleteFailed` ([profile.tsx:118-129, 259, 272](src/app/(protected)/(tabs)/profile.tsx#L118)).
- `orders.title`, `orders.empty`, `orders.statusPending`, `orders.statusPaid`, `orders.statusFailed`, `orders.statusCancelled`, `orders.statusRefunded` ([profile.tsx:45-49, 290-294](src/app/(protected)/(tabs)/profile.tsx#L45)).

These are out-of-scope namespaces and should remain untouched by B.2.

### 8.3 Likely new keys for B.2 / B.3 / B.4

(Reserve under a single, distinct namespace to avoid collisions — e.g., `editProfile.*` or extend `sellerProfile.*`.)

- Display name field + placeholder + helper.
- Avatar section: change photo, take photo, choose from library, remove photo, uploading…, upload failed.
- "Where I sell from" section: pick on map, current location, change, last updated, none set.
- Account section: change password, change email, sign out, delete account, delete confirm title/body/cta, deletion success.
- Form-level: unsaved changes title/body/discard/cancel, save, saving…, save success, save failed.

### 8.4 Naming-collision watchouts

- Don't add `profile.account` siblings ambiguously — that key already labels the section that hosts the *Edit seller profile* + *Sign out* buttons today.
- Don't reuse `sellerProfile.edit` for a button label inside the new editor; that key is the **entry-point** label on the Profile tab.

---

## 9. Design Directions

Calibrated to the brand: premium dark surfaces, glassy backdrops, generous spacing, motion-aware micro-interactions, and an unhurried feel.

### D1 — Dedicated stack route, single-screen sectioned form *(recommended)*

- **Surface:** new stack route `/(protected)/profile/edit` (replaces the existing `edit-seller-profile.tsx`, or supersedes it via re-export).
- **Layout:** single scrollable screen with logical sections — *Identity* (avatar + display name), *About* (bio), *Where I sell from* (a small map preview + city label + "Change" pill), *Contact* (phone, email, website), *Account* (change password, change email, sign out, delete account at the bottom in a destructive-tinted footer).
- **Save model:** atomic. A single "Save" button in the header right; disabled until form is dirty; "Discard changes?" confirm sheet on back-navigation when dirty.
- **Avatar editing:** inline at the top of the *Identity* section. Tapping the avatar opens an action sheet (Take photo / Choose from library / Remove). Upload runs immediately; the avatar URL is written to `sellers.avatar_url` on success and the rest of the form is unaffected. A placeholder ring shows upload progress.
- **"Where I sell from":** its own section between bio and contact. A static map snapshot (or just a pill with the current `location_text` and a `chevron-right`) opens the location picker sheet from G.6's vocabulary; on save, persists `latitude / longitude / location_text / location_point`. The sell form (G.8) reads this as the default if set.
- **Auth actions placement:** in this same screen, footer *Account* section. Sign out is a full-width neutral button; *Delete account* is a small text link in destructive red below it with a confirmation sheet.
- **Trade-offs:** more fields visible at once means more cognitive load; mitigated by section dividers and the fact that most users only edit one field at a time. One screen to maintain; one mutation to wire.

### D2 — Bottom sheet from the Profile tab, autosave-on-blur

- **Surface:** snap-to-large bottom sheet from a *Edit profile* button on the Profile tab; no route change.
- **Layout:** scrollable sheet with the same sections as D1.
- **Save model:** autosave on blur per field; small toast on success.
- **Avatar editing:** inline at the top.
- **"Where I sell from":** a row inside the sheet that opens the location picker as a stacked sheet.
- **Auth actions placement:** *not* in this sheet — sign out / change password / delete account live in a sibling *Settings* sheet so the edit sheet stays focused on the profile object.
- **Trade-offs:** autosave is forgiving but creates many tiny network writes and complicates dirty-state UX (validation errors in mid-typed phone numbers, etc.). Two surfaces (edit + settings) means two i18n sets and two sheets to maintain.

### D3 — Multi-step wizard for first-time setup, single-screen on edit

- **Surface:** a 4-step wizard (Identity → Photo → Where I Sell From → Contact) when the seller row is freshly created (`avatar_url === ''` and no bio/location); thereafter falls back to a sectioned edit screen like D1.
- **Save model:** wizard saves after each step; subsequent edits use D1's atomic save model.
- **Avatar editing:** dedicated step in the wizard; a section in the editor.
- **"Where I sell from":** dedicated step (helps onboard the geo feature for everyone, not just sellers who hunt for it).
- **Auth actions:** outside the wizard entirely — they live on the editor / a separate settings route.
- **Trade-offs:** noticeably more polish, noticeably more code. Two parallel UIs (wizard + editor) means double the QA matrix. Worth it only if onboarding completion is a measured KPI.

### Recommendation: **D1**

D1 matches the brand brief (one calm surface, generous spacing, no modal-on-modal) and the codebase's prevailing form pattern (vanilla `useState` + atomic submit, used by the existing `edit-seller-profile.tsx`, `newPost.tsx`, and the auth screens). It scopes the work for B.2 / B.3 / B.4 cleanly: B.2 owns the screen + form, B.3 owns the avatar storage bucket + RLS + write path, B.4 owns the geo "where I sell from" section that hooks into the existing G.6 picker. D2's autosave is over-engineered for a profile that changes monthly at most, and D3's wizard duplicates UI we'd have to maintain forever for an onboarding moment we don't yet measure.

---

## 10. Open Questions

1. **Display name as `sellers.name` only, or introduce a `handle` column for uniqueness?** Today `name` is free-form, mutable, non-unique. `@handles` are stylistically on-brand for a marketplace but require a migration, a uniqueness constraint, and a "handle taken" UI. **Decision needed for B.2 / B.3.**

2. **Avatar storage bucket — does it exist?** No `from('avatars')` reference exists in code. B.3 must create a `public.avatars` Storage bucket (or chosen name) with RLS: public SELECT, authenticated INSERT / UPDATE / DELETE on objects whose path begins with `<auth.uid()>/`. Confirm whether to namespace per-user or per-seller.

3. **`avatar_url` storage convention.** Should the column store (a) the bucket-relative key (so we can switch between public/signed URLs later), or (b) the full public URL (current convention from `product-media`)? Today's renderers expect a fully-qualified URL in `Avatar.uri`. Picking (b) is consistent and zero-effort; picking (a) needs a `getPublicUrl()` call on every read.

4. **Email change UX.** `supabase.auth.updateUser({ email })` triggers a confirmation email round-trip. Should the editor show a "Pending verification" badge and store the new email out-of-band, or punt the flow to a dedicated screen with explicit "we sent you an email" affordance? Recommend dedicated screen.

5. **`phone_public` privacy default.** Today the column is on `sellers` and exposed via the public read RLS — anyone can fetch any seller's phone. If we add it to the editor, do we add an opt-in toggle? Or rename to make the public-facing nature obvious? Audit shows it's read by [`SellerCard`](src/features/marketplace/components/SellerCard.tsx) and [`ProductDetailSheet`](src/features/marketplace/components/ProductDetailSheet.tsx) for "Contact pro" buttons — it is genuinely public today.

6. **Form library.** Every form in the codebase is vanilla `useState`. Introducing `react-hook-form` here would set a precedent that other screens won't follow until they're rewritten. Recommend sticking with `useState` for B.2 to maintain consistency, with a small ad-hoc `useDirtyForm` helper for atomic save + discard-confirm UX.

7. **Save granularity.** Atomic (D1) keeps the "Save" button as a clear commitment moment. Per-section save (one mutation per section) reduces the blast radius of validation errors but breaks the single-screen mental model. Recommend atomic.

8. **Server-managed columns vs. permissive RLS (§3.3).** The `sellers update own` policy lets the user write to `verified`, `is_pro`, `rating`, `sales_count`, `stripe_*`. B.2 should never include these in its `patch` shape, and B.3 should consider tightening the policy with a column-level `GRANT` revoke or moving updates through a `SECURITY DEFINER` RPC that whitelists `(name, avatar_url, bio, website, phone_public, email_public, latitude, longitude, location_text)`.

9. **Delete account.** Requires a server-side path because `auth.users` cannot be deleted from a client. Likely an Edge Function or a `SECURITY DEFINER` RPC in `service_role`-only context. Where does the entry point live (footer of editor? separate `/settings/account`?) and what is the confirmation copy?

10. **`location_point` write path.** PostGIS `geography(Point, 4326)` columns can be written from the client as `ST_SetSRID(ST_MakePoint(lng, lat), 4326)` via RPC, or via a `BEFORE UPDATE` trigger that derives `location_point` from `latitude / longitude`. Confirm with G.1's author which strategy was intended; the geo migration may already include a trigger that B.4 doesn't need to reinvent.

11. **Public seller-by-id route mirror.** The existing public profile at `/(protected)/seller/[id]` reads the same `sellers` row. After B.2 adds avatar / location fields to the editor, those fields should also surface on the public route — confirm that's part of B.2 scope or deferred.
