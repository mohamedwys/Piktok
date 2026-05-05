# PROJECT_AUDIT.md

Read-only architecture audit of the existing React Native project, produced before any TikTok-style Marketplace transformation. No source files were modified.

> **Important finding up front:** this repo is **already** a TikTok-style marketplace. The vertical product/video feed, right-side action rail, seller cards, Supabase-backed data, sell flow, messaging, and orders are all in place. Subsequent transformation steps should treat this as a refactor/extension, not a greenfield build.

---

## 1. Repo Overview

| Field | Value |
| --- | --- |
| Repo root path | `C:/Users/MwL/Desktop/hubb` |
| `package.json` name | `client` |
| App display name (`app.json`) | `Pictok` |
| Slug | `client` |
| iOS bundle id | `com.pictok.client` |
| Android package | `com.pictok.client` |
| Expo SDK | `~54.0.34` ✅ (matches required SDK 54) |
| React Native | `^0.81.5` |
| React | `^19.1.0` |
| TypeScript | `~5.9.2`, `strict: true`, paths alias `@/* → ./src/*` |
| Routing | `expo-router ~6.0.23` with `experiments.typedRoutes: true` |
| Reanimated 4 + worklets enabled | yes |
| `experiments.reactCompiler` | enabled |

The app entrypoint is `expo-router/entry`. Source lives under `src/`, with `expo-router` configured to read routes from `src/app/` (Expo SDK 54 default for projects that use `src`).

---

## 2. Dependencies Snapshot

```text
Navigation
  expo-router                            ~6.0.23
  @react-navigation/native               ^7.1.8
  @react-navigation/bottom-tabs          ^7.4.0
  @react-navigation/elements             ^2.9.10
  react-native-screens                   ~4.16.0
  react-native-safe-area-context         ~5.6.2

State / data
  zustand                                ^5.0.12
  @tanstack/react-query                  ^5.95.2
  @react-native-async-storage/async-storage  2.2.0

Backend / API
  @supabase/supabase-js                  ^2.100.1
  react-native-url-polyfill              ^3.0.0

Media / video / images
  expo-video                             ~3.0.16
  expo-image                             ~3.0.11
  expo-image-picker                      ~17.0.11
  expo-camera                            ~17.0.10

UI / interactions
  @gorhom/bottom-sheet                   ^5.2.13
  react-native-gesture-handler           ~2.28.0
  react-native-reanimated                ~4.1.1
  react-native-worklets                  ^0.5.1
  react-native-svg                       15.12.1
  expo-blur                              ~15.0.8
  expo-linear-gradient                   ~15.0.8
  expo-haptics                           ~15.0.8
  expo-symbols                           ~1.0.8
  @expo/vector-icons                     ^15.0.3

Expo system
  expo                                   ~54.0.34
  expo-constants                         ~18.0.13
  expo-dev-client                        ~6.0.21
  expo-device                            ~8.0.10
  expo-font                              ~14.0.11
  expo-linking                           ~8.0.12
  expo-localization                      ~17.0.8
  expo-notifications                     ~0.32.17
  expo-splash-screen                     ~31.0.13
  expo-status-bar                        ~3.0.9
  expo-system-ui                         ~6.0.9
  expo-web-browser                       ~15.0.11

i18n
  i18next                                ^26.0.8
  react-i18next                          ^17.0.6

Web
  react-dom                              ^19.1.0
  react-native-web                       ~0.21.0

Dev tools
  @types/react                           ~19.1.10
  typescript                             ~5.9.2

Other / suspicious
  install                                ^0.13.0     ← almost certainly an accidental install (the npm package literally named "install")
  npx                                    ^10.2.2     ← same — `npx` is bundled with npm, this dependency should not be here
```

**Outdated relative to Expo SDK 54:** none of the Expo packages appear out-of-band — every `expo-*` version range matches the Expo SDK 54 manifest.
**Notable absences for the next steps:** no `@shopify/flash-list`, no `expo-file-system` listed explicitly (yet `sell.ts` imports `File` from `expo-file-system`; it is present transitively because `expo` SDK 54 bundles it).

---

## 3. Expo Router Structure

Router root = `src/app/`. Stack-based root, with two grouped segments: an unauthenticated `(auth)` group and a permissive `(protected)` group that does **not** gate routing on auth (per-action gating is done with `useRequireAuth`).

```text
src/app/
├── _layout.tsx                 Root <Stack>; wraps app in ErrorBoundary,
│                               GestureHandlerRootView, ThemeProvider (dark),
│                               QueryClientProvider; runs initI18n() and
│                               syncAuthFromSupabase() on mount; subscribes
│                               to Supabase auth changes; calls
│                               usePushNotifications().
│
├── (auth)/
│   ├── _layout.tsx             Stack; redirects to "/" if already authed.
│   ├── login.tsx               Email/password sign-in via useAuthStore.
│   └── register.tsx            Email/password + username sign-up.
│
└── (protected)/
    ├── _layout.tsx             Stack with no auth gate (free browsing).
    │                           Mounts <ProductDetailSheet /> globally.
    │
    ├── (tabs)/
    │   ├── _layout.tsx         Bottom tab bar with custom curved SVG
    │   │                       background; 5 tabs (Home, Categories,
    │   │                       SellButton, Inbox, Profile); haptic on
    │   │                       tabPress.
    │   ├── index.tsx           Home: dual-feed (For You video feed using
    │   │                       posts.json + Marketplace product feed),
    │   │                       top-bar TopFeedSwitch, search → opens
    │   │                       MarketplaceFilterSheet.
    │   ├── friends.tsx         Categories grid (despite the filename).
    │   │                       Tapping a category sets filters and switches
    │   │                       to Marketplace tab.
    │   ├── newPost.tsx         "Sell" form — pick image/video, fill
    │   │                       title/description/price/category/etc., create
    │   │                       or edit a product (handles ?editId=).
    │   ├── inbox.tsx           Conversations list. Sign-in CTA when guest.
    │   └── profile.tsx         Profile + settings + my listings + my orders;
    │                           sign-in / sign-out; language switcher; link
    │                           to edit-seller-profile.
    │
    ├── conversation/
    │   └── [id].tsx            Dynamic route — chat screen for one
    │                           conversation (messages + send box).
    │
    ├── seller/
    │   └── [id].tsx            Dynamic route — public seller profile with
    │                           grid of their products.
    │
    └── edit-seller-profile.tsx Edit own seller bio/website/phone/email.
```

| Aspect | Where |
| --- | --- |
| Root layout | `src/app/_layout.tsx` |
| Tab layout | `src/app/(protected)/(tabs)/_layout.tsx` |
| Auth-protected routes | None gated at the route level; `useRequireAuth` is invoked per-action |
| Modal / sheet routes | No `presentation: "modal"` route is declared. Modal-like UI is implemented via `@gorhom/bottom-sheet` mounted globally (`ProductDetailSheet`, `MarketplaceFilterSheet`) and a React Native `<Modal>` inside `newPost.tsx` for the category picker. |
| Dynamic routes | `conversation/[id].tsx`, `seller/[id].tsx` |

---

## 4. Screens & Components Inventory

### Screens (route components)

| File | Renders |
| --- | --- |
| `src/app/(auth)/login.tsx` | Email/password login form. |
| `src/app/(auth)/register.tsx` | Username/email/password register form. |
| `src/app/(protected)/(tabs)/index.tsx` | Home with For You video feed + Marketplace product feed + top switch + filter button. |
| `src/app/(protected)/(tabs)/friends.tsx` | Categories grid. |
| `src/app/(protected)/(tabs)/newPost.tsx` | Sell / edit-listing form (media, attributes, pickup, location). |
| `src/app/(protected)/(tabs)/inbox.tsx` | Conversation list (auth-gated content). |
| `src/app/(protected)/(tabs)/profile.tsx` | Profile, language, my listings, my orders, sign-out. |
| `src/app/(protected)/conversation/[id].tsx` | Chat / messaging screen for a single conversation. |
| `src/app/(protected)/seller/[id].tsx` | Public seller profile + product grid. |
| `src/app/(protected)/edit-seller-profile.tsx` | Edit logged-in seller's bio/website/phone/email. |
| `src/features/marketplace/screens/MarketplaceScreen.tsx` | Vertical paged FlatList of products (the TikTok-style marketplace feed). Embedded inside Home. |

### Reusable components

| Component | Path | Purpose |
| --- | --- | --- |
| `ErrorBoundary` | `src/components/ErrorBoundary.tsx` | App-wide React error boundary with retry button. |
| `Avatar` | `src/components/GenericComponents/Avatar.tsx` | Circular avatar with image fallback to colored initial. |
| `CustomTabBarBackground` | `src/components/GenericComponents/CustomTabBarBackground.tsx` | SVG curved tab bar background with center cutout for the Sell button. |
| `ResponsiveContainer` | `src/components/GenericComponents/ResponsiveContainer.tsx` | Constrains content width on tablets. |
| `TopFeedSwitch` | `src/components/GenericComponents/TopFeedSwitch.tsx` | "For You / Marketplace" pill switch above the home feed. |
| `PostListItem` | `src/components/PostListItem.tsx` | Full-screen video item for the For You demo feed (uses `posts.json`). |
| `MarketplaceFeedSkeleton` | `src/features/marketplace/components/` | Skeleton placeholder for the product feed. |
| `MarketplaceFilterSheet` | `src/features/marketplace/components/` | Bottom-sheet for query/category/price/pickup/location filters. |
| `PriceCard` | `src/features/marketplace/components/` | Bottom-left price + buy/bookmark card overlay on the feed item. |
| `ProductActionRail` | `src/features/marketplace/components/` | Right-side TikTok-style like/comment/share/bookmark column. |
| `ProductBottomPanel` | `src/features/marketplace/components/` | Title + attributes chips panel that expands on tap. |
| `ProductDetailSheet` | `src/features/marketplace/components/` | Global bottom-sheet that shows full product details (mounted in `(protected)/_layout.tsx`). |
| `ProductFeedItem` | `src/features/marketplace/components/` | One full-screen feed item (video/image + overlays). |
| `SellerCard` | `src/features/marketplace/components/` | Top-overlay seller pill on a feed item. |
| `SellerProductCard` | `src/features/marketplace/components/` | Grid card on seller profile + my-listings. Optional owner edit/delete actions. |
| `SellerProductCardSkeleton` | `src/features/marketplace/components/` | Skeleton for the above. |

### Hooks (non-data)
| Hook | Path | Purpose |
| --- | --- | --- |
| `useDeviceLayout` | `src/hooks/useDeviceLayout.ts` | Returns width/height/isTablet/contentMaxWidth based on `useWindowDimensions`. |
| `usePushNotifications` | `src/hooks/usePushNotifications.ts` | Registers Expo push token, saves to Supabase, handles cold-start + foreground notification taps to navigate to the relevant conversation. |

### Utilities
| File | Purpose |
| --- | --- |
| `src/features/marketplace/utils/attributeIcon.ts` | Maps `iconKey` strings → MaterialIcons names. |
| `src/features/marketplace/utils/formatCount.ts` | TikTok-style "1.2K" count formatting. |
| `src/features/marketplace/utils/haptics.ts` | `lightHaptic` / `mediumHaptic` helpers around `expo-haptics`. |
| `src/features/marketplace/utils/timeAgo.ts` | Relative time formatter. |
| `src/i18n/getLocalized.ts` | Pulls `fr`/`en` value from `LocalizedString` (`{ fr, en }`). |

---

## 5. State Management

### Zustand stores

| Store | File | State keys | Actions | Purpose |
| --- | --- | --- | --- | --- |
| `useAuthStore` | `src/stores/useAuthStore.ts` | `user: User \| null`, `isAuthenticated: boolean` | `login(email, password)`, `register(email, password, username)`, `logout()` | Holds Supabase auth session mirror. **Persisted** to AsyncStorage under key `auth-storage`. Hydrated on boot via `syncAuthFromSupabase()` and kept in sync with `subscribeToAuthChanges()` in the root layout. |
| `useFilterSheetStore` | `src/stores/useFilterSheetStore.ts` | `isOpen: boolean` | `open()`, `close()` | Controls visibility of the filter bottom-sheet from the home top bar. |
| `useMainTabStore` | `src/stores/useMainTabStore.ts` | `mainTab: 'pour-toi' \| 'marketplace'` | `setMainTab(tab)` | Drives the top "For You / Marketplace" switch on the home screen. |
| `useMarketplaceFilters` | `src/stores/useMarketplaceFilters.ts` | `filters: { query, categoryId, subcategoryId, priceMax, pickupOnly, locationQuery }` | `setFilters(patch)`, `resetFilters()` | Marketplace search filters. **Persisted** under `marketplace-filters`. Exports helpers `hasActiveFilters`, `activeFilterCount`. |
| `useProductSheetStore` | `src/stores/useProductSheetStore.ts` | `productId: string \| null` | `open(productId)`, `close()` | Drives which product the global `ProductDetailSheet` is currently showing. |
| `useRequireAuth` | `src/stores/useRequireAuth.ts` | _hook, not a store_ — selects from `useAuthStore` | `requireAuth()` returns `boolean` and shows a sign-in alert if not authed. | Per-action auth gate used in feed buttons, sell, etc. |

### React Query hooks

All keys are scoped under `['marketplace', ...]` or `['messaging', ...]` or `['seller', ...]`.

| Hook | File | Query key | What it fetches / mutates | Consumers |
| --- | --- | --- | --- | --- |
| `useProducts` | `hooks/useProducts.ts` | `['marketplace', 'products', 'list']` | `listProducts({ limit: 20 })` | (exported, not directly used in the app — `useFilteredProducts` is used instead) |
| `useFilteredProducts` | `hooks/useFilteredProducts.ts` | `['marketplace', 'products', 'list', filters]` | `searchProducts(filters)` | `MarketplaceScreen` |
| `useProduct` | `hooks/useProduct.ts` | `['marketplace', 'products', 'byId', id]` | `getProductById(id)` | `newPost.tsx` (edit), `ProductDetailSheet` |
| `useMyProducts` | `hooks/useMyProducts.ts` | `['marketplace', 'my-products']` | `listMyProducts()` | `profile.tsx` |
| `useDeleteProduct` | `hooks/useDeleteProduct.ts` | mutation → invalidates my-products + list | `deleteProduct(id)` | `profile.tsx` |
| `useCreateProduct` | `hooks/useCreateProduct.ts` | mutation → invalidates list | `createProduct(payload)` | `newPost.tsx` |
| `useUpdateProduct` | `hooks/useUpdateProduct.ts` | mutation → invalidates list, my-products, byId | `updateProduct(id, input)` | `newPost.tsx` |
| `useUserEngagement` | `hooks/useUserEngagement.ts` | `['marketplace', 'engagement']` | `listUserEngagement()` (sets of liked/bookmarked product IDs) | `ProductActionRail`, `PriceCard`, `ProductDetailSheet` |
| `useToggleLike` | `hooks/useToggleLike.ts` | mutation w/ optimistic update on engagement key | `likeProduct` / `unlikeProduct` | `ProductActionRail` |
| `useToggleBookmark` | `hooks/useToggleBookmark.ts` | mutation w/ optimistic update on engagement key | `bookmarkProduct` / `unbookmarkProduct` | `PriceCard`, `ProductDetailSheet` |
| `useSeller` | `hooks/useSeller.ts` | `['seller', 'byId', id]` | `getSellerById(id)` | `seller/[id].tsx` |
| `useSellerProducts` | `hooks/useSellerProducts.ts` | `['seller', 'products', sellerId]` | `listProductsBySeller(sellerId)` | `seller/[id].tsx` |
| `useMySeller` | `hooks/useMySeller.ts` | `['marketplace', 'my-seller']` | `getMySeller()` | `edit-seller-profile.tsx`, `conversation/[id].tsx` |
| `useUpdateMySeller` | `hooks/useUpdateMySeller.ts` | mutation → invalidates my-seller + seller/byId | `updateMySeller(input)` | `edit-seller-profile.tsx` |
| `useConversations` | `hooks/useConversations.ts` | `['messaging', 'conversations']` | `listConversations()` + realtime invalidation via `subscribeToConversations` | `inbox.tsx` |
| `useConversation` | `hooks/useConversation.ts` | `['messaging', 'conversation', id]` | `getConversationById(id)` | `conversation/[id].tsx` |
| `useMessages` | `hooks/useMessages.ts` | `['messaging', 'messages', conversationId]` | `listMessages` + realtime via `subscribeToMessages` (live appends) | `conversation/[id].tsx` |
| `useSendMessage` | `hooks/useSendMessage.ts` | mutation → invalidates messages + conversations; also fires push notification | `sendMessage(...)` | `conversation/[id].tsx` |
| `useStartConversation` | `hooks/useStartConversation.ts` | mutation | `startOrGetConversation(productId)` (Supabase RPC) | `ProductDetailSheet` (and likely "Message seller" CTAs) |
| `useMyOrders` | `hooks/useMyOrders.ts` | `['marketplace', 'my-orders']` | `listMyOrders()` | `profile.tsx` |
| `useCreateCheckoutSession` | `hooks/useCreateCheckoutSession.ts` | mutation → invalidates my-orders | calls `create-checkout-session` Edge Function | likely `ProductDetailSheet` Buy CTA |

`QueryClient` is created once with default options in `src/app/_layout.tsx`.

---

## 6. Supabase Integration

| Aspect | Details |
| --- | --- |
| Client init | `src/lib/supabase.ts` — `createClient(SUPABASE_URL, SUPABASE_ANON_KEY)` with `AsyncStorage` for session persistence, `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`, `lock: processLock`. Imports `react-native-url-polyfill/auto`. Registers an `AppState` listener to start/stop auto-refresh on foreground/background. |
| Env vars consumed | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. (`.env` also defines a redundant `EXPO_PUBLIC_SUPABASE_KEY` that is not read by code.) |
| Auth wired up? | **Yes.** Sign-in/sign-up screens call `supabase.auth.signInWithPassword` / `supabase.auth.signUp`. `syncAuthFromSupabase()` hydrates the Zustand store on boot; `subscribeToAuthChanges()` keeps it live (TOKEN_REFRESHED, SIGNED_OUT). |
| Session persistence | Supabase persists in AsyncStorage; Zustand mirror is also persisted under `auth-storage` (kept in sync via the subscriber). |
| Auth provider component | None — there is no React context. The Zustand store + boot-time hydration replaces a provider. |
| Sign-in / sign-up screens | `src/app/(auth)/login.tsx`, `src/app/(auth)/register.tsx`. |
| Direct `.from()` patterns | Used throughout `src/features/marketplace/services/*` and `src/services/pushNotifications.ts`. |
| RPC calls | `get_or_create_seller_for_current_user(p_username, p_avatar_url)` (in `sell.ts`, `sellers.ts`, `messaging.ts`); `start_or_get_conversation(p_product_id)` (in `messaging.ts`). |
| Edge Functions invoked | `create-checkout-session` (orders), `send-push-notification` (messaging). |
| Realtime subscriptions | `subscribeToConversations` and `subscribeToMessages` in `messaging.ts`. Realtime is enabled in migration `20260509_messaging.sql` for `messages` and `conversations`. |

### Tables / functions / policies (from `supabase/migrations/`)

| Table | Created by | Notes |
| --- | --- | --- |
| `public.sellers` | `20260501_initial_marketplace_schema.sql` | Plus `user_id` column added in `20260503_sell_setup.sql`; `bio/website/phone_public/email_public` added in `20260508_seller_contact.sql`; `stripe_account_id`, `stripe_charges_enabled`, `stripe_payouts_enabled` added in `20260511_seller_stripe.sql`. |
| `public.products` | `20260501` | `pickup_available`, `location` added in `20260504`; `category_id`, `subcategory_id` (text) added in `20260505`. |
| `public.likes` | `20260501` | `(user_id, product_id)` PK. |
| `public.bookmarks` | `20260501` | `(user_id, product_id)` PK. |
| `public.conversations` | `20260509_messaging.sql` | Unique on `(product_id, buyer_id)`. |
| `public.messages` | `20260509_messaging.sql` | `kind in ('text','offer')`, optional `offer_amount`. |
| `public.orders` | `20260510_orders.sql` | Stripe ids + status enum (`pending/paid/failed/cancelled/refunded`). |
| `public.push_tokens` | `20260512_push_tokens.sql` | Expo push tokens, unique by token. |

Storage bucket: `product-media` (public read; authenticated write; owner delete via folder = `<user_id>/...`). Created in `20260503_sell_setup.sql`.

| Function (RPC / trigger) | Purpose |
| --- | --- |
| `public.on_like_change()` (trigger) | Atomically updates `products.likes_count`. (`20260502`) |
| `public.on_bookmark_change()` (trigger) | Atomically updates `products.bookmarks_count`. (`20260502`) |
| `public.on_message_inserted()` (trigger) | Updates `conversations.last_message_at` + `last_message_preview`. (`20260509`) |
| `public.get_or_create_seller_for_current_user(p_username, p_avatar_url)` (RPC) | Auto-creates a seller row for the current `auth.uid()`. (`20260503`) |
| `public.start_or_get_conversation(p_product_id)` (RPC) | Idempotent buyer→seller conversation creation. (`20260509`) |

| Policy area | Status |
| --- | --- |
| `sellers` | Public select; user can read own; user can update own. |
| `products` | Public select; insert/update/delete only by owner (via seller_id ↔ user mapping). |
| `likes`, `bookmarks` | Select/insert/delete only on own rows. |
| `conversations`, `messages` | Visible only to participants; messages insert only by sender participant. |
| `orders` | Buyers select own; sellers select where they are the seller. Inserts/updates only via Edge Function (service role). |
| `push_tokens` | Select/insert/update/delete own only. |
| Storage `product-media` | Public read, authenticated insert, owner delete (path = `<user_id>/...`). |

Tables referenced by client code (sanity check, via grep on `.from('...')`): `push_tokens`, `sellers`, `products`, `conversations`, `messages`, `orders`, `likes`, `bookmarks`. All present in migrations — no orphan references.

Edge Functions on disk (`supabase/functions/`): `create-checkout-session`, `stripe-webhook`, `send-push-notification`. All written in Deno/TypeScript.

---

## 7. Media & Video Capabilities

| Capability | Status |
| --- | --- |
| `expo-video` | **Installed** (`~3.0.16`) and used. `useVideoPlayer` + `<VideoView>` are used in: `src/components/PostListItem.tsx` (For You feed), `src/features/marketplace/components/ProductFeedItem.tsx` (marketplace feed), `src/app/(protected)/(tabs)/newPost.tsx` (sell preview). The Expo plugin `"expo-video"` is listed twice in `app.json` plugins array (harmless but worth tidying). |
| `expo-av` | Not installed. |
| `react-native-video` | Not installed. |
| `expo-image` | **Installed** (`~3.0.11`). Imports search shows it is **not** in active use yet — code uses RN `Image` everywhere. Available for migration. |
| `expo-image-picker` | Installed and used by the sell flow (`newPost.tsx`). |
| `expo-camera` | Installed (`~17.0.10`) and configured in `app.json` plugins. **No source file imports it yet** — it is wired up at the native config layer but not used in TypeScript code. |
| `@shopify/flash-list` | **Not installed.** Both feeds are RN `FlatList` with manual `getItemLayout`, `snapToInterval`, `windowSize`, etc. |
| `react-native-svg` | Installed; used by `CustomTabBarBackground`. |
| `expo-blur`, `expo-linear-gradient` | Installed and used in feed overlays. |

---

## 8. Navigation & UX Patterns

| Aspect | Details |
| --- | --- |
| Bottom tab bar | Yes — `src/app/(protected)/(tabs)/_layout.tsx`. Tabs: Home (`index`), Categories (file `friends`), Sell (`newPost`, center FAB), Inbox (`inbox`), Profile (`profile`). Custom translucent SVG background (`CustomTabBarBackground`) with a center cutout for a raised red FAB. |
| Header | All `<Stack>` and `<Tabs>` use `headerShown: false`. Each screen renders its own custom header. |
| Theme provider | `@react-navigation/native` `ThemeProvider` with `DarkTheme + primary: 'white'`. |
| Gestures | `react-native-gesture-handler ~2.28.0` mounted at the root via `GestureHandlerRootView`. Used implicitly by `@gorhom/bottom-sheet` and Expo Router. |
| Animations | `react-native-reanimated ~4.1.1` + `react-native-worklets ^0.5.1`. Used in `ProductFeedItem`, `ProductBottomPanel`, skeletons. |
| Bottom sheets | `@gorhom/bottom-sheet ^5.2.13` for `MarketplaceFilterSheet` (mounted in Home) and `ProductDetailSheet` (mounted globally in `(protected)/_layout.tsx`). |
| Top "feed switch" | `TopFeedSwitch` pill row in Home for For-You / Marketplace. |
| Haptics | `expo-haptics` wrapped in `lightHaptic` / `mediumHaptic`. Used liberally on tap. |
| Web browser | `expo-web-browser` is imported in `ProductDetailSheet` (likely for Stripe Checkout return URL handling). |

---

## 9. Theming & Styling

| Aspect | Details |
| --- | --- |
| Styling approach | React Native `StyleSheet.create` exclusively. No NativeWind, Tamagui, Restyle, styled-components, Emotion, Stitches, Unistyles, etc. |
| Theme tokens | None centralized. Color values are inlined in each file. `BRAND_PRIMARY = '#FE2C55'` is duplicated in ~8 files. Other repeated tokens: `'#000'` background, `'rgba(255,255,255,0.06)'` card, `'rgba(255,255,255,0.12)'` border. |
| `src/global.css` | Exists but defines only CSS custom properties (`--font-display`, etc.) for web. Not consumed by React Native. |
| Dark mode support | The app is **dark-only.** `userInterfaceStyle: 'automatic'` in `app.json`, but `ThemeProvider` is hard-coded to `DarkTheme` and every screen uses dark backgrounds. There is no light-mode color set anywhere. |
| Typography | No font registration via `expo-font` even though `expo-font` is in plugins. System font is used. |

---

## 10. Existing Marketplace-Adjacent Code

The marketplace is the dominant feature. All relevant code lives under `src/features/marketplace/` plus the supabase server-side artifacts.

| Path | Summary |
| --- | --- |
| `src/features/marketplace/screens/MarketplaceScreen.tsx` | The vertical TikTok-style product feed (FlatList with snapToInterval). |
| `src/features/marketplace/components/ProductFeedItem.tsx` | One full-screen feed item — video/image background, gradient overlay, mounts SellerCard, ProductActionRail, PriceCard, ProductBottomPanel. |
| `src/features/marketplace/components/ProductActionRail.tsx` | Right-side TikTok action column: like, comment, share, bookmark counts. |
| `src/features/marketplace/components/SellerCard.tsx` | Top overlay seller pill that links to seller profile. |
| `src/features/marketplace/components/PriceCard.tsx` | Bottom price + buy/bookmark card. |
| `src/features/marketplace/components/ProductBottomPanel.tsx` | Title + attribute-chip panel that expands on tap. |
| `src/features/marketplace/components/ProductDetailSheet.tsx` | Global bottom sheet for full product details (mounted in protected layout). |
| `src/features/marketplace/components/MarketplaceFilterSheet.tsx` | Search/filter bottom sheet. |
| `src/features/marketplace/components/MarketplaceFeedSkeleton.tsx` | Skeleton state for the feed. |
| `src/features/marketplace/components/SellerCard.tsx`, `SellerProductCard*` | Seller-side cards. |
| `src/features/marketplace/services/products.ts` | List/search/getById/like/bookmark/delete + `listUserEngagement` (returns `Set<string>` of liked & bookmarked IDs). Defines `AuthRequiredError`. |
| `src/features/marketplace/services/sell.ts` | Create/update product including media upload to `product-media` bucket using `expo-file-system`'s `File`. |
| `src/features/marketplace/services/sellers.ts` | Seller CRUD-ish: get-by-id, get-mine (auto-creates via RPC), update-mine, list-products-by-seller. |
| `src/features/marketplace/services/messaging.ts` | Conversations/messages list, send, realtime subscribe, `startOrGetConversation` RPC. |
| `src/features/marketplace/services/orders.ts` | `listMyOrders` + `createCheckoutSession` (calls Stripe edge function). Exports `StripeNotConfiguredError`. |
| `src/features/marketplace/types/product.ts` | The full `Product` type and supporting types. |
| `src/features/marketplace/data/categories.ts` | Static category tree (`auto`, `immo`, `home`, etc.) with localized labels — used by filter sheet, sell flow, and categories tab. |
| `src/app/(protected)/seller/[id].tsx` | Public seller profile screen + product grid. |
| `src/app/(protected)/conversation/[id].tsx` | Buyer↔seller chat screen. |
| `src/app/(protected)/(tabs)/inbox.tsx` | Conversations list. |
| `src/app/(protected)/(tabs)/newPost.tsx` | Sell / edit-listing form. |
| `src/app/(protected)/edit-seller-profile.tsx` | Edit seller bio/contact. |
| `src/data/posts.json` | Mock data for the legacy For You video feed. Not part of the marketplace. |
| `src/components/PostListItem.tsx` | Legacy For You video item — uses `posts.json`. Not connected to Supabase. |
| `src/services/posts.ts` | **Stub file** — `fetchPosts`, `uploadVideoToStorage`, `createPost` are declared but empty. Not used. |

---

## 11. Environment & Config

### `app.json`
- Name: **Pictok**, slug `client`, version `1.0.0`.
- `scheme: "client"` (used by `expo-linking` deep links).
- `userInterfaceStyle: "automatic"` (but app is rendered dark-only).
- iOS: bundle id `com.pictok.client`, build number 4, portrait-only, `requireFullScreen: true`, ITSAppUsesNonExemptEncryption=false.
  - Permissions: `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`.
- Android: package `com.pictok.client`, adaptive icon set, `predictiveBackGestureEnabled: false`. Permissions: `CAMERA`, `RECORD_AUDIO`.
- Web: static output, favicon set.
- Plugins: `expo-router`, `expo-video` (listed twice — duplicate but harmless), `expo-camera` (with permission strings + `barcodeScannerEnabled: true`), `expo-image-picker`, `expo-splash-screen` (Pictok red `#208AEF` background — note: not the app's brand red), `expo-font`, `expo-web-browser`, `expo-localization`, `expo-notifications` (color `#FE2C55`).
- `experiments`: `typedRoutes: true`, `reactCompiler: true`.
- `extra.eas.projectId`: `3bcee70c-5f94-474a-aebd-ce2ca085a75f`.

### `eas.json`
- Build profiles: `development` (dev client + internal), `preview` (apk, internal), `production` (auto-increment, app-bundle on Android, m-medium iOS resource class).
- `submit.production.ios`: appleId `hegedus.nocii@gmail.com`, ascAppId `6765927652`, appleTeamId `4N9X2HC97T`.
- `submit.production.android`: track `internal`, service-account at `./google-service-account.json`.

### `.env` variables (names only)
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_KEY` (declared but **not used** by code)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` (used)

### Other config files
- `metro.config.js` — sets `config.maxWorkers = 2`. Defaults otherwise.
- `tsconfig.json` — extends `expo/tsconfig.base`; strict; path alias `@/*` → `./src/*`, `@assets/*` → `./assets/*`; excludes `supabase/functions/**` (edge functions are Deno, not RN).
- `expo-env.d.ts` — Expo-generated.
- `scripts/reset-project.js` — Expo template reset script.
- `docs/server-setup.md` — runbook for deploying Stripe + push edge functions.

---

## 12. Risk & Reuse Map

### High collision risk — files the marketplace transformation will touch

- `src/app/(protected)/(tabs)/index.tsx` — already hosts the marketplace tab. Any change to feed UX flows through here.
- `src/app/(protected)/(tabs)/_layout.tsx` — bottom tab structure (5 tabs, raised Sell FAB). Adding/removing a tab requires editing here.
- `src/features/marketplace/screens/MarketplaceScreen.tsx` — switching from `FlatList` to `FlashList` or extracting paging logic happens here.
- `src/features/marketplace/components/ProductFeedItem.tsx` — every overlay decision touches this file.
- `src/features/marketplace/components/ProductActionRail.tsx`, `PriceCard.tsx`, `SellerCard.tsx`, `ProductBottomPanel.tsx` — overlay UI.
- `src/features/marketplace/services/products.ts` — `listProducts` / `searchProducts` / row-to-Product mapper. Any new column or query change goes here.
- `src/features/marketplace/types/product.ts` — `Product` shape; touching this propagates everywhere.
- `src/stores/useMarketplaceFilters.ts` — filter shape; touching it requires updating `MarketplaceFilterSheet`, `searchProducts`, AsyncStorage migration.
- `app.json` — plugin and permission edits.
- `package.json` — any new lib (e.g., FlashList) lands here.

### Safe to leave alone

- `src/components/ErrorBoundary.tsx`
- `src/components/GenericComponents/*` (Avatar, ResponsiveContainer, TopFeedSwitch, CustomTabBarBackground)
- `src/lib/supabase.ts`
- `src/i18n/*`
- `src/hooks/useDeviceLayout.ts`, `src/hooks/usePushNotifications.ts`
- `src/services/pushNotifications.ts`
- `supabase/migrations/*` (treat as append-only — only add new migrations)
- `supabase/functions/*` unless the payment / push contract changes
- `eas.json`, `metro.config.js`, `tsconfig.json`

### Existing patterns to REUSE (do not rebuild)

- **Auth:** `useAuthStore` + `syncAuthFromSupabase` + `subscribeToAuthChanges`. Per-action gating is already in `useRequireAuth`.
- **Query client:** instantiated in `_layout.tsx`. Wrap any new queries with the existing `QueryClientProvider` — do not create a second one.
- **Error boundary:** `<ErrorBoundary>` is already wired at the root.
- **Localized text:** `LocalizedString = { fr, en }` + `getLocalized(value, lang)` helper. Reuse on any new field.
- **Haptics:** `lightHaptic` / `mediumHaptic` helpers. Don't import `expo-haptics` directly.
- **Bottom sheets:** the `useFilterSheetStore` and `useProductSheetStore` "store-driven sheet" pattern is already in place — replicate it for any new global sheet.
- **Push notifications:** `sendPushNotification` already wraps the edge function. Reuse for new notification types.
- **Optimistic mutations:** `useToggleLike` / `useToggleBookmark` are clean templates for any new toggle.
- **`Avatar` component** — never reinvent; supports image-fallback-to-initial.
- **Categories tree** — `src/features/marketplace/data/categories.ts`. Treat as the source of truth for category UI; any new screen should consume this same tree.

---

## 13. Gaps & Open Questions

1. **What's still "TikTok-style" that we expect to do?** The repo is already a TikTok-style marketplace with a vertical product feed, right-side action rail, seller pill, price overlay, and dark theme. Before any further refactor, we need an explicit list of what is **still missing** vs. the target. (E.g., is the goal: switch to FlashList? Replace static categories with seller-driven tags? Add a "Following" feed? Add comments?)
2. **For-You video feed using `posts.json`** is still on the home screen behind the `pour-toi` tab. Is it kept, repurposed (video-first product feed), or removed? `src/services/posts.ts` is an empty stub — there is no plan for a real posts table yet.
3. **No comments table or hook** — `comments_count` exists on `products` but there is no table, RLS, mutation, or list hook. The "comment" button in `ProductActionRail` is decorative.
4. **No "follow seller" feature** — schema and code have no follows table or follow/unfollow.
5. **No share tracking** — `shares_count` on `products` is never written; the share button only triggers a haptic.
6. **`@shopify/flash-list` is not installed.** Both feeds use `FlatList` with snapToInterval. If we want sustained 60fps with dozens of feed items, we need to install FlashList.
7. **`expo-image` is installed but unused.** Migrating from `<Image>` → `<ExpoImage>` would help feed performance.
8. **`expo-camera` is configured but not used in any source file.** Either wire it up (in-app capture for sell flow) or remove the plugin/permission.
9. **`expo-video` plugin is listed twice in `app.json`.** Cosmetic; should be deduped.
10. **Suspicious deps:** `install` (^0.13.0) and `npx` (^10.2.2) are accidental — they are not used anywhere and `npx` is bundled with npm. They should be removed before any new dependency surgery.
11. **`.env` declares `EXPO_PUBLIC_SUPABASE_KEY`** which is dead. Should be removed.
12. **No theme tokens.** `BRAND_PRIMARY = '#FE2C55'` is duplicated in many files. Worth extracting to a single module before further UI work.
13. **No light-mode support** despite `userInterfaceStyle: 'automatic'`.
14. **No automated tests.** No `__tests__`, no Jest config, no Detox, no Playwright.
15. **`.gitignore` is committed**, but the repo also contains an oddly-named `C:UsersMwLDesktophubb` directory at the root (visible in `ls -la`) — looks like a stray Windows path artifact from a prior tool. Worth confirming it's not tracked before any structural refactor.
16. **`ThemeProvider` color tokens** declare `primary: 'white'` overriding `DarkTheme`. Make sure later UI work doesn't rely on the `colors.primary` from React Navigation theme (which would give pure white text under headers).

---

## Step 2 Changelog (2026-05-02)

Brand identity + design-system foundation. Brand accent is now electric lime `#CCFF00` (was TikTok red `#FE2C55`). Body text now defaults to Inter (was system). Audit cleanup folded in. No screens were redesigned.

### Files created
- `BRAND.md` — single source of truth for brand and design decisions.
- `src/theme/index.ts` — typed `theme` module with `colors`, `spacing`, `radii`, `typography`, `motion`, `elevation`, `zIndex`, `blur`, and `textVariants` token maps. To swap the brand accent, edit `colors.brand` here.
- `src/components/ui/Text.tsx` — base Text primitive with `display | title | body | caption | label` variants, all resolved through theme tokens. Default + named export. Existing `<Text>` usages were not migrated (they pick up Inter via `Text.defaultProps` instead).

### Files modified
- `src/app/_layout.tsx` — load Inter (400/500/600/700) and Fraunces (400/500/600) via `@expo-google-fonts/*` + `useFonts`; gate render on fonts ready; hide splash after fonts via `expo-splash-screen` (`preventAutoHideAsync` at module scope, `hideAsync` after ready); set `Text.defaultProps.style` and `TextInput.defaultProps.style` `fontFamily` to `Inter_400Regular` once, guarded against re-application on Fast Refresh.
- `app.json` — removed duplicate `expo-video` plugin entry (kept first occurrence with all options); changed `expo-notifications` color from `#FE2C55` to `#CCFF00`.
- `package.json` + `package-lock.json` — removed junk deps `install` and `npx`; added `@expo-google-fonts/inter`, `@expo-google-fonts/fraunces`. (`expo-blur`, `expo-font`, `expo-splash-screen` were already SDK-aligned and unchanged.)
- `.env` — removed dead `EXPO_PUBLIC_SUPABASE_KEY`; removed leading blank line.
- `.gitignore` — added `C:UsersMwLDesktophubb/` so the stray Windows-path directory stops surfacing in `git status`.
- BRAND_PRIMARY → `colors.brand` migration in 16 files: `src/services/pushNotifications.ts`, `src/components/ErrorBoundary.tsx`, `src/components/GenericComponents/Avatar.tsx` (palette member swapped), `src/features/marketplace/components/MarketplaceFilterSheet.tsx`, `src/features/marketplace/components/MarketplaceFeedSkeleton.tsx`, `src/features/marketplace/components/ProductActionRail.tsx`, `src/features/marketplace/components/ProductDetailSheet.tsx`, `src/app/(protected)/seller/[id].tsx`, `src/app/(protected)/(tabs)/_layout.tsx`, `src/app/(protected)/(tabs)/index.tsx`, `src/app/(protected)/(tabs)/profile.tsx`, `src/app/(protected)/(tabs)/newPost.tsx`, `src/app/(protected)/(tabs)/friends.tsx`, `src/app/(protected)/edit-seller-profile.tsx`, `src/app/(protected)/conversation/[id].tsx`, `src/app/(auth)/login.tsx`, `src/app/(auth)/register.tsx`. Local `BRAND_PRIMARY` constants deleted in every file that defined one.

### Files deleted
- None on disk. The `BRAND_PRIMARY` literals and the dead `EXPO_PUBLIC_SUPABASE_KEY` env var were removed inline.

### Dependencies added
- `@expo-google-fonts/inter` (^0.4.2)
- `@expo-google-fonts/fraunces` (^0.4.1)

### Dependencies removed
- `install` (^0.13.0) — junk
- `npx` (^10.2.2) — junk (npx ships with npm)

### Cleanup actions
- `app.json`: deduplicated `expo-video` plugin entry; brand color in notifications swapped to lime.
- `.env`: dead `EXPO_PUBLIC_SUPABASE_KEY` removed. No `.env.example` / `.env.*.local` siblings exist in the repo, so nothing else to touch.
- `package.json` + lockfile: junk `install` and `npx` deps removed via `npm uninstall`.

### Stray Windows-path directory `C:UsersMwLDesktophubb`
- Tracking state: **untracked.** `git ls-files` returned nothing under it; the directory contains only empty subfolders (`supabase/migrations`), no files.
- Source-code references: grepped the codebase for the literal string `C:UsersMwLDesktophubb` — only hit is in `PROJECT_AUDIT.md` itself (audit prose, harmless). No source file references it.
- Action taken: added `C:UsersMwLDesktophubb/` to `.gitignore` so it stops appearing in `git status`. Working-tree copy left intact per Step 2 instruction.
- **Recommendation for the user:** delete the directory manually from the working tree at your convenience. There is nothing in it. From a Windows shell: `rmdir /s /q "C:UsersMwLDesktophubb"`. From bash on Windows: `rm -rf "C:UsersMwLDesktophubb"`.

### Verification results
- `tsc --noEmit` → exit 0. Clean.
- `expo lint` → no project config existed before this step (running it triggers an auto-install of `eslint` + `eslint-config-expo`, which violates the "no other packages" constraint). The auto-install was rolled back; project remains lint-config-less, matching pre-Step-2 state. Lint check is N/A for this step.
- `npx expo export --platform ios --output-dir .expo/step2-bundle-check` → bundled successfully, single 5.92 MB iOS Hermes bundle, all Inter and Fraunces font files present in the asset graph. Bundle-check output cleaned up after verification.
- Simulator boot → **not run.** This is a Windows host (no iOS simulator). The user should boot on iOS / Android themselves and confirm: (a) splash hides only after fonts are ready (no font flash), (b) body text renders in Inter, (c) every previously red surface now renders lime.

### Screenshot
- **Not captured** — see simulator-boot note above. The user should capture and store at e.g. `docs/step-2-lime-feed.png` after their first boot.

### Deviations from planned tasks
- The task spec asked for an `expo-camera` plugin entry change to live "as-is"; no edit needed there. Fine.
- The task spec asked to install `expo-font`, `expo-splash-screen`, `expo-blur` via `npx expo install`. They were already on SDK-54-aligned versions; the install command was a no-op for those three (only the two Google Fonts packages were actually added). This matches the spec's intent ("ensure direct install for clarity") — they remain in `package.json` as direct deps.
- `expo lint` could not be honored without violating the "no other packages" constraint (it auto-installs eslint). Rolled back as documented above.
- Simulator boot + screenshot deferred to the user — see verification section.

### How to revert this step
A single `git revert` of the Step 2 commit fully reverses every change, including the deleted `BRAND_PRIMARY` constants. The added `@expo-google-fonts/*` packages and the removed `install` / `npx` packages will revert cleanly via the lockfile diff. The stray Windows-path directory entry in `.gitignore` reverts trivially; the directory itself is untracked and unaffected.

---

## Step 2.5 Changelog (2026-05-02) — Brand Accent Swap

Pure token swap. The brand accent moved from electric lime `#CCFF00` to burnt amber `#CC5500`, and `brandText` flipped from black to white so that white text on the brand fill passes WCAG AA. No screens, components, stores, queries, or routes were touched beyond what the swap implies.

### Tokens changed (old → new)

| Token | Before (Step 2) | After (Step 2.5) |
| --- | --- | --- |
| `colors.brand` | `#CCFF00` | `#CC5500` |
| `colors.brandPressed` | `#A8D400` | `#A8460A` |
| `colors.brandMuted` | `rgba(204,255,0,0.16)` | `rgba(204, 85, 0, 0.16)` |
| `colors.brandText` | `#000000` | `#FFFFFF` |

No other theme tokens were modified. Spacing, radii, typography, motion, elevation, blur, and zIndex are untouched.

### Files modified
- `src/theme/index.ts` — four brand-token values updated. `as const` preserved; `Theme` type still resolves correctly (`tsc --noEmit` clean).
- `app.json` — `expo-notifications` plugin color `#CCFF00` → `#CC5500`. No other lime hex remained in the file. JSON re-validated.
- `BRAND.md` — Color System section: prose updated (electric lime → burnt amber); token table updated. New subsection **Contrast & Text on Brand** documents the white-on-amber ratio (~5.2:1 → AA body / AAA large) and the rule that any `colors.brand` fill must use `colors.brandText` (not `text.primary` or `text.inverse`) for foreground.

### `colors.brand` consumer sites checked

Every site in source code that uses `colors.brand` as a fill, border, or icon foreground was inspected. Non-text surfaces (skeleton fills, switch tracks, borders, shadow color, notification dots, palette entries) are flagged "n/a foreground."

| # | File:line | Use | Foreground status |
| --- | --- | --- | --- |
| 1 | [src/components/ErrorBoundary.tsx:47](src/components/ErrorBoundary.tsx:47) | `retry` button bg | `retryText` literal `'#fff'` — flagged |
| 2 | [src/services/pushNotifications.ts:30](src/services/pushNotifications.ts:30) | Android notification `lightColor` | n/a foreground |
| 3 | [src/components/GenericComponents/Avatar.tsx:5](src/components/GenericComponents/Avatar.tsx:5) | Palette member (avatar bg fallback) | `initial` literal `'#fff'` — flagged |
| 4 | [src/app/(auth)/login.tsx:142](src/app/(auth)/login.tsx:142) | `submitButton` bg | `submitText:153` literal `'#fff'` — flagged |
| 5 | [src/app/(auth)/register.tsx:154](src/app/(auth)/register.tsx:154) | `submitButton` bg | `submitText:165` literal `'#fff'` — flagged |
| 6 | [src/app/(protected)/edit-seller-profile.tsx:226](src/app/(protected)/edit-seller-profile.tsx:226) | `submitButton` bg | `submitText:233` literal `'#fff'` — flagged |
| 7 | [src/app/(protected)/(tabs)/newPost.tsx:660](src/app/(protected)/(tabs)/newPost.tsx:660) | `ctaPrimary` bg | `ctaPrimaryText:668` literal `'#fff'` — flagged |
| 8 | [src/app/(protected)/(tabs)/newPost.tsx:750](src/app/(protected)/(tabs)/newPost.tsx:750) | `submitButton` bg | `submitText:758` literal `'#fff'` — flagged |
| 9 | [src/app/(protected)/(tabs)/profile.tsx:369](src/app/(protected)/(tabs)/profile.tsx:369) | `ctaPrimary` bg | `ctaPrimaryText:376` literal `'#fff'` — flagged |
| 10 | [src/app/(protected)/(tabs)/profile.tsx:425](src/app/(protected)/(tabs)/profile.tsx:425) | `pillActive` bg | `pillTextActive:439` literal `'#fff'` — flagged |
| 11 | [src/app/(protected)/(tabs)/profile.tsx:451](src/app/(protected)/(tabs)/profile.tsx:451) | `signOutButton` border | n/a foreground (text uses brand color, not on brand fill) |
| 12 | [src/app/(protected)/(tabs)/profile.tsx:459](src/app/(protected)/(tabs)/profile.tsx:459) | `signOutText` color (brand-on-transparent) | n/a (brand as foreground, not background) |
| 13 | [src/app/(protected)/(tabs)/_layout.tsx:109](src/app/(protected)/(tabs)/_layout.tsx:109) | `sellButton` (raised FAB) bg | FAB icon JSX literal `color="#fff"` — flagged |
| 14 | [src/app/(protected)/(tabs)/_layout.tsx:113](src/app/(protected)/(tabs)/_layout.tsx:113) | `sellButton` shadowColor | n/a foreground |
| 15 | [src/app/(protected)/(tabs)/_layout.tsx:126](src/app/(protected)/(tabs)/_layout.tsx:126) | `notificationDot` bg | n/a foreground |
| 16 | [src/app/(protected)/conversation/[id].tsx:252](src/app/(protected)/conversation/[id].tsx:252) | `bubbleMine` bg | `bubbleText:263` literal `'#fff'` (and JSX line 166 `'#fff'`) — flagged |
| 17 | [src/app/(protected)/conversation/[id].tsx:290](src/app/(protected)/conversation/[id].tsx:290) | `sendBtn` bg | send Ionicon JSX literal `color="#fff"` — flagged |
| 18 | [src/features/marketplace/components/MarketplaceFilterSheet.tsx:252](src/features/marketplace/components/MarketplaceFilterSheet.tsx:252) | `Switch` trackColor true | n/a foreground (native switch) |
| 19 | [src/features/marketplace/components/MarketplaceFilterSheet.tsx:371](src/features/marketplace/components/MarketplaceFilterSheet.tsx:371) | `chipActive` bg + border | `chipTextActive:383` literal `'#fff'` — flagged |
| 20 | [src/features/marketplace/components/MarketplaceFilterSheet.tsx:428](src/features/marketplace/components/MarketplaceFilterSheet.tsx:428) | `footerApply` bg | `footerApplyText:431` literal `'#fff'` — flagged |
| 21 | [src/features/marketplace/components/ProductDetailSheet.tsx:593](src/features/marketplace/components/ProductDetailSheet.tsx:593) | `ctaButton` bg | `ctaText:621` literal `'#fff'` — flagged |
| 22 | [src/features/marketplace/components/MarketplaceFeedSkeleton.tsx:94](src/features/marketplace/components/MarketplaceFeedSkeleton.tsx:94) | `railCircle` bg @ 0.4 opacity | n/a foreground (skeleton) |
| 23 | [src/features/marketplace/components/ProductActionRail.tsx:74](src/features/marketplace/components/ProductActionRail.tsx:74) | Liked-heart icon color | n/a (brand as foreground over media) |
| 24 | [src/features/marketplace/components/ProductActionRail.tsx:118](src/features/marketplace/components/ProductActionRail.tsx:118) | `buyCircle` bg | bag/chat Ionicon JSX literal `color="#fff"` — flagged |
| 25 | [src/app/(protected)/(tabs)/newPost.tsx:443,453,463](src/app/(protected)/(tabs)/newPost.tsx:443) | Three `Switch` trackColors | n/a foreground (native switch) |
| 26 | [src/app/(protected)/(tabs)/index.tsx:152](src/app/(protected)/(tabs)/index.tsx:152) | Filter `badge` bg | `badgeText:160` literal `'#fff'` — flagged |
| 27 | [src/app/(protected)/(tabs)/friends.tsx:76](src/app/(protected)/(tabs)/friends.tsx:76) | Category Ionicon `color` | n/a (brand as foreground on dark surface) |
| 28 | [src/app/(protected)/seller/[id].tsx:184](src/app/(protected)/seller/[id].tsx:184) | Avatar ring `borderColor` | n/a foreground (image content) |

### `text.inverse` → `brandText` replacements
**None.** Step 2 did not migrate any text colors to theme tokens — every brand-fill site uses literal `'#fff'` for its foreground. No source file consumes `colors.text.inverse` today, so there is nothing for amber to break in that direction. The `brandText` token was flipped to white preemptively so that future code introduced via the `Text` primitive will resolve correctly.

### Sites flagged for design review (white literal on brand fill)
The 15 sites tagged "flagged" in the table above currently render white text/icons on the new burnt amber via literal `'#fff'`. White on `#CC5500` measures ~5.2:1, which passes WCAG AA body, so the rendered output is **incidentally correct** for amber. Two issues to address in a later pass:

1. **They use the wrong abstraction.** The literal `'#fff'` should be `colors.brandText`. If we ever swap the accent again to a light color, `brandText` flips to black and every consumer follows; literals would silently regress contrast.
2. **The Step 2 spec was strict that only the brand color was to be migrated.** Per Step 2.5 Task 4, white-on-brand cases are flagged (not auto-edited) so design can sign off before changing semantics. A focused follow-up step should sweep these sites and migrate `'#fff'` → `colors.brandText` on brand fills.

### Verification results
- `tsc --noEmit` → exit 0. Clean.
- `npx expo export --platform ios --output-dir .expo/step25-bundle-check` → bundled successfully (5.92 MB Hermes). Bundle artifact removed after check.
- Grep — no `#CCFF00`, `#CDFF00`, or `\blime\b` references remain anywhere in source. Two historical mentions remain in `PROJECT_AUDIT.md` Step 2 changelog (intentional — Step 2 was the lime swap).
- App boot + screenshot **deferred to user** (Windows host has no iOS simulator). Boot the app to confirm every previously-lime surface now renders burnt amber and white text remains legible.

### Reversion command
A single `git revert` of the Step 2.5 commit returns the project to electric lime.
A `git revert` of the Step 2 commit (after first reverting Step 2.5) returns it to TikTok red.

---

## Step 3 Changelog (2026-05-02) — Coral Accent + Primitives

Two changes folded into one safe, additive step: the brand accent moved to **coral red `#FF5A5C`** (final accent decision), and a primitives library landed under [src/components/ui/](src/components/ui/) ready for Steps 4–7 to consume. No existing screens were redesigned; the only visible change in the running app is the accent shift from amber to coral.

### Tokens changed (old → new)

| Token | Step 2.5 | Step 3 |
| --- | --- | --- |
| `colors.brand` | `#CC5500` | `#FF5A5C` |
| `colors.brandPressed` | `#A8460A` | `#E04547` |
| `colors.brandMuted` | `rgba(204, 85, 0, 0.16)` | `rgba(255, 90, 92, 0.16)` |
| `colors.brandText` | `#FFFFFF` | `#FFFFFF` (unchanged value, contrast policy tightened — see BRAND.md) |

### Tokens added
- `colors.verified` = `#3B82F6` — verified-account check overlay.
- `colors.proBadge` = `#8B5CF6` — professional-seller badge fill.
- `colors.proBadgeText` = `#FFFFFF` — text/icon foreground on `proBadge`.
- `colors.glass.dark.bg` = `rgba(0, 0, 0, 0.45)`, `colors.glass.dark.border` = `rgba(255, 255, 255, 0.08)`.
- `colors.glass.darkStrong.bg` = `rgba(0, 0, 0, 0.6)`, `colors.glass.darkStrong.border` = `rgba(255, 255, 255, 0.10)`.

New exported types: `SpacingKey`, `RadiusKey`, `GlassVariant`, `BlurIntensityKey` (used by primitives).

### Primitives created (all under [src/components/ui/](src/components/ui/))

| Primitive | File | Summary |
| --- | --- | --- |
| `Pressable` | [Pressable.tsx](src/components/ui/Pressable.tsx) | RN `Pressable` + Reanimated 4 spring scale (`pressScale` default 0.96, `motion.spring.snappy`). Optional `haptic` prop (`light \| medium \| heavy`) fires `Haptics.impactAsync` on press. Forwards ref. |
| `Surface` | [Surface.tsx](src/components/ui/Surface.tsx) | Themed `View`. `variant` (`surface \| surfaceElevated \| surfaceOverlay`), `radius`, `padding`, `border` — all resolved through theme tokens. Uses `borderStrong` for `surfaceElevated`. |
| `GlassCard` | [GlassCard.tsx](src/components/ui/GlassCard.tsx) | iOS: `expo-blur` `BlurView` with `tint="dark"` and `intensity` from `theme.blur.intensity`. Android: solid `View` painted with `colors.glass.<variant>.bg` (Android native blur is unreliable). Always clipped via `overflow: 'hidden'`. Border defaults on. Variants `dark \| darkStrong`. |
| `Chip` | [Chip.tsx](src/components/ui/Chip.tsx) | Pill with optional leading/trailing icon + label. Variants `glass \| glassStrong \| filled \| outlined`. Sizes `sm \| md`. When `onPress` provided, wraps in `Pressable` with light haptic. Filled variant uses `brandText` foreground. |
| `IconButton` | [IconButton.tsx](src/components/ui/IconButton.tsx) | Circular icon button. Variants `glass \| filled \| ghost`. Sizes `sm` (36) / `md` (48) / `lg` (56). Optional `label` renders the `Text` `caption` variant beneath the circle. Defaults to `light` haptic on press. |
| `Avatar` | [Avatar.tsx](src/components/ui/Avatar.tsx) | Circular avatar via `expo-image`. Sizes `xs` (24) / `sm` (32) / `md` (44) / `lg` (64) / `xl` (96). Initials fallback when no `source` (uppercase first letter on `surfaceElevated`). Optional verified overlay (small blue circle with checkmark anchored bottom-right) using `colors.verified`. Optional `borderColor`. |

Index barrel at [src/components/ui/index.ts](src/components/ui/index.ts) re-exports each primitive plus its types. The previously existing `Text` primitive (Step 2) is also re-exported through the barrel.

### Files modified
- [src/theme/index.ts](src/theme/index.ts) — coral brand tokens, new `verified`/`proBadge`/`proBadgeText`/`glass.*` tokens, new exported types `SpacingKey`/`RadiusKey`/`GlassVariant`/`BlurIntensityKey`.
- [app.json](app.json:78) — `expo-notifications` color `#CC5500` → `#FF5A5C`. JSON revalidated.
- [BRAND.md](BRAND.md) — Color System rewritten for coral; **Contrast & Text on Brand** rewritten with the stricter coral policy (white on coral is icon-only / large-text only — body text on a brand fill must use `text.inverse`); token table updated to include `verified`, `proBadge`, `proBadgeText`, `glass.*`; new sections **Glass Surfaces** and **Status Tokens** added.

### Files created
- [src/components/ui/Pressable.tsx](src/components/ui/Pressable.tsx)
- [src/components/ui/Surface.tsx](src/components/ui/Surface.tsx)
- [src/components/ui/GlassCard.tsx](src/components/ui/GlassCard.tsx)
- [src/components/ui/Chip.tsx](src/components/ui/Chip.tsx)
- [src/components/ui/IconButton.tsx](src/components/ui/IconButton.tsx)
- [src/components/ui/Avatar.tsx](src/components/ui/Avatar.tsx) (separate from the legacy [src/components/GenericComponents/Avatar.tsx](src/components/GenericComponents/Avatar.tsx), which is still used by existing screens; the legacy one will be retired in Steps 4–7)
- [src/components/ui/index.ts](src/components/ui/index.ts) (barrel)

### `expo-haptics` install status
**Already installed** (`~15.0.8`). No `npx expo install` invocation needed; nothing added to `package.json`.

### Untouched (per constraints)
- No screens, components, stores, queries, or routes were modified beyond the theme/app.json hex swaps.
- No existing component was migrated to consume the new primitives — that work belongs to Steps 4–7.
- The existing `Text` primitive ([src/components/ui/Text.tsx](src/components/ui/Text.tsx)) and font loading in [src/app/_layout.tsx](src/app/_layout.tsx) were not modified.
- `Text.defaultProps` font wiring from Step 2 still holds.

### Verification results
- `tsc --noEmit` → exit 0. Clean.
- `npx expo export --platform ios --output-dir .expo/step3-bundle-check` → bundled successfully (5.92 MB Hermes). Bundle artifact removed after check.
- Grep — no `#CCFF00`, `#CDFF00`, `#CC5500`, `\blime\b`, `\bamber\b`, or `electric lime` references remain anywhere in source. The two historical mentions still live only in earlier `PROJECT_AUDIT.md` changelog sections (intentional history).
- App boot + screenshot **deferred to user** (Windows host has no iOS simulator). Boot the app to confirm every previously-amber surface now renders coral and the primitives compile against any test screen the user wants to spike.

### Reversion command
A single `git revert` of the Step 3 commit returns the project to burnt amber and removes the primitives library cleanly.

---

## Step 4 Changelog (2026-05-03) — Top Overlay Redesign

Reproduced the top region of the user's reference layout: a screen-level `MarketplaceHeader` (Pour toi pill, centered "Marketplace" title with white underline, glass Search button) and a per-item top overlay built from new `SellerPill` + `PriceCard` feed components composed of Step 3 primitives. The right action rail, bottom info section, bottom tab bar, every screen besides the marketplace home, and all data-layer code were left untouched.

### Pre-edit reconnaissance

Findings recorded so future steps don't have to re-discover this:

- **Current top bar** lives in [src/app/(protected)/(tabs)/index.tsx:57](src/app/(protected)/(tabs)/index.tsx:57) and is shared by both feeds. Three elements:
  1. `<MaterialIcons name="live-tv">` on the left — **decorative; no `onPress` handler exists**. Effectively dead UI.
  2. Centered `<TopFeedSwitch>` driving `useMainTabStore` between `'pour-toi'` (legacy For You video feed via `posts.json`) and `'marketplace'` (product feed via `MarketplaceScreen`).
  3. Search `<Pressable>` calling `useFilterSheetStore.getState().open()`, with a brand-coloured filter-count badge overlay when filters are active.
- **Current per-item top overlay** lives in [src/features/marketplace/components/ProductFeedItem.tsx:88-101](src/features/marketplace/components/ProductFeedItem.tsx:88) and renders the legacy [`SellerCard`](src/features/marketplace/components/SellerCard.tsx) (left) and the legacy [`PriceCard`](src/features/marketplace/components/PriceCard.tsx) (right). Both wrap children in `BlurView` directly and reach into the bookmark mutation themselves.
- **Icon library**: `@expo/vector-icons` (Ionicons + MaterialIcons). No `lucide-react-native` is installed. `react-native-svg` is present but used only by `CustomTabBarBackground`.
- **Format helpers**: [`src/features/marketplace/utils/formatCount.ts`](src/features/marketplace/utils/formatCount.ts) exists and produces English `"1.2k"` (period decimal). The legacy [`PriceCard`](src/features/marketplace/components/PriceCard.tsx:21) already uses `Intl.NumberFormat('fr-FR', ...)` for currency, so price formatting is consistent — but the count helper is wrong-locale. Per Step 4 spec we left the legacy helper alone and added French versions at [src/lib/format.ts](src/lib/format.ts). Cleanup of the duplicate is queued for a later step.
- **Save/bookmark mutation**: [`useToggleBookmark(productId)`](src/features/marketplace/hooks/useToggleBookmark.ts) — call `.mutate(currentlyBookmarked: boolean)`. Optimistic update on `useUserEngagement().bookmarkedIds`. Gated by `useRequireAuth()`.
- **Seller profile route**: `/(protected)/seller/[id]`, navigated via `router.push(...)`.
- **`Seller` type** (in [src/features/marketplace/types/product.ts](src/features/marketplace/types/product.ts)) tracks `id`, `name`, `avatarUrl`, `verified`, `isPro`, `rating`, `salesCount` — but **no `ratingCount`**. The new `SellerPill` requires `ratingCount`; we map `salesCount → ratingCount` at the call site so the component stays canonical and the data layer is untouched. A real review count belongs to a future schema change.

### Files created
- [src/lib/format.ts](src/lib/format.ts) — `formatPrice(amount, currency='EUR', locale='fr-FR')` and `formatCount(n, locale='fr-FR')` producing French-comma `"1,2k"` / `"1,2M"` via `Intl.NumberFormat`.
- [src/components/ui/VerifiedCheck.tsx](src/components/ui/VerifiedCheck.tsx) — small filled `colors.verified` circle with a centered white `Ionicons.checkmark`.
- [src/components/ui/ProBadge.tsx](src/components/ui/ProBadge.tsx) — small filled `colors.proBadge` pill with bold ultraWide-tracked uppercase "PRO".
- [src/components/ui/BulletDot.tsx](src/components/ui/BulletDot.tsx) — tiny circle separator, defaults to `text.tertiary`.
- [src/components/feed/MarketplaceHeader.tsx](src/components/feed/MarketplaceHeader.tsx) — absolute-positioned floating header. Exports `MARKETPLACE_HEADER_ROW_HEIGHT` constant for consumers to anchor below. `pointerEvents="box-none"` on the wrapper so the feed below still scrolls; only the chip and IconButton accept touches.
- [src/components/feed/SellerPill.tsx](src/components/feed/SellerPill.tsx) — `GlassCard` (variant `dark`, radius `xl`, padding `md`) housing avatar, name + verified check, optional PRO badge + "Vendeur professionnel" label, and a star + rating + ventes row. Wrapped in `Pressable` with light haptic when `onPress` provided.
- [src/components/feed/PriceCard.tsx](src/components/feed/PriceCard.tsx) — `GlassCard` housing the French-formatted price (via `formatPrice`), a ghost `IconButton` bookmark toggle, an optional in-stock dot row, and an optional free-shipping row.

### Files modified
- [src/components/ui/index.ts](src/components/ui/index.ts) — barrel re-exports `VerifiedCheck`, `ProBadge`, `BulletDot` (and their types).
- [src/app/(protected)/(tabs)/index.tsx](src/app/(protected)/(tabs)/index.tsx) — imports `MarketplaceHeader`. The top-bar render is now conditional: when `mainTab === 'marketplace'` we render `MarketplaceHeader` wired to `handleMainTabChange('pour-toi')` and the existing `onPressSearch` (which still opens the filter sheet) and pass through `filterCount` for the search-button badge. When `mainTab !== 'marketplace'` the legacy top bar (live-tv icon, `TopFeedSwitch`, search) renders unchanged so the For You feed is not regressed.
- [src/features/marketplace/components/ProductFeedItem.tsx](src/features/marketplace/components/ProductFeedItem.tsx) — top overlay region only (lines around 88–101 in the prior file): removed `SellerCard` + legacy `PriceCard` imports, added `SellerPill`, new `PriceCard` (feed path), and `MARKETPLACE_HEADER_ROW_HEIGHT`. Added inline `toSellerPillSeller(...)` mapper that derives `ratingCount = salesCount`. Added local hooks for `useUserEngagement` + `useToggleBookmark` + `useRequireAuth` (so the save toggle behaviour previously inside the legacy `PriceCard` is preserved at the call site). Anchored the overlay at `insets.top + MARKETPLACE_HEADER_ROW_HEIGHT + spacing.md` per the spec. The action rail and bottom panel are untouched.

### Existing features preserved
- **Bookmark / save mutation** — `useToggleBookmark(item.id)` is now invoked from `ProductFeedItem` (where state ownership belongs in the new layout). Optimistic updates via `useUserEngagement` are unchanged. `useRequireAuth()` gating is preserved — guests still get the sign-in prompt before the mutation runs.
- **Seller profile navigation** — `router.push('/(protected)/seller/${id}')` wired into `SellerPill.onPress`. Same route as the legacy `SellerCard`.
- **For You ↔ Marketplace tab switching** — `useMainTabStore` is unchanged. The Pour toi pill calls `handleMainTabChange('pour-toi')`. The existing `TopFeedSwitch` still drives the For You side.
- **Filter sheet + filter count** — Search `IconButton` calls the existing `onPressSearch` (unchanged). The brand-coloured count badge migrates onto the new `IconButton` via an absolute-positioned overlay.
- **Haptics** — `Pressable` from `@/components/ui` fires `Haptics.impactAsync` on press for the Pour toi pill and the SellerPill; matches the legacy "light haptic on tap" behaviour.

### Feature-parity concerns surfaced and resolved
1. **`live-tv` MaterialIcon in the legacy top bar.** No `onPress`, no consumer logic, purely decorative. Per Step 4 constraint to surface anything non-obviously-dropped: this icon is intentionally **omitted from `MarketplaceHeader`**. Decision rationale: it was dead UI. Easy to restore as a leading icon on the Pour toi pill or as a separate IconButton if the user disagrees.
2. **`TopFeedSwitch` for the marketplace side.** Migrated, not dropped — the Pour toi pill is the new way to swap to the For You feed; the centered "Marketplace" title with white underline replaces the active-state visualization. The For You side still shows the legacy `TopFeedSwitch` because reskinning that side is out of scope for this step.
3. **`SellerCard` and legacy `PriceCard` are still on disk.** Not deleted because other code may import them (and to keep `git revert` simple). They are unused by `ProductFeedItem` after this step. A future cleanup step should remove them once nothing imports them.
4. **`Seller.ratingCount` doesn't exist in the data model.** Mapped from `salesCount` at the call site as documented above.
5. **Format-helper duplication.** New helpers at `src/lib/format.ts`, legacy `formatCount` at `src/features/marketplace/utils/formatCount.ts` left in place (still used by `SellerCard`, `ProductActionRail`, etc.). Documented in the new file's TSDoc; cleanup queued for a later step.
6. **No automated tests exist** — confirmed by `find . -name __tests__`. No snapshot updates required.

### Verification results
- `tsc --noEmit` → exit 0. Clean.
- `npx expo export --platform ios --output-dir .expo/step4-bundle-check` → bundled successfully (5.97 MB Hermes, up from 5.92 MB pre-Step-4 — accounts for the new components). Bundle artifact removed.
- App boot + screenshot **deferred to user** (Windows host has no iOS simulator). Boot the app to confirm: the marketplace tab shows the new header with Pour toi pill + Marketplace + Search; tapping Pour toi swaps to the For You feed; the search button still opens the filter sheet; each feed item's top overlay renders the new SellerPill (left, glass, with avatar, name, verified blue check, violet PRO, rating + sales) and PriceCard (right, glass, with French-formatted price, bookmark toggle, in-stock dot, free-shipping row); tapping the seller pill still navigates to the seller profile; bookmark toggle still saves and the icon flips immediately (optimistic update preserved).

### Reversion command
A single `git revert` of the Step 4 commit returns the marketplace home and `ProductFeedItem` to their Step-3 layout (legacy top bar + legacy `SellerCard`/`PriceCard`). The new components and helpers ship dead-but-present after revert; rollback is therefore additive-safe.

---

## Step 4.1 Changelog (2026-05-03) — Header Tabs + SellerPill Compaction

Two surgical fixes to Step 4 based on user feedback. PriceCard, the bookmark/save mutation, the seller-profile route, theme tokens, and every other component are untouched.

### Diagnosis
- **Asymmetric header rejected.** Step 4's literal interpretation of the reference image — Pour toi pill on the left, Marketplace title centered, Search on the right — does not read as a tab relationship. Users expect "Pour toi" and "Marketplace" to sit adjacent so the underline indicator visibly anchors to the active tab. The reference's asymmetric placement was rejected as a navigation pattern.
- **SellerPill too prominent.** Step 4's SellerPill used avatar `md` (44 px) + GlassCard `padding="md"` (12 px on every side). Combined with the three-line text column it produced a card that visually competes with the product image. Needs to feel like a floating chip, not a card.

### Files modified
- [src/components/feed/MarketplaceHeader.tsx](src/components/feed/MarketplaceHeader.tsx) — full layout revision. New props `activeTab: 'pour-toi' \| 'marketplace'`, `onPressForYou`, `onPressMarketplace`, `onPressSearch`, `filterCount?`. Removed the Chip-based Pour-toi pill and the Marketplace-only centered title. New layout: left filler View (`flex: 1`); center cluster of two adjacent `TabItem`s with `gap: spacing.lg`; right filler View (`flex: 1`, `alignItems: 'flex-end'`) housing the glass Search `IconButton` + filter-count badge overlay. The internal `TabItem` (file-private; not exported) is a `Pressable` with `hitSlop: spacing.sm`, light haptic, `accessibilityRole="tab"` + `accessibilityState={{ selected }}`, rendering `<Text variant="title">` on top of a 2 px underline View. Active state uses `weight="semibold"` + `color={text.primary}` + visible white underline; inactive uses `weight="medium"` + `color={text.tertiary}` + transparent underline (kept in the tree so layout doesn't shift on toggle). `MARKETPLACE_HEADER_ROW_HEIGHT` constant unchanged at 48 — new layout fits within the same row height.
- [src/app/(protected)/(tabs)/index.tsx](src/app/(protected)/(tabs)/index.tsx) — removed the `mainTab === 'marketplace'` conditional and the entire legacy top-bar fallback (live-tv `MaterialIcons`, `TopFeedSwitch`, manual Search `Pressable`, the `topBar` / `searchButton` / `badge` / `badgeText` / `switchContainer` styles). `MarketplaceHeader` now renders unconditionally for both feeds, wired with `activeTab={mainTab}`, `onPressForYou={() => setMainTab('pour-toi')}`, `onPressMarketplace={() => setMainTab('marketplace')}`, the existing `onPressSearch`, and `filterCount`. Removed unused imports: `TopFeedSwitch`, `Pressable`, `Text`, `MaterialIcons`, `Ionicons`, `useSafeAreaInsets`, `useTranslation`, `colors`, `MAIN_TABS`, `topBarTop`, `insets`, `t`, `handleMainTabChange`. Component itself is a clean ~85-line file now.
- [src/components/feed/SellerPill.tsx](src/components/feed/SellerPill.tsx) — Avatar `size="md"` → `"sm"` (44 → 32 px). `GlassCard` switched from `padding="md"` to explicit `style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}` (12 H × 8 V) — values still token-driven. Avatar-to-content gap `spacing.md` → `spacing.sm` (12 → 8). Vertical row spacing inside the text column dropped from `marginTop: 2` to `marginTop: 1` on the PRO row and the rating row. Typography variants and prop interface are unchanged. Net visual: card height drops noticeably (closer to 56 px from ~76 px on a typical PRO seller — ~25% reduction).

### New header layout structure

```
┌──────────────────── header row ────────────────────┐
│ [filler flex 1]                                    │
│                Pour toi   Marketplace              │
│                          ─────────                 │   ← underline under active
│                                          [filler   │
│                                           flex 1   │
│                                           ┌─────┐] │
│                                           │  ⌕  │  │   ← glass Search IconButton
│                                           └─────┘  │
└────────────────────────────────────────────────────┘
```

Adjacent tabs in the center, search anchored trailing.

### New SellerPill dimensions

| Property | Step 4 | Step 4.1 |
| --- | --- | --- |
| Avatar size | `md` (44 px) | `sm` (32 px) |
| GlassCard padding | `padding="md"` (12 all sides) | `paddingHorizontal: spacing.md` (12), `paddingVertical: spacing.sm` (8) |
| Avatar-to-content gap | `spacing.md` (12) | `spacing.sm` (8) |
| PRO row marginTop | 2 | 1 |
| Rating row marginTop | 2 | 1 |
| Approx card height (3-line PRO seller) | ~76 px | ~56 px |

Prop interface (`SellerPillProps`, `SellerPillSeller`) is unchanged — call sites in [ProductFeedItem.tsx](src/features/marketplace/components/ProductFeedItem.tsx) compile and run unchanged.

### BRAND.md decision note
Added a new **Layout Decisions** subsection inside [Visual Language](BRAND.md) explicitly recording:
1. Top header uses adjacent-tab switch with white underline; the asymmetric Pour-toi-pill placement was tested and rejected.
2. Search button is fixed to the trailing edge and not part of the tab cluster.

The note is intentionally short and prescriptive so a future audit / design-refresh step doesn't accidentally reintroduce the rejected layout. If a future audit suggests it, ignore or escalate.

### Untouched (per constraints)
- [src/components/feed/PriceCard.tsx](src/components/feed/PriceCard.tsx) — unchanged.
- [src/features/marketplace/components/ProductFeedItem.tsx](src/features/marketplace/components/ProductFeedItem.tsx) — unchanged from Step 4.
- Bookmark mutation (`useToggleBookmark`), `useUserEngagement`, `useRequireAuth`, seller-profile route — unchanged.
- Theme tokens (`src/theme/index.ts`) — unchanged.
- Step 3 primitives — unchanged. No new primitives added.
- [src/components/GenericComponents/TopFeedSwitch.tsx](src/components/GenericComponents/TopFeedSwitch.tsx) — left on disk for revert safety; consumption removed from the screen.
- Action rail, bottom info section, bottom tab bar, every screen besides the marketplace home — unchanged.

### Verification results
- `tsc --noEmit` → exit 0. Clean.
- `npx expo export --platform ios --output-dir .expo/step41-bundle-check` → bundled successfully (5.97 MB Hermes; same size as Step 4 — additions/removals are roughly even). Bundle artifact removed.
- Simulator boot **deferred to user** (Windows host has no iOS simulator). Confirm: header shows "Pour toi   Marketplace" as adjacent tabs with the white underline under the active one, glass search button on the right; tapping a tab swaps feeds (Zustand `useMainTabStore` behaviour preserved); SellerPill is visibly more compact; PriceCard / bookmark / seller navigation / search-opens-filter-sheet behaviour all unchanged from Step 4.

### Reversion command
A single `git revert` of the Step 4.1 commit restores the asymmetric header + larger SellerPill from Step 4. The legacy `TopFeedSwitch` still being on disk means revert is clean — no missing imports.

---

## Step 4.2 Changelog (2026-05-03) — SellerPill Size Match

Brought the new `SellerPill` down to the legacy `SellerCard` footprint by reading the legacy file's exact dimensions and applying them. Design language (glass surface, verified blue check, violet PRO badge, French formatting, primitive composition) and prop interface are unchanged — only sizes, paddings, and font sizing moved.

### Legacy reference file
`src/features/marketplace/components/SellerCard.tsx` (preserved on disk since Step 4 for exactly this kind of reference).

### Extracted legacy dimensions

| Property | Value | Legacy source |
| --- | --- | --- |
| Avatar diameter | 36 px | [SellerCard.tsx:34](src/features/marketplace/components/SellerCard.tsx:34) — `<Avatar size={36}>` |
| Card border radius | 14 px | [SellerCard.tsx:68](src/features/marketplace/components/SellerCard.tsx:68) — `borderRadius: 14` |
| Card padding (uniform) | 10 px | [SellerCard.tsx:77](src/features/marketplace/components/SellerCard.tsx:77) — `padding: 10` |
| Avatar↔text gap | 10 px | [SellerCard.tsx:76](src/features/marketplace/components/SellerCard.tsx:76) — `gap: 10` |
| Name fontSize | 14 | [SellerCard.tsx:88](src/features/marketplace/components/SellerCard.tsx:88) — `fontSize: 14` |
| Name fontWeight | '700' (bold) | [SellerCard.tsx:89](src/features/marketplace/components/SellerCard.tsx:89) — `fontWeight: '700'` |
| Verified-icon left margin | 4 | [SellerCard.tsx:93](src/features/marketplace/components/SellerCard.tsx:93) — `marginLeft: 4` |
| Meta text fontSize | 12 | [SellerCard.tsx:110](src/features/marketplace/components/SellerCard.tsx:110) — `fontSize: 12` |
| Star icon size | 11 | [SellerCard.tsx:55](src/features/marketplace/components/SellerCard.tsx:55) — `size={11}` |
| PRO pill: paddingH/V, radius, fontSize | 6 / 2 / 4 / 10 | [SellerCard.tsx:95-105](src/features/marketplace/components/SellerCard.tsx:95) — already reproduced by `ProBadge size="sm"`; not modified per "no other component" constraint |
| Vertical row gaps | 0 (relies on default lineHeight) | [SellerCard.tsx:82-85](src/features/marketplace/components/SellerCard.tsx:82) — no marginTop between rows |
| Card width | flexShrink, no fixed width | [SellerCard.tsx:67-72](src/features/marketplace/components/SellerCard.tsx:67) — fully flex |

### Applied dimensions in `SellerPill`

| Property | Value | Applied via |
| --- | --- | --- |
| Avatar diameter | 36 | `<Avatar diameter={36} />` (cited inline) |
| Card border radius | 14 | `<GlassCard radius="legacy" />` (new `radii.legacy` token) |
| Card padding | `spacing[10]` (10) | `<GlassCard style={{ padding: spacing[10] }} />` |
| Avatar↔text gap | `spacing[10]` (10) | `<View style={{ gap: spacing[10] }} />` |
| Name | `fontSize: 14, lineHeight: 18, weight="bold"` | `<Text variant="body" weight="bold" style={{ fontSize: 14, lineHeight: 18 }}>` (cited) |
| Verified-icon gap | `spacing.xs` (4) | row `gap: spacing.xs` (matches `marginLeft: 4`) |
| PRO row | gap `spacing.sm`, marginTop 0 | inline (legacy has PRO inline; we keep separate row per Step 4 design) |
| Rating/sales row | gap `spacing.xs`, marginTop 0 | inline |
| Meta text | `fontSize: 12, lineHeight: 16` | `<Text variant="caption" style={{ fontSize: 12, lineHeight: 16 }}>` (cited) |
| Card width | flex, no constraint | unchanged (`flex: 1` on parent in `ProductFeedItem`) |

### New theme tokens added
- `spacing[10] = 10` — added to [src/theme/index.ts](src/theme/index.ts) for the legacy 10 px padding/gap. Inserted between `sm:8` and `md:12` to keep numeric ordering. Numeric key follows the existing `0:0` precedent.
- `radii.legacy = 14` — added to [src/theme/index.ts](src/theme/index.ts) for the legacy 14 px card radius. Named explicitly so future code understands its purpose (legacy parity, not general-purpose).

Both are documented in [BRAND.md](BRAND.md) under a new **Component Sizing** subsection of Visual Language. Tokens are intentionally narrow-purpose; new code should prefer the named scale.

### Avatar primitive change
Added an optional `diameter?: number` prop to [src/components/ui/Avatar.tsx](src/components/ui/Avatar.tsx). When provided, takes precedence over `size`. Documented in TSDoc as "use sparingly — prefer the size token scale unless matching a legacy component dimension." All existing call sites continue to work unchanged (the prop is additive).

### Computed height comparison

Legacy `SellerCard` (single avatar-bound rendering — text rows are shorter than 36 px avatar):
- Padding top + bottom: 10 + 10 = 20
- Avatar height: 36
- max(text column, avatar): 36
- **Total card height: ~56 px**

New `SellerPill` (Step 4.2):
- Padding top + bottom: 10 + 10 = 20
- Text column for **non-PRO seller** (2 rows): name 18 + meta 16 = 34
  - max(text, avatar 36): 36 → **Total: ~56 px** ✅ matches legacy within tolerance
- Text column for **PRO seller** (3 rows): name 18 + PRO row 16 + meta 16 = 50
  - max(text, avatar 36): 50 → **Total: ~70 px** — ~14 px taller than legacy

The PRO-seller mismatch is structural (the new design adds a "Vendeur professionnel" row beneath the PRO badge — Step 4 spec required it). Removing that row would require a structural change which violates Step 4.2's "ONLY size properties move" constraint. Flagged for a possible Step 4.3 if exact PRO parity matters; otherwise acceptable.

### Files modified
- [src/theme/index.ts](src/theme/index.ts) — added `spacing[10]: 10` and `radii.legacy: 14`. No other token changes.
- [src/components/ui/Avatar.tsx](src/components/ui/Avatar.tsx) — additive `diameter?: number` prop with TSDoc.
- [src/components/feed/SellerPill.tsx](src/components/feed/SellerPill.tsx) — sizes only (avatar diameter, card padding/radius, row gaps, font sizes/lineHeights, name weight). Prop interface unchanged. Legacy line numbers cited inline next to each numeric value.
- [BRAND.md](BRAND.md) — new **Component Sizing** subsection inside Visual Language records SellerPill final dimensions, the legacy-parity rationale, and the narrow-purpose intent of the two new tokens.

### Untouched (per constraints)
- [src/components/feed/PriceCard.tsx](src/components/feed/PriceCard.tsx)
- [src/components/feed/MarketplaceHeader.tsx](src/components/feed/MarketplaceHeader.tsx)
- [src/features/marketplace/components/ProductFeedItem.tsx](src/features/marketplace/components/ProductFeedItem.tsx)
- All other primitives (`ProBadge`, `VerifiedCheck`, `BulletDot`, `Pressable`, `Surface`, `GlassCard`, `Chip`, `IconButton`, `Text`)
- Bookmark mutation, seller-profile route, theme tokens unrelated to size, the legacy `SellerCard` (still on disk)

### Verification results
- `tsc --noEmit` → exit 0. Clean.
- `npx expo export --platform ios --output-dir .expo/step42-bundle-check` → bundled successfully (5.97 MB Hermes). Bundle artifact removed.
- Simulator boot **deferred to user** (Windows host has no iOS simulator). Confirm the new `SellerPill` reads at the same visual size as the pre-Step-4 layout for non-PRO sellers; PRO sellers remain ~14 px taller pending the structural decision noted above.

### Reversion command
A single `git revert` of the Step 4.2 commit restores the Step-4.1 SellerPill (avatar 32 px, padding 12 H × 8 V, body-variant name, etc.) and removes the new `spacing[10]` / `radii.legacy` tokens and the Avatar `diameter` prop.

---

## Step 7 Changelog (2026-05-03) — Custom Tab Bar

Replaced Expo Router's default tab bar with a project-owned custom tab bar that matches the user's reference image: dark surface with rounded top corners, smooth concave cutout at center, coral "Vendre" FAB sitting half above / half below, and surrounding tabs rendering through Step 3 primitives. No routes were renamed, no schema work was added, and the existing sell-tab navigation flow is unchanged.

### Pre-edit reconnaissance

- **Current tab layout** lived at [src/app/(protected)/(tabs)/_layout.tsx](src/app/(protected)/(tabs)/_layout.tsx). It used Expo Router's default `<Tabs>` plus a `tabBarBackground` callback rendering [CustomTabBarBackground.tsx](src/components/GenericComponents/CustomTabBarBackground.tsx) (SVG, single deep semicircle cutout, sweep-flag 1) and conventional `tabBarIcon` props per `Tabs.Screen`.
- **Routes**: `index` (Accueil), `friends` (Catégories — file misnamed), `newPost` (Vendre), `inbox` (Messages), `profile` (Profil). All five exist as `Tabs.Screen`s. No missing routes — the new bar adapts directly. Per Step 7 constraint, no routes were added or renamed.
- **Sell flow mechanism**: `newPost` is itself a regular tab screen ([src/app/(protected)/(tabs)/newPost.tsx](src/app/(protected)/(tabs)/newPost.tsx)). The FAB navigates via `navigation.navigate('newPost')` — same target as the prior raised tab icon used.
- **Unread-messages source**: none. Old layout had `const MESSAGES_UNREAD = true; // TODO(step-11): drive from real notifications` — a hardcoded boolean. Per Step 7 constraint, the badge stays prop-driven and defaults to `false`. Wired through `unreadMessages?: boolean` prop on `CustomTabBar`. A future step that introduces a real unread source (Zustand store, React Query hook, or realtime) just sets that prop.
- **`react-native-svg`**: confirmed installed (`~15.12.1` in `package.json`). No `npx expo install` invocation needed.
- **Icon library**: `@expo/vector-icons` (Ionicons + MaterialCommunityIcons used here). No new icon library.
- **Existing custom tab bar background**: [src/components/GenericComponents/CustomTabBarBackground.tsx](src/components/GenericComponents/CustomTabBarBackground.tsx) **left on disk** for revert safety. Now unused by the live tree.

### Files created
- [src/components/navigation/TabBarBackground.tsx](src/components/navigation/TabBarBackground.tsx) — SVG shape only. Props `width`, `height`, `cutoutCenterX`, optional `cutoutRadius` (36), `cutoutDepth` (14), `cornerRadius` (20), `fillColor` (defaults to `colors.surface`), `showTopHairline`. The arc radius is **computed from the chord half-length and sagitta** (`r = (cutoutRadius² + cutoutDepth²) / (2 · cutoutDepth)`), then drawn as a single arc with sweep-flag 1. The literal Step 7 path math (chord at `y=cutoutDepth`, arc radius = `cutoutRadius`, sweep-flag 0) produces a deep semicircle and bows the wrong direction in y-down SVG; computing the radius gives the smooth shallow scoop the reference shows. Documented inline in TSDoc.
- [src/components/navigation/TabBarItem.tsx](src/components/navigation/TabBarItem.tsx) — single tab. `Pressable` (Step 3 primitive, `haptic="light"`) wrapping icon + optional badge dot + label `Text`. Active/inactive state controls label color (`primary` vs `tertiary`). Badge is an 8 × 8 coral circle with a 2 px `colors.surface` border, anchored top: -2 / right: -4 to the icon container.
- [src/components/navigation/SellFAB.tsx](src/components/navigation/SellFAB.tsx) — circular coral 56 × 56 button (`colors.brand` fill, white `Feather plus` icon, iOS shadow / Android elevation), wrapped in `Pressable` with `haptic="medium"` and `pressScale={0.92}`. Label below (`t('tabs.sell')`) using `Text variant="caption"`. Exports `SELL_FAB_DIAMETER = 56`. All copy via i18n; `tabs.sell` key already exists in the locale files.
- [src/components/navigation/CustomTabBar.tsx](src/components/navigation/CustomTabBar.tsx) — composes Background + 4 `TabBarItem`s + 1 spacer slot for the sell route + an absolutely-positioned `SellFAB`. Receives the standard `BottomTabBarProps`. Iterates `state.routes`, looks up each route by name in a `TAB_CONFIG` map keyed by `'index' | 'friends' | 'inbox' | 'profile'` that resolves to `{ labelKey, active, inactive }` icon renderers. The `newPost` route renders an empty placeholder so the row stays evenly distributed; the FAB is positioned absolute at `{ top: -CUTOUT_PROTRUSION, left: cx - FAB_COLUMN_WIDTH / 2 }`. Exposes `unreadMessages?: boolean` (default `false`) for future wiring of the inbox dot.

### File modified
- [src/app/(protected)/(tabs)/_layout.tsx](src/app/(protected)/(tabs)/_layout.tsx) — **fully rewritten** down to ~17 lines. Removed: prior `screenOptions` (height, padding, tint colors, label style), `tabBarBackground` callback rendering the legacy `CustomTabBarBackground`, per-screen `tabBarIcon` definitions, the inline raised sell button + notification dot styles, the legacy `screenListeners.tabPress` haptic dispatcher (replaced by per-`TabBarItem` `Pressable haptic="light"`), the `MESSAGES_UNREAD` boolean. Replaced with a single `<Tabs tabBar={(props) => <CustomTabBar {...props} />}>` plus five bare `Tabs.Screen` declarations supplying only the i18n title. All five routes preserved unchanged.

### SVG cutout path

For the default parameters (cutoutRadius 36, cutoutDepth 14, cornerRadius 20, screen width W, total height H, cutoutCenterX W/2):

- arcRadius = `(36² + 14²) / (2 · 14)` = `1492 / 28` = **53.286 px**
- arcStartX = `cutoutCenterX − 36`
- arcEndX = `cutoutCenterX + 36`

```
M 0 20
A 20 20 0 0 1 20 0
L {arcStartX} 0
A 53.286 53.286 0 0 1 {arcEndX} 0
L {W - 20} 0
A 20 20 0 0 1 W 20
L W H
L 0 H
Z
```

Maximum scoop depth into the bar = `cutoutDepth` = **14 px**. Chord width across the cutout = **72 px**. The cutout sits at the very top of the bar (chord on `y=0`), not depressed below it. This places the curve where the reference image places it.

### Constants and rationale

| Constant | Value | Where | Rationale |
| --- | --- | --- | --- |
| `TAB_BAR_HEIGHT` | `64` | [CustomTabBar.tsx](src/components/navigation/CustomTabBar.tsx) | Visual bar height above safe-area inset. Total height is `TAB_BAR_HEIGHT + insets.bottom` so the home indicator never clips the row. |
| `SELL_FAB_DIAMETER` | `56` | [SellFAB.tsx](src/components/navigation/SellFAB.tsx) | Matches the legacy raised sell button dimension; spec default. |
| `CUTOUT_PROTRUSION` | `22` | [CustomTabBar.tsx](src/components/navigation/CustomTabBar.tsx) | Spec default. With FAB diameter 56, 22 px sit above the bar's top edge and 34 px sit below — the FAB partially nests into the bar surface (anchored look) rather than floating fully above it. |
| `FAB_COLUMN_WIDTH` | `80` | [CustomTabBar.tsx](src/components/navigation/CustomTabBar.tsx) | Width of the absolutely-positioned column housing the FAB + label. Wider than the FAB itself (56) so the localized "Vendre" / "Sell" label centers cleanly underneath without overflow. |
| `cutoutRadius` (default) | `36` | [TabBarBackground.tsx](src/components/navigation/TabBarBackground.tsx) | Half-width of the chord, slightly larger than FAB radius (28) for visual breathing room. |
| `cutoutDepth` (default) | `14` | [TabBarBackground.tsx](src/components/navigation/TabBarBackground.tsx) | Sagitta — keeps the scoop shallow and matches the reference image. |
| `cornerRadius` (default) | `20` | [TabBarBackground.tsx](src/components/navigation/TabBarBackground.tsx) | Top-corner rounding; matches the brand's "medium-rounded" geometry rule. |

### Untouched (per constraints)
- All five tab routes ([src/app/(protected)/(tabs)/index.tsx](src/app/(protected)/(tabs)/index.tsx), `friends`, `newPost`, `inbox`, `profile`) — implementations unchanged.
- The `newPost` (sell) screen and its create/update mutations — unchanged.
- Supabase queries, auth, Zustand stores, React Query setup — untouched.
- Top header (Step 4 / 4.1), seller pill (4.2), price card (4), MarketplaceFilterSheet, ProductFeedItem, action rail (Step 5 not yet done) — untouched.
- Theme tokens — unchanged.
- Legacy [CustomTabBarBackground.tsx](src/components/GenericComponents/CustomTabBarBackground.tsx) — left on disk; safe to delete in a later cleanup pass.

### Verification results
- `tsc --noEmit` → exit 0. Clean. (Initial run flagged `tabBarTestID` not present on the v7 `BottomTabNavigationOptions` type; resolved by dropping the testID forwarding — no functional impact.)
- `npx expo export --platform ios --output-dir .expo/step7-bundle-check` → bundled successfully (5.98 MB Hermes; +0.01 MB over Step 4.2 — accounts for the four new components). Bundle artifact removed.
- App boot + screenshot **deferred to user** (Windows host has no iOS simulator). Confirm: 5 visible tabs (Accueil, Catégories, FAB, Messages, Profil); coral FAB centered with white "+" half above / half below the bar; smooth shallow scoop carving the top edge under the FAB; rounded top corners; tapping any tab navigates correctly; tapping FAB navigates to `newPost`; haptic feedback on every press; home-indicator safe-area respected; active tab shows filled icon + bright label, inactive shows outlined icon + muted label.

### Reversion command
A single `git revert` of the Step 7 commit restores the legacy tab layout (default `<Tabs>` with the deep-semicircle background, raised sell tab icon, and inline notification dot). The legacy `CustomTabBarBackground` still being on disk means revert is clean — no missing imports.

---

## Step 7.1 + 4.3 Changelog (2026-05-03) — Tab Bar Diagnosis & Width Cap

User-reported regression on iPad: the new tab bar rendered with a light/cream background, no rounded corners, no curved cutout, FAB inline with the other tabs. SellerPill bloated to ~50% of screen width. Diagnosis below; fixes are surgical.

A separate runtime error (`ReferenceError: Property 'zIndex' doesn't exist`) surfaced during the patch and was fixed in the same commit — same blast radius.

### Render-path inspection findings

Read every file in the path before changing anything:

1. [src/app/(protected)/(tabs)/_layout.tsx](src/app/(protected)/(tabs)/_layout.tsx) — `<Tabs tabBar={(props) => <CustomTabBar {...props}/>}>` was wired correctly. `headerShown: false` set. No leftover `tabBarStyle`, `tabBarBackground`, `tabBarButton`, or `tabBarShowLabel`. **No issue here.**
2. [src/components/navigation/CustomTabBar.tsx](src/components/navigation/CustomTabBar.tsx:95-103) — **Root cause.** Outer container was `position: 'absolute' + bottom: 0 + height: totalHeight`. Cross-checked against [`@react-navigation/bottom-tabs/src/views/BottomTabView.tsx`](node_modules/@react-navigation/bottom-tabs/src/views/BottomTabView.tsx:233-356): React Navigation v7 renders the custom `tabBar()` output as a regular sibling to `MaybeScreenContainer` inside a `flexDirection: 'column'` `SafeAreaProviderCompat`. An absolute outer takes **0 layout height** in that flex column — the screens container expands to fill the full viewport, the tab-bar slot collapses, and our custom bar floats at the bottom in an off-flow position. On iPad with no home indicator, the visible result is exactly what the user reported: the screen's white/light scene background paints where the tab bar should be, and our dark SVG bar is either invisible or behind it.
3. [src/components/navigation/TabBarBackground.tsx](src/components/navigation/TabBarBackground.tsx) — math, fill, dimensions all correct. `colors.surface` resolves to `'#0A0A0A'`. **No issue.**
4. [src/components/navigation/SellFAB.tsx](src/components/navigation/SellFAB.tsx) — fine in isolation, but its raised `top: -CUTOUT_PROTRUSION` (-22) inside the CustomTabBar requires `overflow: 'visible'` on the outer container (RN's default) — once the outer becomes a normal layout View we set this defensively.
5. Searched src/ for any leftover `CustomTabBarBackground` / `tabBarBackground` consumption — only the legacy file's own `export` remains, unconsumed. **No interference.**

### Root causes identified
- **Primary** — Outer container `position: 'absolute'` short-circuits the React-Navigation tab-bar slot's layout; bar renders out of flow and is visually replaced by the scene background underneath.
- **Secondary** — `tabBarStyle.height` was unset; React Navigation reserved its default ~50 + safe-area for the tab bar slot, but our bar wants 64 + safe-area. `useBottomTabBarHeight()` consumers (the home feed) were also receiving the wrong value.
- **Independent runtime error** — `MarketplaceHeader.tsx` and `ProductFeedItem.tsx` both wrote `zIndex: zIndex.overlay` inside an inline style. On Hermes, the object-literal key shadowed the imported `zIndex` binding when the right-hand expression was evaluated, surfacing as `ReferenceError: Property 'zIndex' doesn't exist`. Renaming the import resolves it.

### Fixes applied

| Fix | File:line | Change |
| --- | --- | --- |
| Outer container becomes a normal layout View | [CustomTabBar.tsx:94-104](src/components/navigation/CustomTabBar.tsx:94) | Removed `position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: zIndex.overlay`. Outer is now `<View style={{ height: totalHeight, overflow: 'visible' }}>` — an in-flow child of RN's tab-bar slot. The inline comment cites BottomTabView's expectations so a future reader understands why. |
| Background fills outer | [CustomTabBar.tsx:106-114](src/components/navigation/CustomTabBar.tsx:106) | Inner SVG-wrapper changed to `position: 'absolute', top: 0, left: 0, right: 0, bottom: 0` so the SVG covers the full bar regardless of how the row positions itself. |
| Removed obsolete row padding hack | [CustomTabBar.tsx:122](src/components/navigation/CustomTabBar.tsx:122) | Dropped `paddingBottom: insets.bottom > 0 ? 0 : spacing.xs` — the row no longer needs it since the outer reserves `totalHeight = TAB_BAR_HEIGHT + insets.bottom` and the items sit in the top `TAB_BAR_HEIGHT` band naturally. |
| Removed unused `zIndex` import | [CustomTabBar.tsx:6,9](src/components/navigation/CustomTabBar.tsx:6) | Cleaned up the now-unused `zIndex` and `SELL_FAB_DIAMETER` imports. |
| Inform RN of bar height | [_layout.tsx:13-22](src/app/(protected)/(tabs)/_layout.tsx:13) | Added `tabBarStyle: { height: TAB_BAR_HEIGHT + insets.bottom, borderTopWidth: 0, backgroundColor: 'transparent' }` to `screenOptions`. RN's `getTabBarHeight` reads this to (a) reserve correct screen-content space and (b) propagate to `useBottomTabBarHeight()` consumers (the home feed depends on it). Imported `useSafeAreaInsets` and `TAB_BAR_HEIGHT` from the navigation module. Background transparent + zero top border keep the computed slot from painting anything that would compete with our SVG. |
| Hermes `zIndex` shadowing | [MarketplaceHeader.tsx:6,85](src/components/feed/MarketplaceHeader.tsx:6) and [ProductFeedItem.tsx:23,173](src/features/marketplace/components/ProductFeedItem.tsx:23) | Renamed import: `import { zIndex as zIndexTokens } from '@/theme'`, and reference site to `zIndex: zIndexTokens.overlay`. The previous `zIndex: zIndex.overlay` pattern crashed on Hermes when the inline-style object literal evaluated the right-hand side. |
| iPad / wide-screen handling | [CustomTabBar.tsx:85](src/components/navigation/CustomTabBar.tsx:85) | Already used `useWindowDimensions()` (added in Step 7) — no change needed. The cutout center (`width / 2`) and arc geometry remain fixed-size; the FAB doesn't grow with viewport, which is correct. |

### `SellerPill` and `PriceCard` width caps (Step 4.3 portion)
- [SellerPill.tsx:48-49](src/components/feed/SellerPill.tsx:48) — `GlassCard style` now `{ padding: spacing[10], maxWidth: 320, flexShrink: 1 }`. On iPhone the pill fits naturally; on iPad it stops at 320 instead of growing with the column.
- [PriceCard.tsx:33-37](src/components/feed/PriceCard.tsx:33) — `GlassCard` gains `style={{ maxWidth: 320, flexShrink: 1 }}`. Preventive cap — `ProductFeedItem` already sets the card as a flex-shrink:0 sibling, but the cap protects against any future layout where the card could be told to fill width.
- [BRAND.md](BRAND.md) — **Component Sizing** subsection updated to record the 320 cap and the `flexShrink: 1` pairing on both components, with a note that future layout changes wanting larger feed-item cards should raise the cap deliberately.

### Debug-border status
Not added. The render-path code was readable enough to identify the absolute-positioning cause without a debug aid. If the user's next iPad screenshot still shows the bar misaligned, a temporary 2 px border on the outer is the logical next step — but kept out of this commit.

### Untouched (per constraints)
- Action rail (Step 5 — not yet implemented), top header (Steps 4 / 4.1), bottom info section, all feed-item logic, all data-layer code (Supabase queries, mutations, stores, auth), theme tokens, every other primitive.
- Legacy [src/components/GenericComponents/CustomTabBarBackground.tsx](src/components/GenericComponents/CustomTabBarBackground.tsx) — still on disk, unconsumed.

### Verification results
- `tsc --noEmit` → exit 0. Clean.
- `npx expo export --platform ios --output-dir .expo/step71-bundle-check` → bundled successfully (5.98 MB Hermes, unchanged from Step 7). Bundle artifact removed.
- App boot + screenshot **deferred to user — must be re-tested on iPad after this patch**. The patch is not "done" until visuals are confirmed. Expected visual: dark `#0A0A0A` bar with rounded top corners, smooth shallow scoop at top center, coral FAB sitting raised ~22 px above with white "+" and "Vendre"/"Sell" label below. SellerPill and PriceCard should render at the same size on iPad as they do on iPhone.

### Reversion command
A single `git revert` of this commit restores the broken Step-7 layout (absolute outer, no `tabBarStyle.height`) and removes the maxWidth caps + the Hermes-shadowing rename. The Hermes error will return after revert — only revert this commit if you also revert further back.

---

## Step 7.2 Patch (2026-05-03) — Tab Bar Visual Tune to Match Reference

User shared the reference image again and asked to match the bottom tab bar exactly. Tuning pass on shape, FAB position, and tab-item polish. No structural changes; layout fix from Step 7.1 stays in place.

### Changes

| File | Change |
| --- | --- |
| [TabBarBackground.tsx](src/components/navigation/TabBarBackground.tsx) | **Switched the cutout from a single arc to two cubic Béziers** that meet at the bottom-center. Both segments enter the chord endpoints and the bottom-center with horizontal tangents — the visible kink the arc produced at the chord endpoints is gone, matching the reference's soft S-curve. Defaults retuned: `cutoutRadius` 36 → 42 (chord half-width — wider opening), `cutoutDepth` 14 → 18 (deeper scoop), `cornerRadius` 20 → 24 (more pronounced top corners). Control-point distance set at `cutoutRadius * 0.55` along each tangent — close to a quarter-circle approximation without overshoot. The legacy arc-based approach is documented in TSDoc for context. |
| [CustomTabBar.tsx](src/components/navigation/CustomTabBar.tsx) | `CUTOUT_PROTRUSION` 22 → 28 — FAB now sits half above / half below the bar's top edge (28 of 56 px above), matching the reference's raised-FAB proportion. Inactive icon color changed from `colors.text.tertiary` (~0.42 opacity) to `colors.text.secondary` (~0.68) — reference shows visibly bright inactive icons; the muted tertiary made them recede too much. |
| [TabBarItem.tsx](src/components/navigation/TabBarItem.tsx) | Notification dot: removed the 2 px `colors.surface` border ring — reference shows a clean coral dot directly against the icon. Position fine-tuned (top -1, right -3) to sit on the chat bubble's upper-right curve. Inactive label color synced to `secondary` to match the inactive icon color. |

### Why these specifics
- The reference image shows a smoother cutout than my arc-only path produced. With an arc whose chord sits on the top edge, the tangent at the chord endpoints isn't horizontal (it angles in toward the curve), so the join with the flat top edge is visibly kinked at higher resolutions or on larger screens. Two Béziers with horizontal tangents at both ends fix that geometrically.
- 28 px protrusion lets the FAB extend with its center sitting roughly on the bar's top edge — visually "anchored" but clearly raised. Below that the FAB looks stuck in the bar; above it the FAB looks unanchored.
- `text.secondary` keeps inactive tabs readable; the reference doesn't lean as hard into "muted" as the audit-era values suggested.

### Untouched
- `_layout.tsx`, `SellFAB.tsx` — unchanged.
- All Step 7.1 fixes (outer in-flow, `tabBarStyle.height`, Hermes `zIndex` rename) stay in place.
- `SellerPill` / `PriceCard` width caps from Step 4.3 unchanged.
- All other components, theme tokens, screens.

### Verification
- `tsc --noEmit` → exit 0.
- `expo export --platform ios` → bundled clean (5.98 MB Hermes — same as prior).
- Visual confirmation **deferred to user**. Re-test on iPad / iPhone; the cutout should now read as a soft U-curve, FAB raised with about half above the bar, inactive tabs bright but distinguishable from active.

### Reversion
A single `git revert` of this commit restores the prior arc cutout, 22 px protrusion, tertiary inactive color, and the bordered notification dot. Step 7.1's structural fix is unaffected.

---

## Step 7.3 Patch (2026-05-03) — Tab Bar Restructure: FAB Stays in Slot

User-reported visual: dark bar visible (Step 7.1's fix is in effect) but **no rounded corners, no curved cutout, FAB sitting inline with the other tabs at the same vertical baseline**. The fancy SVG features and the raised FAB were both missing.

### Diagnosis

Root cause: the FAB column was positioned with `top: -CUTOUT_PROTRUSION` and relied on `overflow: 'visible'` propagating up through React Navigation's nested wrappers (BottomTabBarHeightCallbackContext.Provider → SafeAreaProviderCompat → expo-router scene container → react-native-screens) to render its raised half above the tab-bar slot. In practice on iPad iOS, that overflow chain doesn't fully respect `'visible'` — the FAB's negatively-positioned top half was being clipped at the slot's top edge, leaving only the bottom half visible inside the slot at the same baseline as the other tab icons.

The same overflow / clipping behavior likely also caused the SVG corner / cutout features to be invisible: with the SVG's painting region clipped to the slot's straight-edge boundary, the rounded corners (which are at the SVG's top edge, right at the clip boundary) and the cutout (which dips down from the same edge) wouldn't render visibly distinct from a flat rectangle. The SVG's curved geometry was correct but the overflow chain was eating the visible difference.

### Architectural fix

Restructured the bar so it doesn't need to escape the slot at all. The slot itself is now taller; the bar's solid surface starts CUTOUT_PROTRUSION pixels below the slot's top edge; the FAB renders at `top: 0` of the slot (no negative positioning). Everything that was previously "above the slot" is now "inside the slot's transparent top zone" — bulletproof against any overflow clipping anywhere in the ancestor chain.

| Concern | Before | After |
| --- | --- | --- |
| Outer slot height | `TAB_BAR_HEIGHT + insets.bottom` (64 + inset) | `TAB_BAR_SLOT_HEIGHT + insets.bottom` (64 + 28 + inset = 92 + inset) |
| SVG vertical placement | `top: 0` of outer (covers full outer) | `top: CUTOUT_PROTRUSION` of outer (covers bottom 64 + inset) |
| SVG rendered height | `TAB_BAR_HEIGHT + insets.bottom` | `TAB_BAR_HEIGHT + insets.bottom` (unchanged) |
| Items row | `height: 64` at top of outer | `marginTop: CUTOUT_PROTRUSION` + `height: 64` |
| FAB column | `position: 'absolute', top: -28` (relied on `overflow: 'visible'`) | `position: 'absolute', top: 0` (renders inside the slot, no overflow needed) |
| FAB visual position | Half above bar (intended) — half clipped (actual) | Half above bar (the protrusion zone IS above the bar visually because the bar starts 28 px below slot top) |
| `tabBarStyle.height` | `TAB_BAR_HEIGHT + insets.bottom` | `TAB_BAR_SLOT_HEIGHT + insets.bottom` (RN reserves the larger slot) |

Net effect on screen content: the home feed loses 28 px at the bottom — `useBottomTabBarHeight()` now returns the larger slot height. Acceptable; the protrusion zone is transparent so the feed paints under it (only the FAB occludes a small circle in the middle).

### Files modified
- [src/components/navigation/CustomTabBar.tsx](src/components/navigation/CustomTabBar.tsx) — exports new `TAB_BAR_SLOT_HEIGHT = TAB_BAR_HEIGHT + CUTOUT_PROTRUSION`. Outer height changed from `totalHeight` to `slotHeight`. Removed `overflow: 'visible'` (no longer needed). SVG container's `top` changed from `0` to `CUTOUT_PROTRUSION`. SVG `height` prop changed from `totalHeight` to `barHeight`. Items row gained `marginTop: CUTOUT_PROTRUSION`. FAB column's `top` changed from `-CUTOUT_PROTRUSION` to `0`. Inline comments explain the layout invariants for future readers.
- [src/app/(protected)/(tabs)/_layout.tsx](src/app/(protected)/(tabs)/_layout.tsx) — imports `TAB_BAR_SLOT_HEIGHT` (replaces `TAB_BAR_HEIGHT`). `tabBarStyle.height` changed to `TAB_BAR_SLOT_HEIGHT + insets.bottom`. Comment updated.

### Why this is more robust
- **No reliance on `overflow: 'visible'` chain.** Every visible element is within the layout slot's bounds.
- **No negative absolute positioning.** All offsets are zero or positive, easy to reason about.
- **Same SVG path math.** If the curve features still don't render after this restructure, the issue is with the SVG itself (not the chrome around it) — that's a much narrower diagnosis surface for the next iteration.
- **Step 7.2's two-bezier path stays.** The cutout shape is unchanged in geometry; just where it paints in the slot moved.

### Verification
- `tsc --noEmit` → exit 0.
- `expo export --platform ios` → bundled clean (5.98 MB).
- Visual confirmation **deferred to user — please re-test on iPad and post a fresh screenshot**. Expected: the dark bar starts 28 px below the slot's top edge; rounded top corners visible at the bar's top edge; smooth bezier cutout visible at top center; coral FAB sitting with its center roughly on the bar's top edge — top half above the bar (in the transparent protrusion zone) and bottom half nesting into the cutout. The "Sell" label sits ~16 px higher than the other tab labels (because the FAB extends down into the bar), which matches the reference image.

### Reversion
A single `git revert` of this commit restores the prior structure (outer = bar height only, FAB at `top: -28` relying on `overflow: 'visible'`). The Step 7.1 structural fix and Step 7.2 visual tune both remain.

---

## Step 7.4 Patch (2026-05-03) — Tab Bar Overlays Screen Content

After Step 7.3 the user posted a fresh screenshot: **the FAB is now correctly raised** (architecture restructure worked) but **the rounded corners and curved cutout are still invisible** — the bar reads as a flat dark rectangle with the FAB nesting on top.

### Diagnosis

Step 7.3 made the bar slot taller and positioned everything inside its bounds, which fixed the FAB clipping. But it also **kept the bar in-flow** — RN reserved `tabBarStyle.height = TAB_BAR_SLOT_HEIGHT + insets.bottom` worth of screen space for the bar slot, pushing the screen content (the product image) UP above the slot. The transparent protrusion zone at the top of the slot had nothing visually distinct behind it: the React Navigation theme's dark background painted there, identical in colour to my SVG's `colors.surface` (`#0A0A0A`). The cutout and rounded corners *were* rendering correctly — they were just visually indistinguishable from a flat rectangle because both sides of the curve were the same dark colour.

The reference image works because the bar **floats over the product image** — the curves read against the lighter feed showing through the transparent zones, not against another dark layer.

### Fix

Make the bar an **overlay** instead of an in-flow element, and tell RN to reserve only the *solid* bar height — not the protrusion zone — so the feed extends behind the protrusion zone where the curves can be seen.

| Concern | Step 7.3 | Step 7.4 |
| --- | --- | --- |
| Outer position | in-flow (regular layout child of tab-bar slot) | `position: 'absolute', bottom: 0, left: 0, right: 0` |
| Outer `pointerEvents` | (default `auto`) | `'box-none'` — feed scroll passes through transparent zones to whatever's behind |
| Outer height | `slotHeight` (= solid + protrusion) | `slotHeight` (unchanged — still includes both zones) |
| `tabBarStyle.height` | `TAB_BAR_SLOT_HEIGHT + insets.bottom` (reserves solid + protrusion) | `TAB_BAR_HEIGHT + insets.bottom` (reserves solid only) |
| Empty `newPost` slot | `pointerEvents` default | `'box-none'` (touches in narrow strips beside the FAB pass through) |
| `useBottomTabBarHeight()` consumers | reserve solid + protrusion | reserve solid only — feed item bottom 28 px renders behind the bar's protrusion zone |

### Net effect
- Feed item height grows by 28 px (the protrusion zone is no longer reserved).
- The bar still occupies the same visual region (bottom `slotHeight + insets`), but the bottom 28 px of each feed item now paints THROUGH the bar's transparent protrusion zone.
- The rounded top corners of the bar are visible because the area outside the corners (top-left and top-right rectangles) is transparent — the feed shows through there.
- The cutout is visible because its area is transparent — the feed shows through.
- The FAB occludes a 56 px circle in the middle.
- Touches in transparent zones (cutout edges, areas above and beside the rounded corners) pass through to the feed via `pointerEvents: 'box-none'` on the outer.

### Why this is the right answer
- The reference image's bar is a glass overlay, not a frame around the feed. To match, the bar must overlay.
- React Navigation's `tabBarStyle.position: 'absolute'` was the same intent in the legacy layout (pre-Step-7), but it only applies to RN's own default `BottomTabBar`. With a custom `tabBar` we own positioning entirely — Step 7.1 backed away from absolute on the assumption it was the bug, but the actual bug then was overflow clipping on the FAB. Now with the FAB renderable inside the slot bounds (Step 7.3), absolute positioning is safe again and necessary for the visual.

### Files modified
- [src/components/navigation/CustomTabBar.tsx](src/components/navigation/CustomTabBar.tsx) — outer wrapped with `position: 'absolute', bottom: 0, left: 0, right: 0` + `pointerEvents: 'box-none'`. Inline comments document the overlay strategy and the touch-passthrough rationale. Empty newPost slot also marked `pointerEvents: 'box-none'`.
- [src/app/(protected)/(tabs)/_layout.tsx](src/app/(protected)/(tabs)/_layout.tsx) — `tabBarStyle.height` reverted to `TAB_BAR_HEIGHT + insets.bottom` (solid bar only). Comment updated to explain why the protrusion isn't reserved.

### Untouched
- TabBarBackground SVG geometry — unchanged from Step 7.2.
- TabBarItem, SellFAB — unchanged.
- All other screens and components.

### Verification
- `tsc --noEmit` → exit 0.
- `expo export --platform ios` → bundled clean (5.98 MB).
- Visual confirmation **deferred to user — please re-test on iPad and post a screenshot**. Expected: rounded top corners and the smooth bezier cutout are now both visible because the product image (lighter background) shows through the bar's transparent zones. FAB nests inside the cutout. Feed scrolls underneath the protrusion zone (bottom 28 px of each item visible behind the bar's transparent top zone, with the FAB occluding a small circle in the middle).

### Reversion
A single `git revert` of this commit returns to the in-flow layout from Step 7.3 (FAB raises correctly but curves are invisible against the dark Stack background).

---

## Step 7.5 Patch (2026-05-03) — SVG Arc Replaced with Bézier Corners

After Step 7.4 the bar overlay was structurally correct (visible to the user) but the rounded corners and U-cutout were still not appearing. A debug-instrumented bundle (cyan SVG fill, magenta outline, dashed bounds borders) confirmed:

1. Outer slot, SVG container, and FAB column were all positioned correctly.
2. The SVG **was** rendering (cyan fill visible exactly where expected).
3. But the cyan top edge was a perfectly flat line — even at `cornerRadius: 60` and `cutoutRadius: 100`, **the SVG `A` arc command was silently producing no curvature** in this path on iPad. The cubic-Bezier cutout segment wasn't being reached because it sat between the two non-functioning arcs.

### Fix

Replaced the SVG `A` (elliptical arc) command with **explicit cubic Bézier** corners using the standard kappa approximation (`kappa = 0.5523`, four-point quarter-circle). With Bézier-only corners the curves rendered immediately and unmistakably in the next test bundle.

Path before:
```
M 0 r → A r r 0 0 1 r 0 → ... cutout ... → L (W-r) 0 → A r r 0 0 1 W r → ...
```

Path after:
```
M 0 r → C 0 (r·(1-kappa)) (r·(1-kappa)) 0 r 0 → ... cutout ... → L (W-r) 0
       → C (W-r·(1-kappa)) 0 W (r·(1-kappa)) W r → ...
```

### Why arcs failed silently
Most likely a quirk in this version of `react-native-svg` (~15.12.1) interacting with the specific path shape — the arcs may have computed degenerate parameters or were ignored when followed by certain cubic-Bezier sequences. Couldn't reproduce in a tighter test, so didn't investigate further: the Bézier replacement is the standard reliable workaround and produces visually identical geometry. If the arc command starts working after a future RN-SVG upgrade, we don't need to revisit — the Bézier path is geometrically the same shape.

### Production values (debug verified, then dialed back)
- `cornerRadius` default: **24** (subtle, matches the reference image's modest corner rounding)
- `cutoutRadius` default: **48** (chord half-width; chord is 96 px wide, cleanly clearing the 56 px FAB on either side)
- `cutoutDepth` default: **18** (sagitta; depth into the bar — the FAB's bottom half nests in this scoop)

### Debug instrumentation removed
- `DEBUG_BAR` constant in CustomTabBar — gone
- Yellow / green / red dashed borders on outer / SVG container / FAB column — gone
- `debug` prop on TabBarBackground — gone (along with the cyan/magenta override logic)
- Production palette restored: SVG fill `colors.surface`, optional hairline `colors.border` (`showTopHairline` opt-in)

### Files modified
- [src/components/navigation/TabBarBackground.tsx](src/components/navigation/TabBarBackground.tsx) — full rewrite of the path construction. Top corners now via `topLeftCorner` and `topRightCorner` cubic-Bezier expressions (one cubic each). Cutout segment unchanged from Step 7.2's two-bezier U-curve. TSDoc updated to document the kappa-Bézier approach and call out the arc-command failure for future maintainers. `debug` prop and resolved-color overrides removed.
- [src/components/navigation/CustomTabBar.tsx](src/components/navigation/CustomTabBar.tsx) — `DEBUG_BAR` constant and the three dashed-border style spreads removed. `debug` prop no longer passed to `TabBarBackground`. Layout structure unchanged.

### Verification
- `tsc --noEmit` → exit 0.
- `expo export --platform ios` → bundled clean (5.98 MB).
- Visual confirmation **deferred to user — please re-test on iPad and post a final screenshot**. Expected: the dark coral / dark-surface bar reads with subtly rounded top corners (24 px), a smooth U-shaped cutout at the top center cradling the coral FAB, and the chair / product image showing through the transparent zones (above the rounded corners on each side, and around the FAB in the cutout). Production palette only — no more cyan, magenta, or dashed borders.

### Reversion
A single `git revert` of this commit re-introduces the SVG `A` arc commands and the debug instrumentation. The arc commands won't render the corners (we just confirmed) — only revert if you also revert further back.

---

## Step 7.6 Patch (2026-05-03) — Device Adaptation (Phone / Tablet / Landscape)

User asked: "make sure totally adapted to any device phone etc..." After the iPad-targeted fixes, this pass makes the bottom navbar and the marketplace header read well on every form factor — small phones, large phones, iPad portrait, iPad landscape, with notched safe-area insets.

### Issues addressed

1. **Horizontal safe-area insets** — On notched iPhones in landscape (Pro / Pro Max), `insets.left` and `insets.right` are non-zero (typically 44–47 px). The previous tab bar items row used `paddingHorizontal: spacing.sm` without honoring those insets, so the leading and trailing tabs would clip under the notch / camera island.
2. **Tab labels overflow on small phones** — On iPhone SE (375 pt wide), each tab slot is roughly `(375 − 16) / 5 ≈ 71 px`. Localized labels like "Categories" or "Catégories" exceed that at 11 pt font, causing wrap or visual overflow.
3. **Items + FAB spread too wide on iPad / landscape** — On iPad Pro 12.9" landscape (1366 pt wide), the 5 tab slots get ~273 pt each. The visual cluster gets lost in negative space and the FAB looks adrift.
4. **MarketplaceHeader same issue** — Tab cluster + Search were stretched across the whole top of wide screens.
5. **Cutout center misaligned with FAB on wide screens** — When the items cluster centers in a max-width region, the FAB sits in that cluster's center, not the screen center. The SVG cutout was previously hard-coded to screen center.

### Fix

Used the existing `useDeviceLayout` convention pattern and `useSafeAreaInsets` from `react-native-safe-area-context`. Same approach in both components:

```ts
const usableWidth = Math.max(0, width - insets.left - insets.right)
const contentWidth = Math.min(usableWidth, MAX_CONTENT_WIDTH) // 640
const horizontalPad = Math.max(spacing.lg, (usableWidth - contentWidth) / 2)
```

The dark surface / floating chrome stays full-screen-width as before; the *interactive content* clusters into a centered max-width region, with safe-area insets forming the minimum padding.

### Files modified

- [src/components/navigation/CustomTabBar.tsx](src/components/navigation/CustomTabBar.tsx)
  - New constant `TAB_BAR_MAX_CONTENT_WIDTH = 640` documented in code.
  - Items row gains `width: contentWidth` and `marginLeft: contentLeft` so it sits at a consistent visual center.
  - `cx` (used to position the FAB column AND the SVG cutout center) computed from `contentLeft + contentWidth / 2` instead of `width / 2`. The cutout follows the FAB on wide screens — they stay perfectly aligned.
  - Horizontal safe-area insets honored by the `contentLeft` calculation: on notched landscape iPhones, the cluster slides inboard of the notch.

- [src/components/navigation/TabBarItem.tsx](src/components/navigation/TabBarItem.tsx)
  - Label `Text` gets `numberOfLines={1}`, `maxWidth: '100%'`, and `allowFontScaling={false}`. The clamp prevents two-line wrap on small phones; `allowFontScaling={false}` keeps the bar's vertical rhythm intact when the user has accessibility text-scaling enabled (the rest of the app honors scaling — only the tab labels are intentionally fixed).

- [src/components/feed/MarketplaceHeader.tsx](src/components/feed/MarketplaceHeader.tsx)
  - New constant `HEADER_MAX_CONTENT_WIDTH = 640`.
  - Replaced `paddingHorizontal: spacing.lg` with split `paddingLeft / paddingRight` that honor `insets.left / insets.right` plus the centering math.
  - Imported `useWindowDimensions` to compute the cluster size.

### Per-device behavior (post-patch)

| Device | Width | Behavior |
| --- | --- | --- |
| iPhone SE / 8 | 375 pt | Items fill 359 pt (with 8 pt padding). Labels clamp via `numberOfLines={1}`. FAB at screen center. No safe-area insets. |
| iPhone 14 / 15 | 390–393 pt | Same as above. Bottom home-indicator inset honored (already handled by `insets.bottom` since Step 7). |
| iPhone 14/15 Pro Max | 430 pt | Items fill 414 pt. Comfortable. |
| Notched iPhone landscape | up to 932 pt with ~47 pt L/R insets | **Cluster slides inboard of the notch on each side**; items clamp to the centered 640 pt region, with the rest of the dark bar painted edge-to-edge under the notch. |
| iPad mini portrait | 744 pt | Cluster constrained to 640 pt, centered. Comfortable. |
| iPad Air/Pro 11 portrait | 820 pt | Same, 640 pt cluster centered. |
| iPad Pro 12.9 portrait | 1024 pt | 640 pt cluster, ~192 pt of dark surface on each side (matches the reference image's intent — tabs reachable, bar full-width). |
| iPad Pro 12.9 landscape | 1366 pt | 640 pt cluster centered, ~363 pt of dark on each side. Tabs feel anchored, FAB still aligned with cutout. |

### Untouched
- TabBarBackground SVG geometry — unchanged.
- SellFAB — unchanged. The FAB diameter (56 px) is constant on all devices, which is the correct iOS/Material design behavior for primary FABs.
- `_layout.tsx` `tabBarStyle` — unchanged.
- All other components, the action rail (legacy), screens, and the data layer.

### Verification
- `tsc --noEmit` → exit 0.
- `expo export --platform ios` → bundled clean (5.98 MB).
- Visual confirmation **deferred to user**. Worth checking: iPhone simulator (any model with home indicator), iPad portrait, iPad landscape rotation. The tab bar items should cluster comfortably in the center on iPad, and labels should never wrap on small phones.

### Reversion
A single `git revert` of this commit returns to the iPad-only-tested layout (no max content width, no horizontal safe-area). The bar will look correct on iPhone portrait but get spread out on iPad / landscape.


## Step A.2 Changelog (2026-05-03) — Categories Page Redesign (D3)

Replaced the flat icon-grid Categories page with a curated D3 layout:
title block → Tendances rail → Nouveautés rail → 2-column category
grid. Pure UI + two new React Query hooks. No Supabase schema changes,
no shared-state changes, no other screens touched.

### Reconnaissance findings

Confirmed before writing code:

- **Existing screen behavior** ([friends.tsx](src/app/(protected)/(tabs)/friends.tsx)) — Default export `CategoriesScreen`. Tap pattern: `setFilters({ categoryId, subcategoryId: null })` → `setMainTab('marketplace')` → `router.push('/(protected)/(tabs)')` with `mediumHaptic()`. Mirrored exactly in the new screen.
- **Filter store setter** ([useMarketplaceFilters.ts:33-34](src/stores/useMarketplaceFilters.ts:33)) — `setFilters(patch: Partial<MarketplaceFilters>)`. There is no `setCategory(id)` setter — the prompt's suggested signature didn't match the codebase, so the new screen calls `setFilters({ categoryId, subcategoryId: null })` to match the existing pattern.
- **`likes_count` aggregate** ([20260501_initial_marketplace_schema.sql:52](supabase/migrations/20260501_initial_marketplace_schema.sql:52), [products.ts:57](src/features/marketplace/services/products.ts:57)) — Confirmed `integer not null default 0` on `products`. Trending uses real likes ordering (no recency-fallback path needed).
- **Hooks pattern** ([useProducts.ts](src/features/marketplace/hooks/useProducts.ts), [useFilteredProducts.ts](src/features/marketplace/hooks/useFilteredProducts.ts)) — Each hook is a thin `useQuery` wrapper around a service function in [services/products.ts](src/features/marketplace/services/products.ts). New hooks follow this convention. Query keys use the `['marketplace', 'products', ...]` prefix used everywhere else; the prompt's suggested `['products', ...]` keys were renamed to keep the prefix consistent (deviation noted below).
- **Product detail navigation** — There is no `/product/[id]` route. Product detail is a global bottom sheet rendered in [(protected)/_layout.tsx:10](src/app/(protected)/_layout.tsx:10), opened via `useProductSheetStore.getState().open(productId)` ([useProductSheetStore.ts](src/stores/useProductSheetStore.ts)). Rail items use this store; no new route was introduced.
- **Icon library** — Both `Ionicons` and `MaterialCommunityIcons` are available via `@expo/vector-icons` (already used across the app, e.g. [CustomTabBar.tsx:5](src/components/navigation/CustomTabBar.tsx:5)).
- **Theme primitives** ([src/components/ui/](src/components/ui/index.ts)) — `Text`, `Surface`, `GlassCard`, `Pressable` all expose the variants/props the prompt assumed. No new primitives.
- **i18n** — Fully wired. New keys added under the existing `categories` namespace in [fr.json](src/i18n/locales/fr.json) and [en.json](src/i18n/locales/en.json).
- **Category ids** — The actual ids in `CATEGORIES` are `auto`, `immo`, `home`, `fashion`, `electronics`, `sports`, `books`, `other` — not the prompt's placeholder ids (`maison-deco`, `tech`, `bebe-enfant`, `loisirs`, `autres`). The icon mapping was keyed off the real ids; the fallback is `other`.
- **`expo-image`** — Already in [package.json:32](package.json:32) (`~3.0.11`), previously unused. First adoption is `RailProductCard.tsx` per spec.
- **`formatPrice`** — Existing helper at [src/lib/format.ts:13](src/lib/format.ts:13). Reused.

### Files created

- [src/features/categories/icons.ts](src/features/categories/icons.ts) — `CATEGORY_ICONS: Record<id, { lib, name }>` and `getCategoryIcon(id)` fallback. Source of truth for the new page's icons; legacy `iconName` on each `CategoryDef` is left untouched for older surfaces.
- [src/features/marketplace/hooks/useTrendingProducts.ts](src/features/marketplace/hooks/useTrendingProducts.ts) — `useQuery` over `listTrendingProducts({ sinceDays: 7, limit: 12 })`. Key `['marketplace', 'products', 'trending', 'last-7-days']`. `staleTime: 5 min`.
- [src/features/marketplace/hooks/useNewestProducts.ts](src/features/marketplace/hooks/useNewestProducts.ts) — `useQuery` over `listProducts({ limit: 12 })`. Key `['marketplace', 'products', 'newest', 12]`. `staleTime: 2 min`. Reuses the existing service function rather than adding a near-duplicate.
- [src/components/categories/CategorySectionHeader.tsx](src/components/categories/CategorySectionHeader.tsx) — Title + optional subtitle + optional trailing slot. `paddingHorizontal: spacing.lg`, `paddingVertical: spacing.md`.
- [src/components/categories/RailProductCard.tsx](src/components/categories/RailProductCard.tsx) — 156 px square. `expo-image` for the thumbnail, `GlassCard variant="dark"` shell, `Pressable haptic="light"`. Title + `formatPrice(price, currency)`.
- [src/components/categories/CategoryRail.tsx](src/components/categories/CategoryRail.tsx) — `CategorySectionHeader` + horizontal `FlatList` of `RailProductCard`. Loading state renders three `Surface` skeletons (156×220). Empty state renders `Aucun produit` caption.
- [src/components/categories/CategoryCard.tsx](src/components/categories/CategoryCard.tsx) — `Surface variant="surfaceElevated"`, `aspectRatio: 4/5`, icon top, label bottom. Resolves icon library via `getCategoryIcon(id)`.
- [src/components/categories/CategoryGrid.tsx](src/components/categories/CategoryGrid.tsx) — `FlatList numColumns={2} scrollEnabled={false} key="col-2"`. Outer `ScrollView` in the screen handles scroll.

### Files modified

- [src/app/(protected)/(tabs)/friends.tsx](src/app/(protected)/(tabs)/friends.tsx) — Full rewrite. Default export name `CategoriesScreen` preserved. Mirrors the original tap-to-filter behavior exactly: `setFilters({ categoryId: id, subcategoryId: null })` → `setMainTab('marketplace')` → `router.push('/(protected)/(tabs)')`. Reserved Phase G slot as a TODO comment between the Newest rail and the grid (no rendered UI).
- [src/features/marketplace/services/products.ts](src/features/marketplace/services/products.ts) — Added `listTrendingProducts({ sinceDays = 7, limit = 12 })`. Computes a since-timestamp client-side (`new Date(Date.now() - days * 86400000).toISOString()`), filters via `gte('created_at', since)`, orders by `likes_count desc, created_at desc`, joins seller. Returns the same `ListProductsResult` shape as `listProducts` / `searchProducts`.
- [src/i18n/locales/fr.json](src/i18n/locales/fr.json) — Added `categories.subtitle`, `categories.trending`, `categories.newest`, `categories.allCategories`, `categories.noProducts`. Existing `categories.title` and `categories.emptyHint` left untouched.
- [src/i18n/locales/en.json](src/i18n/locales/en.json) — Same keys, English copy.

### i18n status

Wired. The project ships `react-i18next` + `i18next` and the new screen uses `useTranslation()` / `t()` consistently with every other screen. All six new strings have French + English entries.

### Trending definition used

**Real `likes_count` ordering**, no fallback. `likes_count integer not null default 0` is present on `products` (verified in migration 20260501 and in the `ProductRow` type). The hook orders by `likes_count desc, created_at desc` over rows where `created_at >= now() - 7 days`. If a category has zero recent listings the rail's empty state ("Aucun produit") shows; if the project goes dormant for >7 days the rail will be empty until new listings land — this is intentional behaviour, not a bug.

### Deviations from the prompt

1. **Category ids.** The prompt's `CATEGORY_ICONS` was keyed `maison-deco/mode/tech/auto/sports/loisirs/bebe-enfant/autres`. Actual ids in `CATEGORIES` are `auto/immo/home/fashion/electronics/sports/books/other` — the icon mapping was rewritten to match. Fallback id is `other`, not `autres`. The prompt explicitly authorized this adaptation: *"if the ids differ, adapt"*.
2. **Filter setter.** The prompt's `setCategory(id)` does not exist. The new screen calls `setFilters({ categoryId, subcategoryId: null })` to match the existing setter and to mirror the original `friends.tsx` behavior verbatim.
3. **Query-key prefix.** The prompt suggested `['products', ...]`. The codebase convention everywhere else is `['marketplace', 'products', ...]` — keys were prefixed with `marketplace` for cache-key consistency.
4. **Newest-rail service function.** The prompt allowed for a separate function. Reused the existing `listProducts({ limit })` instead, since the existing service already orders by `created_at desc` and limits — adding a duplicate function would have been pointless.
5. **`expo-image` placement.** Adopted only in `RailProductCard.tsx` (per scope). Existing `<Image>` consumers in `ProductFeedItem` / `ProductDetailSheet` are untouched.

### Untouched

- Supabase schema and any migration. No new tables/columns.
- `useMarketplaceFilters`, `MarketplaceFilterSheet`, `useFilteredProducts` — reused as-is.
- Home feed, action rail, top header, tab bar, all other screens.
- Legacy JSONB `products.category` field and its consumers (`ProductBottomPanel` breadcrumb).
- `src/features/marketplace/data/categories.ts` — ids and labels untouched. Legacy `iconName` on each def left in place (still consulted by older surfaces).
- The `friends.tsx` route name. Rename to `categories.tsx` deferred to Step 8 / Phase F per spec.

### Reserved Phase G slot

A `// TODO(Phase G):` comment block sits between the Newest rail and the grid in `friends.tsx`, marking where a `<CategoryRail title={t('categories.nearMe')} ... />` will land once a near-me query (radius + lat/lng or PostGIS) ships. No rendered UI, no unused i18n key, no near-me hook scaffold — Phase G owns the entire near-me path end-to-end (per the audit's location reconnaissance: geo is greenfield).

### Verification

- `tsc --noEmit` → exit 0.
- Visual confirmation **deferred to user**. Acceptance criteria:
  - Tapping the Categories tab lands on the new layout (header → Tendances → Nouveautés → grid).
  - Trending rail shows products from the last 7 days, ordered by `likes_count`.
  - Newest rail shows the most recent 12 products.
  - Tapping a rail product opens the global product detail sheet.
  - Tapping a category card sets the filter and jumps to the home feed showing only that category.
  - All copy is localized via i18n (FR by default, EN when locale is set).
  - No hardcoded colors, spacing, radii, or typography — all token-driven.

### Reversion

A single `git revert` of this commit restores the previous flat-grid `friends.tsx`, removes the new components, hooks, and i18n keys, and drops `listTrendingProducts` from the products service. No schema migration involved, so revert is symmetric.

---

## Step G.1 Changelog (2026-05-03) — Geo Schema Migration

Schema-only step. Adds latitude/longitude (and helpers) to `products` and the user-profile table so subsequent Phase G steps (G.2 geocoding, G.3 device location, G.4 RPC, G.5 feed integration, G.6 posting flow) have something to read and write.

### Reconnaissance findings

- **Migrations directory:** `supabase/migrations/`. Convention is `YYYYMMDD_descriptive.sql` with lowercase SQL keywords, `if not exists` everywhere, no transaction wrappers, no paired down-migrations. Newest existing migration before this step: `20260512_push_tokens.sql`.
- **`products` schema (current):** matches the audit. Has `location text` (free-form, ilike search) and `pickup_available boolean`. Confirmed via [supabase/migrations/20260501_initial_marketplace_schema.sql:35](supabase/migrations/20260501_initial_marketplace_schema.sql:35) and [supabase/migrations/20260504_pickup_location.sql:1](supabase/migrations/20260504_pickup_location.sql:1).
- **No `profiles` table.** The de-facto user profile table is `public.sellers` — it has a 1:1 link to `auth.users` (via `user_id`, added in `20260503_sell_setup.sql`) and carries profile fields `bio`, `website`, `phone_public`, `email_public` (added in `20260508_seller_contact.sql`). The Phase G brief refers to "profiles"; this step **maps that to `sellers`** and adds geo columns there. Surfaced for confirmation — flag if the intent was instead to create a brand-new `profiles` table.
- **RLS:** `sellers` already has policies (`sellers public read`, `sellers user read own`, `sellers update own`) and `products` likewise. This migration does **not** touch any policy.
- **Generated TypeScript types:** the project does **not** generate Supabase types. There is no `src/types/supabase.ts` (or equivalent), and no `supabase gen types` script in `package.json`. Existing client code calls `supabase.from('...')` untyped.
- **Local Supabase:** **not configured.** No `supabase/config.toml`, no `.supabase/` directory, no `supabase` binary in `PATH`, no `supabase` scripts in `package.json`. The project is remote-only.

### PostGIS path chosen: PRIMARY (with caveat)

- No existing migration enables `postgis`. Only `uuid-ossp` is created (in `20260501`).
- Supabase officially supports the `postgis` extension on every project tier, so the migration uses the PRIMARY path: `create extension if not exists postgis`, generated `location_point geography(Point, 4326)` columns, and GIST indexes. G.5's RPC will use `ST_DWithin`.
- **Caveat:** without a local Supabase environment, the `create extension postgis` was **not executed and not verified** as part of this step. If the user's hosted project unexpectedly cannot enable PostGIS, the migration includes a **FALLBACK** SQL block (commented at the bottom of the file) that drops the extension + generated columns + GIST indexes and keeps only lat/lng + the BTREE composite indexes. G.5 would then need Haversine PL/pgSQL instead of `ST_DWithin`.

### Migration file

- Path: `supabase/migrations/20260513_geo_columns.sql`
- Content summary:
  - Wrapped in `begin; ... commit;` — partial application impossible.
  - `create extension if not exists postgis;`
  - `products`: adds `latitude double precision`, `longitude double precision`, `location_updated_at timestamptz`, generated `location_point geography(Point, 4326)`, GIST index `products_location_point_gix`, partial BTREE index `products_lat_lng_idx (latitude, longitude) where latitude is not null and longitude is not null`.
  - `sellers` (mapped from "profiles"): adds `latitude`, `longitude`, `location_text text`, `location_updated_at`, generated `location_point`, GIST index `sellers_location_point_gix`, partial BTREE `sellers_lat_lng_idx`.
  - All DDL uses `if not exists`. Existing columns are not modified. RLS policies are not modified. No `not null` constraints (every new column nullable).
  - Existing `products.location text` is **untouched** — it becomes the human-readable display name going forward. **No** duplicate `location_text` was added to `products`.
  - Inline `-- ROLLBACK SQL` block at the top of the file documents the exact reversal commands.

See [supabase/migrations/20260513_geo_columns.sql](supabase/migrations/20260513_geo_columns.sql).

### Local apply log — **DEFERRED (blocker)**

- The brief says: *"If the project does not have local Supabase running, STOP and report. The user must spin up the local stack (`supabase start`) before this step can verify."*
- Local Supabase is not configured in this repo. **Local apply was skipped.** No log to capture.
- To enable local verification before applying to production, the user can:
  ```bash
  npm i -g supabase                  # or use a project-local install
  supabase init                      # creates supabase/config.toml
  supabase start                     # spins up the local stack
  supabase db reset --local          # applies all migrations including this one
  ```

### Generated types regeneration — **DEFERRED (blocker)**

- The project has no Supabase type-generation script and no committed generated types file.
- Per the brief, this step **STOPs and reports** rather than hand-editing types or scaffolding a generation pipeline (that is a project-tooling decision the user should make).
- When the user is ready, the standard command (after `supabase login` + `supabase link --project-ref <ref>`) is:
  ```bash
  supabase gen types typescript --linked > src/types/supabase.ts
  ```
  After that, `latitude`, `longitude`, `location_text`, `location_updated_at`, and `location_point` will appear on the `products` and `sellers` row types. (Generated `location_point` may type as `unknown`/`string` — the geography column is opaque to the JS client; the app should always read/write `latitude`+`longitude` and let the DB compute `location_point`.)

### Verification performed

- `tsc --noEmit` → exit 0. Migration is a `.sql` file, excluded from the TS include path; existing TS unaffected.
- Manual schema sanity checks (`\d public.products`, `\d public.sellers`, `\di public.products_location*`, `select extname from pg_extension where extname = 'postgis'`) **deferred** — they require a running database. Acceptance criteria for the user once applied:
  - `\d public.products` shows `latitude double precision`, `longitude double precision`, `location_updated_at timestamp with time zone`, `location_point geography(Point,4326)`.
  - `\d public.sellers` shows the same plus `location_text text`.
  - `\di public.products_*` shows `products_location_point_gix` (GIST) and `products_lat_lng_idx` (BTREE, partial).
  - `\di public.sellers_*` shows the equivalent two indexes for `sellers`.
  - `select extname from pg_extension where extname = 'postgis';` returns one row.
  - Existing rows have NULL `latitude`/`longitude` (no backfill performed).

### Production apply instructions (user runs when ready)

1. Make sure the local working tree is clean and the migration commit has landed.
2. Link the project (one-time): `supabase login && supabase link --project-ref <project-ref>`.
3. Apply: `supabase db push --linked`.
4. (Optional) Regenerate types: `supabase gen types typescript --linked > src/types/supabase.ts`.
5. If `create extension postgis` fails (very rare on Supabase), revert the new migration commit, swap the file to the FALLBACK block at the bottom, recommit, and reapply. G.5 will need Haversine PL/pgSQL instead of `ST_DWithin`.

### Known follow-ups

- **Backfill existing rows.** Existing `products.location` strings (e.g. "Dubai, UAE") have no coordinates. A future one-off geocoding script can populate `products.latitude`/`longitude` from the existing text. Out of scope for G.1; flagged for a later phase (likely after G.2 lands a geocoding helper).
- **No `profiles` table created.** Geo columns went on `sellers` since that is the user-profile table in this project. If the longer-term plan wants a separate `profiles` table (e.g. to decouple buyer accounts from seller accounts), that is a larger model change deserving its own step.

### Reversion

- **The migration file itself:** `git revert <commit>` removes `supabase/migrations/20260513_geo_columns.sql` and the changelog edit.
- **Any DB it has been applied to:** the rollback SQL is at the top of the migration file (commented). Run it manually against each environment where the migration was applied. The block drops the indexes, then the generated `location_point` columns, then the lat/lng/location_text/location_updated_at columns. It deliberately does **not** drop the `postgis` extension (other future migrations may need it).

---

## Step G.2 Changelog (2026-05-03) — Geocoding Service Wrapper

Provider-agnostic geocoding module. Forward (address → coordinates) and reverse (coordinates → address) behind a typed `GeocodingProvider` interface, with one concrete implementation (Nominatim, free, no API key). Used downstream by G.4 (browse-area picker), G.6 (posting flow), and Phase B (seller profile location). No UI or React Query hooks in this step.

### Reconnaissance findings

- No existing geocoding helpers, no `nominatim`/`mapbox`/`geocoding` packages in `package.json`.
- No HTTP wrapper in `src/lib/`. Existing HTTP traffic goes through `@supabase/supabase-js`. Decision: use raw `fetch` (built-in) for the geocoding service.
- Env convention: `process.env.EXPO_PUBLIC_*` (used by [src/lib/supabase.ts:6](src/lib/supabase.ts:6)). Provider selector reads `EXPO_PUBLIC_GEOCODING_PROVIDER` (defaults to `'nominatim'`).
- `src/lib/` is the right home — it already hosts `supabase.ts` and `format.ts`.

### Files created

- [src/lib/geocoding/types.ts](src/lib/geocoding/types.ts) — `GeoCoordinate`, `GeoLocation`, `GeocodingProvider` interface, `GeocodeOptions`, `ReverseGeocodeOptions`, and the typed `GeocodingError` class (carries `provider`, `status`, `cause`).
- [src/lib/geocoding/throttle.ts](src/lib/geocoding/throttle.ts) — promise-chain throttler. `MIN_INTERVAL_MS = 1100` (just over Nominatim's 1 req/s fair-use limit). `throttled<T>(fn)` queues calls and serialises them; the chain swallows errors locally so one failure doesn't poison subsequent calls.
- [src/lib/geocoding/cache.ts](src/lib/geocoding/cache.ts) — in-memory LRU. Capacity 200, TTL 24 h. Forward keys: `provider:fwd:locale:limit:lower(query)`. Reverse keys: `provider:rev:locale:lat,lng` with coords rounded to 4 dp (~11 m). Process-only — cleared on app reload. AsyncStorage persistence intentionally deferred.
- [src/lib/geocoding/nominatim.ts](src/lib/geocoding/nominatim.ts) — Nominatim implementation. `User-Agent: Pictok/1.0 (contact: support@pictok.app)` (top-of-file constant — change in one line). Maps `lat/lon/display_name/address.{city,town,village,country,country_code,postcode}` to `GeoLocation`; uppercases `countryCode`. Empty results → `[]` / `null`, never throw. Non-2xx, network errors, and malformed JSON → `GeocodingError` carrying status + provider. Default forward `limit=5`, default `locale='en'`.
- [src/lib/geocoding/index.ts](src/lib/geocoding/index.ts) — public API. Exports `geocodeAddress`, `reverseGeocode`, all types, and `GeocodingError`. Each call: cache read → on miss, `throttled(provider.call)` → on success, cache write → return. Errors do **not** populate the cache.

### Provider chosen + rationale

**Nominatim (OpenStreetMap)** — free, no API key, no SDK. Trade-off is the 1 req/s fair-use cap and the `User-Agent` requirement; both are absorbed inside the wrapper (throttler + constant). Adequate for development and low-volume production. Migration to Mapbox or Google is a one-file swap (see below).

### Throttle / cache config

| Knob | Value | Where |
| --- | --- | --- |
| Min request interval | 1100 ms | [throttle.ts](src/lib/geocoding/throttle.ts) `MIN_INTERVAL_MS` |
| Cache capacity | 200 entries | [cache.ts](src/lib/geocoding/cache.ts) `CAPACITY` |
| Cache TTL | 24 h | [cache.ts](src/lib/geocoding/cache.ts) `TTL_MS` |
| Reverse key precision | 4 dp (~11 m) | [cache.ts](src/lib/geocoding/cache.ts) `REVERSE_PRECISION` |
| Default forward limit | 5 | [nominatim.ts](src/lib/geocoding/nominatim.ts) `DEFAULT_LIMIT` |
| Default locale | `'en'` | [nominatim.ts](src/lib/geocoding/nominatim.ts) `DEFAULT_LOCALE` |

### Sample manual test (do not run in CI — Nominatim is rate-limited and external)

In a dev console (e.g. a temporary screen, or a node REPL with `fetch` polyfill):

```ts
import { geocodeAddress, reverseGeocode } from '@/lib/geocoding';

await geocodeAddress('Dubai');
// → [{ latitude: 25.0747..., longitude: 55.1882...,
//      displayName: 'Dubai, United Arab Emirates',
//      city: 'Dubai', country: 'United Arab Emirates',
//      countryCode: 'AE', ... }, ...]  (up to 5 entries)

await reverseGeocode({ latitude: 25.276, longitude: 55.296 });
// → { latitude: 25.276..., longitude: 55.296...,
//     displayName: 'Burj Khalifa, ...',
//     city: 'Dubai', country: 'United Arab Emirates',
//     countryCode: 'AE', ... }
```

Empty / unmatched queries:
- `geocodeAddress('')` → `[]` (short-circuits, no network call).
- `geocodeAddress('xqzxqzxqz')` → `[]`.
- `reverseGeocode({ latitude: 0, longitude: 0 })` → `null` (Nominatim returns an `error` object for ocean coords).

### Verification performed

- `tsc --noEmit` → exit 0 (project is `strict: true`; no `any` introduced — Nominatim responses are typed `unknown` and narrowed with explicit guards).
- `expo export --platform ios` → exit 0; one `entry-*.hbc` bundle produced clean. Dist directory cleaned up.
- Zero new npm dependencies. `package.json` and `package-lock.json` untouched by this step.

### Migrating to Mapbox / Google later

1. Add a sibling file (e.g. `src/lib/geocoding/mapbox.ts`) exporting a `GeocodingProvider`. Implement `geocode` and `reverseGeocode` against the new HTTP API; map its response shape to the same `GeoLocation`. Keep the throttle/headers concerns inside that file (Mapbox's free tier is more generous; the global throttler is fine to keep at 1.1 s — providers can opt in by calling network code outside `throttled` if they want, but doing it through the same singleton keeps usage predictable).
2. Add an env var: `EXPO_PUBLIC_GEOCODING_PROVIDER=mapbox` and (if needed) `EXPO_PUBLIC_MAPBOX_TOKEN=…`. Read the token inside the new module via `process.env.EXPO_PUBLIC_MAPBOX_TOKEN`.
3. Extend [index.ts](src/lib/geocoding/index.ts) `selectProvider()` with the new case:
   ```ts
   case 'mapbox': return mapboxProvider;
   ```
4. No consumer code change required — `geocodeAddress` / `reverseGeocode` keep the same signature.

### Reversion

`git revert <commit>` removes the entire `src/lib/geocoding/` directory and this changelog section. There are no consumers in this step, so revert is symmetric. No DB or env changes to undo.

---

## Step G.3 Changelog (2026-05-03) — Device Location Hook

Adds the device-GPS primitive: `expo-location` install, `app.json` plugin block with a French permission rationale, and a `useDeviceLocation` hook that exposes permission state, current coordinates, loading/error, and `request` / `refresh` / `openSettings` actions. No UI, no store, no consumer in this step.

### Reconnaissance findings

- `expo-location` was absent from `package.json` and `package-lock.json` (confirmed via grep).
- Hooks directory: `src/hooks/` already exists with [useDeviceLayout.ts](src/hooks/useDeviceLayout.ts) and [usePushNotifications.ts](src/hooks/usePushNotifications.ts). New hook lands as a sibling.
- Existing path alias: `@/* → ./src/*` (`tsconfig.json`). New hook imports `@/lib/geocoding/types` for the shared `GeoCoordinate` type from G.2.
- Existing Expo plugins in [app.json](app.json): `expo-router`, `expo-video`, `expo-camera` (with permissions), `expo-image-picker`, `expo-splash-screen`, `expo-font`, `expo-web-browser`, `expo-localization`, `expo-notifications`. New plugin added at the end of the array, matching the configured-plugin tuple style used by `expo-camera` / `expo-image-picker` / `expo-notifications`.
- **Inconsistency to flag:** existing iOS `infoPlist` rationale strings (`NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`) are in **English** even though the audit + reference call out French as the primary locale. The new `locationWhenInUsePermission` is added in **French** per the G.3 brief. The mismatch is pre-existing and out of scope here; flagged for a follow-up unification pass.
- Permissions array on Android already lists `CAMERA`, `RECORD_AUDIO`. The Expo `expo-location` plugin auto-injects `ACCESS_COARSE_LOCATION` + `ACCESS_FINE_LOCATION` at prebuild time — no manual entry needed (and intentionally **no** `ACCESS_BACKGROUND_LOCATION`).

### Dependency installed

- `expo-location` `~19.0.8` (SDK 54 aligned). Installed via `npx expo install expo-location` so the version range is the one Expo recommends for SDK 54. No other packages added. (`expo install` reports a pre-existing `npm audit` warning — unrelated, not introduced by this step.)

### `app.json` edit

Added a configured-plugin tuple to [app.json](app.json) `plugins`:

```json
[
  "expo-location",
  {
    "locationWhenInUsePermission": "Cette application utilise votre position pour afficher les annonces près de vous."
  }
]
```

- Only `locationWhenInUsePermission` set. **No** `locationAlwaysPermission`, **no** `isAndroidBackgroundLocationEnabled`, **no** background-location flags. Foreground / when-in-use only.
- JSON validated post-edit (`JSON.parse` round-trips clean).
- The plugin handles iOS `NSLocationWhenInUseUsageDescription` and Android `ACCESS_COARSE_LOCATION` / `ACCESS_FINE_LOCATION` automatically at prebuild time; no manual `infoPlist` entry needed.

### Hook file

- Path: [src/hooks/useDeviceLocation.ts](src/hooks/useDeviceLocation.ts)
- Public surface:
  ```ts
  export type LocationPermissionStatus =
    | 'undetermined' | 'granted' | 'denied' | 'restricted';

  export type DeviceLocationState = {
    status: LocationPermissionStatus;
    coords: GeoCoordinate | null;
    accuracyMeters: number | null;
    loading: boolean;
    error: string | null;
    request: () => Promise<LocationPermissionStatus>;
    refresh: () => Promise<void>;
    openSettings: () => Promise<void>;
  };

  export type UseDeviceLocationOptions = {
    accuracy?: 'low' | 'balanced' | 'high';   // default 'balanced'
  };

  export function useDeviceLocation(
    opts?: UseDeviceLocationOptions
  ): DeviceLocationState;
  ```
- Behavior matches the brief:
  - On mount: reads `getForegroundPermissionsAsync()` + `hasServicesEnabledAsync()` to set `status`. **Does not** prompt or fetch.
  - `request()`: fires `requestForegroundPermissionsAsync()`, returns the new mapped status synchronously to the caller.
  - `refresh()`: short-circuits with `error` when status isn't `'granted'`. Otherwise sets `loading=true`, reads `getCurrentPositionAsync({ accuracy })`, populates `coords` + `accuracyMeters`, clears `loading` in `finally`.
  - `openSettings()`: `Linking.openSettings()` wrapped in a try/catch (no-op on platforms that don't support it).
  - Mount/unmount safety: a `mounted` ref guards every async `setState`. A second `statusRef` mirrors `status` so `refresh()` reads the latest value even when called immediately after `request()` (avoids a stale-closure bug).
- Accuracy mapping (per brief):
  - `'low'`      → `Location.Accuracy.Lowest`   (~3 km)
  - `'balanced'` → `Location.Accuracy.Balanced` (~100 m, default)
  - `'high'`     → `Location.Accuracy.High`     (~10 m)
- **Restricted-state mapping:** Expo's `PermissionStatus` enum has only `GRANTED | UNDETERMINED | DENIED` — there is no `RESTRICTED` constant. The hook approximates the brief's fourth state by checking `Location.hasServicesEnabledAsync()` alongside the permission response: **status is `'restricted'` when permissions are `UNDETERMINED` and device location services are disabled at the OS level.** When services come back online, a re-render of the hook (or another `request()` call) re-classifies. iOS parental-control "restricted" cases also surface this way (services disabled).

### Permission-rationale UX guidance for G.4

When G.4 wires the user-location store / browse-area picker, surface UI per status:

| status | Recommended copy | Action |
| --- | --- | --- |
| `undetermined` | "Activer la géolocalisation" | call `request()` |
| `granted` | (no UI) | call `refresh()` when needed |
| `denied` | "Autoriser dans les Réglages" | call `openSettings()` (do **not** call `request()` again — iOS returns the cached denial immediately) |
| `restricted` | "Géolocalisation indisponible sur cet appareil" | disable the action; suggest typing a city instead (G.4's manual location flow) |

iOS-specific note: after a user denies the prompt, subsequent `requestForegroundPermissionsAsync()` calls resolve immediately with `denied` and **do not** show the prompt again. The UI must transition to the `openSettings()` affordance once `status === 'denied'`. The hook already exposes `openSettings()` for this.

### Verification performed

- `tsc --noEmit` → exit 0 (project is `strict: true`; no `any`; uses Expo's `Location.PermissionStatus` enum + `LocationPermissionResponse` type directly).
- `expo export --platform ios` → exit 0; iOS Hermes bundle produced clean (`entry-*.hbc`). Dist directory cleaned up.
- **Not run** — `expo prebuild --clean` (managed workflow); native build / device permission prompt verification.
- **Manual verification deferred to user.** Acceptance criteria when run on iOS:
  - First `request()` shows the system prompt with "Cette application utilise votre position pour afficher les annonces près de vous." (or the OS-localized variant when iOS UI is set to French).
  - Granting the prompt flips `status` to `'granted'`.
  - `refresh()` returns `coords` populated within ~5s.
  - Denying then calling `request()` again resolves immediately without re-prompting; `openSettings()` deep-links to the app's settings screen.

### Reversion

`git revert <commit>` removes:
- `expo-location` from `package.json` + `package-lock.json` (and the `node_modules` install via subsequent `npm install`).
- The `expo-location` plugin tuple in [app.json](app.json).
- [src/hooks/useDeviceLocation.ts](src/hooks/useDeviceLocation.ts).
- This changelog section.

No DB or env changes to undo. There is no consumer of the hook yet, so revert is symmetric.

---

## Step G.4 Changelog (2026-05-03) — User Location Store

Adds a Zustand-backed, AsyncStorage-persisted store holding the user's browse location (coords + display name + source) and search radius. Combines G.2 geocoding and G.3 device GPS into one source of truth that G.5 (RPC) and G.6 (marketplace integration) will consume. No UI in this step.

### Reconnaissance findings

- **Existing Zustand pattern** ([src/stores/useMarketplaceFilters.ts](src/stores/useMarketplaceFilters.ts)): `create<T>()(persist(stateCreator, { name, storage: createJSONStorage(() => AsyncStorage) }))`. Minimal persist config — no `version`, `partialize`, `migrate`, or `onRehydrateStorage`. AsyncStorage import: default import from `@react-native-async-storage/async-storage`. Stores expose flat actions (no nested `actions: {...}` namespace).
- **Existing store layout:** all six current Zustand stores live flat at [src/stores/](src/stores/) (`useAuthStore`, `useRequireAuth`, `useProductSheetStore`, `useMarketplaceFilters`, `useFilterSheetStore`, `useMainTabStore`). There is no precedent for a `src/features/<feature>/stores/` location.
- **Departure from existing layout (deliberate):** the brief explicitly lists the new file at `src/features/location/stores/useUserLocation.ts`. I followed the brief, which establishes a feature-folder convention for this domain. The persistence *pattern* (Zustand + `persist` + `createJSONStorage(() => AsyncStorage)` + flat actions) matches the existing store exactly; only the *file location* differs. If you'd prefer the new store to live at `src/stores/useUserLocation.ts` to match the rest, it's a one-file move.
- Zustand version `^5.0.12` supports `useShallow` from `zustand/react/shallow` (verified in `node_modules/zustand/react/shallow.d.ts`), used by the `useUserCoord` selector helper for stable reference equality.

### Files created

- [src/features/location/constants.ts](src/features/location/constants.ts) — `RADIUS_OPTIONS_KM = [5, 10, 20, 50, 100, 500, 1000, null] as const`, `RadiusKm` type derived via `(typeof RADIUS_OPTIONS_KM)[number]`, `DEFAULT_RADIUS_KM = 20`, `USER_LOCATION_STORAGE_KEY = 'user-location-v1'`, `USER_LOCATION_STORE_VERSION = 1`. `null` in the radius options means "no radius limit".
- [src/features/location/stores/useUserLocation.ts](src/features/location/stores/useUserLocation.ts) — types colocated in the store file (matches the colocated style of `useMarketplaceFilters`). Exports the store hook, a `useHasLocation()` boolean selector, and a `useUserCoord()` selector returning `GeoCoordinate | null`. Action implementations match the brief verbatim (see "Action behavior" below).

### Persistence config

| Field | Value |
| --- | --- |
| Storage engine | `AsyncStorage` via `createJSONStorage` |
| Storage key | `'user-location-v1'` (`USER_LOCATION_STORAGE_KEY`) |
| Schema version | `1` (`USER_LOCATION_STORE_VERSION`) |
| Migrate hook | present, no-op at v1 |
| Partialize | persists all data fields, omits the four action functions |
| Rehydrate guard | resets `radiusKm` to `DEFAULT_RADIUS_KM` if the persisted value isn't in `RADIUS_OPTIONS_KM` (handles corrupted / legacy storage) |

`migrate` and `onRehydrateStorage` are the only places `any` is allowed (Zustand's persisted-state types are awkward there); the rest of the store is fully typed under `strict: true`.

### Default radius + all radius options

```ts
RADIUS_OPTIONS_KM = [5, 10, 20, 50, 100, 500, 1000, null]
DEFAULT_RADIUS_KM = 20
```

`setRadius(km)` validates against `RADIUS_OPTIONS_KM` and throws on out-of-set values.

### Action behavior

| Action | Behavior |
| --- | --- |
| `setManualLocation(query)` | Trims; throws on empty. Calls `geocodeAddress(query, { limit: 1 })`. Returns `false` on no results. On hit, populates lat/lng/displayName/city/country/countryCode + `source = 'manual'` + `lastUpdatedAt = Date.now()`. Does **not** touch `radiusKm`. Geocoding errors propagate. |
| `setDeviceLocation(coord, opts)` | Sets lat/lng + `source = 'device'` + `lastUpdatedAt` synchronously. If `opts.displayName` provided, uses it and clears city/country/countryCode. Otherwise fires a fire-and-forget `reverseGeocode(coord)`; on success, patches displayName + city + country + countryCode **only if** the coord hasn't changed in the meantime (prevents a stale reverse-geocode from overwriting a newer fix); on failure, swallows the error (coords alone are still useful). Never throws. |
| `setRadius(km)` | Validates `km ∈ RADIUS_OPTIONS_KM` and throws on invalid input. Updates only `radiusKm`. Does **not** touch `lastUpdatedAt`. |
| `clear()` | Resets to `INITIAL_DATA` (radius back to default). |

### Selector helpers

- `useHasLocation(): boolean` — `true` when both `latitude` and `longitude` are non-null.
- `useUserCoord(): GeoCoordinate | null` — wrapped in `useShallow` so consumers don't re-render on every store write that touches unrelated fields.

### Verification performed

- `tsc --noEmit` → exit 0 (project is `strict: true`).
- `expo export --platform ios` → exit 0; iOS Hermes bundle produced clean.
- Zero new npm dependencies. Zustand + AsyncStorage already present.
- **Manual sanity deferred to user.** In a dev console / temporary screen:
  ```ts
  import { useUserLocation } from '@/features/location/stores/useUserLocation';
  const s = useUserLocation.getState();
  await s.setManualLocation('Dubai');
  console.log(useUserLocation.getState());
  // → { latitude: ~25.07, longitude: ~55.18, displayName: 'Dubai, …',
  //     source: 'manual', radiusKm: 20, lastUpdatedAt: <ms>, … }
  s.setRadius(50);
  s.clear();
  ```
  Persistence check: write a value, fully reload the app, and confirm the state survives.

### Reversion

`git revert <commit>` removes the `src/features/location/` directory entirely and this changelog section. Persisted AsyncStorage data under the key `user-location-v1` will become orphaned in users' devices but unread (no consumer). To purge proactively, ship a one-line `AsyncStorage.removeItem('user-location-v1')` in a follow-up commit; otherwise the entry just sits dormant. No DB, env, or schema changes to undo.

---

## Step G.5 Changelog (2026-05-03) — Geo-Filtered Products RPC

Migration-only step. Adds `public.products_within_radius(...)` — a geo-aware product search function that G.6 will consume from a new React Query hook to replace (or supplement) `useFilteredProducts` in the marketplace feed. PostGIS-backed (PRIMARY path from G.1).

### Reconnaissance findings

- **PostGIS path confirmed.** `create extension if not exists postgis;` is live (uncommented) at [supabase/migrations/20260513_geo_columns.sql:59](supabase/migrations/20260513_geo_columns.sql:59). The RPC uses `ST_DWithin` / `ST_Distance` against the `location_point geography(Point, 4326)` generated column.
- **Full `products` column list** (29 columns, declaration order across all migrations):

  | # | Column | Type | Added in |
  | --- | --- | --- | --- |
  | 1 | `id` | uuid | 20260501 |
  | 2 | `seller_id` | uuid | 20260501 |
  | 3 | `title` | jsonb | 20260501 |
  | 4 | `description` | jsonb | 20260501 |
  | 5 | `category` | jsonb | 20260501 |
  | 6 | `attributes` | jsonb | 20260501 |
  | 7 | `dimensions` | text | 20260501 |
  | 8 | `price` | numeric(10,2) | 20260501 |
  | 9 | `currency` | text | 20260501 |
  | 10 | `media_type` | text | 20260501 |
  | 11 | `media_url` | text | 20260501 |
  | 12 | `thumbnail_url` | text | 20260501 |
  | 13 | `stock_available` | boolean | 20260501 |
  | 14 | `stock_label` | jsonb | 20260501 |
  | 15 | `shipping_free` | boolean | 20260501 |
  | 16 | `shipping_label` | jsonb | 20260501 |
  | 17 | `likes_count` | integer | 20260501 |
  | 18 | `comments_count` | integer | 20260501 |
  | 19 | `shares_count` | integer | 20260501 |
  | 20 | `bookmarks_count` | integer | 20260501 |
  | 21 | `created_at` | timestamptz | 20260501 |
  | 22 | `pickup_available` | boolean | 20260504 |
  | 23 | `location` | text | 20260504 |
  | 24 | `category_id` | text | 20260505 |
  | 25 | `subcategory_id` | text | 20260505 |
  | 26 | `latitude` | double precision | 20260513 |
  | 27 | `longitude` | double precision | 20260513 |
  | 28 | `location_updated_at` | timestamptz | 20260513 |
  | 29 | `location_point` | geography(Point, 4326) (generated) | 20260513 |

  All 29 are mirrored in the RPC's `RETURNS TABLE` clause in declaration order. The 30th column on the return is the computed `distance_km double precision`.

- **Existing `useFilteredProducts`** ([src/features/marketplace/hooks/useFilteredProducts.ts](src/features/marketplace/hooks/useFilteredProducts.ts)) calls `searchProducts(filters)` ([src/features/marketplace/services/products.ts:135](src/features/marketplace/services/products.ts:135)). Filter parameters supported today and how they're passed to the underlying `from('products').select()` chain:

  | Filter | Source | Maps to |
  | --- | --- | --- |
  | `query` | `MarketplaceFilters.query` | `or(title->>fr.ilike, title->>en.ilike, description->>fr.ilike, description->>en.ilike)` with `%` / `_` stripped |
  | `categoryId` | `MarketplaceFilters.categoryId` | `eq('category_id', …)` |
  | `subcategoryId` | `MarketplaceFilters.subcategoryId` | `eq('subcategory_id', …)` |
  | `priceMax` | `MarketplaceFilters.priceMax` | `lte('price', …)` |
  | `pickupOnly` | `MarketplaceFilters.pickupOnly` | `eq('pickup_available', true)` |
  | `locationQuery` | `MarketplaceFilters.locationQuery` | `ilike('location', …)` (legacy text-only) |

  Sort: hard-coded `created_at desc`. Limit: `20`. No `priceMin`, no offset/cursor.

- **RPC convention.** Existing functions ([20260503_sell_setup.sql:7](supabase/migrations/20260503_sell_setup.sql:7), [20260509_messaging.sql:88](supabase/migrations/20260509_messaging.sql:88)) use `security definer` and grant only to `authenticated`. The new RPC is `security invoker` (per brief — public reads on `products` are RLS-allowed; INVOKER lets the function inherit existing read policies) and grants to `authenticated, anon` so anonymous browsing keeps working.
- **No local Supabase setup, no types-gen script.** Same blockers as G.1 (no `supabase/config.toml`, no CLI in PATH, no `.supabase/` dir, no `supabase gen types` script). Local apply and types regen are deferred — see "Apply" and "Type regeneration" sections below.

### Migration file

- Path: [supabase/migrations/20260514_products_within_radius_rpc.sql](supabase/migrations/20260514_products_within_radius_rpc.sql)
- Wrapped in `begin; … commit;`. Idempotent (`create or replace function`). Inline rollback SQL block at the top.

### Function signature

```sql
public.products_within_radius(
  p_latitude       double precision default null,
  p_longitude      double precision default null,
  p_radius_km      double precision default null,
  p_category_id    text             default null,
  p_subcategory_id text             default null,
  p_min_price      numeric          default null,
  p_max_price      numeric          default null,
  p_search_query   text             default null,
  p_pickup_only    boolean          default null,
  p_sort           text             default 'distance',
  p_limit          int              default 50,
  p_offset         int              default 0
) returns table (
  -- every column of public.products in declaration order, plus:
  distance_km double precision
)
language plpgsql
stable
security invoker
set search_path = public, pg_catalog
```

Notable points:
- **Param superset of `useMarketplaceFilters`.** Includes `p_min_price` (new — existing client only supports `priceMax`) and `p_pickup_only` (mirrors `pickupOnly`). Search query branches across `title->>'fr'|'en'` and `description->>'fr'|'en'` (jsonb-aware), matching the JS client's behavior.
- **Wildcard sanitization.** The function strips `%` and `_` from `p_search_query` before ILIKE concatenation — mirrors the `replace(/[%_]/g, '')` the JS client already does, so callers can pass raw user input without leaking wildcards into the pattern.
- **Sort options:** `'distance'` (default; only meaningful when both lat+lng given), `'newest'`, `'price_asc'`, `'price_desc'`, `'most_liked'`. `created_at desc` is the deterministic tiebreaker.
- **Geo branch is fully NULL-tolerant.** No coords / no radius → no geo filter. With coords + radius → `ST_DWithin(p.location_point, user_point, p_radius_km * 1000.0)` (km → meters), GIST-indexed.
- **Distance column** is `null` when either the user has no point or the product has no `location_point` (e.g. legacy un-geocoded rows).
- **Legacy `locationQuery` ILIKE on `products.location` text is NOT exposed.** Geo radius supersedes it. If G.6 needs that exact text-search semantics during a transition, it can keep calling `searchProducts`.
- **`limit` / `offset` clamped to ≥ 0** via `greatest(…, 0)` to harden against negative input.
- **`security invoker` + `set search_path = public, pg_catalog`.** RLS-respecting; protected against search_path manipulation per Postgres best practice for INVOKER functions calling extension code.
- **Grant:** `to authenticated, anon`.

### Sample verification SQL (run in the Supabase SQL editor or psql after apply — do **not** execute against remote yet)

```sql
-- 1. All products within 10 km of Dubai, sorted by distance
select id, (title->>'en') as title_en, price, round(distance_km::numeric, 2) as km
from products_within_radius(
  p_latitude  := 25.276,
  p_longitude := 55.296,
  p_radius_km := 10,
  p_sort      := 'distance',
  p_limit     := 20
);

-- 2. Filtered by category, broader radius, default sort
select id, (title->>'en'), distance_km
from products_within_radius(
  p_latitude    := 25.276,
  p_longitude   := 55.296,
  p_radius_km   := 50,
  p_category_id := 'home'
);

-- 3. No location, sort by newest (the seeded products have NULL coords —
--    distance_km is null for every row, geo filter is skipped)
select id, (title->>'en'), created_at
from products_within_radius(
  p_sort  := 'newest',
  p_limit := 10
);

-- 4. Subset of filters, no radius, price-asc
select id, (title->>'en'), price
from products_within_radius(
  p_min_price := 50,
  p_max_price := 500,
  p_sort      := 'price_asc'
);

-- 5. Pickup-only + text search, no geo
select id, (title->>'en'), pickup_available
from products_within_radius(
  p_search_query := 'fauteuil',
  p_pickup_only  := true
);
```

Until G.1's data backfill ships, every existing seeded product has NULL `latitude`/`longitude`, so the geo filter only matches products posted *after* G.6's posting flow lands (or after a one-off backfill script geocodes the existing `products.location` strings). This is expected and was flagged as a follow-up in the G.1 changelog.

### Local apply log — **DEFERRED (blocker carried over from G.1)**

- No local Supabase environment in this repo (no `supabase/config.toml`, no CLI, no `.supabase/`). Same STOP as G.1.
- Local apply skipped. No log to capture.

### Production apply instructions (consolidated with G.1)

If you have not yet applied G.1, both migrations land in a single `db push`:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push --linked     # applies 20260513_geo_columns + 20260514_products_within_radius_rpc
```

If G.1 is already applied, the same `db push` will only run G.5.

### Type regeneration — **DEFERRED (blocker carried over from G.1)**

- The project has no `supabase gen types` script and no committed generated types file.
- After the user sets up generation (see G.1 changelog), the new RPC will appear under `Database['public']['Functions']['products_within_radius']` with the parameter + return-row types derived from the migration.
- For now, G.6's hook will type the RPC return manually (or use the `ProductRow` shape augmented with `distance_km`).

### Verification performed

- `tsc --noEmit` → exit 0. No TS code references the new function yet — additive SQL doesn't affect existing TS.
- Manual schema sanity (`\df+ public.products_within_radius`, sample queries from the section above) **deferred** — requires a running database. Acceptance criteria once applied:
  - `\df public.products_within_radius` lists the function with all 12 parameters and `setof record` return.
  - Sample query #1 returns the seeded products (with NULL `distance_km` until coords are populated) ordered by `created_at desc` (the tiebreaker, since no row has a non-null `location_point` yet).
  - Sample query #2 limits results to category 'home'.
  - Sample query #3 returns up to 10 newest products.
  - Sample query #4 returns products in [50, 500] sorted by price ascending.

### Reversion

- **The migration file:** `git revert <commit>` removes [supabase/migrations/20260514_products_within_radius_rpc.sql](supabase/migrations/20260514_products_within_radius_rpc.sql) and this changelog section.
- **Any DB the migration has been applied to:** rollback SQL is at the top of the migration file, commented:
  ```sql
  drop function if exists public.products_within_radius(
    double precision, double precision, double precision,
    text, text, numeric, numeric, text, boolean, text, int, int
  );
  ```
  Run it manually against each environment where the migration was applied.

### Known follow-up

- **G.6** wires a React Query hook (e.g. `useGeoFilteredProducts`) that calls this RPC via `supabase.rpc('products_within_radius', { … })`, integrates with `useUserLocation` (G.4) for `p_latitude` / `p_longitude` / `p_radius_km`, and replaces (or supplements) `useFilteredProducts` in the marketplace feed. The legacy `searchProducts` service can stay until G.6 confirms the RPC covers every consumer.

---

## Step G.6 Changelog (2026-05-03) — Marketplace Feed Geo Integration

Wires the geo stack from G.1–G.5 into the user-facing marketplace feed: a LocationChip in the header opens a sheet for setting the browse area; a new `useNearbyProducts` hook drives the feed via the `products_within_radius` RPC; first-time users see the sheet auto-presented once per session.

### Reconnaissance findings

- **Marketplace home screen:** [src/app/(protected)/(tabs)/index.tsx](src/app/(protected)/(tabs)/index.tsx) renders a tab switcher between a legacy `posts.json`-driven `PostListItem` feed (Pour toi) and `MarketplaceScreen` ([src/features/marketplace/screens/MarketplaceScreen.tsx](src/features/marketplace/screens/MarketplaceScreen.tsx)). The Marketplace branch consumed `useFilteredProducts` directly. We swap **only** that consumption to `useNearbyProducts` — every other consumer of `useFilteredProducts` (search screen, etc.) is untouched.
- **`MarketplaceHeader`** ([src/components/feed/MarketplaceHeader.tsx](src/components/feed/MarketplaceHeader.tsx)) is the centered tab + search header from Step 4.1. Exports `MARKETPLACE_HEADER_ROW_HEIGHT = 48`, consumed by [ProductFeedItem.tsx:57](src/features/marketplace/components/ProductFeedItem.tsx:57) for overlay positioning. The constant now reflects the **total** of the tab row (48) + chip row (40) = **88**. Existing math in `ProductFeedItem` (`insets.top + MARKETPLACE_HEADER_ROW_HEIGHT + spacing.md`) is unchanged — it just absorbs the extra 40 px automatically.
- **Sheet pattern** in this project (per [MarketplaceFilterSheet.tsx](src/features/marketplace/components/MarketplaceFilterSheet.tsx)): base `BottomSheet` from `@gorhom/bottom-sheet` (NOT `BottomSheetModal`), controlled via a Zustand `isOpen` store with `useEffect` → `snapToIndex(0)` / `close()`. We followed this exactly — no `BottomSheetModalProvider` is needed and none was added. `GestureHandlerRootView` already wraps the app at [_layout.tsx:103](src/app/_layout.tsx:103).
- **i18n:** `useTranslation()` + `t('namespace.key')` against [src/i18n/locales/{fr,en}.json](src/i18n/locales/fr.json). New keys added under a fresh `location.*` namespace.
- **Filter store shape** ([useMarketplaceFilters.ts](src/stores/useMarketplaceFilters.ts)): `query`, `categoryId`, `subcategoryId`, `priceMax`, `pickupOnly`, `locationQuery`. **No** `sort`, **no** `minPrice`. The hook only maps fields that exist; `p_min_price` is sent as `null`, sort is derived from whether coords are set.
- **Product/seller join:** the RPC returns product columns + `distance_km` only — no joined seller. The `Product` type requires a `seller`. Plan: in a new service helper, fetch sellers in a second `from('sellers').select('*').in('id', distinctSellerIds)` call and merge in JS, preserving RPC ordering. Documented below.

### Files created

- [src/features/location/stores/useLocationSession.ts](src/features/location/stores/useLocationSession.ts) — non-persisted Zustand atom holding `firstLaunchPromptDismissedThisSession` + `dismissFirstLaunchPrompt()` + `resetSession()`. Separate from `useUserLocation` so the persisted shape stays untouched (per the G.6 brief constraint).
- [src/stores/useLocationSheetStore.ts](src/stores/useLocationSheetStore.ts) — `isOpen` / `open()` / `close()`. Mirrors `useFilterSheetStore` exactly.
- [src/features/marketplace/hooks/useNearbyProducts.ts](src/features/marketplace/hooks/useNearbyProducts.ts) — React Query wrapper. Reads `latitude`, `longitude`, `radiusKm` from `useUserLocation` and `filters` from `useMarketplaceFilters`. `staleTime: 60_000`. Query key: `['marketplace', 'nearby', { lat, lng, radiusKm, filters }]`.
- [src/components/feed/LocationChip.tsx](src/components/feed/LocationChip.tsx) — small pill. With no location: glass chip + outline pin + "Définir ma position". With location: glass chip + brand-colored solid pin + truncated city/displayName + " · 20 km" (or "Sans limite" when `radiusKm === null`) + chevron-down.
- [src/components/feed/RadiusPicker.tsx](src/components/feed/RadiusPicker.tsx) — horizontal `ScrollView` of 8 chips (`5 / 10 / 20 / 50 / 100 / 500 / 1000 / no-limit`). Active = filled brand; inactive = glass.
- [src/components/feed/CitySearchInput.tsx](src/components/feed/CitySearchInput.tsx) — themed `TextInput` + 400 ms debounce + `geocodeAddress(query, { limit: 5, locale })` (locale defaults to `i18n.language`). Race-safe via a `requestId` counter — only the most recent request can update state. States rendered: inline spinner while loading; error caption on `GeocodingError`; empty caption when no results; tappable result rows with pin icon + display name.
- [src/components/feed/LocationSheet.tsx](src/components/feed/LocationSheet.tsx) — base `BottomSheet`, single 80% snap. Layout: header (title + close icon) → device-GPS button (state-aware label via `deviceLabelKey(status)`) → "ou" divider → `CitySearchInput` → `RadiusPicker`. Auto-save on every interaction; no Save button. `topInset={insets.top}`. Closing via any path (backdrop, swipe, close icon, successful set) calls `dismissFirstLaunchPrompt()` so the auto-prompt doesn't re-fire this session.

### Files modified

- [src/features/location/stores/useUserLocation.ts](src/features/location/stores/useUserLocation.ts) — **additive**: new action `setLocationFromGeoLocation(loc: GeoLocation)` writes lat/lng/displayName/city/country/countryCode/source='manual'/lastUpdatedAt without re-geocoding. Used by `LocationSheet.handleSelectCity` so a city pick doesn't waste a Nominatim request right after the search just hit it. Persisted shape **unchanged** — only the action surface area grew.
- [src/hooks/useDeviceLocation.ts](src/hooks/useDeviceLocation.ts) — **return type tweak**: `refresh()` was `() => Promise<void>`, now returns `Promise<GeoCoordinate | null>`. The previous signature led to a stale-closure bug in any caller that wanted to do `await refresh(); use(coords)` — `coords` from the render closure isn't yet updated. Returning the fix directly removes the round-trip through React state. No existing consumers were affected (G.3 had no consumer).
- [src/features/marketplace/services/products.ts](src/features/marketplace/services/products.ts) — **added** `searchNearbyProducts(params)` service: calls `supabase.rpc('products_within_radius', …)`, then merges sellers via a second `from('sellers').select('*').in('id', distinctSellerIds)` query, preserving RPC ordering. Returns `{ items: NearbyProduct[]; nextCursor: null }` where `NearbyProduct = Product & { distanceKm: number | null }`. Manual typing of the RPC return (`RpcProductRow = Omit<ProductRow, 'seller'> & { distance_km: number | null }`) — this is the documented exception until the type-generation pipeline is set up (see G.5 STOP).
- [src/components/feed/MarketplaceHeader.tsx](src/components/feed/MarketplaceHeader.tsx) — **added** a second row (40 px) below the existing tab row, centered, holding the new `LocationChip`. New optional prop `onPressLocation?: () => void` — when omitted, the chip row stays empty (backwards-compatible). `MARKETPLACE_HEADER_ROW_HEIGHT` updated to **88** (= `TAB_ROW_HEIGHT 48 + LOCATION_ROW_HEIGHT 40`). Internal `TAB_ROW_HEIGHT` and `LOCATION_ROW_HEIGHT` constants are private; only the cumulative is exported.
- [src/features/marketplace/screens/MarketplaceScreen.tsx](src/features/marketplace/screens/MarketplaceScreen.tsx) — swapped `useFilteredProducts` → `useNearbyProducts`. Otherwise identical — same shape result, same loading/error/empty states, same `FlatList` configuration.
- [src/app/(protected)/(tabs)/index.tsx](src/app/(protected)/(tabs)/index.tsx) — mounts `<LocationSheet />` next to `<MarketplaceFilterSheet />`. Adds `onPressLocation` handler (opens the sheet store) and a first-launch `useEffect` that opens the sheet when `mainTab === 'marketplace' && !hasLocation && !firstLaunchDismissed`.
- [src/i18n/locales/fr.json](src/i18n/locales/fr.json), [src/i18n/locales/en.json](src/i18n/locales/en.json) — new `location.*` namespace with 11 keys (FR + EN).

### Hook design decision: new hook vs. extending existing

Created a new `useNearbyProducts` rather than extending `useFilteredProducts`. Reasons:

- The brief explicitly says the marketplace home **only** swaps; other consumers stay on the legacy hook.
- The new hook returns `NearbyProduct = Product & { distanceKm: number | null }` — the legacy hook's type is `Product`. Diverging signatures = diverging hooks.
- The query key shape changes (adds lat/lng/radiusKm), so cache entries don't overlap and a future reverter only has to delete one file.
- `useFilteredProducts` is unmodified; reverting G.6 is symmetric — every search screen / other consumer keeps working.

### `BottomSheetModalProvider` mounting

**Not needed.** This project uses base `BottomSheet` (with the Zustand `isOpen` pattern), not `BottomSheetModal`. No provider is mounted in `_layout.tsx` and none was added. `GestureHandlerRootView` already wraps the app.

### Updated `MARKETPLACE_HEADER_ROW_HEIGHT`

Old value: `48` (just the tab row).
New value: `88` (= `TAB_ROW_HEIGHT 48` + `LOCATION_ROW_HEIGHT 40`).

[ProductFeedItem.tsx:57](src/features/marketplace/components/ProductFeedItem.tsx:57) computes `topRowTop = insets.top + MARKETPLACE_HEADER_ROW_HEIGHT + spacing.md`. The new value flows through automatically — the seller pill drops below the chip row without code changes there.

### i18n keys added (FR + EN, under `location.*`)

| Key | FR | EN |
| --- | --- | --- |
| `setMyLocation` | Définir ma position | Set my location |
| `title` | Ma position | My location |
| `searchCity` | Rechercher une ville | Search a city |
| `noResults` | Aucun résultat | No results |
| `radius` | Rayon de recherche | Search radius |
| `noLimit` | Sans limite | No limit |
| `useMyLocation` | Utiliser ma position actuelle | Use my current location |
| `enableGeolocation` | Activer la géolocalisation | Enable geolocation |
| `allowInSettings` | Autoriser dans les Réglages | Allow in Settings |
| `geolocationUnavailable` | Géolocalisation indisponible | Geolocation unavailable |
| `or` | ou | or |

### Verification performed

- `tsc --noEmit` → exit 0 (project is `strict: true`; no `any` outside the documented `RpcProductRow` cast in `searchNearbyProducts`, which is the explicit exception until type generation is set up).
- `expo export --platform ios` → exit 0; iOS Hermes bundle produced clean (~6.07 MB).
- Zero new npm dependencies (`@gorhom/bottom-sheet`, `expo-haptics`, `react-native`, `zustand`, `@tanstack/react-query`, `@expo/vector-icons` already installed).
- **Manual / device verification deferred to user** (no local Supabase + no device runs in the harness). Acceptance criteria when running on iPad with G.1+G.5 applied:
  - Marketplace tab header shows tab row + LocationChip below.
  - With no location, chip reads "Définir ma position" and the sheet auto-presents on first marketplace mount.
  - Tapping the device-GPS button while permission is `'undetermined'` triggers the system prompt (French rationale from G.3); granting + populating coords closes the sheet and updates the chip.
  - Typing "Dubai" in the city search returns up to 5 results within ~400 ms; tapping a result closes the sheet and updates the chip.
  - Tapping a radius chip updates the chip's "· N km" suffix; sheet stays open.
  - Closing the sheet without setting suppresses the auto-prompt for the rest of the session; killing/relaunching the app brings it back.
  - Marketplace feed re-fetches on location/radius/filter changes (visible via `useQuery`'s key change).
  - **`distance_km` is delivered in `NearbyProduct.distanceKm`** but **not yet shown on each product card** — UI for that is a future Phase G follow-up (G.7 "Près de moi" rail or a per-card distance label).

### Constraint compliance

- ✅ `useFilteredProducts` not modified.
- ✅ `products_within_radius` RPC not modified.
- ✅ `useUserLocation` persisted shape unchanged (only an action was added).
- ✅ No Save button on the sheet — auto-save on change.
- ✅ Auto-prompt fires at most once per session (`firstLaunchDismissedThisSession` is non-persisted).
- ✅ No new dependencies.
- ✅ Right action rail / bottom info / tab bar / feed-item components untouched.
- ✅ Step 4.1 tab switch and Step 7.1 tab bar fix preserved (header layout is additive).
- ✅ `MARKETPLACE_HEADER_ROW_HEIGHT` updated; `ProductFeedItem` math unchanged because it adds the constant + `spacing.md`.
- ✅ Browse-location is **not** written to `sellers` in this step — Phase B's job.
- ✅ Single `git revert` removes every file added/modified by this step.

### Known follow-ups

- **Per-card distance label.** `NearbyProduct.distanceKm` is delivered to the feed but not surfaced on `ProductFeedItem`. G.7's "Près de moi" rail (or a small label on the existing seller pill / price card) will consume it.
- **Phase B integration.** Saving the user's browse-location to `sellers.latitude`/`longitude`/`location_text` (so other shoppers see "Sells from Dubai") is Phase B's seller-profile editor responsibility, not G.6's.
- **Existing-row backfill** is still pending (carried from G.1). Until existing seeded products get geocoded, `distance_km` is `null` for every legacy row and the radius filter only matches new posts (or rows with NULL `location_point`, which the RPC's `user_point IS NULL OR p.location_point IS NOT NULL AND ST_DWithin(...)` branch correctly excludes when both lat/lng AND radius are set — meaning legacy products fall out of the feed when the user has a location set).
- **Cleanup pass.** `searchProducts` and `useFilteredProducts` are still used by the search/filters sheet (legacy `locationQuery` ILIKE flow). A future cleanup can either migrate those consumers to `useNearbyProducts` or retire the legacy fields from the filter store.

### Reversion

`git revert <commit>` removes:
- All seven new files (`useLocationSession`, `useLocationSheetStore`, `useNearbyProducts`, `LocationChip`, `RadiusPicker`, `CitySearchInput`, `LocationSheet`).
- The `searchNearbyProducts` service helper + types in [products.ts](src/features/marketplace/services/products.ts).
- The `setLocationFromGeoLocation` action in [useUserLocation.ts](src/features/location/stores/useUserLocation.ts).
- The `refresh()` return-type widening in [useDeviceLocation.ts](src/hooks/useDeviceLocation.ts) (back to `Promise<void>`).
- The header chip row + height-constant change in [MarketplaceHeader.tsx](src/components/feed/MarketplaceHeader.tsx).
- The hook swap in [MarketplaceScreen.tsx](src/features/marketplace/screens/MarketplaceScreen.tsx).
- The sheet mount + auto-prompt effect in [(tabs)/index.tsx](src/app/(protected)/(tabs)/index.tsx).
- The `location.*` i18n keys.
- This changelog section.

No DB / env / native changes to undo. The G.5 RPC is unaffected (this step only consumes it). The `user-location-v1` AsyncStorage entry from G.4 will linger on devices where the app ran G.6 — same disposition as the G.4 changelog notes.

---

## Step G.7 Changelog (2026-05-03) — Près de Moi Rail + Distance Display

Replaces A.2's TODO slot in the Categories page with a working "Près de toi" rail driven by the geo stack from G.1–G.6, surfaces a per-card distance label on the rail, and renders a tappable CTA when the user has no location set.

### Reconnaissance findings

- **TODO comment placement.** A.2's TODO sits in [src/app/(protected)/(tabs)/friends.tsx:90-94](src/app/(protected)/(tabs)/friends.tsx) — between the **Nouveautés** rail and the category grid, **not** between Tendances and Nouveautés as the G.7 brief preamble suggested. I followed the actual TODO, so the resulting screen order is: header → Tendances → Nouveautés → **Près de toi** → grid. Flagging the brief mismatch; if the desired order really is Tendances → Près de toi → Nouveautés, it's a one-line move (`<NearbyProductsRail />` swap in `friends.tsx`).
- **`RailProductCard` shape** ([src/components/categories/RailProductCard.tsx](src/components/categories/RailProductCard.tsx)) — `Pressable` → `GlassCard variant="dark" radius="lg" border` → `Image` (156 × 156) → `View` with title + price. Width = 156, image height = 156, full card ~220. The new distance row slots inside the existing padding block under the price.
- **`searchNearbyProducts` signature** ([products.ts](src/features/marketplace/services/products.ts), added in G.6) — accepts `{ filters, location, sort, limit, offset }`. The rail passes a "neutral" filter object (initial empty `MarketplaceFilters`) so category/price/search/pickup don't bleed in from the marketplace filter store. Returns `NearbyProduct[]` with `distanceKm` already computed.
- **`useLocationSheetStore`** (G.6) exposes `open()` / `close()`. The CTA opens the sheet via the Zustand action — same pattern used by `(tabs)/index.tsx:onPressLocation`.
- **`useHasLocation`** (G.4) exists as a selector returning `true` when both lat & lng are non-null. The hook wires it to `useQuery`'s `enabled` so the RPC isn't called when the user has no location set.
- **Existing rail empty state** in `CategoryRail` shows a plain caption "Aucun produit"; we mirror that copy choice with a more action-oriented "élargissez le rayon" message specific to the geo case.
- **Product navigation pattern** in `friends.tsx`: `useProductSheetStore.open(id)` opens a global product detail sheet. The rail uses the same store/action — does **not** push to a `/product/:id` route as the brief's example suggested (the project doesn't have that route).

### Files created

- [src/features/marketplace/hooks/useNearbyRailProducts.ts](src/features/marketplace/hooks/useNearbyRailProducts.ts)
  - `useQuery` wrapper around `searchNearbyProducts`. Reads ONLY `latitude`, `longitude`, `radiusKm` from `useUserLocation` — it intentionally **does not** consume `useMarketplaceFilters` (the rail shows nearby products regardless of the home-feed category selection).
  - Passes a frozen "neutral" filter object so the RPC's category/sub/price/search/pickup branches all match-anything.
  - `sort: 'distance'`, `limit: 10`, `offset: 0`. Stale time 60 s. Query key `['marketplace', 'nearby-rail', { lat, lng, radiusKm }]`.
  - Gated by `enabled: useHasLocation()` — no RPC call fires when the user hasn't set a location.
  - Return shape per brief: `{ products, loading, error, refetch, isEnabled }`. `refetch` returns `void` (wraps useQuery's `Promise<...>`).
- [src/components/categories/NearbyProductsRail.tsx](src/components/categories/NearbyProductsRail.tsx)
  - Inline `NoLocationCTA` (separate file felt heavier than the value): single tappable `GlassCard` with a brand-muted circular pin badge, title + body copy, and a chevron-forward affordance.
  - Inline `RailSkeletons` (3 grey rectangles 156 × 220) — matches the existing `CategoryRail` skeleton dimensions for visual consistency.
  - Three-state composition:
    1. `!isEnabled` → CTA card under a section header (no subtitle); tap → `useLocationSheetStore.open()` with medium haptic.
    2. `loading && products.length === 0` → skeleton row.
    3. `products.length === 0` (loaded, empty radius) → caption "Aucun produit dans votre zone, élargissez le rayon".
    4. Default → horizontal `FlatList` of `RailProductCard`s with `distanceKm` plumbed through; tap → `useProductSheetStore.open(item.id)`.
  - Subtitle: `radiusKm === null` → "Partout"; else `t('location.withinRadius', { km: radiusKm })` → "Dans un rayon de 20 km".

### Files modified

- [src/components/categories/RailProductCard.tsx](src/components/categories/RailProductCard.tsx) — added optional prop `distanceKm?: number | null`. When finite, renders a small row under the price: `Ionicons "navigate" 10 px` + `Text variant="caption" color="tertiary"` (size 11) showing `formatDistance(distanceKm)`. **Backward compatible**: omitting the prop renders identically to the pre-G.7 card. Existing `CategoryRail` usage (Tendances, Nouveautés) is unaffected because it never passes `distanceKm`.
- [src/lib/format.ts](src/lib/format.ts) — added `formatDistance(km, locale = 'fr-FR')` per the policy:
  - `< 1 km` → integer meters: "450 m"
  - `1 ≤ km < 100` → one-decimal km in locale: "1,2 km" (FR) / "1.2 km" (EN)
  - `≥ 100 km` → integer km: "250 km"
  - Negative / non-finite input → empty string (defensive; `RailProductCard` also guards via `Number.isFinite`).
  Header doc-block updated to list all three helpers.
- [src/app/(protected)/(tabs)/friends.tsx](src/app/(protected)/(tabs)/friends.tsx) — replaced the A.2 TODO comment block with `<NearbyProductsRail />` and added the import. No other change. Tendances and Nouveautés rails, the category grid, the screen header, and the navigation behavior are all unchanged.
- [src/i18n/locales/fr.json](src/i18n/locales/fr.json), [src/i18n/locales/en.json](src/i18n/locales/en.json) — six new keys added to the existing `location.*` namespace (G.6 created the namespace; G.7 extends it).

### `formatDistance` formatting policy

| Input (km) | Output (FR) | Output (EN) |
| --- | --- | --- |
| `0.45` | `450 m` | `450 m` |
| `0.999` | `999 m` | `999 m` |
| `1.0` | `1,0 km` | `1.0 km` |
| `1.234` | `1,2 km` | `1.2 km` |
| `23` | `23,0 km` | `23.0 km` |
| `99.9` | `99,9 km` | `99.9 km` |
| `100` | `100 km` | `100 km` |
| `2540.7` | `2541 km` | `2541 km` |
| `NaN` / `-1` | `''` (empty) | `''` |

### i18n keys added (six new under `location.*`)

| Key | FR | EN |
| --- | --- | --- |
| `nearYou` | Près de toi | Near you |
| `withinRadius` | Dans un rayon de {{km}} km | Within {{km}} km |
| `everywhere` | Partout | Everywhere |
| `noProductsInRadius` | Aucun produit dans votre zone, élargissez le rayon | No products in your area — try a larger radius |
| `activatePromptTitle` | Activez la géolocalisation | Enable geolocation |
| `activatePromptBody` | Voir les produits près de chez vous | See products near you |

i18next default `{{var}}` interpolation matches the project's existing usage (e.g. `seller.memberSince: "Membre depuis {{date}}"` already in `fr.json`).

### Verification performed

- `tsc --noEmit` → exit 0 (`strict: true`; no `any`; uses G.6's `NearbyProduct` type without redefinition).
- `expo export --platform ios` → exit 0; iOS Hermes bundle ~6.08 MB, clean.
- Zero new npm dependencies; reuses Ionicons + existing UI primitives + G.4–G.6 stores/hooks.
- **Manual / device verification deferred to user** (no local Supabase + no on-device runs in the harness). Acceptance criteria when running on iPad with G.1+G.5 applied:
  - Categories page renders three rails: Tendances, Nouveautés, Près de toi (in that order — see brief mismatch flagged above), then the category grid.
  - With NO location set: the Près de toi slot shows the CTA card; tap → LocationSheet (from G.6) presents.
  - With location set + products in radius: the rail shows up to 10 products sorted ascending by distance; each card shows distance under the price ("450 m", "1,2 km", "23 km").
  - With location set + 0 products in radius: the empty caption appears in place of the FlatList.
  - Subtitle reads "Dans un rayon de 20 km" (or whatever the current `radiusKm` is); reads "Partout" when `radiusKm === null` ("Sans limite" in the picker).

### Constraint compliance

- ✅ No changes to `MarketplaceScreen`, `useNearbyProducts`, action rail, top header, or `ProductFeedItem` (Step 6 owns per-card distance on the main feed).
- ✅ No changes to `searchNearbyProducts`, `LocationSheet`, `RadiusPicker`, `CitySearchInput`, or `useUserLocation`.
- ✅ No new dependencies.
- ✅ `useNearbyRailProducts` uses `enabled: isEnabled` to avoid firing without a location.
- ✅ `RailProductCard` is backward-compatible (Tendances + Nouveautés rails render identically).
- ✅ Reuses `NearbyProduct` from G.6; no redefined types.
- ✅ Single `git revert` removes everything in this step.

### Known follow-ups

- **Distance label on the main `ProductFeedItem`.** Step 6 owns the bottom-info redesign and will plumb `distanceKm` down to a per-feed-item label there. G.7 deliberately scoped distance display to the rail card so the blast radius stays small.
- **"Sort by distance" affordance** in `MarketplaceFilterSheet`. The RPC supports it; the filter sheet doesn't expose it yet. Out of scope here — flagged for a future polish pass once Step 6 + G.6's adoption settles.
- **Brief order mismatch.** The brief preamble described a Tendances → Près de toi → Nouveautés ordering; the actual TODO sits between Nouveautés and the grid. Resulting order is Tendances → Nouveautés → Près de toi → grid. If the design wants the alternate order, it's a single-line reorder in `friends.tsx`.
- **Existing-row backfill** still pending (carried from G.1). Until seeded products are geocoded, the rail will mostly show new posts; legacy rows have NULL coords and are excluded by the radius filter when the user has a location set (per the RPC's `user_point IS NULL OR p.location_point IS NOT NULL AND ST_DWithin(...)` branch).

### Reversion

`git revert <commit>` removes:
- [src/features/marketplace/hooks/useNearbyRailProducts.ts](src/features/marketplace/hooks/useNearbyRailProducts.ts)
- [src/components/categories/NearbyProductsRail.tsx](src/components/categories/NearbyProductsRail.tsx)
- The `distanceKm` prop and distance row in [RailProductCard.tsx](src/components/categories/RailProductCard.tsx) (back to title + price only).
- The `formatDistance` helper + doc-block update in [format.ts](src/lib/format.ts).
- The import + render of `NearbyProductsRail` in [friends.tsx](src/app/(protected)/(tabs)/friends.tsx); the original A.2 TODO comment is restored.
- The six new `location.*` keys in both locale files.
- This changelog section.

No DB / env / native changes to undo. The G.4–G.6 surfaces (LocationSheet, header chip, useUserLocation, useNearbyProducts, RPC) are unaffected — G.7 only consumes them.

---

## Step G.8 Changelog (2026-05-03) — Geo Capture in Sell Flow

Closes Phase G's data loop. New listings submitted via the sell flow now carry `latitude` + `longitude` + `location_updated_at` (best-effort geocoded from the typed location text), the form pre-fills from the user's browse location on demand, and the submit handler degrades gracefully when geocoding fails.

### Reconnaissance findings

- **Sell flow file:** [src/app/(protected)/(tabs)/newPost.tsx](src/app/(protected)/(tabs)/newPost.tsx) — single screen, vanilla `useState` (no form library). Location field at [line 432](src/app/(protected)/(tabs)/newPost.tsx) was rendered via the in-file `<Field />` helper. Field is **optional** — no required check on submit. Existing trim behavior on submit: `location: location.trim() || undefined`.
- **Mutation service:** [src/features/marketplace/services/sell.ts](src/features/marketplace/services/sell.ts) — `createProduct(input: CreateProductInput): Promise<string>` does an INSERT of an explicit object literal. `UpdateProductInput` extends `CreateProductInput` via `Omit<…>`, so additive fields propagate.
- **Toast / snackbar infra:** **none.** The project uses `Alert.alert(...)` for success/error messages on sell. Per the brief's escape clause, the soft warning for geocode-failure-with-non-empty-text is **deferred** rather than introducing new infra. Documented as a follow-up.
- **`src/features/sell/`:** doesn't exist. The brief offered two locations for the helper; I went with `src/lib/geocoding/utils.ts` to extend the existing geocoding lib rather than scaffold a new feature folder for one file.
- **Form state for `location`:** existing local state `const [location, setLocation] = useState('')` (with prefill from `existing.location ?? ''` on edit). The new "Use my / Set my location" button writes through `setLocation(...)` — same plumbing.

### Files created

- [src/lib/geocoding/utils.ts](src/lib/geocoding/utils.ts) — `geocodeForSubmit(text)` pure helper. Trims; empty → `null`. Calls `geocodeAddress(trimmed, { limit: 1 })`; takes the first result. Any throw (transport, malformed JSON, parse) is caught and returns `null`. Never throws — callers can use it directly in submit handlers without try/catch boilerplate.

### Files modified

- [src/features/marketplace/services/sell.ts](src/features/marketplace/services/sell.ts) — `CreateProductInput` gains optional `latitude?: number | null` and `longitude?: number | null`. `createProduct` builds the INSERT payload as a `Record<string, unknown>` and only adds `latitude` / `longitude` / `location_updated_at: new Date().toISOString()` when **both** coords are present **and** finite. When omitted, the insert behaves exactly as today (text-only listings, just like before G.8). The generated `location_point` populates automatically via the G.1 migration. `UpdateProductInput` inherits the new fields automatically (it extends `CreateProductInput`); the update path doesn't yet write them — flagged as a follow-up.
- [src/app/(protected)/(tabs)/newPost.tsx](src/app/(protected)/(tabs)/newPost.tsx) —
  - Replaced the `<Field />` location row with an inline composition: a header row containing the field label + a small "Utiliser ma position" / "Définir ma position" pill button (brand-muted background, brand-colored text + icon), followed by a regular `TextInput`.
  - The button text + icon vary on `useHasLocation()`. With location set: solid `location` icon + "Utiliser ma position"; press → fills the field with the user's `displayName`. Without: `location-outline` icon + "Définir ma position"; press → opens `useLocationSheetStore.getState().open()` (G.6's LocationSheet).
  - `onSubmit` switched from sync to `async`. Before constructing the create payload, the handler awaits `geocodeForSubmit(trimmedLocation)` (only on the create path, not edit, and only when the text is non-empty). If coords come back, they're spread into `CreateProductInput`; otherwise the payload is identical to today's text-only shape.
  - The submit `Pressable.onPress` now calls `() => { void onSubmit(); }` to safely invoke the async handler from the sync RN event.
  - Two new local styles: `locationLabelRow` (row layout for label + button) and `prefillButton` / `prefillText` (the brand-muted pill).
- [src/i18n/locales/fr.json](src/i18n/locales/fr.json), [src/i18n/locales/en.json](src/i18n/locales/en.json) — four new keys under the existing `sell.*` namespace.

### Soft-warning decision

**Skipped.** The project has no toast / snackbar primitive — `Alert.alert` is the only modal-style notifier used in the sell flow. Surfacing a separate post-success Alert just for "geocoding failed" would be more intrusive than helpful (two modal alerts back-to-back). Documented in the changelog as a follow-up: when a toast primitive lands, plumb `t('sell.locationGeocodeFailedTitle')` + `t('sell.locationGeocodeFailedBody')` (already added) into a non-blocking inline notice. The keys are in place.

### i18n keys added (four new under `sell.*`)

| Key | FR | EN |
| --- | --- | --- |
| `useMyLocation` | Utiliser ma position | Use my location |
| `setMyLocation` | Définir ma position | Set my location |
| `locationGeocodeFailedTitle` | Annonce créée | Listing created |
| `locationGeocodeFailedBody` | Emplacement non trouvé — votre annonce n'apparaîtra pas dans les recherches par rayon. | Location not found — your listing won't appear in radius searches. |

### Verification performed

- `tsc --noEmit` → exit 0 (project is `strict: true`; no `any` introduced).
- `expo export --platform ios` → exit 0; iOS Hermes bundle ~6.08 MB, clean.
- Zero new npm dependencies.
- **Manual / device verification deferred to user** (no local Supabase + no on-device runs in the harness). Acceptance criteria when running on iPad with G.1+G.5 applied:
  - Open the sell tab. The location field shows a brand-muted pill on the right of its label.
  - With NO browse location set: pill reads "Définir ma position" (outline pin); tap → LocationSheet (from G.6) presents. After picking a city, the field stays empty (the user can now tap the pill again).
  - With browse location set: pill reads "Utiliser ma position" (solid brand pin); tap → field is filled with the user's `displayName`.
  - Submit a listing with text that geocodes (e.g. "Dubai") → product row in DB has `latitude`/`longitude`/`location_updated_at` populated; `location_point` populates automatically.
  - Submit with garbage text ("xqzxqz…") → product still creates, lat/lng remain null, no extra UI noise.
  - Submit with empty text → product creates without geocoding (same as today).
  - The new listing appears in the Categories tab → "Près de toi" rail (G.7) when within the user's radius and current `location_point` is non-null.

### Constraint compliance

- ✅ `products.location` text field semantics unchanged. User's typed text saved as-is (trimmed, just like today).
- ✅ Location field stays optional.
- ✅ Geocoding never throws / fails the submit. `geocodeForSubmit` is contract-pure: returns `null` on any failure.
- ✅ `sellers` table is **not** written in this step.
- ✅ No autosuggest in the sell form (deferred follow-up).
- ✅ No changes to marketplace feed, action rail, header, Categories page.
- ✅ No changes to `useUserLocation`, `LocationSheet`, or any Phase G component beyond consumption.
- ✅ Zero new npm dependencies.
- ✅ No new toast infra introduced; soft warning deferred.
- ✅ Single `git revert` removes everything in this step.

### Phase G summary — what shipped end-to-end

| Step | Layer | Deliverable |
| --- | --- | --- |
| G.1 | Schema | `latitude` / `longitude` / `location_updated_at` / generated `location_point` on `products` and `sellers`; PostGIS extension + GIST/BTREE indexes |
| G.2 | Service lib | Provider-agnostic `geocodeAddress` / `reverseGeocode` (Nominatim impl, 1.1 s throttle, 200-entry / 24 h LRU) |
| G.3 | Native | `expo-location` install + French permission rationale + `useDeviceLocation` hook |
| G.4 | Store | `useUserLocation` Zustand store (persisted to AsyncStorage; 8 radius options + null) |
| G.5 | Schema | `products_within_radius(...)` PostGIS RPC (12 NULL-tolerant params, 5 sort modes, 30-column return + `distance_km`) |
| G.6 | UI | LocationChip in marketplace header, LocationSheet (device GPS + city search + radius picker), `useNearbyProducts` driving the home feed, first-launch auto-prompt |
| G.7 | UI | "Près de toi" rail in Categories with per-card distance label + no-location CTA |
| G.8 | UI | Sell-flow geocoding capture + prefill button |

End-to-end UX: a buyer opens the app → first-launch sheet → sets browse location (device GPS or city) → marketplace feed and "Près de toi" rail filter to their radius → seller posts a listing with a typed location → it gets geocoded best-effort → it shows up in radius searches automatically. Every user-facing string is i18n'd (FR + EN); every persistence layer is migrated reversibly; every component is `tsc --noEmit` clean and bundles for iOS.

### Known follow-ups

- **Autosuggest in the sell-form location field.** The G.6 `CitySearchInput` is sheet-context only; an inline-form variant could reuse the debounced geocoder and the same Nominatim throttle/cache (G.2). Out of scope here.
- **Backfill for existing rows** (carried from G.1). A one-off script that walks `products` where `location_point IS NULL AND location IS NOT NULL`, calls `geocodeAddress(location)`, and updates `latitude` / `longitude` (the generated `location_point` + GIST index recompute automatically). Respect the 1-req/s Nominatim throttle; G.2's `geocodeAddress` already does this.
- **Edit-flow geocoding.** `UpdateProductInput` inherits the new optional fields, but the edit path in `newPost.tsx` (`isEdit && editId`) doesn't currently re-geocode. If sellers commonly fix typos in the location field, this is worth a small pass — geocode the new text on update, write the new lat/lng, bump `location_updated_at`.
- **Phase B integration.** Profile-level "where I sell from" defaults (separate from the buyer's browse location) belong in Phase B's seller-profile editor. The `sellers.latitude/longitude/location_text` columns from G.1 are ready and waiting; Phase G deliberately did not write them to keep concerns separated.
- **Près de toi rail order in the Categories page.** Currently rendered as Tendances → Nouveautés → Près de toi → grid (per the actual A.2 TODO placement). If product / design wants Tendances → Près de toi → Nouveautés instead, it's a one-line reorder in [friends.tsx](src/app/(protected)/(tabs)/friends.tsx).
- **Toast / snackbar primitive.** Once a non-blocking notice primitive exists, the i18n keys `sell.locationGeocodeFailedTitle/Body` (added by G.8) can be wired up to surface the geocode-failure soft warning. The detection condition is already in place: after a successful `createListing`, if `coords === null && location.trim().length > 0`, surface the notice.
- **Type generation.** Both G.1 and G.5 STOPped on this. When the user runs `supabase gen types typescript --linked > src/types/supabase.ts`, the manually-typed `RpcProductRow` cast in `searchNearbyProducts` (G.6) and the `Record<string, unknown>` insert payload in `createProduct` (G.8) can be tightened to the generated row types.

### Reversion

`git revert <commit>` removes:
- [src/lib/geocoding/utils.ts](src/lib/geocoding/utils.ts).
- The `latitude` / `longitude` fields on `CreateProductInput` and the conditional INSERT branch in [sell.ts](src/features/marketplace/services/sell.ts).
- The prefill button row, the `geocodeForSubmit` call in `onSubmit`, the `useUserLocation` / `useLocationSheetStore` imports, and the two new styles in [newPost.tsx](src/app/(protected)/(tabs)/newPost.tsx). The original `<Field />` location row is restored.
- The four new `sell.*` keys in both locale files.
- This changelog section.

No DB / env / native changes to undo. New listings created during the G.8 window keep their populated `latitude` / `longitude` / `location_updated_at` columns even after the revert (the DB shape is independent of the form code that writes to it).

---

## Op.1 Changelog (2026-05-03) — Supabase CLI Bootstrap

Tooling-only step. G.1, G.5, and G.6 each STOPped because no Supabase CLI was installed and the workspace had no `supabase/config.toml`. This step puts that layer in place so future schema changes follow a one-line apply + regen flow and the manual `RpcProductRow` cast in [products.ts:200](src/features/marketplace/services/products.ts:200) / [products.ts:232](src/features/marketplace/services/products.ts:232) can be replaced with generated types in Op.1.1.

### Reconnaissance findings

- **Package manager.** `package-lock.json` present at repo root → npm.
- **Existing scripts.** `start`, `reset-project`, `android`, `ios`, `web`, `lint`. No collision with `db:*` / `gen:types`.
- **Supabase project ref.** Extracted from `EXPO_PUBLIC_SUPABASE_URL` in `.env`: **`mkofisdyebcnmhgkpqws`**. Hardcoded into [SUPABASE.md](SUPABASE.md) as a copy-paste one-liner.
- **Pending migrations confirmed unapplied locally.** [supabase/migrations/20260513_geo_columns.sql](supabase/migrations/20260513_geo_columns.sql) (G.1) and [supabase/migrations/20260514_products_within_radius_rpc.sql](supabase/migrations/20260514_products_within_radius_rpc.sql) (G.5).
- **No prior CLI workspace.** `supabase/config.toml` did not exist; `.supabase/` did not exist; `supabase` was absent from `dependencies` / `devDependencies`.
- **Cast-site inventory for Op.1.1.** Single file:
  - [src/features/marketplace/services/products.ts:200](src/features/marketplace/services/products.ts:200) — `type RpcProductRow = Omit<ProductRow, 'seller'> & { distance_km: number | null };`
  - [src/features/marketplace/services/products.ts:232](src/features/marketplace/services/products.ts:232) — `const rows = (data as unknown as RpcProductRow[]) ?? [];`
  - The `Record<string, unknown>` insert payload mentioned in line 2265 above is no longer present in the codebase (already typed); only the RPC cast remains.

### Changes applied

| File | Change |
| --- | --- |
| [package.json](package.json) | Added `supabase@^2.98.0` to `devDependencies`. Added 5 scripts: `db:push`, `db:status`, `db:diff`, `gen:types`, `gen:types:local`. |
| [package-lock.json](package-lock.json) | Reflects the new dependency tree. |
| [supabase/config.toml](supabase/config.toml) | Created by `npx supabase init`. `project_id = "hubb"`, default ports (api 54321, db 54322). Existing `supabase/migrations/` left untouched. |
| [.gitignore](.gitignore) | Appended `.supabase/`, `supabase/.temp/`, `supabase/.branches/`. `supabase/config.toml` and `supabase/migrations/` remain tracked. |
| [SUPABASE.md](SUPABASE.md) | New doc at repo root: initial setup, apply flow, type-regen flow, optional local Postgres, rollback notes. Project ref hardcoded. |

### Verification performed

- `npx supabase --version` → `2.98.0`. CLI is executable via the pinned local install.
- `tsc --noEmit` → exit 0. (No source changes; only config/scripts.)
- `expo export --platform ios` → exit 0; bundle clean.
- `npx supabase init` → `Finished supabase init.` Generated config sane.
- `supabase login` / `link` / `db push` / `gen:types` **deliberately not run** — they require interactive auth or a linked project. The user runs these manually (see below).

### Manual user actions to run before Op.1.1

```
npx supabase login
npx supabase link --project-ref mkofisdyebcnmhgkpqws
npm run db:push
npm run gen:types
git add src/types/supabase.ts && git commit -m "chore(types): generate supabase types"
```

After `gen:types` produces `src/types/supabase.ts`, Op.1.1 will replace the manual `RpcProductRow` cast in [products.ts](src/features/marketplace/services/products.ts) with `Database['public']['Functions']['products_within_radius']['Returns']`.

### Op.1 follow-up — baselining the migration history

After the user ran the four manual commands, `db:push` failed on `20260501_initial_marketplace_schema.sql` with `ERROR: relation "sellers" already exists`. Cause: every prior migration was applied directly via the Supabase SQL editor, so the schema is fully in place but `supabase_migrations.schema_migrations` was empty. Fix:

```
npx supabase migration repair --status applied 20260501 20260502 20260503 20260504 20260505 20260506 20260507 20260508 20260509 20260510 20260511 20260512 20260513 20260514
```

Output: `Repaired migration history: [...] => applied`. `npm run db:status` then showed all 14 rows synced (local + remote columns match). `npm run db:push` now reports `Remote database is up to date.`

The generated [src/types/supabase.ts](src/types/supabase.ts) (1599 lines, committed in `2677814`) includes the geo columns on `products` / `sellers` and the `products_within_radius` function — `gen:types` reads from the live remote DB, which already had everything regardless of the empty history table. **Op.1.1 is unblocked**: the manual `RpcProductRow` cast in [products.ts:200](src/features/marketplace/services/products.ts:200) / [products.ts:232](src/features/marketplace/services/products.ts:232) can now be replaced with `Database['public']['Functions']['products_within_radius']['Returns']`.

The baselining procedure is documented in [SUPABASE.md](SUPABASE.md) under "Baselining a project migrated by hand" so the recovery path is preserved if a similar situation ever recurs.

### Reversion

`git revert <commit>` removes the new scripts, the devDependency, the `.gitignore` lines, [supabase/config.toml](supabase/config.toml), and [SUPABASE.md](SUPABASE.md). Run `npm install` afterwards to prune the CLI from `node_modules`. The `supabase_migrations.schema_migrations` rows written by the repair command remain on the remote DB — they're harmless tracking metadata; not undone by a code revert. No DB / env / source code changes to undo.

---

## Op.1.1 Changelog (2026-05-03) — RpcProductRow Cast Replacement

Type-only step. Replaces the manually-written `RpcProductRow` alias in [products.ts](src/features/marketplace/services/products.ts) with the generated type from [src/types/supabase.ts](src/types/supabase.ts). Closes the operational debt left by G.1 / G.5 / G.6 STOPs. Zero runtime change.

### Before

[products.ts:200-202](src/features/marketplace/services/products.ts:200) declared the alias by hand:

```ts
type RpcProductRow = Omit<ProductRow, 'seller'> & {
  distance_km: number | null;
};
```

[products.ts:232](src/features/marketplace/services/products.ts:232) cast the RPC response through it:

```ts
const rows = (data as unknown as RpcProductRow[]) ?? [];
```

### Generated shape (verbatim from [supabase.ts:813-860](src/types/supabase.ts:813))

```ts
products_within_radius: {
  Args: { p_category_id?: string; p_latitude?: number; p_limit?: number; p_longitude?: number; p_max_price?: number; p_min_price?: number; p_offset?: number; p_pickup_only?: boolean; p_radius_km?: number; p_search_query?: string; p_sort?: string; p_subcategory_id?: string }
  Returns: {
    attributes: Json
    bookmarks_count: number
    category: Json
    category_id: string
    comments_count: number
    created_at: string
    currency: string
    description: Json
    dimensions: string
    distance_km: number
    id: string
    latitude: number
    likes_count: number
    location: string
    location_point: unknown
    location_updated_at: string
    longitude: number
    media_type: string
    media_url: string
    pickup_available: boolean
    price: number
    seller_id: string
    shares_count: number
    shipping_free: boolean
    shipping_label: Json
    stock_available: boolean
    stock_label: Json
    subcategory_id: string
    thumbnail_url: string
    title: Json
  }[]
}
```

`Returns` is an array, so the row type is reached via `[number]`.

### After

Added an import at [products.ts:12](src/features/marketplace/services/products.ts:12):

```ts
import type { Database } from '@/types/supabase';
```

Replaced the alias at [products.ts:201-202](src/features/marketplace/services/products.ts:201):

```ts
type RpcProductRow =
  Database['public']['Functions']['products_within_radius']['Returns'][number];
```

The cast site at [products.ts:232](src/features/marketplace/services/products.ts:232) is unchanged textually — it still reads `(data as unknown as RpcProductRow[]) ?? []` — but `RpcProductRow` now resolves transitively into the generated shape.

### Why keep the alias instead of inlining

The full path `Database['public']['Functions']['products_within_radius']['Returns'][number]` is 78 characters. Inlining it at the cast site (and conceptually at [products.ts:256](src/features/marketplace/services/products.ts:256), where `row` is consumed under the inferred `RpcProductRow` type via `for (const row of rows)`) hurts readability without removing any drift risk — the alias now points at exactly one source of truth. Dropping the alias to satisfy a "used 3+ times" heuristic would trade clarity for a hollow win.

### Nullability differences (informational)

The generated `Returns` row marks every column as non-null (`category_id: string`, `location: string`, `distance_km: number`, etc.) where the manual `RpcProductRow` had several as `T | null`. Supabase TypeGen's RPC inference doesn't carry NULL information for function return columns; this is a known TypeGen limitation, not a schema change. The generated type is structurally narrower in the consumer's favor (fewer null branches to check), and the existing runtime checks at [products.ts:260](src/features/marketplace/services/products.ts:260) (`typeof row.distance_km === 'number' && Number.isFinite(...)`) defensively guard the value anyway, so nothing downstream changes. The application-layer `NearbyProduct` (camelCase, defined at [products.ts:193](src/features/marketplace/services/products.ts:193)) is untouched.

### Other sites checked

- `grep RpcProductRow src/` → only the two lines in [products.ts](src/features/marketplace/services/products.ts). No other consumer.
- `grep distance_km src/` → only the generated type, the alias, and the runtime use at [products.ts:260-261](src/features/marketplace/services/products.ts:260). No hand-written shadow type.
- `grep "products_within_radius" src/` → only the generated type and the `supabase.rpc(...)` call at [products.ts:216](src/features/marketplace/services/products.ts:216). No competing import path.

### Verification performed

- `tsc --noEmit` → exit 0. No new errors surfaced. (The wider→narrower nullability shift is hidden behind the `as unknown as` cast, so no consumer caught a new issue.)
- `expo export --platform ios` → exit 0; iOS Hermes bundle (6.08 MB) produced clean.
- Zero runtime behavior change. The cast is structural; the data flowing through `searchNearbyProducts` is byte-for-byte identical.

### Reversion

`git revert <commit>` removes the new import line and restores the hand-written alias. The generated `src/types/supabase.ts` from Op.1 is untouched and remains correct for any future consumer.

---

## Step B.1.5 Changelog (2026-05-03) — Sellers Update Grant Hardening

Migration-only step. Closes the self-elevation gap surfaced in [PROFILE_AUDIT.md §3.3](PROFILE_AUDIT.md): the `sellers update own` RLS policy authorizes any authenticated user to UPDATE their own row across **every** column, which combined with the broad table-level UPDATE grant lets a user self-set `verified`, `is_pro`, `rating`, `sales_count`, and `stripe_*`. After this migration applies, `authenticated` can only UPDATE the user-controlled subset; `service_role` (Stripe webhooks, admin paths) is unaffected because it bypasses grants by design.

The RLS policy itself is **unchanged** — it still controls *which row* a user may touch. The column-level grant restricts *which columns* the policy can be exercised against.

### Reconnaissance findings

#### Full `sellers` column inventory

Source: [src/types/supabase.ts:367-437](src/types/supabase.ts:367), cross-referenced with the migration files that introduced each column.

| # | Column | Type | Added in | Category |
| --- | --- | --- | --- | --- |
| 1 | `id` | uuid (PK) | 20260501 | System |
| 2 | `name` | text not null | 20260501 | **User-editable** |
| 3 | `avatar_url` | text not null default `''` | 20260501 | **User-editable** |
| 4 | `verified` | boolean not null default false | 20260501 | System (admin / moderation) |
| 5 | `is_pro` | boolean not null default false | 20260501 | System (admin / business) |
| 6 | `rating` | numeric(3,2) not null default 0 | 20260501 | System (no client mutation pipeline) |
| 7 | `sales_count` | integer not null default 0 | 20260501 | System (server-managed) |
| 8 | `created_at` | timestamptz not null default now() | 20260501 | System (immutable) |
| 9 | `user_id` | uuid FK → auth.users(id), unique | 20260503 | System (set at row creation by `get_or_create_seller_for_current_user`) |
| 10 | `bio` | text | 20260508 | **User-editable** |
| 11 | `website` | text | 20260508 | **User-editable** |
| 12 | `phone_public` | text | 20260508 | **User-editable** |
| 13 | `email_public` | text | 20260508 | **User-editable** |
| 14 | `stripe_account_id` | text | 20260511 | System (Stripe webhook) |
| 15 | `stripe_charges_enabled` | boolean not null default false | 20260511 | System (Stripe webhook) |
| 16 | `stripe_payouts_enabled` | boolean not null default false | 20260511 | System (Stripe webhook) |
| 17 | `latitude` | double precision | 20260513 | **User-editable** |
| 18 | `longitude` | double precision | 20260513 | **User-editable** |
| 19 | `location_text` | text | 20260513 | **User-editable** |
| 20 | `location_updated_at` | timestamptz | 20260513 | **User-editable** |
| 21 | `location_point` | geography(Point, 4326) | 20260513 | Generated (`generated always as ... stored` — non-writable regardless of grant) |

#### Allowlist (kept writable for `authenticated`)

```
name, avatar_url, bio, website, phone_public, email_public,
latitude, longitude, location_text, location_updated_at
```

`name` is included because it is the seller's free-form display name — not a system-managed field, and PROFILE_AUDIT.md §10.8's recommendation explicitly enumerates `name` in the allowlist alongside the geo and contact columns. The existing `updateMySeller` service does not touch `name` today, but B.2 / B.3 will (per audit §4.4 and §9.D1). Granting it now avoids a future migration when B.2 lands.

`avatar_url` is included for the same reason: B.3 will write to it when the avatar storage bucket is created (audit §5.4 / §10.2).

The `location_*` columns are included so the future B.4 "Where I sell from" picker can persist its result client-side without an extra migration. `location_point` is **deliberately omitted** — it is a stored generated column derived from `(latitude, longitude)`, and Postgres rejects writes to it regardless of grants.

#### Disallowed list (no longer writable by the JS client)

```
id, user_id, created_at,
verified, is_pro, rating, sales_count,
stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled
```

These remain writable by `service_role` (Stripe webhooks, admin scripts, the `get_or_create_seller_for_current_user` SECURITY DEFINER RPC). The brief mentioned `stripe_customer_id` as a representative of the `stripe_*` family — note that the current schema only has `stripe_account_id`, `stripe_charges_enabled`, `stripe_payouts_enabled`. No `stripe_customer_id` column exists; if one is added later it must be considered system-managed and excluded from the allowlist.

#### Brief deviation: `updated_at`

The brief's allowlist included `updated_at`. The `sellers` table does **not** have an `updated_at` column today — only `location_updated_at` (added in 20260513). `location_updated_at` is in the allowlist; no fictional `updated_at` is granted. If a generic `updated_at` column is added in a future migration, the column-level GRANT will need to be extended to include it.

#### Every JS call site that mutates `sellers`

Searched with `rg "from\(['\"]sellers['\"]\)" src/` (the project uses single quotes; double-quote variant returned no extra matches).

| File:line | Operation | Columns touched | Within allowlist? |
| --- | --- | --- | --- |
| [src/features/marketplace/services/sellers.ts:53-58](src/features/marketplace/services/sellers.ts:53) | SELECT (`getSellerById`) | — | n/a (read) |
| [src/features/marketplace/services/sellers.ts:79-84](src/features/marketplace/services/sellers.ts:79) | SELECT (`getMySeller`) | — | n/a (read) |
| [src/features/marketplace/services/sellers.ts:113-116](src/features/marketplace/services/sellers.ts:113) | **UPDATE** (`updateMySeller`) | `bio`, `website`, `phone_public`, `email_public` | **Yes — all four are in the allowlist** |
| [src/features/marketplace/services/messaging.ts:105](src/features/marketplace/services/messaging.ts:105) | SELECT (thread participant lookup) | — | n/a (read) |
| [src/features/marketplace/services/messaging.ts:156](src/features/marketplace/services/messaging.ts:156) | SELECT (thread participant lookup) | — | n/a (read) |
| [src/features/marketplace/services/products.ts:242](src/features/marketplace/services/products.ts:242) | SELECT (seller merge for nearby products) | — | n/a (read) |
| [src/features/marketplace/services/products.ts:298](src/features/marketplace/services/products.ts:298) | SELECT (seller merge) | — | n/a (read) |

`from('sellers').insert(...)` returns **zero hits** in `src/`. The only path that creates a seller row is the `get_or_create_seller_for_current_user` SECURITY DEFINER RPC ([20260503_sell_setup.sql:7-34](supabase/migrations/20260503_sell_setup.sql:7)) — runs as definer, bypasses RLS, unaffected by this migration.

`from('sellers').delete(...)` returns zero hits. Deletion happens only via `ON DELETE CASCADE` from `auth.users(id)` — service_role path, unaffected.

#### Migration / seed files that UPDATE `sellers`

`rg "update.*sellers|sellers.*update" supabase/` returned only RLS policy DDL (no data UPDATE statements). Specifically:

- [supabase/migrations/20260508_seller_contact.sql:7-11](supabase/migrations/20260508_seller_contact.sql:7) — creates the `sellers update own` RLS policy. **Untouched by this migration** (it gates row authorization; the column grant is the orthogonal layer).
- [supabase/migrations/20260513_geo_columns.sql:47](supabase/migrations/20260513_geo_columns.sql:47) — comment in the rollback block, not a real statement.

No seed file or migration runs UPDATE statements as `authenticated`. Migrations execute as the database owner / `postgres`, which is unaffected by the `authenticated` role grant.

#### Verification: no JS code path writes to a disallowed column

Confirmed by reading every UPDATE call site (single hit at [services/sellers.ts:113-116](src/features/marketplace/services/sellers.ts:113)). The `updateMySeller` service builds a sparse `patch` containing only `bio`, `website`, `phone_public`, `email_public`. No code path constructs a patch containing `verified`, `is_pro`, `rating`, `sales_count`, or any `stripe_*` column. The migration is therefore backward-compatible for the existing edit form (audit §4.2) and every other consumer of the `sellers` table.

### Migration file

- Path: [supabase/migrations/20260515_tighten_sellers_update_grants.sql](supabase/migrations/20260515_tighten_sellers_update_grants.sql)
- Wrapped in `begin; ... commit;`. Inline rollback SQL block at the top.
- REVOKEs the table-wide UPDATE grant from `authenticated`, then GRANTs UPDATE on the 10-column allowlist. REVOKE / GRANT are naturally idempotent for the same target and column set.

### Inline rollback (cited from the migration file header)

```sql
begin;
  revoke update on public.sellers from authenticated;
  grant  update on public.sellers to   authenticated;
commit;
```

Run this against any database the migration was already applied to in order to restore the prior broad grant. The `git revert <commit>` step alone only removes the file from the migration set — it does not undo the schema state.

### Production apply commands

The project's apply pattern is the user-explicit `db:push` (configured in [package.json](package.json#L11)):

```bash
npm run db:push     # equivalent to: supabase db push --linked
```

This step **stops at the apply boundary**. The migration file is generated, syntactically valid, and ready — the user runs `db:push` when they are ready to apply. Same pattern as G.1 / G.5.

### Optional local apply

The project does not yet have a configured local Supabase environment (no `supabase/config.toml`, no `.supabase/` directory) — same blocker carried over from G.1 / G.5. Local pre-flight is therefore deferred. If the user sets up a local stack later, the migration can be verified with:

```bash
supabase start              # first-time only — boots local Postgres
supabase db reset           # replays every migration including this one
npm run gen:types:local     # OPTIONAL — see "Type regeneration" below; not required for this migration
```

### Type regeneration — NOT required

Column-level grants are runtime auth, not schema. They do not surface in the generated `Database` interface in [src/types/supabase.ts](src/types/supabase.ts) — TypeGen only describes columns, types, nullability, and relationships. Running `npm run gen:types` after applying this migration would produce a byte-identical file.

The runtime impact is at query time only: any JS client UPDATE that includes a disallowed column will throw a Postgres permission error along the lines of `permission denied for column X`. This will surface as a runtime exception in the `error` returned by `supabase.from('sellers').update(...)`, not as a TypeScript compile error.

### Verification performed

- `tsc --noEmit` → exit 0. No source changes; only a new SQL file under `supabase/migrations/`.
- `expo export --platform ios` → exit 0; iOS Hermes bundle (6.08 MB) produced clean.
- Migration SQL is syntactically valid by manual inspection (Postgres-specific column-list grant syntax is hard to lint statically; the form `GRANT UPDATE (col1, col2, ...) ON public.<table> TO <role>` is documented at [postgresql.org/docs/current/sql-grant.html](https://www.postgresql.org/docs/current/sql-grant.html)).
- The existing edit form ([src/app/(protected)/edit-seller-profile.tsx](src/app/(protected)/edit-seller-profile.tsx) → [services/sellers.ts:95-118](src/features/marketplace/services/sellers.ts:95)) only writes columns in the allowlist (`bio`, `website`, `phone_public`, `email_public`). No call-site changes are required and the form continues to work unchanged.

### Reversion

- **The migration file:** `git revert <commit>` removes [supabase/migrations/20260515_tighten_sellers_update_grants.sql](supabase/migrations/20260515_tighten_sellers_update_grants.sql) and this changelog section.
- **Any database the migration has been applied to:** the `git revert` does not undo the applied DDL. Run the rollback SQL from the top of the migration file (or from this changelog section) against each environment where the migration was applied.

### Operational debt

Zero new operational debt. The migration is reversible, idempotent, type-neutral, and backward-compatible with every existing call site. It sits ready for the user to apply at their convenience via `npm run db:push`.

### Known follow-up

- **B.2 / B.3 form additions.** When B.2 / B.3 land (avatar picker, display-name field, geo picker), the writes will target columns already in the allowlist (`name`, `avatar_url`, `latitude`, `longitude`, `location_text`, `location_updated_at`). No further grant migration is required for those steps.
- **Future `updated_at` column.** If a generic `updated_at` column is added to `sellers` in a later migration (e.g., a `BEFORE UPDATE` trigger pattern), that migration must extend the column-level GRANT to include it — otherwise the trigger-driven UPDATE issued by the JS client will fail.
- **SECURITY DEFINER RPC alternative.** The brief explicitly says "Do NOT introduce a SECURITY DEFINER RPC in this step." Should a future requirement need stricter validation (e.g., enforcing URL format on `website`, normalizing `phone_public`), a `SECURITY DEFINER` RPC that whitelists fields is the natural next layer. Today's column-grant approach is sufficient for the current call-site shape.


---

## Step B.2 Changelog (2026-05-03) — Edit Profile Redesign

Step B.2 reshapes the existing 4-field bio/contact form at [src/app/(protected)/edit-seller-profile.tsx](src/app/(protected)/edit-seller-profile.tsx) into a sectioned premium form: avatar header, **Identité**, **À propos**, **Contact**, **Position de vente**, and a stub **Compte** section (B.4 will wire the real auth actions). All writes go through the same `updateMySeller(...)` service hardened by B.1.5's column-level grants. No new schema, no avatar upload (B.3 owns the bucket and pipeline), no auth flows.

### Reconnaissance findings (no code changes)

- **Existing screen:** [src/app/(protected)/edit-seller-profile.tsx](src/app/(protected)/edit-seller-profile.tsx) — vanilla `useState` × 4 (`bio`, `website`, `phone`, `email`), pulls data via `useMySeller(true)`, mutates via `useUpdateMySeller()`, presents inline `TextInput`s with hardcoded dark styling. Save calls `Alert.alert` then `router.back()`. No header bar, no validation, no dirty-state guard.
- **Mutation service:** [src/features/marketplace/services/sellers.ts:95-118](src/features/marketplace/services/sellers.ts:95) — `updateMySeller(input)` builds a partial patch, ensures the seller row exists via the `get_or_create_seller_for_current_user` RPC, then issues `.update(patch).eq('user_id', user.id)`. The undefined-key guard already supports a partial-write pattern; extension to the full B.1.5 allowlist is purely additive.
- **Seller fetch hook:** [src/features/marketplace/hooks/useMySeller.ts](src/features/marketplace/hooks/useMySeller.ts) — React Query, `MY_SELLER_KEY = ['marketplace','my-seller']`, returns `SellerProfile | null`. The `SellerProfile` type previously did **not** expose `latitude` / `longitude` / `locationText`; B.2 extends `SellerProfile` + `SellerRow` + `rowToSeller()` to surface them so the form can hydrate.
- **G.6 location primitives (reused, not modified):** [src/components/feed/CitySearchInput.tsx](src/components/feed/CitySearchInput.tsx) exposes a clean `onSelect(GeoLocation)` prop; [src/hooks/useDeviceLocation.ts](src/hooks/useDeviceLocation.ts) gives `{ status, request, refresh, openSettings, loading }`; [src/lib/geocoding/index.ts](src/lib/geocoding/index.ts) provides `reverseGeocode(coord)` for converting GPS coords into a `displayName` for the form.
- **G.6 store pattern:** [src/stores/useLocationSheetStore.ts](src/stores/useLocationSheetStore.ts) is a 13-line Zustand `{ isOpen, open, close }`. B.2 mirrors it exactly for the profile sheet (separate concept; never opens the user-location sheet from this screen).
- **Bottom sheet pattern:** [src/components/feed/LocationSheet.tsx](src/components/feed/LocationSheet.tsx) — base `BottomSheet` from `@gorhom/bottom-sheet` driven by an `isOpen` Zustand store via a `useEffect` that calls `snapToIndex(0)` / `close()`, with `BottomSheetBackdrop` (`pressBehavior="close"`) and `BottomSheetScrollView`. B.2's sheet copies this scaffolding, drops the radius picker, and shrinks snap to `['65%']`.
- **Alert pattern:** Confirmed across all touched screens — only `Alert.alert(title, message, buttons?)`. No toast / snackbar infrastructure exists; B.2 follows suit.
- **Navigation API:** [package.json](package.json) → `expo-router ~6.0.23` + `@react-navigation/native ^7.1.8`. `usePreventRemove` is available (re-exported from `@react-navigation/core`); B.2 uses the simpler `useNavigation().addListener('beforeRemove', ...)` form for the gesture/system-back guard. Header back-button uses an explicit `Alert.alert`.
- **Text primitive constraints:** [src/components/ui/Text.tsx](src/components/ui/Text.tsx) only supports `color: 'primary' | 'secondary' | 'tertiary' | 'inverse'`. For `brand` and `danger` text (Save label, error messages, delete-account row, asterisk), B.2 passes `style={{ color: colors.brand }}` / `colors.feedback.danger`.
- **Database types up-to-date:** [src/types/supabase.ts:377-401](src/types/supabase.ts:377) already includes `location_text` and `location_updated_at` on `sellers` (via the latest `chore(types): generate supabase types` commit). No regen required.

### Files created

| Path | Purpose |
| --- | --- |
| [src/stores/useEditProfileLocationSheetStore.ts](src/stores/useEditProfileLocationSheetStore.ts) | Zustand `{ isOpen, open, close }` for the profile-only location sheet. Session-ephemeral (no persistence). Mirrors `useLocationSheetStore` exactly. |
| [src/components/profile/EditProfileLocationSheet.tsx](src/components/profile/EditProfileLocationSheet.tsx) | Bottom sheet that lets the user pick a profile location. Reuses `CitySearchInput` (G.6) and `useDeviceLocation`; reverse-geocodes GPS coords to derive a `displayName`; writes back to the form via the `onSelect(GeoLocation)` prop. Snap `['65%']`. |
| [src/components/profile/FormField.tsx](src/components/profile/FormField.tsx) | Label + `TextInput` + inline error + helper-right hint. Handles `required` (red asterisk), `multiline`, `maxLength`, `keyboardType`, `autoCapitalize`. Border turns red when an error is present. |
| [src/components/profile/SectionHeader.tsx](src/components/profile/SectionHeader.tsx) | Form-tuned section header: small `label`-variant title (uppercase, secondary color) + optional caption-color subtitle. Distinct from `CategorySectionHeader` (which is sized for category rails). |

### Files modified

| Path | Change |
| --- | --- |
| [src/app/(protected)/edit-seller-profile.tsx](src/app/(protected)/edit-seller-profile.tsx) | Full redesign. Vanilla `useState` form preserved, expanded from 4 → 8 fields. Adds atomic save (diff-only patch), inline validation, dirty-state guard, header bar with disabled-state Save button, photo placeholder, location row, account stub. |
| [src/features/marketplace/services/sellers.ts](src/features/marketplace/services/sellers.ts) | `SellerProfile` + `SellerRow` extended with `latitude`, `longitude`, `locationText`, `locationUpdatedAt`. `UpdateMySellerInput` extended to accept the full B.1.5 allowlist (`name`, `avatarUrl`, `bio`, `website`, `phonePublic`, `emailPublic`, `latitude`, `longitude`, `locationText`). When any geo field is being written, `location_updated_at` is auto-stamped server-side via `new Date().toISOString()`. Mutation now `.select('*').single()` and returns the updated `SellerProfile` so the cache can be patched in place. |
| [src/features/marketplace/hooks/useUpdateMySeller.ts](src/features/marketplace/hooks/useUpdateMySeller.ts) | Return type `void → SellerProfile`. `onSuccess` now `setQueryData(MY_SELLER_KEY, next)` instead of plain invalidate (instant cache update). The `['seller','byId']` invalidation is preserved so any open public-profile screen refetches. |
| [src/i18n/locales/fr.json](src/i18n/locales/fr.json) | Adds 30+ `profile.*` keys (section titles, field labels, validation strings, dirty-state strings, coming-soon labels). |
| [src/i18n/locales/en.json](src/i18n/locales/en.json) | Mirror of the FR additions. |

### Sections shipped

1. **Photo (top, centered)** — `Avatar size="xl"` + "Modifier la photo" pressable. Tap shows a `Bientôt disponible` alert. B.3 will replace the alert with the upload pipeline.
2. **Identité** — `name` (required, autocap=words).
3. **À propos** — `bio` (multiline, `maxLength={500}`, live `{n}/500` counter on the right).
4. **Contact** — `website` (URL kbd, autocap=none, autocorrect=off), `phonePublic` (phone-pad), `emailPublic` (email kbd, autocap=none).
5. **Position de vente** — Surface row with a navigation icon, `locationText` (or "Aucune position définie" placeholder), 4-decimal lat/lng caption when set, and a "Modifier" pressable that opens the new `EditProfileLocationSheet`. Selection from the sheet calls back into form state.
6. **Compte (stub)** — Surface with three muted rows: change email, change password, delete account (red icon + label). Each row is fully tappable but only fires a `Bientôt disponible` alert. B.4 owns the real flows (signOut also lives there). The previous screen had no signOut affordance, so none is added here.

### Avatar handling

Form reads `existing.avatarUrl` from `useMySeller` and renders it through `Avatar source={{ uri }}`. The "Modifier la photo" affordance is wired only to a coming-soon `Alert.alert` — no upload, no permissions, no Supabase Storage calls. B.3 will replace `handleEditPhoto` with the real upload pipeline (bucket + RLS + image picker + signed-URL fetch) and write the resulting URL back to the form via `handleSetField('avatarUrl', ...)` (the field is already supported by `UpdateMySellerInput`).

### Validation rules implemented

| Field | Rule | Error key |
| --- | --- | --- |
| `name` | trim, non-empty | `profile.validationNameRequired` |
| `website` | if non-empty, must match `/^https?:\/\//i` | `profile.validationWebsiteInvalid` |
| `emailPublic` | if non-empty, must include an `@` and have non-whitespace on both sides | `profile.validationEmailInvalid` |
| `phonePublic` | if non-empty, ≥ 6 trimmed characters | `profile.validationPhoneTooShort` |
| `bio` | ≤ 500 chars (TextInput `maxLength` enforces; rule is a defensive check) | `profile.validationBioTooLong` |

`validate()` is computed on every render (cheap; small object) to drive the Save button's disabled state. Errors are also surfaced as on-blur-style inline messages via per-key state set during the explicit `performSave()` flow. Once the user edits a field with an existing error, `handleSetField` clears that key from `errors`.

### Dirty-state guard

- **Cheap diffing:** `dirty = JSON.stringify(form) !== JSON.stringify(initialForm)`. The form is small enough (8 keys, all primitives) that this is well under a microsecond per render and avoids per-field equality plumbing.
- **Three entry points covered:**
  1. **Header back button** → explicit `handleBackPress` → `Alert.alert` if dirty; otherwise `router.back()`. The "Quitter sans enregistrer" button resets `initialForm` to current form (clears dirty) and then `requestAnimationFrame(() => router.back())` so the gesture-listener (below) sees a non-dirty form and lets navigation through.
  2. **iOS swipe-back / Android system back** → `useNavigation().addListener('beforeRemove', ...)`. When dirty, calls `e.preventDefault()` and presents the same alert; on "Quitter sans enregistrer", resets `initialForm` and dispatches `e.data.action` to complete the original navigation.
  3. **Save** → `performSave()` returns `true` on success and triggers `router.back()`. The mutation is awaited; on error the alert surfaces the message and the user stays on the screen.
- **Atomic save:** `performSave` builds a `patch: UpdateMySellerInput` containing only fields whose value changed since `initialForm`. If the diff is empty (e.g. user touched a field then reverted it), the mutation is skipped entirely and `initialForm` is set to current form (clears dirty without a network round-trip).

### Verification results

- `npx tsc --noEmit` → **exit 0**. No type errors. New types (`SellerProfile.latitude`/`.longitude`/`.locationText`/`.locationUpdatedAt`) propagate through the codebase without breaking existing call sites; the mutation hook's return type is internally consumed only.
- Bundler check: every import path resolves; the new screen imports exclusively from `@/components/ui`, `@/components/profile/*`, `@/stores/*`, `@/features/marketplace/*`, `@/lib/geocoding/types`, `@/theme`, plus stable RN / expo-router / react-i18next / `@react-navigation/native` / `@expo/vector-icons` packages already in use elsewhere in the app.
- Visual / runtime verification is **deferred to the user**. It requires the B.1.5 migration (`20260515_tighten_sellers_update_grants.sql`) and B.1's geo migration (`20260513_geo_columns.sql`) to be applied to the active Supabase project; the screen will compile and render without them, but Save will fail at the database layer for the location fields if the geo columns are missing, and writes to disallowed columns (e.g. `verified`) will be rejected (which is the desired B.1.5 behavior).
- No changes to any G.6 component (`useUserLocation`, `useLocationSheetStore`, `LocationSheet`, `RadiusPicker`, `CitySearchInput`). `CitySearchInput` is **read** as a child component; its file is unmodified.
- No changes to the Profile tab screen; only the Edit route changed.

### Reversion

```
git revert <B.2 commit>
```

This restores:
- The legacy 4-field [edit-seller-profile.tsx](src/app/(protected)/edit-seller-profile.tsx).
- The narrow `UpdateMySellerInput` and `void`-returning `updateMySeller` in [services/sellers.ts](src/features/marketplace/services/sellers.ts).
- The narrow `SellerProfile` / `SellerRow` shape (no geo fields exposed in TS).
- Removes [src/stores/useEditProfileLocationSheetStore.ts](src/stores/useEditProfileLocationSheetStore.ts) and the new files under [src/components/profile/](src/components/profile/).
- Strips the new `profile.*` i18n keys from both locales.

No database migration to revert — B.2 ships zero schema changes.

### Known follow-ups

- **B.3 — avatar upload.** Replace `handleEditPhoto` in [edit-seller-profile.tsx](src/app/(protected)/edit-seller-profile.tsx) with the real flow (image picker → resize/compress → Supabase Storage bucket → write `avatar_url` via the existing `updateMySeller({ avatarUrl })`). The `UpdateMySellerInput.avatarUrl` field is already plumbed through B.2.
- **B.4 — Account section + auth flows.** Replace `AccountStubRow.onPress` (currently `Alert.alert(comingSoon)`) with concrete handlers for sign-out (preserve from existing UX if any), change-email, change-password, delete-account. The visual treatment ("muted, tappable, chevron, 'Soon' label") is already in place — B.4 mostly fills in the click handlers.
- **No-op guard around inline reverts.** If a user types into a field then exactly restores the original value, `dirty` flips back to `false` (good). The `validate()` pass on Save still runs cleanly because the diff-only patch is empty, and `performSave()` short-circuits with `setInitialForm(form)`.
- **`name`-vs-`username` semantics.** The `sellers.name` column has historically been backfilled from `auth.user_metadata.username` via the `get_or_create_seller_for_current_user` RPC. Now that B.2 lets the user edit it freely, future user-onboarding work should make sure the two stay coherent (e.g. if a "username uniqueness" requirement lands, `sellers.name` may need to drift apart from the auth username, or the RPC may need a unique-name guard). Out of scope for B.2.

---

## Step B.3 Changelog (2026-05-03) — Avatar Upload Pipeline

Step B.3 replaces B.2's "Modifier la photo" placeholder with the real upload flow: media-library permission → picker (square crop) → client-side resize/compress → upload to a per-user folder in a new `avatars` Supabase Storage bucket → atomic write of the public URL via the existing `updateMySeller` mutation → React-Query cache update → best-effort delete of the previous avatar file. Photo changes commit immediately and are deliberately decoupled from the form's atomic-save dirty state.

### Reconnaissance findings (no code changes)

- **Dependencies already in place:** [package.json:38](package.json:38) — `expo-image-picker ~17.0.11` was already installed (the brief assumed it wasn't). The plugin entry was already present in [app.json:56-61](app.json) with an English `photosPermission`. **Only `expo-image-manipulator` needed installation.**
- **Plugin entry update:** Existing `expo-image-picker` plugin block carried English copy. B.3 swaps it (and the `NSPhotoLibraryUsageDescription` Info.plist key) for a French string that covers both flows ("Pictok accède à votre bibliothèque photo pour vos annonces et votre photo de profil") since the same OS-level prompt is shared with the Sell flow. No new permissions are introduced; the optional `cameraPermission` / `microphonePermission` keys on the plugin tuple are deliberately omitted (Sell already declares camera via [app.json:48-54](app.json) `expo-camera` plugin; the avatar flow is library-only).
- **Storage migration pattern (followed exactly):** [supabase/migrations/20260503_sell_setup.sql:53-70](supabase/migrations/20260503_sell_setup.sql:53) and [supabase/migrations/20260506_owner_delete.sql:11-17](supabase/migrations/20260506_owner_delete.sql:11) established the project's storage convention — lowercase DDL, `drop policy if exists` + `create policy`, folder-based RLS via `(storage.foldername(name))[1] = auth.uid()::text`. B.3's migration mirrors this exactly. No `service_role` carve-outs needed.
- **Upload primitive pattern:** [src/features/marketplace/services/sell.ts:53-69](src/features/marketplace/services/sell.ts:53) demonstrates the canonical project upload: `new File(uri).bytes()` from `expo-file-system` (the new SDK 54 API) → `supabase.storage.from(bucket).upload(path, bytes, { contentType, upsert: false })` → `getPublicUrl`. Filename uses `${userId}/${Date.now()}.${ext}`. B.3 reuses the bytes-pattern verbatim and adds a random suffix to the filename (`${Date.now()}-${rand}.jpg`) to harden against simultaneous uploads from the same user (a non-issue for avatars but free defense).
- **Auth-user id source:** [sell.ts:33-37](src/features/marketplace/services/sell.ts:33) uses `supabase.auth.getUser()` inline. There is no `useAuth()` hook in the project; [src/stores/useAuthStore.ts](src/stores/useAuthStore.ts) is a Zustand store with `user.id`, but `sell.ts`'s inline pattern is the established convention for service-layer reads. B.3's screen handler matches that pattern (server-truth at the moment of upload, no dependency on store hydration).
- **B.2 screen state:** [edit-seller-profile.tsx](src/app/(protected)/edit-seller-profile.tsx) reads `existing.avatarUrl` directly from the React-Query cache (`useMySeller`), not from form state. Combined with `useUpdateMySeller.onSuccess → setQueryData(MY_SELLER_KEY, next)` (B.2), this means a successful avatar mutation immediately flips the cached value and the `Avatar` re-renders without any extra plumbing — and crucially, without polluting the form's `dirty` JSON-diff. This decoupling is intentional: photo changes are atomic and immediate; field changes are batched into the explicit Save button. Documented in the screen and in this changelog so B.4 doesn't accidentally re-couple them.
- **`useUpdateMySeller` already supports avatar:** B.2's `UpdateMySellerInput` includes `avatarUrl`. No service or hook changes required for B.3.
- **Avatar primitive:** [src/components/ui/Avatar.tsx](src/components/ui/Avatar.tsx) accepts `source: ImageSource | number` — passing `{ uri: publicUrl }` works without any primitive changes.
- **Image manipulator API:** [node_modules/expo-image-manipulator/build/index.d.ts](node_modules/expo-image-manipulator/build/index.d.ts) exports both the new context-based `ImageManipulator` API and the legacy `manipulateAsync`. B.3 uses `manipulateAsync` because the picker's `allowsEditing + aspect [1,1]` already crops to square — only a final 512×512 resize + JPEG @ 0.8 pass is needed, and the legacy single-call signature is the cleanest fit.
- **`MediaTypeOptions` deprecation:** [node_modules/expo-image-picker/build/ImagePicker.types.d.ts](node_modules/expo-image-picker/build/ImagePicker.types.d.ts) exports both `MediaTypeOptions` (enum, on its way out) and `MediaType = 'images' | 'videos' | 'livePhotos'` (string literals, the future-safe form). B.3 uses `mediaTypes: ['images']` to dodge the deprecation warning.

### Dependencies installed

- `expo-image-manipulator ~14.0.8` via `npx expo install expo-image-manipulator` — SDK-54-aligned, no plugin entry needed (pure native module, no permissions). Recorded in [package.json](package.json).
- `expo-image-picker ~17.0.11` — **already installed**, no action needed beyond the plugin-string swap below.

### `app.json` plugin & Info.plist tweaks

| Path | Before | After |
| --- | --- | --- |
| [app.json](app.json) `plugins[expo-image-picker].photosPermission` | English (Sell-only copy) | French covering Sell + avatar profile photo. |
| [app.json](app.json) `ios.infoPlist.NSPhotoLibraryUsageDescription` | English (Sell-only copy) | French covering both flows. |

The `cameraPermission` / `microphonePermission` keys are intentionally omitted from the picker plugin tuple — `expo-image-picker` only injects them when set, and the project's existing `expo-camera` plugin already declares `NSCameraUsageDescription` / `NSMicrophoneUsageDescription` (currently in **English**, which is the locale-mismatch caveat already documented in the G.3 changelog as a Step 8 unification follow-up).

### Migration file

| Path | Purpose |
| --- | --- |
| [supabase/migrations/20260516_create_avatars_bucket.sql](supabase/migrations/20260516_create_avatars_bucket.sql) | Creates the `avatars` bucket (public read, 1 MiB cap, JPEG/PNG/WebP allowlist) and four `storage.objects` policies. |

#### Bucket configuration

- `id = 'avatars'`, `name = 'avatars'`, `public = true` (avatars render across the marketplace next to seller listings; signed URLs are unnecessary).
- `file_size_limit = 1048576` (1 MiB) — the client pipeline produces ~50–100 KiB JPEGs, so this is purely defensive against accidental direct API uploads.
- `allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']` — the client always uploads JPEG; PNG and WebP are allowed in case future flows write them directly.

#### RLS policies

| Policy | Role | Rule |
| --- | --- | --- |
| `avatars public read` | `public` | `bucket_id = 'avatars'` (anyone can fetch any avatar by URL) |
| `avatars user insert` | `authenticated` | bucket match **and** `(storage.foldername(name))[1] = auth.uid()::text` |
| `avatars user update` | `authenticated` | bucket match **and** folder match (defensive — flow uses INSERT + DELETE, never UPDATE) |
| `avatars user delete` | `authenticated` | bucket match **and** folder match |

Folder-based RLS means user A cannot read/list user B's files via the storage API even though `getPublicUrl` (a public CDN URL) works for everyone. Combined with `upsert: false`, an attacker cannot overwrite another user's avatar even with a guessed filename.

### Storage helpers — public API

`src/lib/storage/avatars.ts`:

| Symbol | Signature | Behavior |
| --- | --- | --- |
| `uploadAvatar` | `(userId, fileUri) → Promise<{ publicUrl, path }>` | Resize to 512×512 JPEG @ 0.8 via `manipulateAsync` → read as bytes via `expo-file-system` → upload to `avatars/<userId>/<ts>-<rand>.jpg` → return public URL + storage path. Throws on upload error. |
| `deleteAvatarByPath` | `(path) → Promise<void>` | `supabase.storage.from('avatars').remove([path])`. Errors **swallowed by design** — the new avatar is already saved on the seller row; a cleanup failure must not break the foreground UX. |
| `deleteAvatarByUrl` | `(publicUrl) → Promise<void>` | Parses out the `<userId>/<filename>` segment by string-matching `/storage/v1/object/public/avatars/`. Silent no-op if the URL doesn't belong to the bucket (legacy URL, third-party host, empty string). Delegates to `deleteAvatarByPath`. |

### Edit Profile screen changes

[src/app/(protected)/edit-seller-profile.tsx](src/app/(protected)/edit-seller-profile.tsx):

- **New imports:** `Linking` from RN, `* as ImagePicker from 'expo-image-picker'`, `uploadAvatar` + `deleteAvatarByUrl` from the new helper, `supabase` for the inline `auth.getUser()` call.
- **New state:** `const [uploading, setUploading] = useState(false)`. Drives the spinner overlay on the avatar and disables the "Modifier la photo" pressable mid-flight.
- **`handleEditPhoto` rewritten:** Now opens an `Alert.alert(t('profile.editPhotoTitle'), undefined, buttons)` with two-or-three options:
  - When an avatar exists: `[Choisir une photo, Supprimer la photo (destructive), Annuler]`.
  - When no avatar exists: `[Choisir une photo, Annuler]`.
  - Bails immediately if `uploading === true` (prevents double-tap re-entry).
- **`handlePickPhoto`:**
  1. `ImagePicker.requestMediaLibraryPermissionsAsync()`. On denial, present an Alert with `[Annuler, Ouvrir les Réglages]` (the second button calls `Linking.openSettings()`).
  2. `ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 })`. The picker handles the square crop UX; the full-quality image gets passed to our resize step.
  3. `supabase.auth.getUser()` for the auth user id (matches `sell.ts`'s pattern).
  4. `uploadAvatar(userId, asset.uri)` → `updateMutation.mutateAsync({ avatarUrl: publicUrl })` → on success, fire-and-forget `deleteAvatarByUrl(previousUrl)` if a different previous URL existed.
  5. On any error: `Alert.alert(t('profile.uploadErrorTitle'), t('profile.uploadErrorBody'))`. The `existing` cache is unchanged so the avatar visually reverts to the old URL.
  6. `finally { setUploading(false) }`.
- **`handleDeletePhoto`:** Confirmation `Alert.alert` with `[Annuler, Supprimer la photo (destructive)]`. On confirm: `updateMutation.mutateAsync({ avatarUrl: '' })` → fire-and-forget `deleteAvatarByUrl(previousUrl)`. On error: `Alert.alert` of the delete failure.
- **Avatar render:** Wrapped in a relative `<View>` so an `ActivityIndicator` overlay (`rgba(0,0,0,0.45)` scrim, fully circular) can sit on top while `uploading === true`. The "Modifier la photo" pressable text fades to `text.tertiary` and is `disabled` while uploading.
- **Dirty-state decoupling — explicit and intentional:** The avatar render reads from `existing?.avatarUrl` (React-Query cache), not from `form` state. Because B.2's `useUpdateMySeller.onSuccess` calls `setQueryData(MY_SELLER_KEY, next)`, a successful avatar mutation flips the cached value, the `<Avatar>` re-renders, and the JSON-diff between `form` and `initialForm` is unaffected. So you can edit the bio, then change the photo, and the bio's dirty marker is still accurate — and Save still only writes the bio. Conversely, the photo never gets re-sent on Save (its mutation already happened). This is the right shape for an "atomic immediate" affordance vs. an "atomic batched" one. **Do not add `avatarUrl` to `FormState` in B.4** — it would re-couple the two flows.
- **Stale i18n keys preserved:** B.2's `profile.editPhotoComingSoonTitle` / `…Body` are no longer referenced by the screen but are left in both locale files. This way `git revert` of B.3 restores B.2 cleanly without missing-key fallbacks.

### i18n keys added (FR + EN, mirrored)

Under `profile.*`: `editPhotoTitle`, `choosePhoto`, `deletePhoto`, `deletePhotoConfirmTitle`, `deletePhotoConfirmBody`, `uploadErrorTitle`, `uploadErrorBody`, `deleteErrorTitle`, `deleteErrorBody`, `permissionRequiredTitle`, `permissionRequiredBody`.

Under `common.*`: `openSettings`.

### Verification results

- `npx tsc --noEmit` → **exit 0**. Strict mode, no `any`, no implicit-any callbacks. The picker's `MediaType[]` literal-string API works under strict (no enum-import dance), and `manipulateAsync` types resolve cleanly.
- JSON validation: `app.json`, `src/i18n/locales/fr.json`, `src/i18n/locales/en.json` all parse via `JSON.parse`.
- New imports resolve: `expo-image-picker`, `expo-image-manipulator`, `expo-file-system` (transitive Expo SDK dep, used by Sell already).
- No changes to: `EditProfileLocationSheet`, `FormField`, `SectionHeader`, `useEditProfileLocationSheetStore`, the Account stub section, `useMySeller`, `useUpdateMySeller`, the sellers service, the location store, or the Avatar primitive.
- Visual / runtime verification is **deferred to the user**. Steps to validate after `npm run db:push`:
  1. Tap "Modifier la photo" → Alert offers `[Choisir une photo, Annuler]` (or `+ Supprimer la photo` if one is set).
  2. Choose a photo → French permission prompt (first run only) → library opens → square crop → ~1–2 s upload → avatar updates.
  3. Reload the app → avatar persists (URL is in `sellers.avatar_url`).
  4. Replace the photo → check Supabase dashboard → previous file is gone from `avatars/<userId>/`.
  5. Sign in as a different user → cannot list, write, or delete the first user's folder (RLS enforced; will return 403/empty depending on the operation).
  6. Save the rest of the form (bio, name, etc.) → the avatar field is **not** part of the diff sent to `updateMySeller` (verifiable via the network tab).

### Production apply

```
npm run db:push
```

Applies [supabase/migrations/20260516_create_avatars_bucket.sql](supabase/migrations/20260516_create_avatars_bucket.sql) to the linked Supabase project. Type regen is **not required** — storage policies and `storage.buckets` rows do not surface in `Database['public']` (the generated [src/types/supabase.ts](src/types/supabase.ts) describes only the `public` schema). Running `npm run gen:types` after the migration would produce a byte-identical file.

### Reversion

```
git revert <B.3 commit>
```

This restores:
- B.2's placeholder `handleEditPhoto` (Alert "Bientôt disponible") in [edit-seller-profile.tsx](src/app/(protected)/edit-seller-profile.tsx).
- The English `photosPermission` and `NSPhotoLibraryUsageDescription` strings in [app.json](app.json).
- Removes [src/lib/storage/avatars.ts](src/lib/storage/avatars.ts), [supabase/migrations/20260516_create_avatars_bucket.sql](supabase/migrations/20260516_create_avatars_bucket.sql), and the new `profile.*` + `common.openSettings` i18n keys.
- Removes `expo-image-manipulator` from `package.json`.

If the migration was already applied to a Supabase project, run the rollback SQL block at the top of the migration file against each environment manually — `git revert` removes the migration file but does not undo applied DDL.

### Known follow-ups

- **Camera capture as a second option.** Out of scope for v1 per brief. When added, extend the `Alert.alert(t('profile.editPhotoTitle'), ...)` button list with a "Prendre une photo" entry that uses `ImagePicker.launchCameraAsync` (the `expo-camera` plugin already declares `NSCameraUsageDescription`).
- **Server-side resize via Supabase Image Transformations.** The pipeline currently does the only resize on the client. Supabase's `getPublicUrl(path, { transform: { width, height } })` would let us serve thumbnails (e.g. 64×64 for inline avatars in lists) without pre-uploading multiple sizes. Would also remove `expo-image-manipulator` as a dependency. Defer until thumbnail demand is real.
- **French / English Info.plist unification (Step 8).** The `expo-camera` plugin still declares English `cameraPermission` / `microphonePermission`. With this changelog, the photo-library permission is now French, so an iOS user picking a photo for their avatar sees a French prompt while the same user opening the camera in Sell sees an English prompt. Documented as a unification follow-up since G.3.
- **Avatar visibility across the app.** With B.3, `existing.avatarUrl` becomes a real CDN URL on first upload. Any other render path that reads `seller.avatar_url` (public profile screen, listing cards, message threads) will pick up the new URL automatically — but those surfaces should be smoke-tested for Image cache busting (the URL is unique per upload, so cache busting is automatic).
- **`uploading` swipe-back interaction.** A user could in theory tap the back gesture mid-upload. The `beforeRemove` listener does not currently block on `uploading` — the upload promise will continue in the background and either succeed (cache updates while the user is on the previous screen) or fail silently. Acceptable for v1; revisit if user reports surface.

---

## Step B.4 Changelog (2026-05-03) — Auth Flows

Step B.4 retires the four "Bientôt disponible" stub rows that B.2 left behind in the Account section and ships the real auth flows: **sign out**, **change email**, **change password**, and **delete account**. The latter ships with a SECURITY DEFINER RPC because Supabase doesn't expose a client-callable self-delete on `auth.users`. Two-step confirmation (Alert + cross-platform typed-phrase modal) gates the destructive path. After this step, **Phase B is complete end-to-end**: profile audit (B.1) → grant tightening (B.1.5) → sectioned form (B.2) → avatar pipeline (B.3) → auth flows (B.4).

### Reconnaissance findings (no code changes)

- **Existing sign-out:** [src/stores/useAuthStore.ts:75-84](src/stores/useAuthStore.ts:75) — `useAuthStore.getState().logout()` calls `supabase.auth.signOut()` and clears the store. The Profile tab uses it at [src/app/(protected)/(tabs)/profile.tsx:170](src/app/(protected)/(tabs)/profile.tsx:170) followed by `router.replace('/(protected)/(tabs)')`. B.4 reuses this helper but follows up with `router.replace('/(auth)/login')` instead, since (protected) is **not auth-gated** ([src/app/(protected)/_layout.tsx](src/app/(protected)/_layout.tsx) — "Free browsing: no auth gate at the route level"). The Edit Profile screen would otherwise stay mounted with a now-stale `useMySeller` query after sign-out.
- **Auth state listener:** [src/app/_layout.tsx:82](src/app/_layout.tsx:82) wires `subscribeToAuthChanges` from the auth store at app boot, so `supabase.auth.signOut()` (whether explicit or as a side effect of the delete RPC) reconciles store state automatically. B.4 doesn't need to touch the listener.
- **Login route:** `/(auth)/login`. `(auth)/_layout.tsx` redirects authenticated users back to `/`, so once an unauthenticated user lands on login the rest of the auth flow is intact.
- **No `auth` features folder existed.** B.4 creates `src/features/auth/services/auth.ts` for the new helpers (`changeEmail`, `changePassword`, `deleteMyAccount`) and intentionally does **not** add a duplicate `signOut` helper there — `useAuthStore.logout()` is already the project's canonical sign-out path and shadowing it would invite drift.
- **FK CASCADE inventory** — read every existing migration that references `auth.users(id)` or `sellers/products/conversations/orders` IDs to determine whether `auth.users` deletion would cascade cleanly:

| Table.column | References | Action | Notes |
| --- | --- | --- | --- |
| `sellers.user_id` | `auth.users(id)` | **CASCADE** | [20260503_sell_setup.sql:3](supabase/migrations/20260503_sell_setup.sql:3) |
| `bookmarks.user_id` | `auth.users(id)` | **CASCADE** | [20260501_initial_marketplace_schema.sql:65](supabase/migrations/20260501_initial_marketplace_schema.sql:65) |
| `likes.user_id` | `auth.users(id)` | **CASCADE** | [20260501_initial_marketplace_schema.sql:76](supabase/migrations/20260501_initial_marketplace_schema.sql:76) |
| `conversations.buyer_id` | `auth.users(id)` | **CASCADE** | [20260509_messaging.sql:5](supabase/migrations/20260509_messaging.sql:5) |
| `conversations.seller_user_id` | `auth.users(id)` | **CASCADE** | [20260509_messaging.sql:6](supabase/migrations/20260509_messaging.sql:6) |
| `messages.sender_id` | `auth.users(id)` | **CASCADE** | [20260509_messaging.sql:20](supabase/migrations/20260509_messaging.sql:20) |
| `push_tokens.user_id` | `auth.users(id)` | **CASCADE** | [20260512_push_tokens.sql:3](supabase/migrations/20260512_push_tokens.sql:3) |
| `orders.buyer_id` | `auth.users(id)` | **CASCADE** | [20260510_orders.sql:3](supabase/migrations/20260510_orders.sql:3) |
| `products.seller_id` | `sellers(id)` | CASCADE (transitive) | Via `sellers.user_id` cascade |
| `bookmarks.product_id`, `likes.product_id`, `conversations.product_id`, `messages.conversation_id` | (various) | CASCADE (transitive) | Via products/conversations cascade |
| **`orders.seller_id`** | **`sellers(id)`** | **RESTRICT** ⚠️ | [20260510_orders.sql:5](supabase/migrations/20260510_orders.sql:5) — **blocks the cascade chain** when the user has any sales |
| **`orders.product_id`** | **`products(id)`** | **RESTRICT** ⚠️ | [20260510_orders.sql:4](supabase/migrations/20260510_orders.sql:4) — **same row set** as the `seller_id` block |

The two RESTRICTs together mean a `DELETE FROM auth.users WHERE id = X` will fail any time user X has acted as a seller in an existing order. The B.4 RPC pre-deletes the offending `orders` rows (`seller_id IN (SELECT id FROM sellers WHERE user_id = v_user_id)`, which by construction also covers the `product_id` RESTRICT for the same rows) before issuing the auth-users delete. **This loses sales-history rows** — flagged as a v1 trade-off vs. a future "anonymize-and-keep" variant in the follow-ups section below.

### Migration file

| Path | Purpose |
| --- | --- |
| [supabase/migrations/20260517_delete_my_account_rpc.sql](supabase/migrations/20260517_delete_my_account_rpc.sql) | Defines `public.delete_my_account()` (SECURITY DEFINER), pre-deletes blocking `orders` rows, then `DELETE FROM auth.users WHERE id = auth.uid()`. EXECUTE granted to `authenticated` only; revoked from `public` and `anon`. |

#### RPC signature

```sql
public.delete_my_account() returns void
```

- `SECURITY DEFINER` — runs with the migration owner's rights so the JS client (which has no access to `auth.users` or to RESTRICTed `orders` rows) can still execute the chain.
- `set search_path = pg_catalog, public, auth` — pinned to defeat the classic SECURITY DEFINER search-path hijack vector.
- Body re-checks `auth.uid()`; raises `'unauthenticated'` for anon JWTs (defensive — the EXECUTE grant already excludes `anon`, but the explicit guard makes the error path well-defined).

### Auth helpers

[src/features/auth/services/auth.ts](src/features/auth/services/auth.ts):

| Symbol | Behavior |
| --- | --- |
| `changeEmail(newEmail)` | `supabase.auth.updateUser({ email })`. Triggers Supabase's email-confirmation flow; the change is pending until the user clicks the link delivered to the new address. |
| `IncorrectCurrentPasswordError` | Typed sentinel error. Lets the change-password screen render an inline error on the "current password" field instead of showing a generic Alert. |
| `changePassword(current, next)` | 1. `supabase.auth.getUser()` → email. 2. `signInWithPassword({ email, password: current })` to validate the current password (Supabase's `updateUser` does not verify it). On failure, throws `IncorrectCurrentPasswordError`. 3. `updateUser({ password: next })`. |
| `deleteMyAccount()` | `supabase.rpc('delete_my_account')` → on success, best-effort `supabase.auth.signOut()`. The sign-out step is wrapped in try/catch because the user is already deleted server-side; a failed local clean-up is not a data-integrity issue. |

#### Type-system shim

The `delete_my_account` function name is **not yet in** [src/types/supabase.ts](src/types/supabase.ts) (types were last regenerated before this migration). To keep `tsc --noEmit` green without `any`, the call uses `'delete_my_account' as never` — the supabase-js community's standard escape hatch for a "function exists but types are stale" gap. Running `npm run gen:types` after applying the migration will register the function name and the `as never` cast can be cleaned up. The cast is documented in-line so a future maintainer doesn't accidentally forget it.

### New sub-routes

| Path | Purpose |
| --- | --- |
| [src/app/(protected)/account/change-password.tsx](src/app/(protected)/account/change-password.tsx) | Three-field form (`current`, `next`, `confirm`) using the B.2 `FormField` primitive (now with `secureTextEntry`). Validation: `current` non-empty, `next` ≥ 8 chars, `confirm` matches `next`. On `IncorrectCurrentPasswordError`, surfaces the error inline on the `current` field. On success, alert → `router.back()`. |
| [src/app/(protected)/account/change-email.tsx](src/app/(protected)/account/change-email.tsx) | Renders a read-only "Email actuel" block above the new-email field. Validation: non-empty + `^[^\s@]+@[^\s@]+\.[^\s@]+$` + must differ from current. A surface below the input explains the email-confirmation flow ("Vous recevrez un email de confirmation à la nouvelle adresse"). On success, alert → `router.back()`. |

Both routes mirror B.2's screen scaffolding (header bar with back + centered title + right-aligned Save), so the sub-flow visually belongs to the Edit Profile experience.

### TypedConfirmModal — cross-platform replacement for `Alert.prompt`

[src/components/profile/TypedConfirmModal.tsx](src/components/profile/TypedConfirmModal.tsx) — `Alert.prompt` is iOS-only. Rather than splitting the delete-account UX across two platform branches, B.4 ships a small (≈155-line) RN `Modal` that:

- Renders a translucent backdrop scrim (tap to dismiss).
- Centers a card with title + body + a single uppercase TextInput + a Cancel + Delete row.
- Disables the destructive button until the trimmed, case-insensitive input matches the `expectedPhrase` prop.
- Resets its input on every `visible` flip so re-opening starts clean.
- Is mounted once at the bottom of the Edit Profile screen tree alongside `EditProfileLocationSheet` (mirroring B.2's mounting pattern).

The phrase comes from i18n: `profile.deleteAccountConfirmPhrase` (`SUPPRIMER` in FR, `DELETE` in EN). Localizing the phrase rather than hardcoding it means a future locale add-on doesn't require a code change.

### `FormField` extension

[src/components/profile/FormField.tsx](src/components/profile/FormField.tsx) gained two additive props (B.2 didn't need them, B.4 does):

- `secureTextEntry?: boolean`
- `textContentType?: TextInputProps['textContentType']` (lets iOS surface password-strength + autofill hints on `'password'` / `'newPassword'`)

No behavior change for B.2 callers — defaults preserve the exact prior render.

### EditProfile Account section: stub → real

[src/app/(protected)/edit-seller-profile.tsx](src/app/(protected)/edit-seller-profile.tsx):

- Removed `handleAccountStubPress`. Added four real handlers + two new local state pieces:
  - `handleChangeEmail` → `router.push('/(protected)/account/change-email')`.
  - `handleChangePassword` → `router.push('/(protected)/account/change-password')`.
  - `handleSignOut` → confirmation `Alert.alert` → on confirm, `await useAuthStore.getState().logout()` + `router.replace('/(auth)/login')`.
  - `handleDeleteAccount` → warning `Alert.alert` (`Continuer` / `Annuler`) → on continue, `setDeleteModalVisible(true)`.
  - `handleDeleteConfirm` (called from the modal) → `await deleteMyAccount()` → `router.replace('/(auth)/login')`. Errors fall through to a localized `Alert.alert`. State: `[deleteModalVisible, deleting]`.
- Renamed `AccountStubRow` → `AccountRow`. Made the "Soon" chip optional (now omitted entirely, since none of the rows are stubs). Added a `disabled` prop so the Delete row dims while a deletion is in flight.
- The Account section now renders **four** rows (was three with stubs, no signOut row before): Change email, Change password, **Sign out** (danger), Delete account (danger). Each is a real `Pressable` with the existing haptic + chevron treatment.
- Mounted `<TypedConfirmModal>` alongside `<EditProfileLocationSheet>` at the bottom of the screen tree.
- **Avatar dirty-state guardrail respected** — no avatar-related code was touched. Photo mutations remain decoupled from the form's atomic-save dirty diff (B.3 invariant).

### i18n keys added (FR + EN, mirrored)

Under `profile.*`: `sectionSecurity`, `signOutTitle`, `signOutBody`, `signOutConfirm`, `changeEmailTitle`, `changeEmailNotice`, `changeEmailSuccessTitle`, `changeEmailSuccessBody`, `changeEmailCurrentLabel`, `changeEmailNewLabel`, `validationEmailNewSameAsCurrent`, `changePasswordTitle`, `changePasswordCurrentLabel`, `changePasswordNewLabel`, `changePasswordConfirmLabel`, `changePasswordHelper`, `changePasswordSuccessTitle`, `changePasswordSuccessBody`, `validationPasswordRequired`, `validationPasswordTooShort`, `validationPasswordMismatch`, `validationCurrentPasswordIncorrect`, `deleteAccountTitle`, `deleteAccountWarning`, `deleteAccountContinue`, `deleteAccountConfirmTitle`, `deleteAccountConfirmBody`, `deleteAccountConfirmPhrase`, `deleteAccountFinal`, `deleteAccountMismatch`.

The B.2 stub keys (`comingSoonTitle`, `comingSoonBody`, `comingSoonShort`) are preserved so a `git revert` of B.4 restores the stub behavior cleanly without missing-key fallbacks.

### Verification results

- `npx tsc --noEmit` → **exit 0**. Strict mode, no `any`. The `'delete_my_account' as never` cast is the only type-system escape hatch and is documented inline + here.
- JSON validation: both locale files parse via `JSON.parse`.
- New imports resolve: `expo-router`, `react-native` (`Modal`, `KeyboardAvoidingView`, `Platform`), `@expo/vector-icons`, `@/lib/supabase`, `@/components/profile/*`, `@/components/ui`, `@/stores/useAuthStore`, `@/features/auth/services/auth`.
- Untouched (per constraints): `useUpdateMySeller`, `useMySeller`, the sellers service, the avatar pipeline (`src/lib/storage/avatars.ts`), `EditProfileLocationSheet`, `useEditProfileLocationSheetStore`, the Avatar primitive, the form's atomic-save logic.
- Visual / runtime verification deferred to the user (see "Production apply" below). Steps to validate:
  1. Open Edit Profile → Account section now shows four rows: Changer l'email, Changer le mot de passe, Se déconnecter (red), Supprimer le compte (red).
  2. **Sign out** → confirmation Alert → on confirm, redirected to `/(auth)/login`.
  3. **Change email** → sub-route → enter a new email → success alert → return. Open the new email's inbox to verify the confirmation link.
  4. **Change password** → sub-route → wrong current → inline error on first field. Right current + 8+ char new + matching confirm → success alert → return.
  5. **Delete account** → warning Alert (`Continuer`) → typed-confirm modal → type `SUPPRIMER` → button enables → confirm → `auth.users` row gone (verify in Supabase dashboard) → redirected to login. Verify the user's `sellers`, `products`, `conversations`, `messages`, `bookmarks`, `likes`, `push_tokens`, and any seller-side `orders` are gone.

### Production apply

```
npm run db:push           # applies the SECURITY DEFINER RPC migration
npm run gen:types         # OPTIONAL but recommended — registers delete_my_account
                          # in the generated Database types so the `as never`
                          # cast in src/features/auth/services/auth.ts can be
                          # cleaned up.
```

Both commands are safe to re-run; the migration is idempotent (CREATE OR REPLACE, REVOKE/GRANT) and gen:types overwrites the types file deterministically.

### Reversion

```
git revert <B.4 commit>
```

This restores:
- B.2's stub `handleAccountStubPress` and `AccountStubRow` in [edit-seller-profile.tsx](src/app/(protected)/edit-seller-profile.tsx).
- The narrower `FormField` (no `secureTextEntry`/`textContentType`) — B.2 didn't pass them, so existing call sites are unaffected.
- Removes [supabase/migrations/20260517_delete_my_account_rpc.sql](supabase/migrations/20260517_delete_my_account_rpc.sql), [src/features/auth/services/auth.ts](src/features/auth/services/auth.ts), [src/components/profile/TypedConfirmModal.tsx](src/components/profile/TypedConfirmModal.tsx), and the two `account/*` route files.
- Strips the new `profile.*` i18n keys from both locales.

If the migration was already applied, run the rollback SQL block at the top of the migration file against each Supabase environment manually — `git revert` removes the migration file but does not undo applied DDL. The rollback also revokes the `EXECUTE` grant explicitly (defensive — `DROP FUNCTION` already revokes implicitly).

### Phase B end-to-end summary

| Step | Date | Scope | Migration(s) | Files (added/modified) |
| --- | --- | --- | --- | --- |
| **B.1**   | (audit) | PROFILE_AUDIT.md — gap inventory across schema, grants, storage, auth, UI | — | `PROFILE_AUDIT.md` |
| **B.1.5** | 2026-05-15 | Tighten column-level UPDATE grants on `sellers` (close self-elevation gap) | `20260515_tighten_sellers_update_grants.sql` | (no source code changes) |
| **B.2**   | 2026-05-03 | Sectioned Edit Profile form (Identité, À propos, Contact, Position de vente, Compte stub) + atomic save + dirty-state guard | — | `edit-seller-profile.tsx`, `sellers.ts`, `useUpdateMySeller`, `FormField`, `SectionHeader`, `EditProfileLocationSheet`, `useEditProfileLocationSheetStore`, locales |
| **B.3**   | 2026-05-03 | Avatar upload pipeline (bucket + RLS + image picker + resize + URL persist + best-effort cleanup) | `20260516_create_avatars_bucket.sql` | `avatars.ts`, `edit-seller-profile.tsx`, `app.json`, `package.json` (image-manipulator), locales |
| **B.4**   | 2026-05-03 | Auth flows (sign out, change email, change password, delete account via SECURITY DEFINER RPC) | `20260517_delete_my_account_rpc.sql` | `features/auth/services/auth.ts`, `change-email.tsx`, `change-password.tsx`, `TypedConfirmModal`, `FormField` (+secureTextEntry), `edit-seller-profile.tsx`, locales |

After B.4, the Edit Profile screen is **functionally complete**: every row in the section list does what its label says. The remaining work for Phase C / D / future steps lives outside this surface.

### Known follow-ups

- **Forgot-password flow on the login screen.** Out of Phase B scope per brief — that's a sign-in / pre-auth concern. When added, it will live at `/(auth)/forgot-password` and call `supabase.auth.resetPasswordForEmail(email)` with a deep-link redirect target; the redirect handler then opens the existing change-password screen in a "new password only" mode.
- **Email-change verification status.** After `changeEmail`, Supabase keeps the session on the old email until verification. The Edit Profile screen currently shows the old email until the user signs back in (or the auth listener fires a refresh). A future "pending email change" indicator could read `auth.user.new_email` (Supabase exposes it post-`updateUser` while the change is pending) and surface a subtle banner.
- **Password strength meter.** Currently the only UI feedback is a static `≥ 8 characters` helper. Adding a real-time strength indicator (zxcvbn or similar) is a small UX win but a non-trivial bundle add.
- **Anonymize-instead-of-delete for `orders`.** B.4's RPC deletes the user's seller-side orders to free the cascade chain. A privacy-friendlier variant would set the seller_id to a tombstone seller row + null out `name`/`avatar_url`/etc. on the `sellers` row instead of cascading. Worth doing once a real audit / Stripe-compliance requirement lands.
- **Re-auth window for destructive actions.** Currently any signed-in user can issue the delete RPC. A more cautious flow would require a fresh password re-entry (similar to the change-password current-password check) before the delete. Defer until a security review surfaces the gap.
- **Type regen.** The `'delete_my_account' as never` cast in `src/features/auth/services/auth.ts` is intentional but should be removed once `npm run gen:types` runs against an environment where the migration is applied. Trivial cleanup; tracked here so it's not forgotten.

---

## Step C.2 Changelog (2026-05-03) — Follows Schema + Counter Trigger

Schema-only step. Adds the `follows` table, two counter columns on `sellers`, a `SECURITY DEFINER` trigger that maintains the counters, three RLS policies, and the table-level grants needed by the JS client. No TypeScript / source-code changes.

> **Audit referenced:** [FOLLOWING_AUDIT.md](FOLLOWING_AUDIT.md) — recommended schema direction **S1** (composite PK on `sellers.id`, public-authenticated SELECT, owner-scoped INSERT/DELETE, counter columns maintained by trigger).

### Reconnaissance findings (re-confirmed before authoring)

- **Greenfield.** No existing `follows` / `followers` / `following` table or code. Verified by grepping `src/` and `supabase/migrations/` (FOLLOWING_AUDIT.md §1). C.2 is a clean add — no stub to reconcile.
- **Likes pattern referenced.** [supabase/migrations/20260501_initial_marketplace_schema.sql:64-70](supabase/migrations/20260501_initial_marketplace_schema.sql#L64) for the table shape (composite PK, CASCADE FKs, single supplementary index on the non-leading column). [supabase/migrations/20260502_engagement_triggers.sql:17-41](supabase/migrations/20260502_engagement_triggers.sql#L17) for the trigger shape (`SECURITY DEFINER`, `greatest(x - 1, 0)` clamp, `AFTER INSERT OR DELETE`). One deliberate deviation from likes: SELECT is open to authenticated users, not private-to-owner — follower lists must be discoverable. Documented in the migration header.
- **B.1.5 grant constraint reaffirmed.** [supabase/migrations/20260515_tighten_sellers_update_grants.sql:53-64](supabase/migrations/20260515_tighten_sellers_update_grants.sql#L53) re-grants UPDATE on `sellers` only on the user-controlled allowlist (`name, avatar_url, bio, website, phone_public, email_public, latitude, longitude, location_text, location_updated_at`). The new `followers_count` / `following_count` columns are deliberately **not** added to the allowlist. Their only writer is the trigger function, which is `SECURITY DEFINER` so it bypasses the column grant. Adding them to the allowlist would re-open the self-elevation gap that B.1.5 closed.
- **`sellers` FK shape confirmed.** `sellers.id uuid primary key default uuid_generate_v4()` ([supabase/migrations/20260501_initial_marketplace_schema.sql:21-30](supabase/migrations/20260501_initial_marketplace_schema.sql#L21)) and `sellers.user_id uuid references auth.users(id) on delete cascade unique` ([supabase/migrations/20260503_sell_setup.sql:2-4](supabase/migrations/20260503_sell_setup.sql#L2)). The follows FKs both reference `sellers(id)` (UUID); the RLS policies translate `auth.uid()` → `sellers.id` via the `sellers.user_id` 1:1 mapping.
- **Migration naming convention.** `YYYYMMDD_description.sql`. Latest existing is `20260517`. New file is `20260518_follows_schema_and_counters.sql` to preserve lexical apply ordering even though today's calendar date is earlier — mirrors the convention used by B.2/B.3/B.4 (changelog dated 2026-05-03, migrations dated 20260515-20260517).

### Migration

**File:** [supabase/migrations/20260518_follows_schema_and_counters.sql](supabase/migrations/20260518_follows_schema_and_counters.sql)

**Schema additions in seven steps (all wrapped in a single `BEGIN; ... COMMIT;`):**

| # | Action | Statement |
| --- | --- | --- |
| 1 | Counter columns on `sellers` | `alter table public.sellers add column if not exists followers_count integer not null default 0, add column if not exists following_count integer not null default 0;` — backfills existing rows to 0 (no follow rows exist yet, so this is correct). |
| 2 | `follows` table | `create table if not exists public.follows ( follower_id uuid not null references public.sellers(id) on delete cascade, following_id uuid not null references public.sellers(id) on delete cascade, created_at timestamptz not null default now(), primary key (follower_id, following_id), constraint follows_no_self_follow check (follower_id <> following_id) );` |
| 3 | Supplementary index | `create index if not exists follows_following_id_idx on public.follows (following_id);` — the PK already covers the leading-column `follower_id` lookup; this covers the reverse direction. |
| 4 | Trigger function | `create or replace function public.handle_follow_change() returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$ ... $$;` — `INSERT` branch: increment `sellers[NEW.following_id].followers_count` and `sellers[NEW.follower_id].following_count`. `DELETE` branch: decrement both with `greatest(x - 1, 0)` clamp. |
| 5 | Trigger wiring | `drop trigger if exists follows_change_trigger on public.follows; create trigger follows_change_trigger after insert or delete on public.follows for each row execute function public.handle_follow_change();` |
| 6 | RLS policies (3) | `alter table public.follows enable row level security;` then `"follows authenticated read"` (`select to authenticated using (true)`), `"follows self insert"` (`with check follower_id in (select id from public.sellers where user_id = auth.uid())`), `"follows self delete"` (`using ...` same subquery). No UPDATE policy — follow rows are immutable. |
| 7 | Table-level grant | `grant select, insert, delete on public.follows to authenticated;` — no grant to `anon`, no `update` to anyone. |

### Trigger SECURITY DEFINER rationale (cite B.1.5)

After B.1.5 ([20260515_tighten_sellers_update_grants.sql](supabase/migrations/20260515_tighten_sellers_update_grants.sql)), the `authenticated` role has no UPDATE grant on `sellers` columns outside the user-editable allowlist. `followers_count` / `following_count` are intentionally outside that allowlist — they are server-managed counters, not user-editable profile fields. For the trigger function to UPDATE columns the calling user has no grant on, it must be `SECURITY DEFINER` so it runs with the migration owner's rights instead of the calling user's rights. The function additionally pins `set search_path = public, pg_catalog` to defeat the classic SECURITY DEFINER hijack vector — without this, a malicious user could create a `public.sellers` shadow object in their own schema and trick the trigger into resolving it. Both clauses are required; neither is optional.

The older trigger functions in [20260502_engagement_triggers.sql](supabase/migrations/20260502_engagement_triggers.sql) (`on_like_change` / `on_bookmark_change`) are also `SECURITY DEFINER` but predate B.1.5 and rely on the default `search_path`. The new `handle_follow_change()` lands post-B.1.5 and locks `search_path` explicitly — a small hardening upgrade for any new trigger going forward.

### Three-scenario policy walk-through (informal proof)

| Scenario | Inputs | RLS outcome | Trigger outcome |
| --- | --- | --- | --- |
| **(a) Self-follow as me** | User A (`sellers.id = a`, `auth.uid = uA`) inserts `(a, b)` into `follows`. | `WITH CHECK` subquery resolves `a.user_id = uA` → matches `auth.uid()`. **Pass.** | Increments `sellers[b].followers_count` and `sellers[a].following_count`. |
| **(b) Follow on someone else's behalf** | User A (`auth.uid = uA`) tries to insert `(b, c)` where `b.user_id ≠ uA`. | `WITH CHECK` subquery resolves `b.user_id ≠ uA`. **Deny.** PostgREST returns 403. | Never fires; the row is never written. |
| **(c) Unfollow my own row** | User A deletes their own `(a, b)` row. | `USING` subquery resolves `a.user_id = uA`. **Pass.** | Decrements `sellers[b].followers_count` and `sellers[a].following_count`, both with `greatest(x - 1, 0)` clamp. |

The CHECK constraint `follower_id <> following_id` blocks `(a, a)` self-follow at the DB layer — this fires before the RLS policy on INSERT and surfaces as a Postgres `23514` (check_violation) to the client, separate from any 403 RLS denial. The JS client should also gate the FollowButton to never show a "follow yourself" affordance, but the DB is the source of truth.

### Composition with B.4's `delete_my_account` RPC

The cascade chain in [20260517_delete_my_account_rpc.sql:11-28](supabase/migrations/20260517_delete_my_account_rpc.sql#L11) gains two new CASCADE-direct paths via `follows`:

```
auth.users → sellers (CASCADE on user_id)
            → follows.follower_id  (CASCADE on follower_id)   -- NEW
            → follows.following_id (CASCADE on following_id)  -- NEW
```

No edit to the B.4 RPC is required. As the cascade unwinds:

1. `delete from auth.users where id = v_user_id` ([20260517_delete_my_account_rpc.sql:98](supabase/migrations/20260517_delete_my_account_rpc.sql#L98)) cascades to the deleted user's `sellers` row.
2. The `sellers` delete cascades to every `follows` row where `follower_id` or `following_id` matches the deleted seller.
3. Each `follows` DELETE fires `handle_follow_change()`, which decrements the surviving sellers' counters with the `greatest(x - 1, 0)` clamp.

The end state is consistent: the deleted user's outgoing follows are gone, the deleted user's followers' `following_count` is decremented (since they were following someone who no longer exists), and the people the deleted user followed have their `followers_count` decremented.

### Production apply

```
npm run db:push      # applies 20260518_follows_schema_and_counters.sql
npm run gen:types    # REQUIRED — regenerates src/types/supabase.ts
git add src/types/supabase.ts && git commit -m "chore(types): generate supabase types after C.2"
```

Both commands are safe to re-run; the migration is idempotent (`IF NOT EXISTS` / `OR REPLACE` / `DROP IF EXISTS` on every DDL) and `gen:types` overwrites the types file deterministically.

### Type regen — REQUIRED before C.3

Unlike B.1.5 (grant changes do not surface in generated types), this migration adds:

- A new public-schema table → `Database['public']['Tables']['follows']` (with `Row`, `Insert`, `Update`, `Relationships`).
- Two new columns on `sellers` → `Database['public']['Tables']['sellers']['Row']` gains `followers_count: number` and `following_count: number`; same for `Insert` (optional with default 0) and `Update` (optional).

C.3 implements `useToggleFollow` against `from('follows').insert(...)` and reads `followers_count` from the `sellers` row. Without `gen:types`, the table is unknown to TypeScript and the `from('follows')` call would require an `as never` escape-hatch cast (the same pattern B.4 used for `'delete_my_account' as never` while types were stale). To keep C.3 cleanly typed, run `gen:types` between C.2 apply and C.3 implementation.

### Verification (this step)

- `npx tsc --noEmit` → **exit 0**. No source changes; the migration file is SQL-only.
- Migration SQL syntactically inspected:
  - Balanced `BEGIN; ... COMMIT;` (single transaction wrapper).
  - Every `CREATE` has matching `IF NOT EXISTS` (table, columns, index) or `OR REPLACE` (function) or `DROP ... IF EXISTS` + `CREATE` (trigger, policies). Re-running is a no-op.
  - No `GRANT ... TO anon` or `GRANT ... TO public` anywhere. Only `GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated`.
  - Trigger function is `SECURITY DEFINER` with `SET search_path = public, pg_catalog` — both required, both present.
  - No `UPDATE` policy on `follows` — follow rows are immutable; toggling = INSERT/DELETE.
  - `CHECK (follower_id <> following_id)` is named (`follows_no_self_follow`) so a future drop/replace is unambiguous.
  - Inline rollback SQL block is a complete reverse of the forward migration (revokes grants → drops policies → drops trigger → drops function → drops index → drops table → drops counter columns).
- Local apply is OPTIONAL per Op.1's STOP boundary. The user runs production apply explicitly.

### Reversion

```
git revert <C.2 commit>
```

This removes [supabase/migrations/20260518_follows_schema_and_counters.sql](supabase/migrations/20260518_follows_schema_and_counters.sql) from source control. **If the migration was already applied to a database, `git revert` does NOT undo applied DDL** — the rollback SQL block at the top of the migration file must be run manually against each environment:

```sql
begin;
  revoke select, insert, delete on public.follows from authenticated;
  drop policy if exists "follows authenticated read" on public.follows;
  drop policy if exists "follows self insert"        on public.follows;
  drop policy if exists "follows self delete"        on public.follows;
  drop trigger  if exists follows_change_trigger     on public.follows;
  drop function if exists public.handle_follow_change();
  drop index    if exists public.follows_following_id_idx;
  drop table    if exists public.follows;
  alter table   public.sellers drop column if exists followers_count;
  alter table   public.sellers drop column if exists following_count;
commit;
```

The rollback also revokes the table-level GRANT explicitly (defensive — `DROP TABLE` already revokes implicitly). Order matters: drop policies / trigger / function before the table so the dependencies unwind cleanly. After running, also `npm run gen:types` to remove `Database['public']['Tables']['follows']` and the new `sellers` columns from the generated types.

### C.3 handoff

C.3 is unblocked once the migration is applied and types are regenerated. The hooks/services to write next, all mirroring existing precedent:

- **Extend `UserEngagement`** in [src/features/marketplace/services/products.ts:384-407](src/features/marketplace/services/products.ts#L384) with `followingSellerIds: Set<string>` so a single `listUserEngagement()` round-trip primes follow-state alongside likes and bookmarks. Cache key stays `USER_ENGAGEMENT_QUERY_KEY = ['marketplace', 'engagement']` ([useUserEngagement.ts:7](src/features/marketplace/hooks/useUserEngagement.ts#L7)) — no key churn.
- **`followSeller(targetSellerId)` / `unfollowSeller(targetSellerId)`** service functions adopting the `PG_UNIQUE_VIOLATION = '23505'` swallow pattern from [products.ts:346, 353](src/features/marketplace/services/products.ts#L346). The follower's own `sellers.id` is resolved via the `getOrCreateSellerForCurrentUser` RPC (already invoked by `updateMySeller` in [sellers.ts:115-118](src/features/marketplace/services/sellers.ts#L115)).
- **`useToggleFollow(targetSellerId)`** mutation hook mirroring [useToggleLike.ts:15-45](src/features/marketplace/hooks/useToggleLike.ts#L15) exactly: `onMutate` snapshot → optimistic patch via `setQueryData` → `onError` rollback → `onSettled` invalidation. Two extensions over the like/bookmark template:
  1. `onSettled` invalidates `['seller', 'byId', targetSellerId]` so the public seller profile's `followers_count` refreshes (likes/bookmarks invalidate the products list for `likes_count`).
  2. The optimistic patch toggles `followingSellerIds` on the `UserEngagement` cache entry, not `likedIds` / `bookmarkedIds`.
- **No UI work in C.3.** The `FollowButton` UI / placement is C.4's scope (per FOLLOWING_AUDIT.md §10 / U1).

---

## Step C.3 Changelog (2026-05-03) — Follow Hooks + UserEngagement Extension

JS-only step. Ships the React Query hooks layer for follow/unfollow on top of C.2's schema. Three new hooks (`useToggleFollow`, `useFollowers`, `useFollowing`), one new service (`follows.ts`), and one additive type extension on `UserEngagement` so any component can answer "am I following this seller?" via O(1) Set membership without an extra round trip. No UI changes — C.4 wires the FollowButton.

### Reconnaissance findings

- **Type regen confirmed.** [src/types/supabase.ts:106-138](src/types/supabase.ts#L106) now includes `Database['public']['Tables']['follows']` (Row / Insert / Update / Relationships with both FKs to `sellers`); [src/types/supabase.ts:406-407, 431-432, 456-457](src/types/supabase.ts#L406) gain `followers_count: number` and `following_count: number` on the `sellers` Row / Insert / Update. The user ran `npm run db:push` + `npm run gen:types` between C.2 and C.3. C.3 uses the regenerated types directly — no `as never` / `as any` escape hatches.
- **`UserEngagement` location.** Defined at [src/features/marketplace/services/products.ts:384-407](src/features/marketplace/services/products.ts#L384) (type + `listUserEngagement()` fetcher); read via the hook at [src/features/marketplace/hooks/useUserEngagement.ts](src/features/marketplace/hooks/useUserEngagement.ts) keyed by `USER_ENGAGEMENT_QUERY_KEY = ['marketplace', 'engagement']` with `staleTime: 5 * 60_000`. Pre-extension shape: `{ likedIds: Set<string>; bookmarkedIds: Set<string> }`.
- **Existing toggle pattern.** [src/features/marketplace/hooks/useToggleLike.ts:15-45](src/features/marketplace/hooks/useToggleLike.ts#L15) and [useToggleBookmark.ts:15-45](src/features/marketplace/hooks/useToggleBookmark.ts#L15) are byte-for-byte identical except for the `liked` / `bookmarked` field name. Both take `(productId: string)` at hook construction and `currentlyXXX: boolean` as the mutation variable. Both follow `onMutate` snapshot → `setQueryData` patch → `onError` rollback → `onSettled` invalidate (`['marketplace', 'products', 'list']`). Auth gating is **not** in the hook — call sites use `useRequireAuth`.
- **`currentSellerId` source.** No top-level auth-context exposes a seller-row id. The pattern used by `updateMySeller` ([sellers.ts:115-124](src/features/marketplace/services/sellers.ts#L115)) is to call the SECURITY DEFINER RPC `get_or_create_seller_for_current_user(p_username, p_avatar_url)` which returns `string` (the seller UUID). The RPC is idempotent — calling it returns the existing row's id if one exists, or creates one and returns the new id. C.3's `followSeller` / `unfollowSeller` adopt the same pattern. The `useMySeller` hook ([useMySeller.ts:1-13](src/features/marketplace/hooks/useMySeller.ts#L1), key `MY_SELLER_KEY = ['marketplace', 'my-seller']`) wraps `getMySeller()` (read-only `select('*').eq('user_id', auth.user.id)`); does not auto-create.
- **Seller query key shape.** [useSeller.ts:8](src/features/marketplace/hooks/useSeller.ts#L8) — `['seller', 'byId', id]`. `useToggleFollow.onSettled` invalidates this so `followers_count` refreshes on the public profile after a toggle.
- **Path convention.** No `src/features/social/` directory exists. The brief explicitly green-lights `src/features/marketplace/services/follows.ts` as the alternative; placing the new files alongside `useToggleLike` / `useToggleBookmark` / `useUserEngagement` keeps the engagement story coherent and avoids spawning a one-file `social` feature for what is conceptually marketplace social.
- **`useInfiniteQuery` first use.** No prior `useInfiniteQuery` call in `src/`; `@tanstack/react-query ^5.95.2` is already a dependency so no install needed. The list hooks (`useFollowers` / `useFollowing`) are the project's first paginated React Query consumers — pattern is conventional (initial `pageParam: 0`, `getNextPageParam` returns `allPages.length * PAGE_SIZE` until a short page indicates end-of-list).

### Files added

| Path | Role |
| --- | --- |
| [src/features/marketplace/services/follows.ts](src/features/marketplace/services/follows.ts) | Service layer: `followSeller`, `unfollowSeller`, `listFollowers`, `listFollowing`, plus `FollowerRow` and `ListPageOpts` types. |
| [src/features/marketplace/hooks/useToggleFollow.ts](src/features/marketplace/hooks/useToggleFollow.ts) | Optimistic-toggle mutation; takes `{ sellerId, currentlyFollowing }` per call (vs the like/bookmark hooks which bind `productId` at hook construction — see "Signature deviation" below). |
| [src/features/marketplace/hooks/useFollowers.ts](src/features/marketplace/hooks/useFollowers.ts) | Paginated `useInfiniteQuery` over `listFollowers(sellerId)`. |
| [src/features/marketplace/hooks/useFollowing.ts](src/features/marketplace/hooks/useFollowing.ts) | Symmetric — `useInfiniteQuery` over `listFollowing(sellerId)`. |

### Files modified

| Path | Change |
| --- | --- |
| [src/features/marketplace/services/products.ts](src/features/marketplace/services/products.ts) | `UserEngagement` gains `followingSellerIds: Set<string>`. `listUserEngagement()` resolves the calling user's `sellers.id` in parallel with the likes/bookmarks queries (single round trip), then fetches their follows by `follower_id`. Unauthenticated users get an empty set; users without a seller row get an empty set without firing the follows query. Two extra round trips at most (sellers lookup is parallelized with the existing two queries; follows is sequenced after). |
| [src/features/marketplace/index.ts](src/features/marketplace/index.ts) | Re-exports `useToggleFollow`, `useFollowers`, `useFollowing`, `followSeller`, `unfollowSeller`, `listFollowers`, `listFollowing`, `FollowerRow`, `ListPageOpts`, and `ToggleFollowVars`. |

### Optimistic-update pattern (mirrors `useToggleLike`)

```ts
useMutation<void, Error, { sellerId: string; currentlyFollowing: boolean }, { prev: UserEngagement | undefined }>({
  mutationFn:  if currentlyFollowing -> unfollowSeller(sellerId)
              else                    -> followSeller(sellerId),
  onMutate:   await qc.cancelQueries({ queryKey: USER_ENGAGEMENT_QUERY_KEY })
              const prev = qc.getQueryData<UserEngagement>(USER_ENGAGEMENT_QUERY_KEY)
              if (prev) {
                const next = new Set(prev.followingSellerIds)
                if (currentlyFollowing) next.delete(sellerId) else next.add(sellerId)
                qc.setQueryData(USER_ENGAGEMENT_QUERY_KEY, { ...prev, followingSellerIds: next })
              }
              return { prev },
  onError:    if (ctx?.prev) qc.setQueryData(USER_ENGAGEMENT_QUERY_KEY, ctx.prev),
  onSettled:  invalidate USER_ENGAGEMENT_QUERY_KEY (re-fetches Set from server)
              invalidate ['seller', 'byId', sellerId]                  (refresh followers_count)
              invalidate ['social', 'followers', sellerId]             (list page UI if open)
              invalidate ['social', 'following', sellerId]             (list page UI if open),
})
```

### Signature deviation from `useToggleLike` / `useToggleBookmark`

`useToggleLike(productId: string)` and `useToggleBookmark(productId: string)` both bind the target id at **hook construction** so each card's `onPress` only needs to pass the boolean. `useToggleFollow()` takes both at **mutation invocation** — `mutate({ sellerId, currentlyFollowing })`. Two reasons:

1. The seller profile header (C.4's primary integration point) renders one `FollowButton` for one seller — same ergonomics either way.
2. Future use sites (followers list with a per-row "Follow back" button, future "Suggested sellers" rail) need a single hook instance that toggles different seller ids per row. Binding the id at the hook level would force one `useToggleFollow` per row, which is awkward and breaks React's hook-rule expectations on conditional rendering.

The brief specifies this signature explicitly under §4 ("Signature: `UseMutationResult<void, Error, { sellerId: string; currentlyFollowing: boolean }>`"). C.4 will pass the constant `sellerId` from props and read `currentlyFollowing` from `useUserEngagement().followingSellerIds.has(sellerId)`.

### `FollowerRow` shape — type honesty over brief wording

The brief specifies all fields as non-nullable. The DB allows `sellers.user_id`, `sellers.bio`, and `sellers.location_text` to be null ([supabase.ts:367-389](src/types/supabase.ts#L367)). `FollowerRow` follows the DB:

```ts
export type FollowerRow = {
  id: string;
  user_id: string | null;     // sellers may pre-exist their auth user
  name: string;
  avatar_url: string;          // DB: NOT NULL DEFAULT '' — never undefined
  bio: string | null;
  verified: boolean;
  is_pro: boolean;
  followed_at: string;         // follows.created_at
};
```

C.5's list-row component should treat `bio` as `?? ''` for layout and treat `user_id === null` as a non-clickable seller (cannot route to a profile that has no auth-user owner). Strict typing means C.5 will hit type errors on these cases and have to handle them explicitly — desirable.

### `listFollowers` / `listFollowing` — FK-disambiguating join

`follows` has two FKs to `sellers` (`follower_id`, `following_id`), so a plain `select('*, follower:sellers(*)')` would be ambiguous. PostgREST accepts either the FK constraint name (`follows_follower_id_fkey`) or the column name (`follower_id`) as the disambiguation hint after `!`. The column-name form is more readable:

```ts
.select(`created_at, follower:sellers!follower_id(${SELLER_JOIN_COLUMNS})`)
.eq('following_id', sellerId)
```

`SELLER_JOIN_COLUMNS = 'id, user_id, name, avatar_url, bio, verified, is_pro'` — the slim subset C.5's row component needs. Counter columns (`followers_count` / `following_count`) are deliberately omitted from the join to keep payload small; if C.5 needs them, the seller's own profile query (`useSeller`) already returns them after the C.2 type regen.

### `listUserEngagement()` — parallel-fetch redesign

Pre-extension: two parallel queries (likes, bookmarks) keyed by `auth.user.id`. Post-extension: three parallel queries (sellers lookup, likes, bookmarks) keyed by `auth.user.id`, then **one** sequenced query (follows) keyed by the resolved `sellers.id`. Total: 2 round trips for users with a seller row, 1 round trip for users without (the follows query is skipped). Trade-off vs a single super-query (e.g., a custom RPC returning all four sets): more round trips but no new SQL surface. The follows query short-circuits cleanly when `followerSellerId === null` (no seller row → no follows possible → empty set), avoiding a needless empty-result query.

The 5-minute `staleTime` on `useUserEngagement` means this fires once per session for most users; the extra latency is invisible.

### `followSeller` / `unfollowSeller` — idempotent + auth-aware

`getMySellerIdOrCreate()` private helper:
1. `supabase.auth.getUser()` → throw `AuthRequiredError` if no user.
2. Build a `username` fallback chain (user_metadata → email-local-part → 'User'), matching `updateMySeller`'s convention exactly.
3. RPC `get_or_create_seller_for_current_user({ p_username, p_avatar_url: '' })` → returns the seller UUID (existing or freshly created).

`followSeller(followingId)`:
- Resolve `followerId` via the helper.
- INSERT `(follower_id, following_id)`.
- Swallow `error.code === '23505'` (unique-violation) — re-follows are idempotent. Mirrors `likeProduct` / `bookmarkProduct` ([products.ts:343-353](src/features/marketplace/services/products.ts#L343)).

`unfollowSeller(followingId)`:
- Resolve `followerId` via the helper.
- DELETE WHERE `follower_id = me AND following_id = target`.
- No special error swallowing — DELETE of a non-existent row is silently a no-op at the SQL layer.

The C.2 schema's `CHECK (follower_id <> following_id)` constraint means a self-follow attempt would surface a Postgres `23514` (check_violation) here. Not specially handled — the C.4 FollowButton will gate this in UI by hiding for "this is me", and a defensive double-check is noise. If a self-follow ever bubbles up, the user sees a generic error — appropriate for a scenario the UI should never produce.

### Verification

- `npx tsc --noEmit` → **exit 0**. Strict mode, no `any`, no `as never`. The single `as unknown as Row[]` cast in each `listFollowers` / `listFollowing` mapper is the conventional supabase-js pattern for embedded-select results (PostgREST returns relation columns as `unknown` in the generated types because the disambiguation hint is parsed at runtime).
- New imports resolve: `@/lib/supabase`, `@/features/marketplace/services/products` (for `AuthRequiredError`), `@tanstack/react-query` (no version change).
- No new dependencies. `useInfiniteQuery` is in the existing `@tanstack/react-query ^5.95.2`.
- No app behavior change — no UI consumes the hooks yet. Existing surfaces (feed, seller profile, edit profile, marketplace screen) render identically.
- `UserEngagement` extension is purely additive — no consumer of the existing two fields breaks. Verified by re-running `tsc --noEmit` after each file landed.

### Manual sanity (deferred to user, after C.4 lands)

1. Sign in as user A. Open user B's profile.
2. Tap Follow → optimistic UI shows "Following" instantly. Network tab shows `INSERT INTO follows`.
3. Refresh user B's profile → `followers_count` is +1 (C.2 trigger ran).
4. `useUserEngagement().followingSellerIds.has(B)` returns `true` synchronously after `onSettled` invalidate.
5. Tap Following → optimistic UI shows "Follow". Network tab shows `DELETE FROM follows`.
6. Refresh user B's profile → `followers_count` is back to original (clamp prevents going below 0 even if the trigger somehow double-fires).
7. Open `useFollowers(B)` → user A appears at the top of the list (most recent first). Pagination via `fetchNextPage()` returns next page when available.

### Reversion

```
git revert <C.3 commit>
```

This restores:
- The pre-C.3 `UserEngagement` shape (`{ likedIds, bookmarkedIds }` only).
- The pre-C.3 `listUserEngagement()` body (two parallel queries, no sellers lookup, no follows query).
- The pre-C.3 `src/features/marketplace/index.ts` barrel (no follow exports).

Removes:
- `src/features/marketplace/services/follows.ts`
- `src/features/marketplace/hooks/useToggleFollow.ts`
- `src/features/marketplace/hooks/useFollowers.ts`
- `src/features/marketplace/hooks/useFollowing.ts`

The C.2 migration is **not** reverted by this — C.3 only adds JS layer over the C.2 schema. To fully unwind both, also `git revert` the C.2 commit and run the rollback SQL block from [supabase/migrations/20260518_follows_schema_and_counters.sql](supabase/migrations/20260518_follows_schema_and_counters.sql) against any DB the migration was applied against.

### C.4 handoff — FollowButton component spec

C.4 builds the `FollowButton` UI component. Inputs:

- **Target seller id** (`sellerId: string`) — the seller being followed.
- **Current user's seller id** — read from `useMySeller(isAuthenticated)`. Used to gate "this is me" → render nothing (or render a "Edit profile" button, deferred to C.4 design call).
- **Follow state** — `useUserEngagement().data?.followingSellerIds.has(sellerId) ?? false`. O(1) Set membership; no extra query.
- **Auth gating** — wrap `onPress` in `useRequireAuth().requireAuth()` (matches the like/bookmark call-site pattern on `ProductFeedItem`). On unauthenticated tap, surface the existing sign-in Alert from `useRequireAuth`.

Mutation invocation:

```ts
const { mutate: toggleFollow, isPending } = useToggleFollow();
// ...
const onPress = () => {
  if (!requireAuth()) return;
  void mediumHaptic();
  toggleFollow({ sellerId, currentlyFollowing });
};
```

Visual states (per FOLLOWING_AUDIT.md §10 / U1):

- **Not following**: filled primary background ("Follow" / "Suivre").
- **Following**: outlined / glass variant with checkmark ("Following" / "Suivi").
- **Pending**: button stays in the optimistic next-state; small loading affordance optional but not required (the optimistic toggle is instant, so a spinner adds noise).
- **Self (sellerId === my sellerId)**: render nothing.

Integration point: [src/app/(protected)/seller/[id].tsx](src/app/(protected)/seller/[id].tsx) — add a horizontal action row immediately under the `statsRow` (between [seller/[id].tsx:90-91](src/app/(protected)/seller/[id].tsx#L90)) containing `[FollowButton] [Message]`. The Message button's data flow already exists via the `start_or_get_conversation` RPC (see [messaging.ts:88-128](src/features/marketplace/services/messaging.ts#L88)) — wiring it is C.4's call to bundle or defer.

`SellerPill` inline FollowButton variant is **not** part of C.4 per FOLLOWING_AUDIT.md §10 / U1 ("FollowButton on seller profile header only").

### i18n keys C.4 will add (heads-up for the locale files)

Reserve under `seller.*` to keep the namespace tight:
- `seller.follow` (FR: "Suivre", EN: "Follow")
- `seller.following` (FR: "Suivi", EN: "Following")
- `seller.followFailed` (FR: "Impossible de suivre", EN: "Could not follow")
- `seller.unfollowFailed` (FR: "Impossible de ne plus suivre", EN: "Could not unfollow")
- `seller.followers` (already in use? — C.4 to verify; if collision, namespace under `seller.followersCount` or `seller.followersLabel`)
- `seller.followingLabel` (for the pluralized count display, e.g., "342 abonnements" / "342 following")

---

## Step C.4 Changelog (2026-05-03) — FollowButton + Profile Integration

UI step. Adds a `FollowButton` (filled coral / outlined-glass) and a `MessageButton` to the seller profile header, plus a social-stats row showing `followers_count` / `following_count`. Self-profile shows an "Edit profile" Chip in place of Follow/Message. Counter labels render as plain text — C.5 will make them tappable as entry points to follower/following list sub-routes.

> **Audit referenced:** [FOLLOWING_AUDIT.md §10 / U1](FOLLOWING_AUDIT.md) — recommended UI direction (FollowButton on seller profile header only, no FollowButton on `SellerPill`, lists deferred to C.5, Following feed deferred to C.6).

### Reconnaissance findings

- **Seller profile structure** ([src/app/(protected)/seller/[id].tsx](src/app/(protected)/seller/[id].tsx)) is a single `<FlatList>` of products with a custom `ListHeaderComponent`. Header order: avatar → name + verified + PRO → memberSince → statsRow (★ rating · sales) → bio (conditional) → contactCard (PRO + has-contact, conditional) → "LISTINGS" sectionTitle. No CTA buttons today; no action row to preserve.
- **`Chip` primitive** at [src/components/ui/Chip.tsx](src/components/ui/Chip.tsx) already exposes `'filled' | 'outlined'` variants and `'sm' | 'md'` sizes, plus a `leadingIcon` prop and built-in `'light'` haptic via the wrapped `Pressable` ([Pressable.tsx:71-75](src/components/ui/Pressable.tsx#L71)). No new primitive needed; both buttons compose on top.
- **`useRequireAuth()`** at [src/stores/useRequireAuth.ts](src/stores/useRequireAuth.ts) returns `{ isAuthenticated, user, requireAuth }`. The `requireAuth(): boolean` function alerts a sign-in CTA on `false`. Identical contract to the like/bookmark gate pattern.
- **`useMySeller(isAuthenticated)`** at [src/features/marketplace/hooks/useMySeller.ts:6-13](src/features/marketplace/hooks/useMySeller.ts#L6) returns the current user's seller row keyed by `MY_SELLER_KEY = ['marketplace', 'my-seller']`. Used here to compute `isOwnProfile = mySeller?.id === seller.id`.
- **Messaging entry point status — DEFERRED.** The existing RPC `start_or_get_conversation(p_product_id uuid)` ([supabase/migrations/20260509_messaging.sql:88-128](supabase/migrations/20260509_messaging.sql#L88)) is **product-scoped** — every conversation belongs to a `(product, buyer)` pair via the unique constraint on `conversations(product_id, buyer_id)`. There is no per-seller (product-less) conversation path in the current backend. Per the brief's fallback ("If neither exists, surface and defer Message button wiring to a follow-up — render the button disabled with a tooltip / 'Bientôt' alert"), C.4 ships the `MessageButton` visually but routes its `onPress` to a localized "Bientôt disponible" Alert. Surfaced as a known follow-up (see "Follow-up" below).
- **Seller query key shape.** [useSeller.ts:8](src/features/marketplace/hooks/useSeller.ts#L8) — `['seller', 'byId', id]`. Matches the invalidation key in C.3's `useToggleFollow.onSettled` ([useToggleFollow.ts:50](src/features/marketplace/hooks/useToggleFollow.ts#L50)). `followers_count` refetches automatically after each toggle.
- **`formatCount`** — two helpers exist. [src/features/marketplace/utils/formatCount.ts](src/features/marketplace/utils/formatCount.ts) is the legacy English-style "1.2k" used today on this screen. [src/lib/format.ts:30-39](src/lib/format.ts#L30) is the locale-aware Intl-backed helper that produces the French "1,2k" the brand brief requires for new code (per the in-file comment at [lib/format.ts:1-17](src/lib/format.ts#L1)). C.4 imports both: the legacy import stays untouched on rating/sales (preserves existing layout); the new social-stat counts use `formatCountIntl` from `@/lib/format` with explicit locale.

### Files added

| Path | Role |
| --- | --- |
| [src/components/profile/FollowButton.tsx](src/components/profile/FollowButton.tsx) | ~55 lines. Reads `useUserEngagement().followingSellerIds`, gates via `useRequireAuth().requireAuth()`, dispatches `useToggleFollow().mutate({ sellerId, currentlyFollowing })`. Variant flips `'filled' ↔ 'outlined'`; label flips `Suivre ↔ Suivi(e)`. Optional `sellerName` prop personalizes the accessibility label. |
| [src/components/profile/MessageButton.tsx](src/components/profile/MessageButton.tsx) | ~55 lines. Outlined Chip with `chatbubble-outline` leading icon. `onPress` is auth-gated then surfaces a localized "Bientôt disponible" Alert (named variant when `sellerName` is provided). Inline header comment documents the deferral and the reason (product-scoped messaging). |

### Files modified

| Path | Change |
| --- | --- |
| [src/features/marketplace/services/sellers.ts](src/features/marketplace/services/sellers.ts) | `SellerProfile` gains `followersCount: number`, `followingCount: number`. Hand-typed `SellerRow` gains `followers_count: number`, `following_count: number`. `rowToSeller()` maps both with `?? 0` defensive defaults (a database that hasn't applied C.2 yet would return undefined; the defaults keep the screen renderable without crashing during a partial-rollout window). |
| [src/app/(protected)/seller/[id].tsx](src/app/(protected)/seller/[id].tsx) | Imports `useMySeller`, `useAuthStore`, `Chip`, `FollowButton`, `MessageButton`, and `formatCount as formatCountIntl` from `@/lib/format`. Computes `isOwnProfile`. Adds a `socialStatsRow` (followers · following) immediately under the existing `statsRow`. Adds an `actionRow` between `bio` and `contactCard`: `[Edit profile]` for self, `[Follow] [Message]` for others. Anonymous viewers see `[Follow] [Message]` (the buttons gate via `requireAuth()` on tap). Six new style entries; existing styles untouched. |
| [src/i18n/locales/en.json](src/i18n/locales/en.json) | Adds `profile.editProfile` and the new `social.*` namespace (12 keys including aria labels and the deferred-message-coming-soon copy). |
| [src/i18n/locales/fr.json](src/i18n/locales/fr.json) | Mirrors EN keys exactly. `Suivre` / `Suivi(e)` / `abonnés` / `abonnements`. |

### Self-profile guard

`isOwnProfile = !!mySeller && !!seller && mySeller.id === seller.id` — computed before the loading early returns; safely evaluates to `false` while either side is undefined. The action row is conditional:

- **Other user** (`isOwnProfile = false`): `[Follow] [Message]`. `Follow` toggles via the C.3 mutation; `Message` shows the deferred Alert.
- **Self** (`isOwnProfile = true`): `[Modifier le profil]` — pill chip with `create-outline` icon routes to `/(protected)/edit-seller-profile`. Replaces nothing — the existing seller profile screen had no CTA before C.4.
- **Anonymous viewer** (`isAuthenticated = false`): falls into the "other user" branch since `mySeller` is undefined → `isOwnProfile = false`. The `Follow` button's `requireAuth()` gate alerts the sign-in CTA on tap. The `Message` button does the same before its deferred Alert. This preserves the existing read-only-with-CTA-prompt-on-tap pattern used by like/bookmark on the feed.

The C.2 schema's `CHECK (follower_id <> following_id)` is the DB safety net; the UI guard ensures the button never offers a self-follow that the DB would have to reject.

### Counter display pattern

Renders as a separate row right below the existing `statsRow`, two label-value pairs side by side with `gap: 24`. Layout:

```
★ 4.8 · 1,2k ventes
342 abonnés     87 abonnements
```

Number uses `Text bold 14px white`; label uses `12px secondary`. Numbers are formatted via `formatCountIntl(n, 'fr-FR' | 'en-US')` per the brand-aware helper at [src/lib/format.ts:30](src/lib/format.ts#L30) so French sees "1,2k" and English sees "1.2k". Counter labels are **not** wrapped in `Pressable` and have no `accessibilityRole='button'` — they are plain text. C.5 is the step that converts them into tappable navigation entry points (currently they look like static stats, which is the desired affordance for C.4's surface).

### React Query refresh on toggle

Already wired in C.3: [useToggleFollow.ts:50-53](src/features/marketplace/hooks/useToggleFollow.ts#L50) invalidates `['seller', 'byId', sellerId]` in `onSettled`. The seller profile uses the same key via `useSeller(id)` ([useSeller.ts:8](src/features/marketplace/hooks/useSeller.ts#L8)). Post-toggle:

1. Optimistic patch flips `followingSellerIds` immediately → button text and variant update synchronously.
2. Mutation completes server-side → the C.2 trigger increments/decrements `followers_count`.
3. `onSettled` invalidates the seller-by-id query → `useSeller` refetches → `followersCount` displays the new value.

Verified the key matches the call site (no mismatch — C.3 chose `['seller', 'byId', sellerId]` based on its own reconnaissance of the existing `useSeller` hook).

### Verification

- `npx tsc --noEmit` → **exit 0**. Strict mode, no `any`, no `as never`.
- Both locale files parse via `JSON.parse` — verified with `node -e 'JSON.parse(...)'` after the edits.
- Zero new dependencies. `Chip`, `Pressable` (with built-in haptic), Ionicons, and `useRequireAuth` are all already in the codebase.
- No regression in existing surfaces — the legacy `formatCount` import is preserved; rating/sales render byte-identically; contactCard (for PRO sellers with public contact info) is untouched and still renders below the new action row.
- The `?? 0` defaults in `rowToSeller()` mean a database without the C.2 migration applied would render the seller profile with `0 abonnés / 0 abonnements` instead of crashing on missing fields. Acceptable degraded state during a partial-rollout window.

### Visual verification (deferred to user)

1. Open someone else's seller profile: `[Follow] [Message]` action row sits between bio and the optional contactCard. `Follow` is filled coral. Counters show `0 abonnés` and `0 abonnements` until follows accumulate.
2. Tap `Follow` → button instantly flips to outlined `Suivi(e)` (optimistic). Within ~200ms the followers counter increments by 1 (post-`onSettled` refetch).
3. Tap `Suivi(e)` → reverts to filled `Follow`; counter decrements.
4. Open your own profile: action row shows only `[Modifier le profil]` outlined chip; tapping it routes to `/(protected)/edit-seller-profile`.
5. Sign out, open someone else's profile: `[Follow] [Message]` are visible; tapping either surfaces the sign-in alert before the action.
6. Switch to English locale: chip label flips to `Follow`/`Following`/`Message`; counter labels flip to `followers`/`following`; numbers format with English thousands separator.

### Reversion

```
git revert <C.4 commit>
```

This restores:
- The pre-C.4 `SellerProfile` and `SellerRow` types (no follower/following counts).
- The pre-C.4 `rowToSeller()` mapper.
- The pre-C.4 [src/app/(protected)/seller/[id].tsx](src/app/(protected)/seller/[id].tsx) (no action row, no social stats row, no `useMySeller` import).
- Strips the new `social.*` namespace and `profile.editProfile` from both locales.

Removes:
- [src/components/profile/FollowButton.tsx](src/components/profile/FollowButton.tsx)
- [src/components/profile/MessageButton.tsx](src/components/profile/MessageButton.tsx)

C.2 migration and C.3 hooks are independent of C.4 and remain functional after revert — `useToggleFollow` and the schema continue to exist; only the UI surface goes away.

### Follow-up surfaced

- **Direct messaging from a seller profile is deferred.** The existing `start_or_get_conversation` RPC requires a `product_id`. To wire `MessageButton` for real, a future migration would need either (a) a new `start_or_get_seller_conversation(p_seller_user_id uuid)` RPC and a corresponding `conversations.product_id NULL`-allowed schema change, or (b) UI that picks a product to anchor the conversation against (mid-tap product picker sheet). Option (a) is simpler for the C.4 user-flow but expands the messaging schema's invariant. Defer to whoever owns Phase D / messaging hardening. Until then, the deferred Alert tells the user to "open one of their listings to start a conversation" — a workable workaround using the existing per-product chat entry on the product detail screen.

### C.5 handoff

C.5 builds the followers / following list sub-routes. Required steps:

1. **Convert `seller/[id].tsx` to a folder route.** Move the current file to `src/app/(protected)/seller/[id]/index.tsx`. Add siblings:
   - `src/app/(protected)/seller/[id]/followers.tsx` — paginated list consuming `useFollowers(sellerId)` from C.3.
   - `src/app/(protected)/seller/[id]/following.tsx` — paginated list consuming `useFollowing(sellerId)` from C.3.
2. **Make the social-stat counter labels tappable.** Wrap each `socialStatBlock` in a `Pressable` with `haptic="light"` that pushes the corresponding sub-route. Add `accessibilityRole="button"` and a localized accessibility label (e.g., "View 342 followers"). The C.4 layout (`socialStatBlock` is already a `<View row gap=4>`) is shaped for this drop-in.
3. **List row UI.** Each row renders `Avatar(48) + name + verified/PRO badges + bio (1 line, secondary) + Follow button on the right` (the inline `Follow` chip on the right uses C.4's `FollowButton` with `size="sm"`). Tap on the row routes to that seller's profile via `router.push(\`/(protected)/seller/\${id}\`)`. Empty state: "Aucun abonné pour le moment" / "No followers yet". Loading: skeleton rows. Pagination: `onEndReached → fetchNextPage()` with `onEndReachedThreshold = 0.5`.
4. **`FollowButton` reuse — no changes needed in the component itself.** C.4's `size` prop already handles the smaller list-row variant. The existing self-profile guard in the seller profile remains specific to that screen; the `FollowButton` itself does not gate self-follow because the followers/following lists never include the current user looking at someone else's followers (you can be in your own list, but the row component should hide its `FollowButton` for the row matching the viewer's own seller id).
5. **i18n keys to add for C.5** (under `social.*`): `followersTitle`, `followingTitle`, `noFollowers`, `noFollowing`, `followersAriaLabel`, `followingAriaLabel`, `viewFollowers`, `viewFollowing`. Reserve under the same `social.*` namespace C.4 introduced.

C.6 (Following feed as third tab) remains explicitly out of scope — defer until enough sellers are followed to populate a stream meaningfully (per FOLLOWING_AUDIT.md §6.3).

---

## Step C.5 Changelog (2026-05-03) — Folder Route + Followers/Following Lists

Structural step. Converts the seller route from a leaf to a folder so list sub-routes can live alongside it, then ships the followers / following list screens consuming C.3's `useFollowers` / `useFollowing` hooks. C.4's social-stat counters are now tappable navigation entry points. After this step, the social graph is fully navigable.

> **Audit referenced:** [FOLLOWING_AUDIT.md §10 / U1](FOLLOWING_AUDIT.md) — sub-route lists at `/(protected)/seller/[id]/followers` and `.../following`. Following feed (C.6) deferred.

### Reconnaissance findings

- **Three call sites push to the seller route**, all using the URL pattern `/(protected)/seller/${id}`:
  - [src/features/marketplace/components/ProductFeedItem.tsx:99](src/features/marketplace/components/ProductFeedItem.tsx#L99)
  - [src/features/marketplace/components/ProductDetailSheet.tsx:406](src/features/marketplace/components/ProductDetailSheet.tsx#L406)
  - [src/features/marketplace/components/SellerCard.tsx:24](src/features/marketplace/components/SellerCard.tsx#L24)
- All three use `as Href` casting to bypass Expo Router's `experiments.typedRoutes`. Expo Router resolves both `seller/[id].tsx` and `seller/[id]/index.tsx` to the same URL pattern (`/seller/:id`), so the file move is **transparent** to all three call sites — verified post-move with `tsc --noEmit` exit 0 + manual inspection.
- **No deep-link references** to `seller` in [app.json](app.json) (verified: zero matches case-insensitive).
- **No push-notification handlers** target `seller` routes — [src/services/pushNotifications.ts](src/services/pushNotifications.ts) and [src/hooks/usePushNotifications.ts](src/hooks/usePushNotifications.ts) both grep clean.
- **C.4 counter labels** at [seller/[id]/index.tsx:105-118](src/app/(protected)/seller/[id]/index.tsx#L105) (post-move path). Two `socialStatBlock` Views inside `socialStatsRow` — surgical wrap-in-Pressable target.
- **`Pressable` from `@/components/ui`** has built-in scale animation on press (`pressScale: 0.96`, [Pressable.tsx:51-67](src/components/ui/Pressable.tsx#L51)) plus a `haptic` prop. Used by `FollowerRow` so we don't need a custom press-state background or a manual `lightHaptic()` call.
- **`ProBadge`** at [src/components/ui/ProBadge.tsx:29](src/components/ui/ProBadge.tsx#L29) defaults `label = 'PRO'`, so omitting the prop is safe.

### Folder conversion

```
git mv src/app/(protected)/seller/[id].tsx \
       src/app/(protected)/seller/[id]/index.tsx
```

Tracked in `git status` as `RM src/app/(protected)/seller/[id].tsx -> src/app/(protected)/seller/[id]/index.tsx` (rename detected — preserves blame history). The file's contents are unchanged from C.4 except for the two diffs in §"Files modified" below.

### Files added

| Path | Role |
| --- | --- |
| [src/components/profile/FollowerRow.tsx](src/components/profile/FollowerRow.tsx) | Reusable list row: Avatar(48) + name + verified + PRO + 1-line bio + inline `FollowButton size="sm"`. Tap row → `router.push(/(protected)/seller/${id})`. `showFollowButton` defaults true; pass `false` for the self-row defensive guard. Uses the `@/components/ui/Pressable` (scale animation + built-in `'light'` haptic) so no custom press-state styling needed. |
| [src/components/profile/FollowerListPrimitives.tsx](src/components/profile/FollowerListPrimitives.tsx) | Two co-located primitives shared between the followers and following screens: `FollowerListSkeletons` (renders `count` skeleton rows matching `FollowerRow` geometry — 48px circle + two text bars + button placeholder) and `FollowerListEmpty` (centered icon + title + optional body, `iconName` is caller-supplied so the followers screen uses `people-outline` and the following screen uses `person-add-outline`). Co-located rather than scattered to keep the list-screen surface tight. |
| [src/app/(protected)/seller/[id]/followers.tsx](src/app/(protected)/seller/[id]/followers.tsx) | `SellerFollowersScreen`. Reads `useSeller(id)` for the header context (parent seller's name) and `useMySeller(isAuthenticated)` for the self-row guard. Consumes `useFollowers(id)` (C.3 `useInfiniteQuery`, page size 20). FlatList with `onEndReached` + `RefreshControl` + skeleton loader + empty state. Custom in-screen header bar with chevron-back + dynamic title. |
| [src/app/(protected)/seller/[id]/following.tsx](src/app/(protected)/seller/[id]/following.tsx) | `SellerFollowingScreen`. Symmetric to followers.tsx but consumes `useFollowing(id)` and uses `social.followingOfTitle` / `social.noFollowingTitle` copy. |

### Files modified

| Path | Change |
| --- | --- |
| [src/app/(protected)/seller/[id]/index.tsx](src/app/(protected)/seller/[id]/index.tsx) | Imports `Href` from `expo-router`. Wraps each of C.4's two `socialStatBlock` Views in a `Pressable` with `onPress` → `router.push(/(protected)/seller/${seller.id}/followers \| /following as Href)`, `lightHaptic()`, `hitSlop: 6`, `accessibilityRole: 'button'`, and parameterized `accessibilityLabel` carrying the count for screen readers. Press feedback via `pressed && { opacity: 0.6 }` style callback. **No other change** — the action row, FollowButton/MessageButton placement, contactCard, listings grid all stay identical. |
| [src/i18n/locales/en.json](src/i18n/locales/en.json) | Adds 9 new keys under the `social.*` namespace (extending C.4's set): `followersOfTitle`, `followingOfTitle`, `followersTitle`, `followingTitle`, `noFollowersTitle`, `noFollowingTitle`, `viewProfileAriaLabel`, `viewFollowersAriaLabel`, `viewFollowingAriaLabel`. |
| [src/i18n/locales/fr.json](src/i18n/locales/fr.json) | Mirrors EN keys exactly. `Abonnés de {{name}}` / `Abonnements de {{name}}` / `Aucun abonné pour le moment`, etc. |

### List screen pattern

Both screens use the same shape:

```ts
const items = query.data?.pages.flatMap((page) => page) ?? [];

<FlatList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <FollowerRow seller={...} showFollowButton={...}/>}
  onEndReached={() => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }}
  onEndReachedThreshold={0.5}
  ListEmptyComponent={query.isLoading ? <Skeletons/> : <Empty/>}
  ListFooterComponent={query.isFetchingNextPage ? <Spinner/> : null}
  refreshControl={
    <RefreshControl
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={() => void query.refetch()}
      tintColor={colors.text.secondary}
    />
  }
  contentContainerStyle={items.length === 0 ? { flexGrow: 1 } : undefined}
/>
```

The `isRefetching && !isFetchingNextPage` predicate on `RefreshControl.refreshing` prevents the pull-to-refresh spinner from spinning when the user merely scrolls to the bottom and triggers a next-page fetch — the next-page footer spinner handles that case independently. The `flexGrow: 1` on the empty contentContainer lets the empty-state view fill the screen vertically (centered) instead of collapsing to its intrinsic height at the top.

### Self-row guard

`showFollowButton={!mySeller || mySeller.id !== item.id}`:

- For an unauthenticated viewer (`mySeller === undefined`): show the FollowButton on every row. Tapping it triggers the auth gate via `useRequireAuth().requireAuth()` (already wired in C.4's `FollowButton`).
- For an authenticated viewer: hide the FollowButton on the row that matches their own seller id.

The C.2 schema's `CHECK (follower_id <> following_id)` makes self-follow a DB-level error (`23514` check_violation), so the user could never actually trigger one even if the button were shown — the row is reachable in their own following list (showing who they follow) but never in their own followers list (you can only appear as a follower of someone else). Defensive UI keeps the button from advertising an action the DB will reject, in either direction. The cost is a per-row equality check, which is trivial.

### Verification

- `npx tsc --noEmit` → **exit 0** before AND after the file move. Strict mode, no `any`. Three pre-existing `as Href` casts in unrelated callers are unchanged; the four new `as Href` casts in C.5 follow the same project convention for typedRoutes-with-dynamic-segments.
- Both locale files parse via `JSON.parse` — verified with `node -e 'JSON.parse(...)'` after each edit.
- File move tracked correctly by git as `RM src/app/(protected)/seller/[id].tsx -> src/app/(protected)/seller/[id]/index.tsx` (rename, not delete + add — git's `--similarity` heuristic detected the unchanged contents).
- All three pre-existing call sites resolve to the same URL post-move:
  - [ProductFeedItem.tsx:99](src/features/marketplace/components/ProductFeedItem.tsx#L99) → `/(protected)/seller/${id}` → resolves to `seller/[id]/index.tsx`. ✅
  - [ProductDetailSheet.tsx:406](src/features/marketplace/components/ProductDetailSheet.tsx#L406) → same. ✅
  - [SellerCard.tsx:24](src/features/marketplace/components/SellerCard.tsx#L24) → same. ✅
- Zero new dependencies. `RefreshControl` is from `react-native` core; `useInfiniteQuery` already in `@tanstack/react-query`.

### Visual verification (deferred to user)

1. Open a seller profile → tap "342 abonnés" → followers list opens, header shows "Abonnés de Maison Nova".
2. Each row: avatar + name + (verified ✓) + (PRO badge) + 1-line bio + small filled `Suivre` button on the right.
3. Tap a row → navigates to that seller's profile.
4. Tap `Suivre` on a row → button optimistically flips to outlined `Suivi(e)`. The followers list parent's count refreshes only when navigating back (the parent profile invalidates its `['seller', 'byId']` key on toggle via C.3's `onSettled`).
5. Scroll to bottom → next page loads (footer spinner appears, then 20 more rows).
6. Pull down to refresh → top spinner appears, list re-fetches from offset 0.
7. Open the **following** list for a seller with no follows → empty state with `person-add-outline` icon + "Aucun abonnement pour le moment".
8. Open your own profile → tap your own followers count → opens YOUR followers list. If you appear in someone else's following list, the `Suivre` button on your own row is hidden (defensive guard).

### Reversion

```
git revert <C.5 commit>
```

This restores:
- The pre-C.5 leaf-route file at `src/app/(protected)/seller/[id].tsx` (git rename → revert recreates the leaf file with C.4 contents).
- The pre-C.5 [src/app/(protected)/seller/[id]/index.tsx](src/app/(protected)/seller/[id]/index.tsx) social stats row (untappable plain-text counters from C.4).
- Strips the 9 new `social.*` keys from both locales.

Removes:
- [src/components/profile/FollowerRow.tsx](src/components/profile/FollowerRow.tsx)
- [src/components/profile/FollowerListPrimitives.tsx](src/components/profile/FollowerListPrimitives.tsx)
- [src/app/(protected)/seller/[id]/followers.tsx](src/app/(protected)/seller/[id]/followers.tsx)
- [src/app/(protected)/seller/[id]/following.tsx](src/app/(protected)/seller/[id]/following.tsx)
- The (now-empty) `src/app/(protected)/seller/[id]/` directory.

C.2 / C.3 / C.4 are independent of C.5 and remain functional after revert — the schema, hooks, FollowButton, and the seller profile (C.4 counters as plain text) all continue to work; only the list sub-routes go away.

### C.6 readiness

A "Following" feed is now an option but **explicitly remains out of Phase C scope** per FOLLOWING_AUDIT.md §6.3 ("defer until enough sellers are followed to populate a stream meaningfully"). When/if C.6 ships, all the data + components are in place:

- **Hook** `useFollowing(mySeller.id)` returns the seller ids the user follows; a future `useFollowingFeed(...)` would query products via `seller_id IN (sellerIdsIFollow)` ordered by `created_at desc`, paginated with `useInfiniteQuery` mirroring C.5's pattern.
- **Tab integration** would extend [src/stores/useMainTabStore.ts](src/stores/useMainTabStore.ts) `MainTabId = 'pour-toi' | 'marketplace' | 'following'` and add a third `<TabItem>` to [src/components/feed/MarketplaceHeader.tsx](src/components/feed/MarketplaceHeader.tsx). Header content max-width is currently 640px ([MarketplaceHeader.tsx:26](src/components/feed/MarketplaceHeader.tsx#L26)); three labels fit comfortably on phone width.
- **Empty state** for users who follow nobody: prompt them to discover sellers (link to a "discover" surface that doesn't exist yet — would need to be a ranked seller list or a search affordance).
- **Realtime** is optional. C.2's migration did not add `follows` to the `supabase_realtime` publication; if C.6 needs live feed updates, an additive migration would `alter publication supabase_realtime add table public.follows;` and the feed query would resubscribe per-row. React Query invalidation in `onSettled` is sufficient for v1.

The social graph is now fully navigable: Follow button on every other-user profile, counters tappable to followers/following lists, every row tappable to its seller profile, every row's inline `Suivre` button toggleable. Phase C's product surface is functionally complete.

---

## Op.2 Changelog (2026-05-03) — Apply Procedure + FK Audit + Cast Cleanup

Op.2 closes out Op.1's plumbing with three independent outcomes:

1. The four pending migrations (B.1.5, B.3, B.4, C.2) get a documented, copy-pasteable apply procedure the user can run in one focused session.
2. Every FK in `supabase/migrations/` is catalogued with its `ON DELETE` action, bucketed by safety for future delete flows. This is meant to be a permanent reference — re-read it before adding any "delete X" feature.
3. The `as never` cast that B.4 left at the `delete_my_account` RPC call site is removed. `npm run gen:types` has already been run against an environment that includes B.4 + C.2; the regenerated `Database['public']['Functions']['delete_my_account']` and `Database['public']['Tables']['follows']` are both present in [src/types/supabase.ts](src/types/supabase.ts), so the typed call resolves cleanly without any cast.

### Reconnaissance findings

| Check | Result |
| --- | --- |
| `package.json` scripts (Op.1 wiring) | All five present: `db:push`, `db:status`, `db:diff`, `gen:types`, `gen:types:local` ([package.json:12-16](package.json#L12)). No-op for this step. |
| `Database['public']['Tables']['follows']` in `src/types/supabase.ts` | **Present** — line 106. C.2 has been applied + types regenerated. |
| `Database['public']['Functions']['delete_my_account']` in `src/types/supabase.ts` | **Present** — line 675 (`{ Args: never; Returns: undefined }`). B.4 has been applied + types regenerated. |
| `as never` cast site | [src/features/auth/services/auth.ts:61](src/features/auth/services/auth.ts#L61) — verbatim `await supabase.rpc('delete_my_account' as never)`. |
| Migration files on disk | 18 in `supabase/migrations/` (`20260501` … `20260518`). |

Both type markers being present means the user has already run `db:push` + `gen:types` between Op.1 and Op.2. The "apply procedure" section below is therefore documentation-for-next-time, and the cast removal proceeds.

### How to apply the four pending migrations

The four migrations from this conversation are: B.1.5 ([20260515_tighten_sellers_update_grants.sql](supabase/migrations/20260515_tighten_sellers_update_grants.sql)), B.3 ([20260516_create_avatars_bucket.sql](supabase/migrations/20260516_create_avatars_bucket.sql)), B.4 ([20260517_delete_my_account_rpc.sql](supabase/migrations/20260517_delete_my_account_rpc.sql)), C.2 ([20260518_follows_schema_and_counters.sql](supabase/migrations/20260518_follows_schema_and_counters.sql)). All four are idempotent, transactional, and reversible; running them as a batch is safe.

#### Pre-flight

```bash
npm run db:status     # shows which migrations are marked unapplied on remote
```

`db:status` calls `supabase migration list --linked` and prints a two-column table of local vs. remote migration timestamps. Anything in the local column without a matching remote row is what `db:push` will apply.

#### Apply

```bash
npm run db:push       # applies all unapplied migrations transactionally,
                      # in timestamp order
```

The Supabase CLI applies each migration inside its own transaction, in ascending timestamp order. If any migration fails, that file is rolled back; earlier migrations remain applied. All four files in this batch wrap their bodies in explicit `begin; … commit;` blocks (B.4 and C.2 — see `delete_my_account` RPC and `handle_follow_change` trigger) or are simple enough that the implicit transaction suffices (B.1.5 grants, B.3 bucket insert).

#### Regenerate types

```bash
npm run gen:types
git add src/types/supabase.ts
git commit -m "chore(types): regenerate after Op.2"
```

C.2 adds a new public-schema table (`follows`) and two columns on `sellers` (`followers_count`, `following_count`). B.4 adds a new public-schema function (`delete_my_account`). Both are additive type changes — no existing key shape changes. Code that already typechecked continues to typecheck.

#### Sanity check

```bash
npx tsc --noEmit      # should still exit 0
```

If `tsc` regresses, the most likely cause is a previously-hidden `Row['column']` access that the regenerated, stricter types now surface as a narrowing opportunity. Report back with the exact error — the fix is usually a one-line nullable-handling tweak, not a redesign.

### Per-migration expected behavior post-apply

| ID | File | What lights up |
| --- | --- | --- |
| B.1.5 | [20260515_tighten_sellers_update_grants.sql](supabase/migrations/20260515_tighten_sellers_update_grants.sql) | `sellers` UPDATE column allowlist enforced at the grant layer. Attempts to write `verified` / `is_pro` / `rating` / `sales_count` / `stripe_*` from the JS client throw `permission denied for column …`. Only the user-controlled allowlist (`name`, `avatar_url`, `bio`, `website`, `phone_public`, `email_public`, `latitude`, `longitude`, `location_text`, `location_updated_at`) remains writable. |
| B.3 | [20260516_create_avatars_bucket.sql](supabase/migrations/20260516_create_avatars_bucket.sql) | `avatars` Storage bucket created with per-user folder RLS (`{auth.uid()}/…` path scope). End-to-end avatar uploads from EditProfile work; cross-user write attempts are rejected at the Storage policy layer. |
| B.4 | [20260517_delete_my_account_rpc.sql](supabase/migrations/20260517_delete_my_account_rpc.sql) | `public.delete_my_account()` RPC live. Account deletion flow in EditProfile calls it via `supabase.rpc('delete_my_account')` (now without the `as never` cast — see below). The RPC pre-deletes orders pointing at the user's seller rows to free the `orders.seller_id` / `orders.product_id` RESTRICT, then deletes from `auth.users`, which cascades through every other dependent table. |
| C.2 | [20260518_follows_schema_and_counters.sql](supabase/migrations/20260518_follows_schema_and_counters.sql) | `public.follows` table + `sellers.followers_count` / `sellers.following_count` counter columns + `handle_follow_change()` trigger live. Follow / unfollow + counter display work end-to-end. RLS scopes INSERT/DELETE to "the seller row owned by `auth.uid()`"; SELECT is open to any authenticated user (follower lists must be discoverable). |

### FK CASCADE Inventory (2026-05-03)

Every foreign-key constraint defined across the 18 migrations in `supabase/migrations/`. This table is meant to be a permanent reference — re-read it before adding any feature that deletes a parent row.

`ON UPDATE` is unspecified for every FK in the project (Postgres default = `NO ACTION`). The column is omitted below for brevity; assume `NO ACTION` unless future migrations change that.

| # | Source | Target | ON DELETE | Defined in |
| --- | --- | --- | --- | --- |
| 1 | `public.products.seller_id` | `public.sellers(id)` | CASCADE | [20260501_initial_marketplace_schema.sql:37](supabase/migrations/20260501_initial_marketplace_schema.sql#L37) |
| 2 | `public.likes.user_id` | `auth.users(id)` | CASCADE | [20260501_initial_marketplace_schema.sql:65](supabase/migrations/20260501_initial_marketplace_schema.sql#L65) |
| 3 | `public.likes.product_id` | `public.products(id)` | CASCADE | [20260501_initial_marketplace_schema.sql:66](supabase/migrations/20260501_initial_marketplace_schema.sql#L66) |
| 4 | `public.bookmarks.user_id` | `auth.users(id)` | CASCADE | [20260501_initial_marketplace_schema.sql:76](supabase/migrations/20260501_initial_marketplace_schema.sql#L76) |
| 5 | `public.bookmarks.product_id` | `public.products(id)` | CASCADE | [20260501_initial_marketplace_schema.sql:77](supabase/migrations/20260501_initial_marketplace_schema.sql#L77) |
| 6 | `public.sellers.user_id` | `auth.users(id)` | CASCADE | [20260503_sell_setup.sql:3](supabase/migrations/20260503_sell_setup.sql#L3) |
| 7 | `public.conversations.product_id` | `public.products(id)` | CASCADE | [20260509_messaging.sql:4](supabase/migrations/20260509_messaging.sql#L4) |
| 8 | `public.conversations.buyer_id` | `auth.users(id)` | CASCADE | [20260509_messaging.sql:5](supabase/migrations/20260509_messaging.sql#L5) |
| 9 | `public.conversations.seller_user_id` | `auth.users(id)` | CASCADE | [20260509_messaging.sql:6](supabase/migrations/20260509_messaging.sql#L6) |
| 10 | `public.messages.conversation_id` | `public.conversations(id)` | CASCADE | [20260509_messaging.sql:19](supabase/migrations/20260509_messaging.sql#L19) |
| 11 | `public.messages.sender_id` | `auth.users(id)` | CASCADE | [20260509_messaging.sql:20](supabase/migrations/20260509_messaging.sql#L20) |
| 12 | `public.orders.buyer_id` | `auth.users(id)` | CASCADE | [20260510_orders.sql:3](supabase/migrations/20260510_orders.sql#L3) |
| 13 | `public.orders.product_id` | `public.products(id)` | **RESTRICT** | [20260510_orders.sql:4](supabase/migrations/20260510_orders.sql#L4) |
| 14 | `public.orders.seller_id` | `public.sellers(id)` | **RESTRICT** | [20260510_orders.sql:5](supabase/migrations/20260510_orders.sql#L5) |
| 15 | `public.push_tokens.user_id` | `auth.users(id)` | CASCADE | [20260512_push_tokens.sql:3](supabase/migrations/20260512_push_tokens.sql#L3) |
| 16 | `public.follows.follower_id` | `public.sellers(id)` | CASCADE | [20260518_follows_schema_and_counters.sql:122-123](supabase/migrations/20260518_follows_schema_and_counters.sql#L122) |
| 17 | `public.follows.following_id` | `public.sellers(id)` | CASCADE | [20260518_follows_schema_and_counters.sql:124-125](supabase/migrations/20260518_follows_schema_and_counters.sql#L124) |

**Total: 17 FKs across 18 migrations.** No `SET NULL` / `SET DEFAULT` FKs exist in the project.

#### Bucket A — Safe for user deletion (CASCADE)

15 of 17 FKs cascade cleanly from `auth.users` / `sellers` / `products` / `conversations` to dependents. The full delete chain triggered by `delete from auth.users where id = v_user_id`:

```
auth.users
  └── sellers              (#6, CASCADE on user_id)
       ├── products        (#1, CASCADE on seller_id)
       │    ├── likes      (#3, CASCADE on product_id)
       │    ├── bookmarks  (#5, CASCADE on product_id)
       │    └── conversations (#7, CASCADE on product_id)
       │         └── messages (#10, CASCADE on conversation_id)
       ├── follows         (#16/#17, CASCADE on follower_id / following_id)
       └── orders          (#14, RESTRICT — see Bucket B)
  ├── likes                (#2, CASCADE on user_id)
  ├── bookmarks            (#4, CASCADE on user_id)
  ├── conversations        (#8/#9, CASCADE on buyer_id / seller_user_id)
  ├── messages             (#11, CASCADE on sender_id)
  ├── push_tokens          (#15, CASCADE on user_id)
  └── orders               (#12, CASCADE on buyer_id)
```

#### Bucket B — Will block deletion (RESTRICT)

Two FKs use `ON DELETE RESTRICT`. Both are on `orders`:

| FK | Blocks deletion of | Pre-DELETE handled by |
| --- | --- | --- |
| #13 `orders.product_id → products(id)` | The `product` row this order references | Implicit — `delete_my_account` RPC pre-deletes orders by `seller_id`, which transitively covers every product this seller has sold (every order's product belongs to that order's seller). |
| #14 `orders.seller_id → sellers(id)` | The `seller` row this order references | Explicit — `delete_my_account` RPC at [20260517_delete_my_account_rpc.sql:87-90](supabase/migrations/20260517_delete_my_account_rpc.sql#L87) does `delete from public.orders where seller_id in (select id from public.sellers where user_id = v_user_id)` before the cascade. |

Both RESTRICTs are deliberate: the `orders` table is sales-history audit data, and the design choice in B.4 was "deleting your account also wipes your sales history" rather than "anonymize the seller row and keep paid-order audit data". The latter is flagged as a future privacy-friendly variant in B.4's header comment ([20260517_delete_my_account_rpc.sql:30-33](supabase/migrations/20260517_delete_my_account_rpc.sql#L30)).

The RESTRICTs DO NOT block `delete_my_account` today because of the explicit pre-DELETE. They WOULD block any future code path that tries to delete a `sellers` row or a `products` row directly (without going through B.4's RPC). See "Future delete flows" below.

#### Bucket C — SET NULL / SET DEFAULT

None. No FK in the project orphans or resets on parent deletion.

#### Future delete flows that would trip Bucket B

| Hypothetical flow | Tripped FK(s) | Required mitigation |
| --- | --- | --- |
| Account deletion (B.4) — **shipped** | #13, #14 | Already handled via explicit pre-DELETE in `delete_my_account` ([20260517_delete_my_account_rpc.sql:87-90](supabase/migrations/20260517_delete_my_account_rpc.sql#L87)). |
| "Delete my listing" — a seller removes a single product | #13 (`orders.product_id`) | A `delete from public.products where id = ?` would fail with FK violation if any order references that product. Either pre-DELETE matching orders (destructive, wipes order history for that listing) OR change the FK to `ON DELETE SET NULL` and make `orders.product_id` nullable (preserves audit history with a "product removed" semantic) OR add a soft-delete column on `products` and never hard-delete. **Decision deferred until the use case lands.** |
| "Soft-delete / suspend a seller" — admin operation | #14 (`orders.seller_id`) | Same shape as the listing-deletion problem at the seller level. A seller suspension feature should almost certainly be soft (a `suspended_at` column) rather than hard, precisely so it composes with the existing RESTRICT. **Decision deferred until the use case lands.** |
| Anonymize-on-delete privacy variant of B.4 | None — works around RESTRICT by NOT deleting the seller row | Replace the seller row's PII fields with sentinels (`name = 'Deleted user'`, `user_id = null`, etc.) instead of deleting it. The orders rows survive untouched, RESTRICT is never tested. Per B.4's header comment, this is the recommended next iteration. |

**This audit is documentation, not an action item.** Per Op.2's constraints, Bucket B FKs are NOT preemptively migrated to CASCADE. Future steps decide based on actual use cases and the audit-trail trade-off.

### Cast removal — done

The B.4 changelog left a temporary `as never` cast in [src/features/auth/services/auth.ts:61](src/features/auth/services/auth.ts#L61) because the typed `delete_my_account` literal didn't exist in `Database['public']['Functions']` until types were regenerated post-apply. Both prerequisites were met by the time Op.2 ran (see reconnaissance above: line 675 of `supabase.ts` carries the function entry), so the cast is removed.

**Before** ([src/features/auth/services/auth.ts:60-68](src/features/auth/services/auth.ts#L60), pre-Op.2):

```ts
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account' as never);
  if (error) throw error;
  try {
    await supabase.auth.signOut();
  } catch {
    // The user is already gone server-side; swallow.
  }
}
```

**After** ([src/features/auth/services/auth.ts:53-61](src/features/auth/services/auth.ts#L53), post-Op.2):

```ts
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  try {
    await supabase.auth.signOut();
  } catch {
    // The user is already gone server-side; swallow.
  }
}
```

The 12-line JSDoc paragraph that explained the cast as a "temporary shim" was also removed since it no longer applies. The function-level JSDoc keeps its first paragraph (sign-out semantics) intact. `supabase.rpc('delete_my_account')` now resolves through `Database['public']['Functions']['delete_my_account']` with no escape hatch.

### Verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` exit code | 0 |
| `npx expo export --platform ios` bundle | clean, single hbc artifact `entry-da1c7d6f6ffae350362593e174f468ab.hbc` (6.2 MB) |
| Migration count | 18 (`ls supabase/migrations \| wc -l`), all covered by the FK inventory |
| Source files modified | 1 ([src/features/auth/services/auth.ts](src/features/auth/services/auth.ts)) |
| Migration files modified | 0 |
| Type files modified | 0 (types were regenerated by the user out-of-band before this step) |

### Files modified

- [src/features/auth/services/auth.ts](src/features/auth/services/auth.ts) — removed the `as never` cast and the JSDoc paragraph that documented it.
- [PROJECT_AUDIT.md](PROJECT_AUDIT.md) — this Op.2 changelog (apply procedure + FK inventory + cast removal record).

### Reversion

```bash
git revert <op-2-commit-sha>
```

Restores the `as never` cast and the JSDoc paragraph, and removes the Op.2 section from `PROJECT_AUDIT.md`. No migrations or types are touched by the revert (they were already in their post-apply state when Op.2 ran). One revert restores the entire scenario cleanly.

---

## Step D.1.5 Changelog (2026-05-03) — Products Update Grant Hardening

Closes the self-elevation gap on `public.products` surfaced in [COMMENTS_AUDIT.md §2](COMMENTS_AUDIT.md). Mirrors B.1.5 ([20260515_tighten_sellers_update_grants.sql](supabase/migrations/20260515_tighten_sellers_update_grants.sql)) mechanically: REVOKE table-wide UPDATE on `public.products` from `authenticated`, GRANT UPDATE on the user-controlled column allowlist only. Migration-only — no source code changes, no type regeneration.

### Why

The `"products update own"` RLS policy ([20260507_owner_update.sql:1-10](supabase/migrations/20260507_owner_update.sql#L1)) authorizes any authenticated user to UPDATE their own product row across every column. With the broad table-level UPDATE grant in place, that means a seller can issue, for any of their own listings:

```ts
supabase
  .from('products')
  .update({ comments_count: 999_999, likes_count: 999_999, shares_count: 999_999 })
  .eq('id', myProductId);
```

…and PostgREST will accept it because the row-level policy is satisfied (they own the row) and there is no column-level grant blocking the column write. They can also forge `created_at`, reassign `seller_id` (in principle, though the RLS check would fail on the new value), and self-mutate `bookmarks_count`. This is the same self-elevation shape `sellers` had before B.1.5.

D.2 (next migration — comments schema + counter trigger) lands a SECURITY DEFINER `handle_comment_change()` that writes `products.comments_count`. SECURITY DEFINER bypasses these grants by running as the migration owner — same pattern as C.2's `handle_follow_change()` on `sellers.followers_count` / `sellers.following_count`. Without D.1.5 in place first, D.2's trigger is doing correct work alongside a forged-counter side channel from clients. D.1.5 lands first to make the trigger load-bearing.

### Reconnaissance — every column on `public.products`

Source: [src/types/supabase.ts:266-369](src/types/supabase.ts#L266) (`Database['public']['Tables']['products']`). 29 columns total. Categorization below; alphabetical within each bucket.

**(a) Allowlist — kept writable for `authenticated` (user-controlled, surfaced through the sell flow):**

| Column | Type | Notes |
| --- | --- | --- |
| `attributes` | jsonb | Localized attribute chips. Written by `createProduct` / `updateProduct`. |
| `category` | jsonb | Localized `{ primary, secondary }` payload. Written by `createProduct` / `updateProduct`. |
| `category_id` | text \| null | Categories tree id. Written by `createProduct` / `updateProduct`. |
| `currency` | text | `EUR \| USD \| GBP`. Written by `createProduct` / `updateProduct`. |
| `description` | jsonb | Localized description. Written by `createProduct` / `updateProduct`. |
| `dimensions` | text \| null | Free-form dimension string. Written by `createProduct` / `updateProduct`. |
| `latitude` | double precision \| null | G.1 column, written by `createProduct` when geocoding succeeds. Future edit flow may write. |
| `location` | text \| null | Free-form location string. Written by `createProduct` / `updateProduct`. |
| `location_updated_at` | timestamptz \| null | G.1 column, written by `createProduct` alongside lat/lng. |
| `longitude` | double precision \| null | G.1 column, written by `createProduct` alongside latitude. |
| `media_type` | text | `image \| video`. Written by `createProduct` and conditionally by `updateProduct` when media is replaced. |
| `media_url` | text | Storage URL. Written by `createProduct` and conditionally by `updateProduct`. |
| `pickup_available` | boolean | Written by `createProduct` / `updateProduct`. |
| `price` | numeric | Written by `createProduct` / `updateProduct`. |
| `shipping_free` | boolean | Written by `createProduct` / `updateProduct`. |
| `shipping_label` | jsonb \| null | Localized shipping label. Seller-controlled (not yet exposed in UI but reserved for future edit flow). |
| `stock_available` | boolean | Written by `createProduct` / `updateProduct`. |
| `stock_label` | jsonb \| null | Localized stock label. Seller-controlled (not yet exposed in UI but reserved). |
| `subcategory_id` | text \| null | Written by `createProduct` / `updateProduct`. |
| `thumbnail_url` | text \| null | Written by `createProduct` and conditionally by `updateProduct`. |
| `title` | jsonb | Localized title. Written by `createProduct` / `updateProduct`. |

**(b) System-managed — disallowed, only writable by `service_role` going forward:**

| Column | Reason |
| --- | --- |
| `bookmarks_count` | Counter, maintained by `on_bookmark_change()` ([20260502_engagement_triggers.sql:44-68](supabase/migrations/20260502_engagement_triggers.sql#L44)). |
| `comments_count` | Counter, will be maintained by D.2's `handle_comment_change()` (SECURITY DEFINER, bypasses this grant). |
| `created_at` | Insertion timestamp, immutable. |
| `id` | Primary key, immutable. |
| `likes_count` | Counter, maintained by `on_like_change()` ([20260502_engagement_triggers.sql:17-41](supabase/migrations/20260502_engagement_triggers.sql#L17)). |
| `seller_id` | Listing ownership, immutable post-creation. |
| `shares_count` | Counter (no current writer; reserved for a future shares table). |

**(c) Generated / not writable regardless of grant:**

| Column | Reason |
| --- | --- |
| `location_point` | `geography(Point, 4326) generated always as ... stored` ([20260513_geo_columns.sql:69-77](supabase/migrations/20260513_geo_columns.sql#L69)). Generated columns reject any direct write at the storage layer. |

### Reconnaissance — every JS call site that mutates `public.products`

Searched with `rg "from\(['\"]products['\"]\)" src/`. Across the entire `src/` tree there is exactly **one** UPDATE call site, two INSERT/DELETE call sites, and the rest are SELECTs.

| File / Line | Operation | Columns touched | Allowlist verification |
| --- | --- | --- | --- |
| [src/features/marketplace/services/sell.ts:135-140](src/features/marketplace/services/sell.ts#L135) | INSERT (`createProduct`) | `seller_id, title, description, category, category_id, subcategory_id, attributes, dimensions, price, currency, media_type, media_url, thumbnail_url, stock_available, shipping_free, pickup_available, location` and conditionally `latitude, longitude, location_updated_at` | Not affected — INSERT grant is separate from UPDATE grant. The `"products insert own"` RLS policy ([20260503_sell_setup.sql:39-45](supabase/migrations/20260503_sell_setup.sql#L39)) gates this and remains unchanged. |
| [src/features/marketplace/services/sell.ts:185-189](src/features/marketplace/services/sell.ts#L185) | UPDATE (`updateProduct`) | `title, description, price, currency, category, category_id, subcategory_id, attributes, dimensions, stock_available, shipping_free, pickup_available, location` and conditionally `media_type, media_url, thumbnail_url` | **All within the allowlist** — verified column-by-column against the `patch` literal at [sell.ts:155-183](src/features/marketplace/services/sell.ts#L155). No counter columns, no `seller_id`, no `created_at`. |
| [src/features/marketplace/services/products.ts:329](src/features/marketplace/services/products.ts#L329) | DELETE (`deleteProduct`) | n/a | Not affected — DELETE grant is separate from UPDATE grant. The `"products delete own"` RLS policy ([20260506_owner_delete.sql:2-8](supabase/migrations/20260506_owner_delete.sql#L2)) gates this and remains unchanged. |

`rg upsert src/` confirms there is **no** `from('products').upsert(...)` call site anywhere.

The remaining `from('products')` references are SELECT-only (search/list/by-id):
[src/features/marketplace/services/products.ts:127](src/features/marketplace/services/products.ts#L127) (`listProducts`),
[products.ts:141](src/features/marketplace/services/products.ts#L141) (`searchProducts`),
[products.ts:283](src/features/marketplace/services/products.ts#L283) (`listTrendingProducts`),
[products.ts:304](src/features/marketplace/services/products.ts#L304) (`listMyProducts`),
[products.ts:314](src/features/marketplace/services/products.ts#L314) (`deleteProduct` — preceding select for cleanup),
[products.ts:335](src/features/marketplace/services/products.ts#L335) (`getProductById`),
[sellers.ts:85](src/features/marketplace/services/sellers.ts#L85) (`listProductsBySeller`).

### Migration

**Path:** [supabase/migrations/20260519_tighten_products_update_grants.sql](supabase/migrations/20260519_tighten_products_update_grants.sql).

**Body** (post-comments):

```sql
begin;

revoke update on public.products from authenticated;

grant update (
  attributes,
  category,
  category_id,
  currency,
  description,
  dimensions,
  latitude,
  location,
  location_updated_at,
  longitude,
  media_type,
  media_url,
  pickup_available,
  price,
  shipping_free,
  shipping_label,
  stock_available,
  stock_label,
  subcategory_id,
  thumbnail_url,
  title
) on public.products to authenticated;

commit;
```

**Inline rollback** (cited from the migration header at [20260519_tighten_products_update_grants.sql:60-65](supabase/migrations/20260519_tighten_products_update_grants.sql#L60)):

```sql
begin;
  revoke update on public.products from authenticated;
  grant  update on public.products to   authenticated;
commit;
```

The rollback restores the prior broad UPDATE grant. It does NOT touch the RLS policy (which was never modified by D.1.5) or any other table.

### Production apply

This migration is **not** applied to production by D.1.5. The user runs:

```bash
npm run db:push
```

…when convenient. D.2 should land before any further marketplace edit work — once D.1.5 is applied, any UPDATE that includes a disallowed column throws Postgres `permission denied for column X` at query time.

### Verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | exit 0 (no source changes — the migration is SQL-only). |
| `expo export --platform ios` | Not run. No source files were modified by D.1.5; the bundler outcome is unchanged from the post-D.1 state. |
| Migration syntax | Balanced `begin;` / `commit;`. No `grant ... to public` and no `grant ... to anon`. Allowlist matches the reconnaissance categorization above. |
| RLS policy untouched | Yes — `"products update own"` ([20260507_owner_update.sql:1-10](supabase/migrations/20260507_owner_update.sql#L1)) is left as-is. Row authorization is unchanged. |
| service_role unaffected | Yes — `service_role` bypasses column grants by design, so server-side counter writes (existing likes / bookmarks triggers, future comments / shares triggers, Stripe webhook paths if any, admin scripts) keep working. |

### Type regeneration — NOT required

Column-level grants do not surface in the Supabase TypeScript codegen output. `Database['public']['Tables']['products']['Update']` continues to declare every column as optional regardless of grant; the runtime enforcement happens at the Postgres layer. **Skip `npm run gen:types` for D.1.5.** D.2 will require regen because it adds the `comments` table.

### D.2 handoff

D.2 (`comments` schema + RLS + trigger) ships next and reads this changelog without re-discovering the products grants posture:

- D.2's `handle_comment_change()` is `SECURITY DEFINER set search_path = public, pg_catalog`. It runs as the migration owner and bypasses the new `products` UPDATE column grant — so writing `update public.products set comments_count = comments_count + 1` from inside the trigger continues to work after D.1.5 lands.
- D.2 includes the analogous `alter publication supabase_realtime add table public.comments` for D.5's realtime subscription.
- D.2 does **not** need to re-tighten products grants. D.1.5 owns that surface.

### Files modified

| File | Change |
| --- | --- |
| [supabase/migrations/20260519_tighten_products_update_grants.sql](supabase/migrations/20260519_tighten_products_update_grants.sql) | New file — REVOKE table-wide UPDATE, GRANT UPDATE on the user-controlled allowlist. |
| [PROJECT_AUDIT.md](PROJECT_AUDIT.md) | This D.1.5 changelog. |

### Reversion

```bash
git revert <d-1-5-commit-sha>
```

The revert removes the migration file and this changelog. **The rollback SQL above must additionally be applied to any database where the migration was already applied** — `git revert` alone does not undo the database state change, only the file presence in the source tree.

---

## Step D.2 Changelog (2026-05-03) — Comments Schema + Counter Trigger + RLS

Ships the database foundation for product comments per S1 in [COMMENTS_AUDIT.md §10](COMMENTS_AUDIT.md). Adds a flat `public.comments` table (no `parent_id`, no `deleted_at`), a composite index on `(product_id, created_at desc)` plus an author-side index, a `SECURITY DEFINER` counter trigger that maintains `products.comments_count` (mirrors C.2's `handle_follow_change()`), a `BEFORE UPDATE OF body` `updated_at` touch trigger, four RLS policies (public-authenticated SELECT; author-scoped INSERT/UPDATE/DELETE), table-level `SELECT/INSERT/DELETE` grants + column-level `UPDATE (body, updated_at)` grant, and `supabase_realtime` publication membership for `public.comments` (so D.5 only wires the JS subscription). Schema-only — no source code changes. Type regen IS required after apply (in contrast to D.1.5).

### Reconnaissance

**C.2 follows trigger pattern** ([20260518_follows_schema_and_counters.sql:158-184](supabase/migrations/20260518_follows_schema_and_counters.sql#L158)) — copied verbatim modulo target column / table name:

- `language plpgsql security definer set search_path = public, pg_catalog` header.
- `if (TG_OP = 'INSERT') ... elsif (TG_OP = 'DELETE') ... return NEW/OLD ...` shape.
- `greatest(x - 1, 0)` clamp on the DELETE branch to defeat negative counter drift if a race or service-role bulk delete bypasses the trigger.
- Trigger creation idiom: `drop trigger if exists … on public.comments; create trigger … after insert or delete on public.comments for each row execute function …`.

**RLS idiom** — also from C.2 (`follows`):

- `to authenticated` on every policy (no anon).
- SELECT `using (true)` — public-authenticated visibility, matches the audit's recommendation that comments are part of the public conversation on a listing.
- INSERT WITH CHECK / UPDATE USING+WITH CHECK / DELETE USING all gate on the `sellers.user_id = auth.uid()` subquery, translating auth identity → seller identity at policy evaluation time.
- `drop policy if exists … create policy …` for full idempotency (matches C.2's convention).

**`products.comments_count` confirmation.** Column declared NOT NULL DEFAULT 0 at [20260501_initial_marketplace_schema.sql:53](supabase/migrations/20260501_initial_marketplace_schema.sql#L53). Generated TS surface: `Row.comments_count: number` ([src/types/supabase.ts:272](src/types/supabase.ts#L272)). After D.1.5, this column is no longer in the user-writable allowlist for `public.products` ([20260519_tighten_products_update_grants.sql](supabase/migrations/20260519_tighten_products_update_grants.sql)) — only `service_role` and `SECURITY DEFINER` triggers can write it. D.2's trigger is the latter.

**`sellers` bridge confirmation.** `sellers.id` is `uuid primary key default uuid_generate_v4()` ([20260501:22](supabase/migrations/20260501_initial_marketplace_schema.sql#L22)) and `sellers.user_id` is `uuid references auth.users(id) on delete cascade unique` ([20260503:1-3](supabase/migrations/20260503_sell_setup.sql#L1)). The auth-to-seller bridge `sellers.user_id = auth.uid()` is the same shape used by `follows` and now by `comments`.

**UUID generator.** `uuid_generate_v4()` (uuid-ossp) is the project convention — already enabled at [20260501:16](supabase/migrations/20260501_initial_marketplace_schema.sql#L16) and used by `sellers`, `products`, `conversations`, `messages`, `orders`, `push_tokens`. The migration uses the same generator rather than introducing pgcrypto's `gen_random_uuid()`.

**Realtime publication.** Established by Supabase initialization (managed). Two existing tables are members: `public.messages` and `public.conversations` ([20260509_messaging.sql:133-134](supabase/migrations/20260509_messaging.sql#L133)). Pattern: `alter publication supabase_realtime add table public.<name>;`. **D.2 wraps the call in a `do $$ ... end $$` block guarded by `pg_publication_tables` because `ALTER PUBLICATION ... ADD TABLE` does not support `IF NOT EXISTS` on Postgres ≤ 14**, which would break re-runs without the guard.

### Migration

**Path:** [supabase/migrations/20260520_comments_schema.sql](supabase/migrations/20260520_comments_schema.sql).

**Schema additions (summary):**

| # | Object | Notes |
| --- | --- | --- |
| 1 | `public.comments` (table) | Columns: `id`, `product_id`, `author_id`, `body`, `created_at`, `updated_at`. Both FKs `ON DELETE CASCADE`. Body length CHECK `between 1 and 1000` (constraint name `comments_body_length`). |
| 2 | `comments_product_id_created_at_idx` (composite, DESC on `created_at`) | Hot read path: paginated comments per product. |
| 2 | `comments_author_id_idx` (BTREE) | "All comments by this user" + cascade cleanup. |
| 3 | `public.handle_comment_change()` (function) | `language plpgsql security definer set search_path = public, pg_catalog`. INSERT/DELETE counter math with `greatest(x-1, 0)` clamp. |
| 3 | `comments_change_trigger` (AFTER INSERT OR DELETE) | Wires (3). |
| 4 | `public.touch_comment_updated_at()` (function) | SECURITY INVOKER (default). Sets `NEW.updated_at = now()`. |
| 4 | `comments_touch_updated_at_trigger` (BEFORE UPDATE OF body) | `WHEN OLD.body IS DISTINCT FROM NEW.body` — fires only when body actually changes. |
| 5 | RLS — 4 policies | `comments authenticated read` (SELECT, `using (true)`); `comments self insert` (INSERT WITH CHECK on author seller); `comments self update` (UPDATE USING+WITH CHECK); `comments self delete` (DELETE USING). |
| 6 | Grants | `grant select, insert, delete on public.comments to authenticated;` and `grant update (body, updated_at) on public.comments to authenticated;`. |
| 7 | Realtime | `do $$ … end $$` guard adds `public.comments` to `supabase_realtime` if not already a member. |

**SECURITY DEFINER rationale.** D.1.5 ([20260519_tighten_products_update_grants.sql](supabase/migrations/20260519_tighten_products_update_grants.sql)) deliberately excluded `comments_count` from the user-writable allowlist on `public.products`. The trigger function `handle_comment_change()` must therefore run with elevated privileges to UPDATE `products.comments_count` — `SECURITY DEFINER` runs the function as the migration owner (typically `postgres`), bypassing the user's column-level grant restrictions. `SET search_path = public, pg_catalog` defeats the classic SECURITY DEFINER hijack vector (a malicious user creating a `public.products` shadow object in their own schema). Same pattern, same justification, as C.2's `handle_follow_change()` — which writes `sellers.followers_count` / `sellers.following_count` after B.1.5 narrowed the `sellers` UPDATE grant.

**`touch_comment_updated_at()` is deliberately NOT `SECURITY DEFINER`.** The user holds column-level UPDATE grant on `body` AND `updated_at` (the column-level grant in step 6), so the trigger writing `NEW.updated_at` does not require elevated privileges. SECURITY INVOKER is the right choice.

### Four-scenario policy walk-through

| Scenario | Mechanism | Outcome |
| --- | --- | --- |
| **(a)** User A inserts comment with `author_id = a` (a's own seller_id), body = `'hello'` | INSERT policy WITH CHECK subquery resolves `a.user_id = uA` → matches `auth.uid()`. | Policy passes. Row inserted. `comments_change_trigger` fires AFTER INSERT and runs `update products set comments_count = comments_count + 1 where id = NEW.product_id` via SECURITY DEFINER. |
| **(b)** User A tries to insert comment with `author_id = b` (someone else's seller_id) | INSERT policy WITH CHECK subquery resolves `b.user_id ≠ uA`. | Policy denies. PostgREST returns 403. Row never written. Trigger never fires. |
| **(c)** User A updates body of own comment | UPDATE policy USING + WITH CHECK both resolve `a.user_id = uA`. UPDATE column grant covers `body`. | Policy passes. `comments_touch_updated_at_trigger` fires BEFORE UPDATE OF body (only because `OLD.body IS DISTINCT FROM NEW.body`) and sets `NEW.updated_at = now()`. The counter trigger does NOT fire (it is AFTER INSERT OR DELETE only). |
| **(d)** User A tries to update `created_at` on own comment | UPDATE column grant does NOT include `created_at`. | Postgres returns `permission denied for column created_at` at parse/plan time. RLS never evaluates because the grant check fires first. |

Additional implicit cases:
- User A tries to update `product_id` (move comment to a different listing): same as (d) — `product_id` is not in the column-level UPDATE grant. Permission denied.
- User A tries to update `author_id` (impersonate): same as (d). Permission denied.
- User A deletes own comment: DELETE policy USING resolves `a.user_id = uA`; passes. `comments_change_trigger` fires AFTER DELETE and runs `update products set comments_count = greatest(comments_count - 1, 0) where id = OLD.product_id`.

### Production apply

Not applied to production by D.2. The user runs:

```bash
npm run db:status      # see pending: D.1.5 + D.2 (both queued)
npm run db:push        # applies both
npm run gen:types      # regenerates src/types/supabase.ts
git add src/types/supabase.ts
git commit -m "chore(types): regenerate after D.2"
```

Both D.1.5 and D.2 ship in a single push because that's the natural order: D.1.5's grant tightening makes D.2's SECURITY DEFINER trigger load-bearing, and D.2 cannot leave production with a writable `comments_count` from clients.

### Verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | exit 0 (no source files modified). |
| `expo export --platform ios` | Not run. No source files were modified by D.2; the bundler outcome is unchanged from the post-D.1.5 state. |
| Migration syntax | Balanced `begin;` / `commit;`. Inline rollback at top. Idempotency guards on every DDL: `create table if not exists`, `create index if not exists`, `create or replace function`, `drop trigger if exists` + `create trigger`, `drop policy if exists` + `create policy`, `do $$ … end $$` guard around the publication add. |
| Grants posture | `grant select, insert, delete` and `grant update (body, updated_at)` to `authenticated` only. No `grant ... to anon`, no `grant ... to public`. |
| `handle_comment_change` definition | `security definer` + `set search_path = public, pg_catalog`. Both required and present. |
| `touch_comment_updated_at` definition | SECURITY INVOKER (default) — caller already has column UPDATE grant on the columns it writes. |
| Column-level UPDATE grant | Restricted to `(body, updated_at)`. `id, product_id, author_id, created_at` are NOT writable on UPDATE. |
| Publication add | Wrapped in `do $$ ... end $$` with `pg_publication_tables` existence guard, idempotent across re-runs and Postgres versions ≤ 14. |
| RLS state | `enable row level security` on `public.comments`. Four policies installed: `comments authenticated read`, `comments self insert`, `comments self update`, `comments self delete`. |

### Type regeneration — REQUIRED

Unlike D.1.5 (where column-level grants do not surface in codegen and `gen:types` is a no-op), **D.2 adds a new public-schema table** (`public.comments`). After `npm run gen:types`, `Database['public']['Tables']['comments']` will appear in `src/types/supabase.ts` with the standard `Row` / `Insert` / `Update` shape:

```ts
comments: {
  Row: {
    id: string;
    product_id: string;
    author_id: string;
    body: string;
    created_at: string;
    updated_at: string | null;
  };
  Insert: { /* … with optional defaults */ };
  Update: { /* … all optional */ };
  Relationships: [
    { /* product_id → products.id */ },
    { /* author_id → sellers.id */ },
  ];
};
```

D.3 depends on this regeneration — its hooks reference `Database['public']['Tables']['comments']['Row']` for the row type and `Insert` for the create shape.

### Reversion

```bash
git revert <d-2-commit-sha>
```

The revert removes the migration file and this changelog. **The rollback SQL at the top of the migration file must additionally be applied to any database where the migration was already applied** — drop the publication membership, the two triggers, the two functions, the four policies, the column + table grants, the two indexes, and finally the table itself. `git revert` alone does not undo the database state change.

If both D.1.5 and D.2 need reverting in lockstep (e.g., a regression in the sell flow caused by the column-level grant interaction), revert them in reverse apply order: revert D.2 first (drops `comments` and its trigger writing `products.comments_count`), then revert D.1.5 (restores broad UPDATE grant on `products`). This avoids leaving the trigger in place while pointing at a `products` table the trigger can no longer write to via grants alone (it could not — the trigger is SECURITY DEFINER and bypasses grants — but the conceptual ordering is cleaner).

### Files modified

| File | Change |
| --- | --- |
| [supabase/migrations/20260520_comments_schema.sql](supabase/migrations/20260520_comments_schema.sql) | New file — comments table, indexes, triggers, RLS, grants, realtime publication membership. |
| [PROJECT_AUDIT.md](PROJECT_AUDIT.md) | This D.2 changelog. |

### D.3 handoff

D.3 (`useComments` query hook + `useCreateComment` / `useEditComment` / `useDeleteComment` mutation hooks + service module) ships next against the regenerated types and reads this changelog without re-discovering the comments schema:

**Service signatures (D.3 will land at `src/features/marketplace/services/comments.ts`):**

```ts
import type { Database } from '@/types/supabase';

export type CommentRow    = Database['public']['Tables']['comments']['Row'];
export type CommentInsert = Database['public']['Tables']['comments']['Insert'];

export type Comment = {
  id: string;
  productId: string;
  authorId: string;       // sellers.id
  body: string;
  createdAt: string;
  updatedAt: string | null;
};

export async function listComments(productId: string, opts?: { limit?: number; before?: string }): Promise<Comment[]>;
export async function createComment(productId: string, body: string): Promise<Comment>;
export async function editComment(commentId: string, body: string): Promise<Comment>;
export async function deleteComment(commentId: string): Promise<void>;
```

**Optimistic-prepend pattern (per [COMMENTS_AUDIT.md §7](COMMENTS_AUDIT.md)).** D.3's `useCreateComment` is **not** a toggle — it is a prepend mutation with id-swap on success:

- `onMutate`: snapshot the comment list, prepend an optimistic temp row with `id = 'temp-' + crypto.randomUUID()` and `pending: true`. Return `{ prev, tempId }`.
- `onSuccess(serverRow, _vars, ctx)`: replace the temp row with the server row by `tempId` match.
- `onError`: filter out the temp row by `tempId`.
- `onSettled`: invalidate `['marketplace', 'products', 'list']` so feed-card `comments_count` badges refresh.

**Realtime subscription pattern (D.5, pre-unblocked by step 7 of D.2).** Mirror [src/features/marketplace/services/messaging.ts:233-272](src/features/marketplace/services/messaging.ts#L233) and [src/features/marketplace/hooks/useMessages.ts:20-31](src/features/marketplace/hooks/useMessages.ts#L20):

```ts
export function subscribeToComments(productId: string, onChange: (payload: RealtimePayload) => void) {
  const channel = supabase
    .channel(`comments:${productId}`)
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `product_id=eq.${productId}` },
        onChange)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
```

The `useComments(productId)` hook subscribes on mount and merges INSERTs into the React Query cache with id-dedup (matching `useMessages.ts:23-26`'s pattern) so the optimistic temp row is replaced — not duplicated — when the realtime echo arrives.

**Required types (already regenerated post-apply).** `Database['public']['Tables']['comments']['Row']` and `Insert`. No additional table types are touched by D.3.

D.5 (realtime hook wiring) is also pre-unblocked: the publication membership is already in place via the DO-guarded `alter publication` at the bottom of D.2.

---

## Step D.3 Changelog (2026-05-03) — Comment Hooks + Service Layer

Ships the React Query hooks layer for comments per [COMMENTS_AUDIT.md §7](COMMENTS_AUDIT.md): cursor-based `useComments(productId)` infinite query, `usePostComment(productId)` with optimistic prepend + id-swap on success, `useDeleteComment(productId)` with optimistic remove + rollback, `useEditComment(productId)` with optimistic body patch + rollback. Plus the service-layer module they wrap. Pure JS — no UI, no schema, no realtime subscription wiring (D.4 / D.5 own those).

### Reconnaissance

**Type regen verification.** Confirmed `Database['public']['Tables']['comments']` is present at [src/types/supabase.ts:68-109](src/types/supabase.ts#L68) after the user ran `npm run db:push && npm run gen:types`. The Row shape matches D.2's table declaration: `id, product_id, author_id, body, created_at, updated_at` with `updated_at: string | null`. Both FKs (sellers via `author_id`, products via `product_id`) are reflected in the Relationships array.

**`useMessages` reference pattern** — read both files in full and mirrored the relevant idioms:

- [src/features/marketplace/services/messaging.ts:185-211](src/features/marketplace/services/messaging.ts#L185) — list-then-insert shape, with `select(SELECT_STRING).single()` after the `.insert(...)` to return the canonical server row.
- [src/features/marketplace/hooks/useMessages.ts:20-31](src/features/marketplace/hooks/useMessages.ts#L20) — query-cache merge with id-dedup so the realtime echo of an optimistic insert is idempotent. D.5's subscription will use the same approach on the comments cache.
- Query-key shape: messaging uses `['messaging', 'messages', conversationId]`. D.3 mirrors with `['marketplace', 'comments', productId]` — exposed as the helper `COMMENTS_QUERY_KEY(productId)` so D.4 / D.5 don't hardcode the tuple.

**`useMySeller` location.** [src/features/marketplace/hooks/useMySeller.ts:6](src/features/marketplace/hooks/useMySeller.ts#L6). Returns `UseQueryResult<SellerProfile | null, Error>` keyed on the exported `MY_SELLER_KEY = ['marketplace', 'my-seller']`. The hook takes an `enabled: boolean` argument; passing `true` from `usePostComment` is correct because the optimistic temp row needs the current user's joined fields (name / avatar / verified / is_pro). When the cache is cold, `usePostComment` falls back to `qc.getQueryData(MY_SELLER_KEY)` and finally to an empty-string placeholder — the server row from `onSuccess` overwrites these fields anyway.

**`useRequireAuth` location.** [src/stores/useRequireAuth.ts:18](src/stores/useRequireAuth.ts#L18). Per the audit's instruction (and matching the toggle-hook convention in `useToggleLike` / `useToggleBookmark`), auth gating happens at the **call site**, not inside the mutation hook. D.3's hooks do not import `useRequireAuth`. D.4's CommentsSheet will call `requireAuth()` from `useRequireAuth` before invoking `postComment.mutate(...)`, mirroring the Like / Bookmark / Make-Offer call sites in `ProductActionRail.tsx` / `ProductDetailSheet.tsx`.

**Seller-id resolution for comment INSERTs.** `comments.author_id` references `public.sellers(id)` (D.2 schema), and the RLS policy gates on `auth.uid() ↔ sellers.user_id`. The service module copies the `getMySellerIdOrCreate()` pattern from [src/features/marketplace/services/follows.ts:34-48](src/features/marketplace/services/follows.ts#L34) — same `get_or_create_seller_for_current_user` RPC, same fallback username derivation. The seller row is lazily created if the user has not yet entered the sell flow, so a comment can be posted by a buyer-only account without bouncing through the sell setup.

**Embedded-select cast.** `postComment` and `editComment` use `.select('id, …, author:sellers!author_id(id, name, avatar_url, verified, is_pro)').single()` to fetch the canonical row + joined author in one round trip. PostgREST returns the embedded `author` as an object, but the supabase-js return type cannot infer that shape from the select string. The same documented escape hatch used by [services/follows.ts:95](src/features/marketplace/services/follows.ts#L95) (`as unknown as Row[]`) and [services/products.ts:132](src/features/marketplace/services/products.ts#L132) (`as unknown as ProductRow[]`) applies: `data as unknown as CommentWithAuthor[]` (or `as unknown as CommentWithAuthor` for `.single()`). This is the only escape hatch in the new code.

**Temp-id generator choice.** `nanoid` is a transitive dep but not a direct one; `crypto.randomUUID()` is unavailable in Hermes without `expo-crypto` or `react-native-get-random-values`. Per the task's no-new-deps constraint, D.3 ships a pure-JS helper at [src/features/marketplace/hooks/usePostComment.ts:20-23](src/features/marketplace/hooks/usePostComment.ts#L20):

```ts
function makeTempId(): string {
  return `temp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
```

The id only needs to be unique within the in-memory query cache between optimistic prepend and `onSuccess` id-swap. The `temp-` prefix is the recognizable signal D.5's realtime subscription will use to dedupe self-echoes (real server ids are RFC4122 UUIDs).

### Files created

| File | Lines | Role |
| --- | --- | --- |
| [src/features/marketplace/services/comments.ts](src/features/marketplace/services/comments.ts) | ~130 | Service-layer: `listComments`, `postComment`, `deleteComment`, `editComment`. Exports `CommentRow`, `CommentAuthor`, `CommentWithAuthor`, `CommentPage`. |
| [src/features/marketplace/hooks/useComments.ts](src/features/marketplace/hooks/useComments.ts) | ~35 | `useInfiniteQuery` with cursor-based pagination. Exports `COMMENTS_QUERY_KEY` for dependent hooks. |
| [src/features/marketplace/hooks/usePostComment.ts](src/features/marketplace/hooks/usePostComment.ts) | ~135 | Optimistic prepend + id-swap. Reads `useMySeller(true)` for the temp row's joined author fields. |
| [src/features/marketplace/hooks/useDeleteComment.ts](src/features/marketplace/hooks/useDeleteComment.ts) | ~65 | Optimistic remove + rollback. Counter invalidation in `onSuccess`. |
| [src/features/marketplace/hooks/useEditComment.ts](src/features/marketplace/hooks/useEditComment.ts) | ~85 | Optimistic body patch + provisional `updated_at`; server row replaces in `onSuccess`. No counter invalidation. |

### Files modified

| File | Change |
| --- | --- |
| [src/features/marketplace/index.ts](src/features/marketplace/index.ts) | Re-exported the four hooks (with their `*Vars` types) and the four service functions plus the four type aliases. Maintains the existing barrel convention so call sites can `import { useComments, usePostComment, … } from '@/features/marketplace'`. |
| [PROJECT_AUDIT.md](PROJECT_AUDIT.md) | This D.3 changelog. |

### Cursor-pagination spec

- Page size: **20** rows per page (constant `DEFAULT_PAGE_SIZE` in the service, `PAGE_SIZE` in the hook). Matches the audit's recommendation in §7 / §12 ("default `limit = 50` was an alternative; 20 keeps initial-load latency low and matches the messaging convention").
- Cursor: the `created_at` ISO string of the **oldest** row in the previous page. The next-page query is `lt('created_at', cursor)`.
- Ordering: `order('created_at', { ascending: false })` so the head of page 0 is the newest comment. The composite index from D.2 (`comments_product_id_created_at_idx` on `(product_id, created_at desc)`) covers this read pattern exactly — no plan-time sort.
- `nextCursor`: `null` when fewer than `limit` rows came back (terminal page); else the timestamp of the last item. `getNextPageParam` maps `null → undefined` so React Query stops paging.

### Optimistic-prepend with id-swap pattern

`usePostComment` is **not** a toggle (per [COMMENTS_AUDIT.md §7](COMMENTS_AUDIT.md)). The lifecycle:

1. **`onMutate({ body })`** — cancel in-flight queries on the comments key, snapshot the cache as `previous`, generate `tempId = 'temp-…'`, build a `CommentWithAuthor` from `useMySeller` + the typed body, prepend it to page 0 of the `InfiniteData<CommentPage>`. If the cache is empty, seed a single-page structure so the sheet renders immediately.
2. **`mutationFn`** — call `postComment({ productId, body })`, which inserts and returns the canonical `CommentWithAuthor` (real UUID, server timestamp, fresh author join).
3. **`onSuccess(serverRow, _, ctx)`** — walk every page, replace the row whose `id === ctx.tempId` with `serverRow`. The temp row vanishes; the server row takes its position. Then invalidate `['product', 'byId', productId]` and `['marketplace', 'products', 'list']` so the action-rail counter and feed-card badges refresh against the trigger-incremented `comments_count`.
4. **`onError(_, _, ctx)`** — restore `ctx.previous` to drop the temp row.

`useDeleteComment` and `useEditComment` follow the same skeleton with different transformation steps (filter-out by id; map-and-patch). `useDeleteComment` also invalidates the product / list keys. `useEditComment` does NOT (edit doesn't change counters).

### Realtime-echo dedupe readiness

D.5's realtime subscription will receive a `postgres_changes` INSERT event for every comment, including the user's own posts. The handler must dedupe to avoid double-rendering. D.3's design supports this in two ways:

1. **`temp-` id prefix** lets the subscription detect a still-pending optimistic row by string check. Server ids are RFC4122 UUIDs (`uuid_generate_v4()` from D.2's table default); no real id will start with `temp-`.
2. **`onSuccess` id-swap** ensures that by the time the realtime echo arrives (typically after the INSERT response), the cache row already has the server id. The subscription handler can then `prev.find(c => c.id === payload.new.id)` and skip if found — same dedup pattern as [useMessages.ts:23-26](src/features/marketplace/hooks/useMessages.ts#L23).

If the realtime event arrives **before** the INSERT response (rare but possible on mobile), the subscription handler will see only the temp row in the cache. It can either (a) check whether any `temp-…` row has matching `body` + `author_id` and replace it eagerly, or (b) prepend and let `onSuccess` handle the de-dup post-arrival. D.5 picks the strategy.

### Verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | exit 0 (no errors). |
| `expo export --platform ios` | Not run. The hooks are not imported by any UI yet — no app behavior change is observable from a fresh bundle. |
| New deps | Zero. `nanoid`, `expo-crypto`, `react-native-get-random-values` all skipped — pure-JS `makeTempId` helper instead. |
| Strict TS | `any` usage: zero. Single documented escape hatch is `as unknown as CommentWithAuthor[]` / `as unknown as CommentWithAuthor` on PostgREST embedded-select results — same convention as `services/follows.ts` / `services/products.ts`. |
| Stale-type collision | `src/types/types.ts:23-35`'s legacy `Comment` / `NewCommentInput` are untouched. The new code uses `CommentRow` / `CommentWithAuthor` / `CommentPage` and does not import from `@/types/types`. Phase F still owns the cleanup. |
| Auth gating | Not in the hooks (per audit / Phase C convention). D.4's CommentsSheet must call `requireAuth()` from `useRequireAuth` before invoking `postComment.mutate`, `editComment.mutate`, `deleteComment.mutate`. |
| Haptics | Not in the hooks. D.4 wires haptics through Pressable. |
| Realtime subscription | Not in this step. D.5 owns the JS subscription that consumes the comments query cache. |

### D.4 handoff

D.4 (CommentsSheet UI) ships next and reads this changelog without re-discovering the data layer:

**Sheet store** — mirror [src/stores/useProductSheetStore.ts](src/stores/useProductSheetStore.ts) at [src/stores/useCommentsSheetStore.ts](src/stores/useCommentsSheetStore.ts):

```ts
import { create } from 'zustand';

type CommentsSheetStore = {
  productId: string | null;
  open: (productId: string) => void;
  close: () => void;
};

export const useCommentsSheetStore = create<CommentsSheetStore>((set) => ({
  productId: null,
  open: (productId) => set({ productId }),
  close: () => set({ productId: null }),
}));
```

**Sheet component** — mirror [src/features/marketplace/components/ProductDetailSheet.tsx](src/features/marketplace/components/ProductDetailSheet.tsx)'s skeleton (base `BottomSheet` from `@gorhom/bottom-sheet` v5, single 90% snap point per [COMMENTS_AUDIT.md §11](COMMENTS_AUDIT.md), `BottomSheetFooter` for the sticky compose input, `BottomSheetFlatList` or `BottomSheetScrollView` for the list). Mount it at app level alongside `ProductDetailSheet`.

**Primitives**:
- `CommentItem` — avatar + name + verified pill + body + relative timestamp + (own-comment-only) edit/delete affordance. Receives `CommentWithAuthor`. Uses `timeAgo` from `@/features/marketplace/utils/timeAgo`. Tap-and-hold or kebab-menu for edit/delete (D.4 picks).
- `CommentInput` — auth-gated `Pressable`/`TextInput` with avatar prefix and a send button that calls `postComment.mutate({ body })`. `useMySeller(true)` for the avatar; `useRequireAuth()` for the gate.

**Hook usage**:
```ts
const productId = useCommentsSheetStore((s) => s.productId);
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
  useComments(productId ?? '');
const post   = usePostComment(productId ?? '');
const edit   = useEditComment(productId ?? '');
const remove = useDeleteComment(productId ?? '');
```

**Action-rail wire-up** — replace `onPressComment = () => {}` at [ProductActionRail.tsx:41](src/features/marketplace/components/ProductActionRail.tsx#L41) with `useCommentsSheetStore.getState().open(product.id)`. Per [COMMENTS_AUDIT.md §11](COMMENTS_AUDIT.md), this lands against the legacy action rail (Step 5's redesign has not shipped); when Step 5 lands the same store call works in the new rail.

### Reversion

```bash
git revert <d-3-commit-sha>
```

Removes the five new source files, the barrel-export additions, and this changelog. No database state to undo. No type changes to undo (D.2's regen stays — independent of D.3).

---

## Step D.4 Changelog (2026-05-03) — CommentsSheet UI + Action Rail Wire-up

Builds the comment surface end-to-end: a Zustand `useCommentsSheetStore` (mirrors `useLocationSheetStore` shape with a `productId` payload), three new feed primitives (`CommentItem`, `CommentInput`, `CommentsSheet`), the sheet mounted in the marketplace home screen as a sibling of `LocationSheet`, and the action-rail comment button wired up to open the sheet for the tapped product. Folds the action-rail wiring originally specced as D.6 into D.4 per the updated plan. After this step, tapping the comment button on any feed item opens a working sheet where the user can read, post, edit, and delete comments. D.5 will layer realtime echoes on top without changing the UI.

### Reconnaissance

**Sheet idiom — `LocationSheet` (G.6) verbatim.**

- Store: [src/stores/useLocationSheetStore.ts](src/stores/useLocationSheetStore.ts) — `{ isOpen, open, close }` shape. CommentsSheet's store extends this with `productId` (the carrier between action rail tap and sheet open).
- Component: [src/components/feed/LocationSheet.tsx:124-138](src/components/feed/LocationSheet.tsx#L124) — base `BottomSheet` from `@gorhom/bottom-sheet` (NOT `BottomSheetModal`), `enablePanDownToClose`, `BottomSheetBackdrop` with opacity 0.6, `keyboardBehavior="interactive"`, `keyboardBlurBehavior="restore"`, `topInset={insets.top}`, the imperative `sheetRef.snapToIndex(0) / .close()` driven by a `useEffect(() => { if (isOpen) … })` watcher. `onChange((idx) => idx === -1 && close())` for swipe-to-close.
- Mount: [src/app/(protected)/(tabs)/index.tsx:107](src/app/(protected)/(tabs)/index.tsx#L107) — `<LocationSheet />` is a sibling of `<MarketplaceFilterSheet />` at the bottom of the screen tree. `<CommentsSheet />` lands as a third sibling at the same depth.

**Action rail shape.** [src/features/marketplace/components/ProductActionRail.tsx](src/features/marketplace/components/ProductActionRail.tsx) takes `{ product: Product, tabBarHeight?: number }` (full Product, not `productId`). The comment Pressable was at line 79-87, with `onPressComment = () => {}` at line 41. D.4 replaces the empty handler with `lightHaptic()` + `useCommentsSheetStore.getState().open(product.id)` — matches the existing like / buy-button haptic pattern at [ProductActionRail.tsx:31-39](src/features/marketplace/components/ProductActionRail.tsx#L31).

**Date helper choice.** No `date-fns` / `dayjs` in `package.json`. The project already ships [src/features/marketplace/utils/timeAgo.ts](src/features/marketplace/utils/timeAgo.ts:1) — a small `timeAgo(iso, lang)` helper supporting "à l'instant" / "just now", `Xm`, `Xh`, `Xd`, and falling back to `toLocaleDateString` past 7 days. **D.4 reuses it** — no new helper, no new dependency.

**`useMySeller` shape.** [src/features/marketplace/hooks/useMySeller.ts:6](src/features/marketplace/hooks/useMySeller.ts#L6) takes an `enabled: boolean` and returns `UseQueryResult<SellerProfile | null, Error>`. CommentsSheet calls `useMySeller(true)` and uses `mySeller.id === comment.author_id` to gate the `...` menu on each row.

**`useRequireAuth`.** [src/stores/useRequireAuth.ts:18](src/stores/useRequireAuth.ts#L18) — returns `{ isAuthenticated, user, requireAuth }`. The sheet calls `requireAuth()` inside `handleSubmit` per the Phase C convention (gating at the call site, not inside the mutation hook).

**D.3 invalidation-key typo — corrected.** While reading `useProduct` ([hooks/useProduct.ts:11](src/features/marketplace/hooks/useProduct.ts#L11)) for the sheet's title-counter source, the correct cache key was confirmed as `['marketplace', 'products', 'byId', productId]`. D.3's `usePostComment` and `useDeleteComment` had typoed `['product', 'byId', productId]` invalidations — the action-rail counter would not refresh. Patched in both hooks; the optimistic-prepend / id-swap / rollback logic is unchanged. Documented for transparency rather than left for D.5 because D.4's UX explicitly depends on the counter incrementing visibly after a post / delete.

### Files created

| File | Lines | Role |
| --- | --- | --- |
| [src/stores/useCommentsSheetStore.ts](src/stores/useCommentsSheetStore.ts) | ~15 | `{ isOpen, productId, open(productId), close }` Zustand store. |
| [src/components/feed/CommentItem.tsx](src/components/feed/CommentItem.tsx) | ~115 | Avatar + author header (name, verified, pro badge, relative time, edited suffix) + body + own-comment `...` actions menu (Alert.alert). Pending rows render at 0.55 opacity. |
| [src/components/feed/CommentInput.tsx](src/components/feed/CommentInput.tsx) | ~140 | Sticky compose row using `BottomSheetTextInput` (gorhom v5 keyboard-aware). create / edit modes, character counter past 80% threshold, send button transitions to `checkmark` icon in edit mode, `ActivityIndicator` while submitting. |
| [src/components/feed/CommentsSheet.tsx](src/components/feed/CommentsSheet.tsx) | ~360 | Main sheet at 90% snap. `BottomSheetFlatList` + `BottomSheetFooter` with `CommentInput`. Inline `CommentsSkeletons` (5 placeholders) and `CommentsEmpty` (centered icon + copy). Local state `bodyDraft` + `editingId`; clears when sheet closes or productId changes. Auth-gated `handleSubmit`, confirm Alert before delete, navigates to seller profile on author tap (also closes the sheet). |

### Files modified

| File | Change |
| --- | --- |
| [src/app/(protected)/(tabs)/index.tsx](src/app/(protected)/(tabs)/index.tsx) | Imported and mounted `<CommentsSheet />` as a sibling of `<LocationSheet />` at the bottom of the screen tree. |
| [src/features/marketplace/components/ProductActionRail.tsx](src/features/marketplace/components/ProductActionRail.tsx) | Imported `useCommentsSheetStore`. Replaced `onPressComment = () => {}` with `lightHaptic() + useCommentsSheetStore.getState().open(product.id)` — folds D.6 into D.4 per the updated plan. |
| [src/features/marketplace/hooks/usePostComment.ts](src/features/marketplace/hooks/usePostComment.ts) | Fixed product-cache invalidation key: `['product', 'byId', productId]` → `['marketplace', 'products', 'byId', productId]` to match `useProduct` at [hooks/useProduct.ts:11](src/features/marketplace/hooks/useProduct.ts#L11). |
| [src/features/marketplace/hooks/useDeleteComment.ts](src/features/marketplace/hooks/useDeleteComment.ts) | Same key correction as above. |
| [src/i18n/locales/fr.json](src/i18n/locales/fr.json) | Added `comments.*` namespace (16 keys: title / inputPlaceholder / emptyTitle / editedSuffix / editingIndicator / deleteConfirmTitle / deleteConfirmBody / deleteConfirmAction / actionsTitle / actionEdit / actionDelete / openActionsAriaLabel / submitCreateAriaLabel / submitEditAriaLabel / unknownAuthor). |
| [src/i18n/locales/en.json](src/i18n/locales/en.json) | English mirror of the same namespace. |
| [PROJECT_AUDIT.md](PROJECT_AUDIT.md) | This D.4 changelog. |

### Pending-row visual treatment

Per the D.3 handoff: temp rows are detected by id prefix. The sheet's `renderItem` callback computes `isPending = item.id.startsWith('temp-')` and forwards it to `CommentItem`, which renders the row at `opacity: 0.55` and the body text at `color="tertiary"`. The own-comment `...` actions menu is also hidden while pending — editing / deleting an unconfirmed row would race the mutation. Once `usePostComment.onSuccess` swaps the temp row with the server row (real UUID), `startsWith('temp-')` becomes false and the row renders at full opacity with the menu enabled.

### Action-rail wiring (D.6 fold)

Originally D.6 was specced separately as the wire-up step. Folding it into D.4 is the natural shape: building the sheet without wiring its trigger leaves a dead UI for two steps. The change is a four-line diff in [ProductActionRail.tsx](src/features/marketplace/components/ProductActionRail.tsx):

```ts
import { useCommentsSheetStore } from '@/stores/useCommentsSheetStore';

const onPressComment = (): void => {
  void lightHaptic();
  useCommentsSheetStore.getState().open(product.id);
};
```

When Step 5 (action-rail redesign) eventually ships, the same store call works in the new rail without changes — the store API is independent of which rail triggers it.

### Verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | exit 0 (resolved two type frictions: `Text`'s `color` prop only accepts `primary \| secondary \| tertiary \| inverse`, so the brand-colored "Modification d'un commentaire" hint and "Annuler" link in `CommentInput` use a `style={{ color: colors.brand }}` override on top of `color="primary"`; gorhom's `snapPoints` prop expects a mutable array, so `SNAP_POINTS` is typed as `(string \| number)[]` instead of `as const`). |
| `expo export --platform ios` | Not run automatically. The user can verify a clean bundle with `npx expo export --platform ios` after pulling the changes. |
| New deps | Zero. `timeAgo` reused from `src/features/marketplace/utils/timeAgo.ts`; no `date-fns`. |
| Strict TS | `any`: zero in D.4. The single documented escape hatch is the `as unknown as CommentWithAuthor[]` from D.3 (still in `services/comments.ts`); D.4 introduces no new ones. |
| Stale `Comment` type | [src/types/types.ts:23-35](src/types/types.ts#L23) untouched. The new code uses the `CommentWithAuthor` type from `services/comments.ts`. Phase F still owns the cleanup. |
| Auth gating | Inside the sheet (`handleSubmit` calls `requireAuth()` before posting / editing). The hooks themselves remain auth-agnostic per D.3 / Phase C convention. |
| i18n coverage | All user-facing strings go through `t(...)`. Both `fr.json` and `en.json` have parallel `comments.*` keys. |
| Realtime | Not in this step. D.5 owns the JS subscription that consumes the comments cache. |

**Manual sanity checks (deferred to user, requires the dev build):**
- Tap any product's comment button → sheet opens to 90% snap.
- Empty product: "Soyez le premier à commenter" centered with chat-bubble icon.
- Type a comment + send → optimistic prepend (low opacity) → server response replaces with full opacity; counter on the action rail increments.
- Tap "..." on own comment → Modifier / Supprimer alert.
- Modifier → input pre-fills, send button changes to checkmark, "Modification d'un commentaire" hint + Annuler link appear.
- Supprimer → confirm alert → row vanishes optimistically; counter decrements.
- Tap an author avatar → sheet closes, navigates to their seller profile.
- Pull-to-refresh refetches.
- Scroll past first 20 comments → cursor pagination loads next page.
- Body > 800 chars → "X/1000" indicator appears bottom-right of input.
- Body > 1000 chars → input rejects via `maxLength`.

### D.5 handoff

D.5 (realtime subscription) ships purely additively against the D.4 surface — no UI changes, no new mutations, no new hooks. The realtime layer plugs into the existing `['marketplace', 'comments', productId]` cache.

**Subscription pattern** (mirror [src/features/marketplace/services/messaging.ts:233-272](src/features/marketplace/services/messaging.ts#L233) and [src/features/marketplace/hooks/useMessages.ts:20-31](src/features/marketplace/hooks/useMessages.ts#L20)):

```ts
// services/comments.ts (or a sibling realtime file)
export function subscribeToComments(
  productId: string,
  onChange: (payload: RealtimePostgresChangesPayload<CommentRow>) => void,
) {
  const channel = supabase
    .channel(`comments:${productId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'comments',
        filter: `product_id=eq.${productId}`,
      },
      onChange,
    )
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
```

**Hook integration.** D.5 should add a `useEffect` either inside `useComments` (most ergonomic — co-located with the query) or in a new `useCommentsRealtime(productId)` companion hook the sheet calls separately. Each event handler:

| Event | Handler |
| --- | --- |
| INSERT | If `payload.new.id` matches an existing row in any page, ignore (self-echo of D.3's id-swap). Else fetch the joined author (or accept that the row renders without joined author until refetch) and prepend to page 0. |
| UPDATE | Find row by `payload.new.id` in any page; replace `body` and `updated_at`. |
| DELETE | Filter out by `payload.old.id` in all pages. |

**Self-echo dedupe**. D.3's `temp-` prefix + `onSuccess` id-swap give D.5 a clean dedupe target. By the time the realtime INSERT echo arrives, the cache row already has the server id, so `pages.some(p => p.items.some(c => c.id === payload.new.id))` correctly skips the duplicate.

**Author-join gap on realtime INSERT**. The INSERT payload carries the raw row from `postgres_changes`, which does NOT include the embedded `author:sellers!author_id(...)`. D.5 either (a) issues a one-row fetch on INSERT to hydrate the author, or (b) renders a placeholder `unknownAuthor` until the next refetch, or (c) hydrates from a `seller-by-id` cache if one exists. Recommendation: (a) — single round-trip per incoming INSERT, scoped to `comments` rows the user did not author themselves (own posts are already hydrated via the optimistic temp row that gets id-swapped).

**Subscription lifecycle.** Mount: when the sheet opens (productId becomes non-null) — subscribe. Unmount / productId change: unsubscribe. The closure capture is straightforward in a hook with `useEffect([productId])`.

### Reversion

```bash
git revert <d-4-commit-sha>
```

Removes the four new component / store files, the action-rail wiring, the marketplace home mount, the i18n additions, the D.3 invalidation-key fix, and this changelog. No database changes to undo. The user is back to D.3's hooks layer with no UI surface.

---

## Step D.5 Changelog (2026-05-03) — Comments Realtime Subscription

Subscribes the open `CommentsSheet` to `postgres_changes` events on `public.comments` filtered by `product_id`, merging remote INSERT / UPDATE / DELETE events into the same React Query cache that D.3's mutations write to. Self-echoes deduplicate by id (the `temp-` prefix was already swapped to a real UUID by `usePostComment.onSuccess` before the realtime echo arrives, so a presence check on the real id is sufficient). The sheet UI from D.4 is unchanged — D.5 is a pure additive layer. Phase D is complete after this step.

### Reconnaissance

**Messaging realtime pattern — verbatim (D.5 mirrors).**

[src/features/marketplace/services/messaging.ts:252-272](src/features/marketplace/services/messaging.ts#L252):

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

[src/features/marketplace/hooks/useMessages.ts:20-31](src/features/marketplace/hooks/useMessages.ts#L20):

```ts
useEffect(() => {
  if (!conversationId) return;
  const unsub = subscribeToMessages(conversationId, (msg) => {
    qc.setQueryData<ChatMessage[]>(key, (prev) => {
      if (!prev) return [msg];
      if (prev.find((m) => m.id === msg.id)) return prev; // dedupe
      return [...prev, msg];
    });
  });
  return unsub;
}, [conversationId, qc]);
```

**Idioms D.5 inherits exactly:**

- **Channel name = `${entity}:${scopeId}`** — `messages:${conversationId}` becomes `comments:${productId}`. Each subscription is product-scoped; two users on different sheets never share a channel.
- **Service returns `() => void`** — the unsubscribe closure, not the `RealtimeChannel`. Callers wire it directly to `useEffect`'s cleanup return slot. Returning the channel itself would force every caller to remember the `void supabase.removeChannel(channel)` invocation, which is the leak vector the messaging codebase deliberately closed.
- **Payload row cast** — `payload.new as CommentRow` mirrors `payload.new as MessageRow`. The `postgres_changes` typing in supabase-js v2 is `RealtimePostgresChangesPayload<{ [key: string]: any }>` from a literal table name, so an explicit cast is the project convention.
- **Dedupe by id presence in cache** — `prev.find(m => m.id === msg.id)` becomes `cache.pages.some(p => p.items.some(c => c.id === id))` for the InfiniteData shape D.3 uses.
- **No retry / polling fallback** — if realtime drops, pull-to-refresh from D.4 is the escape hatch.

**Publication membership confirmed.** D.2's [migration](supabase/migrations/20260520_comments_schema.sql:262-274) added `public.comments` to `supabase_realtime` via the `pg_publication_tables`-guarded `do $$ … end $$` block. Verified at [src/features/marketplace/services/messaging.ts:233-272](src/features/marketplace/services/messaging.ts#L233) that the publication is the same one messaging uses (`supabase_realtime`).

**Cache key shape.** D.3 keyed comments queries on `['marketplace', 'comments', productId]` and exposed the helper `COMMENTS_QUERY_KEY(productId)` from [hooks/useComments.ts:8](src/features/marketplace/hooks/useComments.ts#L8). D.5 imports and uses it directly — no key duplication.

**Sheet → hook contract.** [src/stores/useCommentsSheetStore.ts](src/stores/useCommentsSheetStore.ts) exposes `productId: string | null` (D.4). When the sheet closes, `productId` is set to `null` by the store's `close()` action. The realtime hook's `useEffect` checks `if (!productId) return;` and skips subscribing — the same idempotent guard as `useMessages`.

### Files modified

| File | Change |
| --- | --- |
| [src/features/marketplace/services/comments.ts](src/features/marketplace/services/comments.ts) | Added `getCommentWithAuthor(commentId)` (one-row select with the same `author:sellers!author_id(...)` join as `listComments`, used by realtime to enrich INSERT payloads); `subscribeToProductComments(productId, handlers)` returning `() => void` (mirrors `subscribeToMessages`); exported `CommentRealtimeHandlers` type. |
| [src/components/feed/CommentsSheet.tsx](src/components/feed/CommentsSheet.tsx) | Imported and called `useCommentsRealtime(productId)` alongside the other hooks. The hook short-circuits when `productId` is `null` (sheet closed). |
| [src/features/marketplace/index.ts](src/features/marketplace/index.ts) | Re-exported `useCommentsRealtime`, `getCommentWithAuthor`, `subscribeToProductComments`, `CommentRealtimeHandlers` from the barrel. |
| [PROJECT_AUDIT.md](PROJECT_AUDIT.md) | This D.5 changelog. |

### Files created

| File | Lines | Role |
| --- | --- | --- |
| [src/features/marketplace/hooks/useCommentsRealtime.ts](src/features/marketplace/hooks/useCommentsRealtime.ts) | ~110 | Side-effect hook. Subscribes on `productId` change, unsubscribes on close / change. INSERT enriches via one-row select then prepends; UPDATE patches `body` + `updated_at`; DELETE filters out. INSERT and DELETE invalidate the product / list caches so the action-rail counter refreshes. |

### Self-echo dedupe pattern

Two layers ensure no duplicates and no flicker:

1. **Synchronous presence check** at the top of `onInsert`. By the time the realtime echo arrives for our own post, `usePostComment.onSuccess` has already swapped the `temp-…` row with the server row (real UUID). The cache contains a row with `id === payload.new.id`, so `hasComment(cache, row.id)` returns true and we no-op. Same shape as `useMessages.ts:25` (`prev.find((m) => m.id === msg.id)`).
2. **Async re-check** inside `qc.setQueryData`. After awaiting `getCommentWithAuthor`, another realtime event or our own optimistic insert may have populated the row. The second `hasComment(old, enrichedRow.id)` inside the writer closes that window. Without it, two near-simultaneous INSERT events for the same id (rare but possible on reconnect storms) could double-prepend.

`onUpdate` and `onDelete` are naturally idempotent — `map`-then-replace is a no-op when the body is unchanged, and `filter` is a no-op when the row isn't in the cache.

### Author-enrichment pattern

`postgres_changes` payloads carry only the raw `comments` row — no embedded `author:sellers!author_id(...)` because the realtime broker reads the table directly (no PostgREST select string). Without enrichment, every remote INSERT would render with empty author fields until the next refetch.

D.5 issues a one-row select via `getCommentWithAuthor(row.id)` after each INSERT echo. The select reuses the `SELECT_WITH_AUTHOR` constant from D.3's service, so the embedded join is byte-for-byte identical to the initial page load.

UPDATE and DELETE skip enrichment — UPDATE patches only `body` + `updated_at` (the cached row already has the author), and DELETE only needs the `id` from `payload.old`.

If the enrichment fetch fails (network blip, RLS denial, etc.), the handler returns silently. The next pull-to-refresh / `staleTime` expiry picks up the row. No retry loop, no error toast — same deliberate "fail quiet, refresh later" stance as the messaging hook.

### Counter invalidation triggers

| Event | Counter handling |
| --- | --- |
| INSERT | After enrichment + prepend, invalidate `['marketplace', 'products', 'byId', productId]` and `['marketplace', 'products', 'list']`. The action-rail badge re-reads the trigger-incremented `comments_count`. |
| UPDATE | No counter invalidation — edit doesn't change `comments_count`. |
| DELETE | Invalidate the same two product caches. The badge re-reads the trigger-decremented count. |

### Edge cases

- **Stale productId.** The `useEffect([productId, qc])` dep array ensures the subscription always tracks the current store value. Switching products closes the old channel before opening the new one — no leaks.
- **Sheet close → reopen same product.** The closed effect's cleanup runs first, then the new effect re-subscribes. The cached pages from the previous open may still be valid (60s `staleTime`); any drift since close is filled in by the realtime echoes that arrive on resubscribe.
- **Author cascade-deletion mid-subscription.** `auth.users` deletion cascades to `sellers` (via `sellers.user_id`) and on to `comments` (via `comments.author_id`). DELETE events fire for every cascaded comment row; UI filters them out. The action-rail counter is decremented by the trigger and refreshed by the per-DELETE invalidation.
- **Multiple inserts within ms.** The async `getCommentWithAuthor` call is unawaited from the realtime callback's perspective (the callback returns immediately; the async work runs in the microtask queue). Two near-simultaneous INSERTs for different ids race only inside `qc.setQueryData`, where React Query's writer is synchronous — the second writer sees the result of the first. The async re-check in the writer also catches the rare same-id duplicate from reconnect storms.
- **Subscription failure.** If `supabase.channel(...).subscribe()` reports an error or the websocket drops, the messaging codebase's stance is "no retry; user pulls to refresh." D.5 inherits the same posture — no fallback polling, no error toast, no exponential backoff.

### Verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | exit 0. |
| `expo export --platform ios` | Not run automatically. No structural changes to the bundler graph (one new hook, one extended service, one wired component). |
| New deps | Zero. `getCommentWithAuthor` reuses `supabase` + `SELECT_WITH_AUTHOR`; `subscribeToProductComments` reuses `supabase.channel(...).on('postgres_changes', ...)`. |
| Strict TS | `any`: zero in D.5. The single documented escape hatch (`as unknown as CommentWithAuthor` for embedded selects, `payload.new as CommentRow` for realtime payloads) follows the existing convention. |
| Cleanup idiom | Identical to `subscribeToMessages` — service returns `() => void`; hook returns it from `useEffect`. |
| RLS posture | Unchanged. The realtime broker enforces RLS the same way as the REST endpoint (per Supabase docs); only authenticated users with SELECT access on `public.comments` receive events. D.2's `comments authenticated read` policy already grants this. |

**Manual sanity (deferred to user; requires two test users / devices):**

- Open product comments sheet on Device A. Post a comment from Device B → appears on A within ~1–2s. Action-rail counter on A increments.
- Device B edits its comment → body updates on A, `· modifié` suffix appears.
- Device B deletes its comment → row vanishes on A.
- On Device B (the poster): no flicker, no duplicate (self-echo deduped via id presence).
- Close the sheet on A → no further updates from B's posts (subscription disposed).
- Switch to a different product on A → events for the previous product stop, events for the new product start.

### Phase D summary — end-to-end

| Step | Output |
| --- | --- |
| **D.1** | [COMMENTS_AUDIT.md](COMMENTS_AUDIT.md) — read-only audit, S1 schema + U1 sheet recommendation, identified self-elevation hole on `products` grants. |
| **D.1.5** | [supabase/migrations/20260519_tighten_products_update_grants.sql](supabase/migrations/20260519_tighten_products_update_grants.sql) — REVOKE table-wide UPDATE on `products` from `authenticated`, GRANT UPDATE on the user-controlled column allowlist. Closed the self-elevation hole; made D.2's SECURITY DEFINER trigger load-bearing. |
| **D.2** | [supabase/migrations/20260520_comments_schema.sql](supabase/migrations/20260520_comments_schema.sql) — `public.comments` table, two indexes, counter trigger (SECURITY DEFINER + pinned `search_path`, mirrors C.2), `updated_at` BEFORE UPDATE OF body trigger, four RLS policies, table + column-level grants, realtime publication membership. Type regen included `Database['public']['Tables']['comments']`. |
| **D.3** | Service module + four hooks (`listComments` / `postComment` / `deleteComment` / `editComment` + `useComments` / `usePostComment` / `useDeleteComment` / `useEditComment`). Cursor-based pagination, optimistic prepend with id-swap, optimistic patch / remove with rollback. Pure-JS `temp-…` id generator. |
| **D.4** | `useCommentsSheetStore` + `CommentItem` + `CommentInput` + `CommentsSheet` (90% snap, BottomSheetFlatList + BottomSheetFooter, inline skeletons + empty state). Mounted in marketplace home. Action-rail comment button wired (D.6 fold). Patched D.3 invalidation-key typo. i18n keys (FR + EN). |
| **D.5** | This step. `subscribeToProductComments` + `getCommentWithAuthor` in the service; `useCommentsRealtime` hook; mounted in `CommentsSheet`. Self-echo dedupe by id; one-off author enrichment on INSERT. Counter invalidation on INSERT / DELETE. |

After D.5, the comments surface is fully live: a buyer reading a listing sees comments from other buyers / the seller in real time, posts / edits / deletes their own comments with optimistic UI, and the action-rail counter stays in sync. No new dependencies. No new infrastructure. All changes reversible via `git revert`.

### Known follow-ups (out of Phase D)

| Follow-up | Notes |
| --- | --- |
| "X commented on your listing" push notification | Infra ready per [COMMENTS_AUDIT.md §5](COMMENTS_AUDIT.md). Land as a post-success call inside `usePostComment` (similar to [useSendMessage.ts:36-49](src/features/marketplace/hooks/useSendMessage.ts#L36)) that resolves the listing owner's `auth.users.id` via `products.seller_id → sellers.user_id` and invokes `sendPushNotification` with a 80-char body preview. Skip when the commenter is the listing owner. |
| Realtime presence ("12 viewing this thread") | Use Supabase Realtime presence on the same `comments:${productId}` channel. Render a small badge near the sheet title. |
| Nested replies | Additive migration: `alter table public.comments add column parent_id uuid null references public.comments(id) on delete cascade`. App-side max-depth = 1. UI shows indented reply rows under their parent. |
| Comment moderation / report flow | New `report` action in the own-comment menu (when `!isOwn`) that opens a sheet asking for a reason and writes to a new `comment_reports` table. Out of scope for v1 marketplace. |
| Mention support (`@username`) | New `mentions jsonb` column on `comments` (additive migration). Parse mentions client-side; render with linked seller pill. Notification fan-out via the existing push infra. |
| Unread-comments badge | Track per-user `last_seen_at` per product (new lightweight table or jsonb on a user-prefs row). Decorate the action-rail comment icon with an unread-dot when count increased since last seen. |
| Soft-delete + thread placeholders | If a moderation feature lands or comment context preservation matters, the additive shape is `add column deleted_at timestamptz null` + a SELECT policy that filters or projects placeholder text. Per [COMMENTS_AUDIT.md §9](COMMENTS_AUDIT.md), this is forward-compatible from S1. |

### Reversion

```bash
git revert <d-5-commit-sha>
```

Removes the new realtime hook, the two service additions, the sheet wiring, the barrel re-exports, and this changelog. No database state to undo. The user is back to D.4's UI with no realtime layer — the sheet still works, just only refreshes via pull-to-refresh / `staleTime` expiry / mutation invalidations.

---

## Step E.2 Changelog (2026-05-03) — Share Implementation

Phase E completes. The action-rail share button is now real: tapping it opens the system share sheet with a localized message + a deep link, optimistically increments `products.shares_count`, and shared links deep-link recipients onto the marketplace home with the product sheet open.

Companion read-only audit: [SHARE_AUDIT.md](SHARE_AUDIT.md). The decisions this step implements (T1, S1, U1, routing-a) come from that audit.

### Pre-edit reconnaissance

| Question | Answer |
| --- | --- |
| `useProductSheetStore` mount | [src/app/(protected)/_layout.tsx:10](src/app/(protected)/_layout.tsx) — `<ProductDetailSheet />` mounted at the protected layout level, so any descendant route (including the new `(protected)/product/[id].tsx`) can `open()` it without remounting. |
| `useProduct` cache key | `['marketplace', 'products', 'byId', productId]` per [src/features/marketplace/hooks/useProduct.ts:11](src/features/marketplace/hooks/useProduct.ts). The cache holds **transformed `Product`** (not `ProductRow`) — the optimistic patch must touch `product.engagement.shares`, NOT `shares_count`. |
| List cache key | `['marketplace', 'products', 'list']` (prefix-matched by `useFilteredProducts` via `['marketplace', 'products', 'list', filters]`). Mirrors usePostComment.ts:139 invalidation. |
| Localized title helper | `getLocalized(value, lang?)` already exists at [src/i18n/getLocalized.ts:5](src/i18n/getLocalized.ts) — no new helper needed. |
| Price helper | `formatPrice(amount, currency, locale)` at [src/lib/format.ts:19](src/lib/format.ts). Already locale-aware. |
| Haptic | `lightHaptic()` from [src/features/marketplace/utils/haptics.ts:3](src/features/marketplace/utils/haptics.ts). |
| Auth gate | `useRequireAuth().requireAuth()` at [src/stores/useRequireAuth.ts:18](src/stores/useRequireAuth.ts) — boolean return; `if (!requireAuth()) return;` is the established gate idiom. |
| `expo-linking` install | Confirmed `~8.0.12` at [package.json:41](package.json). `Linking.createURL('product/<id>')` resolves the `client` scheme from [app.json:8](app.json) automatically. |
| `Share` API | RN core, no install. Used here for the first time in the codebase per SHARE_AUDIT.md §1.2. |
| Share message location | Inline in the service (locale-branched literals). Phase F will i18n-ize alongside the brand-name decision. |

### Files created

| Path | Purpose |
| --- | --- |
| [supabase/migrations/20260521_increment_share_count_rpc.sql](supabase/migrations/20260521_increment_share_count_rpc.sql) | `public.increment_share_count(p_product_id uuid)` SECURITY DEFINER RPC, pinned `search_path`, `auth.uid() IS NULL` guard, `COALESCE(...,0) + 1` defensive bump, GRANT EXECUTE to `authenticated` (REVOKE from `public` first). Mirrors D.2's `handle_comment_change()` security shape. |
| [src/features/marketplace/hooks/useShareProduct.ts](src/features/marketplace/hooks/useShareProduct.ts) | TanStack mutation. `onMutate` patches `byId` cache → `engagement.shares + 1`; `mutationFn` runs `incrementShareCount` then `shareProduct` (share-sheet errors swallowed per T1); `onError` rolls back the cache; `onSettled` invalidates `byId` + `list`. |
| [src/app/(protected)/product/\[id\].tsx](src/app/(protected)/product/%5Bid%5D.tsx) | Thin deep-link route. `router.replace('/(protected)/(tabs)')` then `setTimeout(0)` → `useProductSheetStore.open(id)` so the global sheet mounted in [(protected)/_layout.tsx](src/app/(protected)/_layout.tsx) sits over the home tab. Renders a brief black backdrop. |

### Files modified

| Path | Change |
| --- | --- |
| [src/features/marketplace/services/products.ts](src/features/marketplace/services/products.ts) | Added imports for `Share` (RN core) + `Linking` (expo-linking). Added `incrementShareCount(productId)` that casts `supabase.rpc` to a typed signature (the RPC isn't yet in `Database['public']['Functions']` until `npm run gen:types` runs against the applied DB). Added `ShareProductInput` type and `shareProduct(input)` that builds the deep-link URL, picks a fr/en message template, and calls `Share.share({ message, url })`. The "Marqe" brand name is hardcoded pending Phase F. |
| [src/features/marketplace/components/ProductActionRail.tsx](src/features/marketplace/components/ProductActionRail.tsx) | Replaced the no-op `onPressShare = () => {}` (was line 46) with a `useCallback` handler: `requireAuth()` gate → `lightHaptic()` → resolve locale from `i18n.language` → `shareMutation.mutate({ productId, title: getLocalized(...), priceLabel: formatPrice(...), locale })`. Added imports for `useShareProduct`, `getLocalized`, `formatPrice`, `useCallback`. The action rail now matches the like / buy / comment buttons in firing both `requireAuth` and a haptic. |

### Files NOT modified (deliberately)

- `app.json` — scheme stays `client`. Rebrand is a Phase F concern.
- `src/features/marketplace/index.ts` — `useShareProduct` is consumed only by the action rail (single call site); no barrel re-export needed. Other hooks like `useToggleLike` (also single-site) follow the same pattern.
- `src/i18n/locales/{en,fr}.json` — share message stays inline in the service per SHARE_AUDIT.md §11 Q1 default. Phase F can move it to `share.message` if more variants land.
- `src/types/supabase.ts` — generated. Type regen is OPTIONAL per the migration header; the cast in `incrementShareCount` works without it.
- `useProductSheetStore` — consumed as-is by the new route.

### Optimistic-update lifecycle

```
tap share
  └─ onMutate: setQueryData(['marketplace','products','byId',id], p =>
        ({ ...p, engagement: { ...p.engagement, shares: shares + 1 } }))
  └─ mutationFn:
        await incrementShareCount(id)            // RPC; throws → onError rollback
        try { await shareProduct(input) } catch {} // T1: swallow
  └─ onError: setQueryData(byId, ctx.previous)   // rollback
  └─ onSettled: invalidate byId + list
```

The optimistic patch is visible immediately in the `ProductDetailSheet` (which subscribes via `useProduct`). The action-rail count in the feed reads from a list-cache prop, so it pops only after the `onSettled` invalidation refetches the list — same staleness window as Phase D's comment-counter wiring at [usePostComment.ts:132-139](src/features/marketplace/hooks/usePostComment.ts).

### SECURITY DEFINER rationale

[D.1.5](supabase/migrations/20260519_tighten_products_update_grants.sql) revoked the broad UPDATE grant on `public.products` from `authenticated` and re-granted UPDATE only on the user-controlled allowlist. `shares_count` was deliberately excluded — see [SHARE_AUDIT.md §2.3](SHARE_AUDIT.md). For the JS client to bump the counter without a service-role round-trip, the RPC must run as the migration owner (SECURITY DEFINER). The `set search_path = public, pg_catalog` clause defeats the classic SECURITY DEFINER hijack (a malicious user creating a `public.products` shadow object in a writable schema and tricking the function into resolving it), matching the shape of [`handle_comment_change()`](supabase/migrations/20260520_comments_schema.sql) and [`handle_follow_change()`](supabase/migrations/20260518_follows_schema_and_counters.sql).

### Verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | exit 0. |
| `expo export --platform ios` | Not run automatically. No new bundler entry-points; one new hook, one extended service, one wired component, one new route file. |
| New deps | Zero. `Share` ships with React Native core; `expo-linking ~8.0.12` was already installed. |
| Strict TS | No `any`. The single typed cast in `incrementShareCount` is `supabase.rpc as unknown as IncrementShareCountRpc` — a documented escape hatch that disappears after `npm run gen:types`. |

**Manual sanity (deferred to user; requires migration applied):**

- Tap share button on a product → system share sheet opens with `Découvrez {title} à {price} sur Marqe` (FR) / `Check out {title} for {price} on Marqe` (EN) plus the `client://product/<id>` URL.
- Counter on the rail bumps after the next list refetch (~immediately in the sheet via the byId cache patch).
- Cancel the share sheet → counter STAYS incremented (T1: intent counts).
- Share via any channel → counter persists; the DB row's `shares_count` matches.
- Force an RPC failure (e.g., temporarily revoke EXECUTE in the DB) → optimistic patch rolls back; counter returns to prior value.
- On a second device: paste the shared URL into Messages → tap → app opens at marketplace home with the product sheet on top.

### Production apply

```bash
npm run db:push        # applies 20260521_increment_share_count_rpc.sql
npm run gen:types      # OPTIONAL — registers the function in
                       # Database['public']['Functions'] so the cast in
                       # incrementShareCount can be removed in a follow-on
                       # commit. Runtime works without regen.
```

### Phase E summary — end-to-end

| Step | Output |
| --- | --- |
| **E.1** | [SHARE_AUDIT.md](SHARE_AUDIT.md) — read-only audit, 11 sections. Confirmed share button is a no-op (`() => {}`), `shares_count` is system-managed (D.1.5 allowlist exclusion), no existing `share_events` table, no `Share.share` usage anywhere, no `expo-sharing` install. App scheme is `client` (Expo template default); no iOS associatedDomains, no Android intentFilters. Recommended T1 / S1 / U1 / routing-a. |
| **E.2** | This step. RPC migration + service helpers + optimistic mutation hook + action-rail wiring + thin deep-link route. Tapping share now opens the OS share sheet with a localized message and a working deep link; counter increments via SECURITY DEFINER RPC; recipients land on the marketplace with the product sheet open. |

After E.2, the Phase E share surface is functional end-to-end. No new dependencies. All changes reversible via `git revert` plus the rollback SQL in the migration header.

### Known follow-ups (out of Phase E)

| Follow-up | Notes / source |
| --- | --- |
| Scheme rebrand `client` → final brand name | Phase F. One-line change in [app.json:8](app.json) plus a coordinated rebuild. Invalidates any previously-shared links — currently zero exist, so the cost is paid up front. |
| Universal / web links | Out of scope until a public web app exists at a known host (per [SHARE_AUDIT.md §4.2](SHARE_AUDIT.md)). Add `ios.associatedDomains` + `android.intentFilters` then. |
| Share-as-engagement attribution | Track which share opened a deep link → conversion funnel. Requires the [SHARE_AUDIT.md §8 S2/S3](SHARE_AUDIT.md) extension (`share_events` table + referrer column on the deep-link route's mount effect). |
| Custom in-app share sheet (U2) | Polish-phase: project-styled bottom sheet with Share-via / Copy-link / Send-to-friend. Per [SHARE_AUDIT.md §9](SHARE_AUDIT.md), the OS sheet is the right v1 surface. |
| Share counter rate-limiting | Only if abuse emerges. v1 is "each tap = +1" with no dedup per [SHARE_AUDIT.md §7](SHARE_AUDIT.md). Mitigation would be a per-user-per-product cooldown inside the RPC. |
| `npm run gen:types` after deploy | Removes the `IncrementShareCountRpc` cast in `incrementShareCount`. Cosmetic; runtime is unaffected. |
| iPad simulator / share-unavailable fallback | Currently swallowed (counter still increments per T1). Could land a `Clipboard.setStringAsync(url)` + toast as a polish item; requires a toast component the app does not have yet. |
| i18n the share message | Move `Découvrez ... sur Marqe` / `Check out ... on Marqe` from the service to `share.message` interpolations in the locale bundles when the brand name lands. |

### Reversion

```bash
git revert <e-2-commit-sha>
```

Removes the migration file, the service additions, the new hook, the new route, the action-rail wiring, and this changelog. After reversion, run the documented rollback SQL in [supabase/migrations/20260521_increment_share_count_rpc.sql](supabase/migrations/20260521_increment_share_count_rpc.sql) against the deployed database to drop the function. Once dropped, the share button returns to a no-op and `products.shares_count` is once again unwritable from the JS client.


---

## Step 5 Changelog (2026-05-03) — Action Rail Redesign + Like Burst

Step 5 is presentation-only. The action rail's wirings (toggle-like, share, comment, buy) are unchanged; the rail is rebuilt on top of the Step 3 primitives, gains a More button + bottom sheet, and acquires a Reanimated 4 burst micro-interaction on the like-flip transition.

### Reconnaissance findings

| Surface | State at start of Step 5 |
| --- | --- |
| `src/features/marketplace/components/ProductActionRail.tsx` | Four buttons (Buy / Like / Comment / Share). Visual: Ionicons over a caption, no glass treatment except the 56-pt coral `buyCircle`. No "More" button. Counts via the abbreviated `formatCount` ("1,2k"). Container: `position: 'absolute', right: 14, bottom: tabBarHeight + 16, gap: 25`. |
| `useToggleLike` ([useToggleLike.ts:15](src/features/marketplace/hooks/useToggleLike.ts:15)) | Optimistic mutation in place since pre-Phase D. Toggles `likedIds` Set in the user-engagement cache; invalidates the products list on settle. Reused as-is. |
| `useShareProduct` ([useShareProduct.ts:28](src/features/marketplace/hooks/useShareProduct.ts:28)) | Phase E.2 hook. Reused as-is. |
| `useCommentsSheetStore.open(productId)` ([useCommentsSheetStore.ts:13](src/stores/useCommentsSheetStore.ts:13)) | Phase D.4 trigger. Reused as-is. |
| Buy entry point | `useProductSheetStore.getState().open(product.id)` — the existing product sheet handles the buy/contact flow downstream. Reused as-is. |
| Legacy "more" / "options" sheet | None. Clean slate for `MoreActionsSheet`. |
| `expo-clipboard` install status | Not installed. Resolved via `npx expo install expo-clipboard` → `~8.0.8` (SDK 54 aligned). |
| `formatActionCount` in [src/lib/format.ts](src/lib/format.ts) | Missing. Added. |
| Marketplace home mount point for new sheet | [src/app/(protected)/(tabs)/index.tsx](src/app/(protected)/(tabs)/index.tsx) — beside the existing `MarketplaceFilterSheet`, `LocationSheet`, and `CommentsSheet`. |
| `common.comingSoonTitle` / `common.comingSoonBody` | Existed only under `profile.*`. Promoted to `common.*` for Step 5 placeholders. |

### Files created

| File | Purpose |
| --- | --- |
| [src/stores/useMoreActionsSheetStore.ts](src/stores/useMoreActionsSheetStore.ts) | Zustand store mirroring [useCommentsSheetStore.ts](src/stores/useCommentsSheetStore.ts) — `{ isOpen, productId, open(id), close() }`. |
| [src/components/feed/LikeButton.tsx](src/components/feed/LikeButton.tsx) | Specialized like control with burst animation. Composes `Pressable` (haptic="medium") → glass-pill → `Animated.View` heart wrapper + sibling `Animated.View` ring. Renders `formatActionCount(count)` beneath. |
| [src/components/feed/MoreActionsSheet.tsx](src/components/feed/MoreActionsSheet.tsx) | Bottom sheet (`gorhom/bottom-sheet`) with snap point `['35%']`. Three rows: Copier le lien (real, via `expo-clipboard` + `Linking.createURL`), Signaler (placeholder Alert), Masquer (placeholder Alert). |

### Files modified

| File | Change |
| --- | --- |
| [src/lib/format.ts](src/lib/format.ts) | Added `formatActionCount(n, locale = 'fr-FR')` — full Intl-formatted count for action-rail counters. Header doc block updated to enumerate all four formatters. |
| [src/features/marketplace/components/ProductActionRail.tsx](src/features/marketplace/components/ProductActionRail.tsx) | Full visual rewrite atop the Step 3 primitives. Buy = `IconButton variant="filled" size="lg"`; Comment / Share / More = `IconButton variant="glass" size="md"`; Like = the new `LikeButton`. All counts now go through `formatActionCount` ("2 453", "128") instead of the abbreviated `formatCount`. All wirings preserved verbatim (`useToggleLike`, `useShareProduct`, `useCommentsSheetStore.open`, `useProductSheetStore.open`). New: `useMoreActionsSheetStore.open` for the More button. |
| [src/app/(protected)/(tabs)/index.tsx](src/app/(protected)/(tabs)/index.tsx) | Mounted `<MoreActionsSheet/>` as a sibling of `<CommentsSheet/>`. |
| [src/i18n/locales/fr.json](src/i18n/locales/fr.json) + [src/i18n/locales/en.json](src/i18n/locales/en.json) | Added `actionRail.*` (buy / buyAriaLabel / share / shareAriaLabel / more / moreAriaLabel / commentAriaLabel / likeAriaLabel / unlikeAriaLabel) and `more.*` (title / copyLink / linkCopiedTitle / report / hide). Promoted `comingSoonTitle` / `comingSoonBody` from `profile.*` to `common.*` since the More-sheet placeholders live outside the profile namespace. |
| [package.json](package.json) + lockfile | Added `expo-clipboard@~8.0.8` (SDK 54 aligned). |

### Burst animation spec

Wired in [LikeButton.tsx](src/components/feed/LikeButton.tsx) using Reanimated 4 only.

| Channel | Behavior on **not-liked → liked** | Behavior on **liked → not-liked** |
| --- | --- | --- |
| Heart scale | `withSequence(withSpring(1.35, motion.spring.snappy), withSpring(1.0, motion.spring.gentle))` | No animation. Silent flip to outlined. |
| Ring scale | Reset to `0`, then `withTiming(1, { duration: 380 })` | n/a |
| Ring opacity | Reset to `0.6`, then `withTiming(0, { duration: 380 })` | n/a |
| Ring color / geometry | `borderColor: colors.brand`, `borderWidth: 2`, `borderRadius: diameter / 2`, absolutely positioned with all-zero insets, `pointerEvents: 'none'`. Sibling of the `GlassCard` (NOT a child — the card has `overflow: hidden` and would clip the expanding ring). | n/a |
| Haptic | `medium` (via `Pressable`'s `haptic` prop) | `medium` |
| Icon swap | Outlined Ionicons `heart-outline` → filled `heart` colored `colors.brand`. Driven by the `isLiked` prop. | Reverse; instant. |

The animation runs synchronously at tap; the toggle mutation runs asynchronously. A failed mutation rolls back the optimistic count via `useToggleLike`'s `onError`, but the burst the user already saw is not retracted — visual continuity is preserved.

### Sizing decision

Legacy rail used a 56-pt filled coral circle for Buy and naked 30-33pt icons for Like/Comment/Share. The reference image shows all four secondary actions inside glass pills slightly smaller than Buy. Adopted:

| Button | Size | Diameter | Icon |
| --- | --- | --- | --- |
| Buy (Acheter / Contacter) | `IconButton size="lg"` | 56 | Ionicons `bag-handle` (Pro) or `chatbubble-ellipses` (non-Pro) at 26pt |
| Like | `LikeButton size="md"` | 48 | Ionicons `heart` / `heart-outline` at 22pt |
| Comment | `IconButton size="md"` | 48 | Ionicons `chatbubble-outline` at 20pt |
| Share | `IconButton size="md"` | 48 | Ionicons `paper-plane-outline` at 20pt |
| More | `IconButton size="md"` | 48 | Ionicons `ellipsis-horizontal` at 20pt |

Container gap shrunk from `25` to `spacing.lg` (16) since each button now carries its own caption — the visual rhythm matches the reference more tightly. Right offset (`14`) and bottom offset (`tabBarHeight + 16`) are unchanged from legacy.

The Pro / non-Pro Buy distinction (`bag-handle` + "Acheter" vs. `chatbubble-ellipses` + "Contacter") is preserved because labelling Buy as "Acheter" for a non-Pro seller misrepresents the downstream flow — the product sheet already routes those users to a contact path. The aria label uses `actionRail.buyAriaLabel` either way.

### Counter formatting policy

`formatActionCount` is the new home for action-rail counters and any future surface that wants full numbers ("2 453"). `formatCount` (abbreviated, "1,2k") stays in [src/lib/format.ts](src/lib/format.ts) for tight chips and headers. The legacy `src/features/marketplace/utils/formatCount.ts` is unchanged and still consumed elsewhere; consolidation is out of Step 5 scope.

### MoreActionsSheet content

| Row | Behavior |
| --- | --- |
| Copier le lien | `Linking.createURL(\`product/\${productId}\`)` → `Clipboard.setStringAsync(url)` → `Alert.alert(t('more.linkCopiedTitle'))` → close. Real, ships now. |
| Signaler | `Alert.alert(common.comingSoonTitle, common.comingSoonBody)` → close. Phase F wires the real flow. |
| Masquer | Same placeholder, rendered with `colors.feedback.danger` for icon + label to communicate destructive intent. Phase F wires the real flow. |

No auth gating on the sheet. Copy link is non-destructive; Report and Hide are placeholders.

### Verification results

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | exit 0 (clean). |
| `npx expo export --platform ios --dev` | bundles clean (13.7 MB iOS bundle, no warnings about the new files). |
| New deps | `expo-clipboard@~8.0.8` (SDK 54 aligned). No other dependencies added. |
| JSON locale files | Parse via `JSON.parse` without errors. |

Manual / runtime verification (deferred to user; requires every prior migration applied):

- Open the marketplace feed.
- Tap **Acheter** → product sheet opens (existing checkout entry, unchanged).
- Tap heart on a not-liked product → heart pulses 1.0 → 1.35 → 1.0 via spring; coral ring expands from circle and fades over ~380ms; icon flips to filled coral; count increments; haptic medium fires.
- Tap heart on a liked product → silent flip to outlined; count decrements; no burst.
- Tap **comment** → CommentsSheet opens (D.4 wiring).
- Tap **share** → system share sheet (E.2 wiring) + counter increments.
- Tap **More** → 35% sheet with three rows.
  - Copy link → URL on clipboard, "Lien copié" alert, sheet dismisses.
  - Signaler → "Bientôt disponible" alert.
  - Masquer → "Bientôt disponible" alert.
- All counts render French-formatted ("2 453", "128", "1 234").

### Step 6 handoff

Step 6 redesigns the **bottom info section** — title, price card, breadcrumb chip, tag chips. Specifically:

- Fraunces (display) typography for the product title.
- Fraunces typography for the floating price card on the top overlay.
- Per-card distance surfacing (uses `formatDistance` from Phase G.7 plus the user's resolved location).
- Tag chip layout matching the reference image (Bois massif / Tissu bouclé / Beige / dimensions ruler chip).

Step 6 is presentation-only; no backend, no new mutations.

### Reversion

```bash
git revert <step-5-commit-sha>
```

Removes the new files (`useMoreActionsSheetStore`, `LikeButton`, `MoreActionsSheet`), the rail rewrite, the home-screen mount, the i18n additions, the `formatActionCount` helper, the doc-block update, and this changelog. The `expo-clipboard` install reverts via the package.json + lockfile diff in the same commit. After reversion, the rail returns to its Phase E shape and `formatCount` (abbreviated) once again drives the counters.


---

## Step 6 Changelog (2026-05-03) — Bottom Info Redesign + Fraunces Moment

Step 6 closes out the visual reproduction. Every region of the reference image now matches what's on screen: the breadcrumb chip, the title in Fraunces, the expandable description with Voir plus, the wrapping tag chip row (with the G.7-deferred distance chip surfacing for the first time), and the seller mini-card with the outlined Voir le profil chip.

### Reconnaissance findings

| Surface | State at start of Step 6 |
| --- | --- |
| `src/features/marketplace/components/ProductBottomPanel.tsx` | Existed. Controlled-`expanded` prop pattern with a chevron handle that toggled scrim height + description visibility. Container: `position: 'absolute', left: 12, right: '30%', bottom: tabBarHeight + 16`. Inline breadcrumb (Ionicons `home` + raw `>`), inline title (`fontSize: 22, fontWeight: '800'`), inline description, inline `AttributeChip` subcomponent for tags, inline dimensions chip. No seller mini-card, no distance, no Fraunces. |
| `Product` type ([product.ts](src/features/marketplace/types/product.ts)) | Has structured `attributes: ProductAttribute[]` (each `{ id, label: LocalizedString, iconKey? }`) — NOT raw JSONB. Has `dimensions?: string` separate from attributes. Has `category: { primary, secondary }` as `LocalizedString` pair (the legacy display-time breadcrumb path). Carries `categoryId?` / `subcategoryId?` for the normalized link. Did **NOT** carry `distanceKm` — Step 6 adds it as `distanceKm?: number \| null`. |
| Distance plumbing | `ListNearbyResult.items: NearbyProduct[]` ([products.ts:196](src/features/marketplace/services/products.ts:196)) where `NearbyProduct = Product & { distanceKm: number \| null }`. Marketplace feed already produces `NearbyProduct[]` ([MarketplaceScreen.tsx:28](src/features/marketplace/screens/MarketplaceScreen.tsx:28)) but `ProductFeedItem` widens to `Product`, dropping the field. After adding `distanceKm?` to the base `Product` type, distance flows through structurally with zero service-layer change. |
| `formatDistance` ([format.ts:49](src/lib/format.ts:49)) | Phase G.7 helper — fr-FR formatting, "950 m" / "1,2 km" / "12 km" tiers. Already consumed by [RailProductCard.tsx](src/components/categories/RailProductCard.tsx). Reused in `ProductTagChipRow`. |
| Attribute icon mapping | [src/features/marketplace/utils/attributeIcon.ts](src/features/marketplace/utils/attributeIcon.ts) maps `iconKey` → `{ family: 'ionicons' \| 'material' \| 'dot', name }`. Keys: `wood` → `leaf`, `fabric`/`textile` → `sparkles`, `color` → dot, `dimensions` → `straighten`, default → dot. Reused in `ProductTagChipRow` instead of duplicating into the new component. |
| Seller relation | Already on `Product.seller: Seller` ({ id, name, avatarUrl, verified, isPro, rating, salesCount }). The `SellerMiniCard` consumes a narrowed `{ id, name, avatarUrl, verified, isPro }` slice. |
| Seller profile route | `(protected)/seller/[id]` — confirmed via existing usages in [CommentsSheet.tsx:203](src/components/feed/CommentsSheet.tsx:203) and [ProductFeedItem.tsx:99](src/features/marketplace/components/ProductFeedItem.tsx:99). |
| `display` Text variant | [Text.tsx:50](src/components/ui/Text.tsx:50) resolves `variant="display"` → `family.display` (Fraunces_500Medium); with `weight="semibold"` it walks `displayFamilyForWeight` → `Fraunces_600SemiBold`. Verified the resolution path; the variant works as advertised. The new `ExpandableDescription` belt-and-suspenders the choice with an explicit `fontFamily: typography.family.displaySemibold` style override so the Fraunces moment cannot regress if the variant map shifts later. |
| Existing i18n surfaces | `common.viewProfile: "Voir le profil"` and `marketplace.sellerPro: "Vendeur professionnel"` already existed. Added duplicates under `seller.*` per spec for namespace cleanliness; documented redundancy here. |

### Files created

| File | Purpose |
| --- | --- |
| [src/components/feed/CategoryBreadcrumbChip.tsx](src/components/feed/CategoryBreadcrumbChip.tsx) | Glass pill with a 22-pt circular home-icon affordance + caption-weight breadcrumb text. `›` separator rendered in `colors.text.tertiary`. When `onPress` is provided the chip becomes a haptic Pressable; otherwise the body renders inert. |
| [src/components/feed/ExpandableDescription.tsx](src/components/feed/ExpandableDescription.tsx) | Title in Fraunces (28pt, lineHeight 32, displaySemibold) + 3-line clamped description with a Voir plus / Voir moins toggle. Toggle visibility is detected via a measure-then-clamp pattern: first render is unclamped, `onTextLayout` reads the actual line count, subsequent renders clamp to 3 unless the user has expanded. Robust without animation per spec. |
| [src/components/feed/ProductTagChipRow.tsx](src/components/feed/ProductTagChipRow.tsx) | Wrap-row of `Chip variant="glass" size="sm"` chips. Order: distance chip (when finite) → attribute chips (iterating `product.attributes`, skipping empty labels, leading icons via the existing `attributeIcon` util) → dimensions chip (when `product.dimensions` is non-empty). Returns `null` if all three sources are empty. |
| [src/components/feed/SellerMiniCard.tsx](src/components/feed/SellerMiniCard.tsx) | Glass card with avatar (`size="sm"`, 32pt), name + verified-check, ProBadge + "Vendeur professionnel" / "Vendeur particulier" caption, and an `outlined`-variant Chip CTA with a `chevron-forward` trailing icon for "Voir le profil". |

### Files modified

| File | Change |
| --- | --- |
| [src/features/marketplace/types/product.ts](src/features/marketplace/types/product.ts) | Added `distanceKm?: number \| null` to the `Product` type with a doc comment that points to `searchNearbyProducts` as the population point. The `NearbyProduct = Product & { distanceKm: number \| null }` intersection still narrows correctly. |
| [src/features/marketplace/components/ProductBottomPanel.tsx](src/features/marketplace/components/ProductBottomPanel.tsx) | Full content rewrite. Drops the chevron-handle + `expanded` / `onToggleExpanded` props. New composition: `CategoryBreadcrumbChip → ExpandableDescription → ProductTagChipRow → SellerMiniCard`. Outer container changes from `right: '30%'` to `left: spacing.lg, right: spacing.lg`; the upper-content sub-view reserves `paddingRight: 72` (`ACTION_RAIL_RESERVE`) so breadcrumb / title / description / tags don't collide with the action rail's column, while the seller mini-card spans full width below. Breadcrumb tap calls `useMarketplaceFilters.setFilters({ categoryId, subcategoryId })`. View-profile tap routes to `(protected)/seller/[id]`. |
| [src/features/marketplace/components/ProductFeedItem.tsx](src/features/marketplace/components/ProductFeedItem.tsx) | Removed `useState` for `bottomPanelExpanded`, the `useSharedValue` / `useAnimatedStyle` / `withTiming` / `interpolate` imports, the dynamic-scrim animation, and the `expanded` / `onToggleExpanded` props on `<ProductBottomPanel>`. Scrim is now a static `<View>` with `height: '60%'` (the previously-expanded value) — matches the new always-on bottom info weight. |
| [src/i18n/locales/fr.json](src/i18n/locales/fr.json) + [src/i18n/locales/en.json](src/i18n/locales/en.json) | Added `seller.viewProfile`, `seller.viewProfileAriaLabel`, `seller.professional`, `seller.individual`, plus the new `feedItem.showMore` / `feedItem.showLess` namespace. `seller.viewProfile` is semantically identical to the pre-existing `common.viewProfile`; `seller.professional` is identical to `marketplace.sellerPro`. The duplication is intentional per spec — namespacing keeps the bottom-info copy localized to its surface. |

### Fraunces verification

The display family resolves through three paths, all aligned:

1. The Text primitive's `variant="display"` defaults to `typography.family.display` = `Fraunces_500Medium`.
2. With `weight="semibold"`, the primitive walks `displayFamilyForWeight` and resolves `Fraunces_600SemiBold`.
3. `ExpandableDescription` *also* applies `style={{ fontFamily: typography.family.displaySemibold }}` so the Fraunces moment cannot regress if the variant-to-family table is restructured later.

Visually: the title is the only Fraunces text on the entire feed surface — every other label is Inter — so the editorial moment Step 2 was preparing for finally lands.

### Distance display surfacing (G.7 deferral resolved)

`Product.distanceKm` is now part of the typed surface. Population is unchanged: `searchNearbyProducts` writes `distance_km` from the RPC into `NearbyProduct.distanceKm`, which now matches the base `Product` shape structurally. `ProductTagChipRow` checks `Number.isFinite(distanceKm)` before rendering the chip, so products without coords or users without a set location simply omit the chip — no empty / "?" placeholder.

The chip uses an Ionicons `navigate` leading icon and `formatDistance(distanceKm)` for the label ("950 m", "1,2 km", "12 km" per the G.7 tiers). It always renders first in the wrap row when present, so it reads as the primary tag for nearby products.

### Visual reproduction summary

| Reference image region | Status |
| --- | --- |
| Top header (Pour toi / Marketplace / search) | Step 4 |
| Top overlay — seller pill (left) | Step 4.1 |
| Top overlay — price card (right) | Step 4 |
| Right action rail (Acheter / heart / comment / share / more) | Step 5 |
| Like burst micro-interaction | Step 5 |
| Breadcrumb chip (home dot + path) | **Step 6 ✓** |
| Title in Fraunces | **Step 6 ✓** |
| Description + Voir plus | **Step 6 ✓** |
| Tag chips (material / fabric / color / dimensions / distance) | **Step 6 ✓** |
| Seller mini-card with outlined Voir le profil | **Step 6 ✓** |
| Bottom tab bar | Step 7 |

End-to-end visual reproduction is complete. Phase F (cleanup) is now the only remaining track.

### Known follow-ups

| Follow-up | Source / notes |
| --- | --- |
| Color attribute swatch | Currently renders as a generic dot via `attributeIcon('color')`. The reference image shows a beige circle for "Beige". To do this correctly we need a `colorValue?: string` on `ProductAttribute` (CSS color or hex). Phase F. Sniffing the localized label for a CSS color name was rejected as fragile. |
| Legacy `category` JSONB → `category_id` migration at the data layer | Phase F per A.2 reconnaissance. The breadcrumb still reads `product.category.primary/secondary` for display continuity; the tap handler reads the normalized `categoryId` for filtering. Both paths coexist until Phase F retires the JSONB. |
| Description expand animation | State toggle is final per spec. If polish wants a height animation, Phase F. |
| `seller.viewProfile` / `seller.professional` duplication | `common.viewProfile` and `marketplace.sellerPro` carry identical values. Spec called for surface-local namespacing; if a flatter i18n surface is preferred later, consolidate in Phase F. |
| Attribute icon expansion | Adding new attribute kinds (e.g. weight, finish, era) means extending the `attributeIcon` switch in [src/features/marketplace/utils/attributeIcon.ts](src/features/marketplace/utils/attributeIcon.ts). One-line edits per kind. |

### Verification results

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | exit 0 (clean). |
| `npx expo export --platform ios --dev` | bundles clean (13.7 MB iOS bundle, no warnings about the new files). |
| New deps | None. Step 6 ships entirely on existing primitives + `formatDistance` + `attributeIcon`. |
| JSON locale files | Parse via `JSON.parse` without errors. |

Manual / runtime verification (deferred to user; requires every prior migration applied):

- Open the marketplace feed.
- Bottom of every feed item:
  - Glass breadcrumb chip with home icon + "Maison & Déco › Fauteuils".
  - Title in **Fraunces** (visibly different typeface from the rest of the UI — Inter elsewhere).
  - Description clamps to 3 lines; "Voir plus" appears only when the description actually overflows; tapping it expands; "Voir moins" collapses.
  - Tag chips wrap; each has a leading icon (leaf for `wood`, sparkles for `fabric/textile`, dot for `color`, ruler for dimensions, navigate for distance).
  - When the user has a set location AND the product has coords, a distance chip ("1,2 km") leads the row.
  - Seller mini-card spans full width with avatar + name + (verified) + (PRO) + "Vendeur professionnel" / "Vendeur particulier" + outlined "Voir le profil ›" chip.
- Tap breadcrumb → marketplace filter applies category + subcategory.
- Tap "Voir le profil" → routes to `(protected)/seller/[id]`.

### Reversion

```bash
git revert <step-6-commit-sha>
```

Removes the four new components ([CategoryBreadcrumbChip.tsx](src/components/feed/CategoryBreadcrumbChip.tsx), [ProductTitle.tsx](src/components/feed/ProductTitle.tsx), [ProductTagChipRow.tsx](src/components/feed/ProductTagChipRow.tsx), [SellerMiniCard.tsx](src/components/feed/SellerMiniCard.tsx)), restores the legacy [ProductBottomPanel.tsx](src/features/marketplace/components/ProductBottomPanel.tsx) content, restores `bottomPanelExpanded` state + dynamic scrim animation in [ProductFeedItem.tsx](src/features/marketplace/components/ProductFeedItem.tsx), removes the `distanceKm` field from `Product`, removes the new i18n keys, and removes this changelog. No backend or migration impact.

### Step 6 amendment (same day) — Panel-level Voir plus / Voir moins

User feedback: a single panel-wide expand toggle is cleaner than burying the toggle inside the description. The bottom info panel now opens compact and reveals heavier content on demand.

**Compact (default):** breadcrumb chip → title (Fraunces) → tag chips → "Voir plus ⌄"

**Expanded:** breadcrumb chip → title (Fraunces) → description (full, no clamp) → tag chips → "Voir moins ⌃" → seller mini-card

Changes:

| File | Change |
| --- | --- |
| `src/components/feed/ExpandableDescription.tsx` | **Deleted.** The measure-then-clamp pattern is gone — description is either fully shown (expanded) or fully hidden (compact). |
| [src/components/feed/ProductTitle.tsx](src/components/feed/ProductTitle.tsx) | **New.** Focused Fraunces title component. Belt-and-suspenders the variant resolution with explicit `fontFamily: typography.family.displaySemibold` so the editorial moment cannot regress. |
| [src/features/marketplace/components/ProductBottomPanel.tsx](src/features/marketplace/components/ProductBottomPanel.tsx) | Adds local `expanded` state (default `false`). Description and seller mini-card are conditionally rendered on `expanded`; tag chips and breadcrumb stay visible in both modes (they're identity info — material, color, dimensions, distance — and short). The "Voir plus / Voir moins" toggle sits below the tag chips inside the action-rail-reserved upper-content column with a chevron that flips on state. No animation per spec — instant flip. |

Trade-off: tag chips render even when compact rather than getting hidden along with the description. They carry identity (material, color, dimensions, distance) at near-zero visual cost, so demoting them to expanded-only would over-prune. Description and seller mini-card are the bulky bits and stay gated.

Verification: `npx tsc --noEmit` exits 0; `npx expo export --platform ios --dev` bundles clean.

---

## Step H'.2 Changelog (2026-05-04) — Currency Localization Foundation

Foundation step for display-currency localization. Ships the data layer (constants, country-currency map, rate service, two Zustand stores, refresh hook, formatter helper, formatter hook, root-layout mount) without migrating any call site. H'.3 owns the call-site migration and the Settings UI.

Audit reference: [CURRENCY_AUDIT.md](CURRENCY_AUDIT.md). All decisions locked there: device-locale detection via `expo-localization`, free no-key rate API, 12h cache, in-app override UI (deferred to H'.3), display-only conversion (transactions still settle in product currency).

### Reconnaissance findings

- **`expo-localization ~17.0.8`** is already installed ([package.json:43](package.json:43)) and wired ([app.json:74](app.json:74)). Reused the existing `getLocales()` API surface for consistency with [src/i18n/index.ts:13](src/i18n/index.ts:13) — `Localization.getLocales()[0]?.currencyCode` (preferred) and `?.regionCode` (fallback). No deprecated flat properties.
- **`api.exchangerate.host` now requires an API key** (HTTP 200 with `{"success":false,"error":{"code":101,"type":"missing_access_key"}}`). Per Task 1's escape hatch, switched to **Frankfurter** (free, no key). The `.app` host is unreachable from this environment but `api.frankfurter.dev/v1/latest?base=EUR` works and returns the same shape: `{"amount":1.0,"base":"EUR","date":"2026-04-30","rates":{"USD":1.1702,"GBP":0.86625,...}}`.
- **Coverage gap to flag:** Frankfurter covers ~30 currencies (USD/GBP/JPY/CHF/CAD/AUD/CNY/INR/most EU minors). It does **not** cover AED, SAR, QAR, KWD, MAD. MENA users selecting one of those Gulf/Maghreb currencies hit the no-rates fallback (display in product currency, no `≈` prefix). Acceptable for v1; revisit if telemetry shows real users in the gap.
- **Persistence pattern** mirrored verbatim from [src/features/location/stores/useUserLocation.ts:60-180](src/features/location/stores/useUserLocation.ts:60) — `persist` middleware with `version`, `partialize`, `migrate`, defensive `onRehydrateStorage`, AsyncStorage backend. Same shape `useDisplayCurrency` and `useExchangeRates` adopt.
- **Root layout mount point** at [src/app/_layout.tsx:86](src/app/_layout.tsx:86) — `usePushNotifications()` is already a side-effect hook called inside `RootLayout`. Mounted `useExchangeRatesRefresh()` immediately after it.

### Files created

| File | Purpose |
|---|---|
| [src/lib/currency/constants.ts](src/lib/currency/constants.ts) | `CURRENCY_CACHE_TTL_MS` (12h), `CURRENCY_API_URL` (Frankfurter v1), `CURRENCY_RATES_CACHE_KEY`, `CURRENCY_PREFERENCE_KEY`, version constants, `DEFAULT_CURRENCY`, `APPROX_PREFIX`. |
| [src/lib/currency/country-currency-map.ts](src/lib/currency/country-currency-map.ts) | All 249 ISO 3166-1 alpha-2 codes → ISO 4217 currency. `countryToCurrency(code)` helper with `DEFAULT_CURRENCY` fallback for unknown/null inputs. |
| [src/lib/currency/exchangeRates.ts](src/lib/currency/exchangeRates.ts) | `fetchExchangeRates()` service, `isStale(snapshot)` predicate, `ExchangeRateSnapshot` type. **Synthesizes `[base]: 1` into the rates map** since Frankfurter omits the base — keeps the formatter's `rates[product] / rates[display]` math uniform across the EUR-product-default case. |
| [src/stores/useDisplayCurrency.ts](src/stores/useDisplayCurrency.ts) | Zustand+AsyncStorage store. 3-tier auto-detection (`getLocales()[0].currencyCode` → `countryToCurrency(regionCode)` → `DEFAULT_CURRENCY`). `setManual(code)` and `setAuto()` actions. On rehydrate with `source: 'auto'`, re-runs detection so users moving regions pick up the change; `'manual'` rehydrates as-is. Defensive `onRehydrateStorage` resets corrupted state to fresh detection. |
| [src/stores/useExchangeRates.ts](src/stores/useExchangeRates.ts) | Zustand+AsyncStorage store. `refresh()` and `refreshIfStale()` actions. Persists `snapshot` only (loading/error are runtime). Fail-soft on network errors — keeps last known snapshot. Defensive rehydrate validates the snapshot shape and drops it if corrupted. |
| [src/hooks/useExchangeRatesRefresh.ts](src/hooks/useExchangeRatesRefresh.ts) | Side-effect hook. On mount: `refreshIfStale()`. Subscribes to `AppState` and re-runs the staleness check on transitions to `'active'`. Returns nothing; mounted once at the root layout. Uses the modern `AppState.addEventListener('change', handler)` API with subscription `.remove()` cleanup. |
| [src/hooks/useFormatDisplayPrice.ts](src/hooks/useFormatDisplayPrice.ts) | Composition hook. Pulls display currency from `useDisplayCurrency`, rates from `useExchangeRates.snapshot?.rates`, locale from `react-i18next`'s `i18n.language`. Returns a memoized `(amount, productCurrency?) => string` formatter. The single entry point H'.3 call sites will use. |

### Files modified

| File | Change |
|---|---|
| [src/lib/format.ts](src/lib/format.ts) | Added `formatDisplayPrice(amount, productCurrency, displayCurrency, locale, rates)` alongside the existing `formatPrice`. Updated the doc block to enumerate all five formatters and clarify when to use `formatPrice` (transactional surfaces — order history, share strings, conversation offers) vs `formatDisplayPrice` (marketplace display surfaces). Existing `formatPrice` signature/behavior unchanged. |
| [src/app/_layout.tsx](src/app/_layout.tsx) | Imported and mounted `useExchangeRatesRefresh()` next to `usePushNotifications()`. Two-line additive change — no other `_layout.tsx` logic touched. |

### EUR-EUR fast path

`formatDisplayPrice` short-circuits when `productCurrency === displayCurrency`, deferring directly to `formatPrice` with no conversion math, no rate lookups, and no `≈` prefix. Per [CURRENCY_AUDIT.md §2](CURRENCY_AUDIT.md), every product currency is `'EUR'` today, and a French simulator/device auto-detects `'EUR'` as display currency — so this fast path covers ~100% of current real users. The convert path is exercised only after H'.3 ships the override UI and a user actively picks a non-EUR display currency.

### Graceful no-rates fallback

When `rates` is null OR either currency is missing from the rates map (Frankfurter coverage gap, or first launch with no network and empty cache), `formatDisplayPrice` displays the original amount in `productCurrency` with no `≈` prefix. Better to show the real listing price than a stale or invented number. Failure modes that hit this path:

- Cold first launch on an offline device.
- Display currency outside Frankfurter's ~30-currency coverage (AED, SAR, QAR, KWD, MAD).
- API outage during a 12h-window refresh attempt (the previous snapshot is kept; this is a fail-soft, not the fallback path — the fallback only kicks in when the snapshot is genuinely missing).

### Verification

- `npx tsc --noEmit` exits 0 (zero TypeScript errors).
- Zero new npm dependencies. Frankfurter switch reuses the existing `fetch` global; `expo-localization` and `@react-native-async-storage/async-storage` were already installed.
- Lint check attempted via `npx expo lint`; pre-existing infra issue — `expo lint` auto-installed `eslint`/`eslint-config-expo` as a side-effect on first run, then failed with `Cannot find module 'eslint'`. Reverted those `package.json`/`package-lock.json` edits and the auto-generated `eslint.config.js` per the no-new-deps constraint. The lint infra is broken on this branch independent of H'.2 — separate concern.
- No app behavior change yet (H'.2 is foundation; no consumer wired up).
- Manual sanity (deferred to user, runtime):
  - On launch, `useExchangeRates.getState().snapshot` should populate within ~1–2 s with `{ base: 'EUR', rates: { EUR: 1, USD: 1.17, ...}, fetchedAt: <unix-ms> }` (note `EUR: 1` is synthesized).
  - `useDisplayCurrency.getState()` returns `{ currency: 'EUR', source: 'auto' }` on a French simulator; should switch to `'AUD'` / `'USD'` etc. when the simulator region changes.
  - `useFormatDisplayPrice()(299, 'EUR')` returns `"299,00 €"` on EUR-display, `"≈ 350,07 $US"` on USD-display, or just `"299,00 €"` if rates haven't fetched yet.

### H'.3 handoff

H'.3 ships the call-site migration and the override UI. From [CURRENCY_AUDIT.md §1](CURRENCY_AUDIT.md):

**5 call sites to migrate** (display surfaces — swap to `useFormatDisplayPrice()`):

1. [src/components/feed/PriceCard.tsx:50](src/components/feed/PriceCard.tsx:50) — already locale-aware, simple swap.
2. [src/components/categories/RailProductCard.tsx:53](src/components/categories/RailProductCard.tsx:53) — needs locale plumbing.
3. [src/features/marketplace/components/PriceCard.tsx:21,63](src/features/marketplace/components/PriceCard.tsx:21) — **delete the local-shadow `formatPrice`** at line 21 as part of the swap.
4. [src/features/marketplace/components/ProductDetailSheet.tsx:45,315](src/features/marketplace/components/ProductDetailSheet.tsx:45) — **delete the local-shadow `formatPrice`** at line 45 as part of the swap.
5. [src/features/marketplace/components/SellerProductCard.tsx:44](src/features/marketplace/components/SellerProductCard.tsx:44) — replace inline `Intl.NumberFormat` with the formatter hook.

**4 sites to leave on `formatPrice`** (transactional record semantics — wallet/receipts/messages):

- [src/features/marketplace/components/ProductActionRail.tsx:61](src/features/marketplace/components/ProductActionRail.tsx:61) — share string. Keep product currency.
- [src/app/(protected)/(tabs)/profile.tsx:60](src/app/(protected)/(tabs)/profile.tsx:60) — order history. Keep product currency (real money charged).
- [src/app/(protected)/conversation/[id].tsx:168](src/app/(protected)/conversation/[id].tsx:168) — conversation offer. Pre-existing latent bug (hardcoded `'EUR'`); flag for separate fix, **not** H'.3's responsibility.
- (Plus the lib helper itself — `src/lib/format.ts:formatPrice` stays exported.)

**2 local-shadow `formatPrice` declarations to DELETE** in H'.3 alongside the migration: [src/features/marketplace/components/PriceCard.tsx:21](src/features/marketplace/components/PriceCard.tsx:21) and [src/features/marketplace/components/ProductDetailSheet.tsx:45](src/features/marketplace/components/ProductDetailSheet.tsx:45). Failing to delete them silently bypasses the display formatter on those screens.

**Settings UI to mirror** [src/app/(protected)/(tabs)/profile.tsx:576-620](src/app/(protected)/(tabs)/profile.tsx:576) — the language-pill pattern. Add a sibling row inside the same `<Surface>` (don't open a new card). Recommended pill set:

- `'Auto'` (resets to detected; `setAuto()`)
- Top currencies derived from `COUNTRY_CURRENCY_MAP`'s most-frequent values: `'EUR'`, `'USD'`, `'GBP'` cover the existing `Currency` union; `'AED'`, `'SAR'`, `'CHF'`, `'CAD'` are sensible v1 additions matching Marqe's growth markets. Keep the list small (≤6 pills) per the language-toggle precedent.
- New i18n keys to add: `profile.currency`, `profile.currencyAuto`, `profile.currencyAutoHint` (per CURRENCY_AUDIT.md §5).

### Reversion command

```
git restore --source=HEAD --staged --worktree -- \
  src/app/_layout.tsx \
  src/lib/format.ts
git clean -fd -- \
  src/lib/currency/ \
  src/stores/useDisplayCurrency.ts \
  src/stores/useExchangeRates.ts \
  src/hooks/useExchangeRatesRefresh.ts \
  src/hooks/useFormatDisplayPrice.ts
```

(Then revert the changelog entry from PROJECT_AUDIT.md by hand if rolling all the way back.)

---

## Step H'.2.1 Changelog (2026-05-04) — Rate Source Swap (Frankfurter → jsdelivr currency-api)

Targeted fix on top of H'.2: replace Frankfurter (~30 currencies, no MENA/GCC) with the jsdelivr-hosted fawazahmed0/currency-api (~300 currencies including AED, SAR, QAR, KWD, MAD). H'.2's stores, hooks, formatter, and root-layout mount are unchanged — only the URL constants and the response-shape parser change.

### Why

H'.2's reconnaissance already flagged the gap: a UAE user with display currency `'AED'` would hit the no-rates fallback (display in product currency, no `≈` prefix). The original feature brief specifically called out Dubai → AED as the target case to close. jsdelivr's currency-api is the standard free, key-less, comprehensive coverage choice.

### Reconnaissance findings

- Probed both hosts directly. **Both reachable, identical 6,345-byte payloads** (`diff -q` reports no difference). Date returned: `2026-05-03`.
- Top-level keys: `["date", "eur"]`. Nested `eur` object holds 300 currency keys.
- **All previously missing MENA/GCC currencies present** with finite numeric rates (sample, EUR base, 2026-05-03):

| Code | Rate from EUR | Notes |
|---|---|---|
| AED | 4.306153 | UAE Dirham — the brief's target case |
| SAR | 4.396996 | Saudi Riyal |
| QAR | 4.272149 | Qatari Riyal |
| KWD | 0.36031 | Kuwaiti Dinar |
| MAD | 10.847448 | Moroccan Dirham |
| USD | 1.172539 | sanity check |
| GBP | 0.862002 | sanity check |
| JPY | 184.174195 | sanity check |
| EUR (self) | 1 | provider includes the base; H'.2's `[base]: 1` synthesis is now redundant-but-load-bearing |

### URLs

- **Primary** (jsdelivr CDN):
  `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json`
- **Fallback** (Cloudflare Pages mirror):
  `https://latest.currency-api.pages.dev/v1/currencies/eur.json`

`fetchExchangeRates()` tries the primary first; on any failure (network, non-2xx, malformed JSON), retries the fallback; if both fail, throws the *primary* error for diagnostic clarity. The store's `refresh()` catches and fail-softs by keeping the last cached snapshot — UX-visible behavior unchanged from H'.2.

### Adapter changes

- [src/lib/currency/constants.ts](src/lib/currency/constants.ts) —
  - `CURRENCY_API_URL` now points to jsdelivr.
  - **New** `CURRENCY_API_FALLBACK_URL` for the pages.dev mirror.
  - **New** `CURRENCY_API_BASE_KEY = 'eur'` — lowercase as it appears under the response's base-currency key. The parser uppercases for internal storage.
  - Doc block rewritten to enumerate the provider history (exchangerate.host → Frankfurter → jsdelivr) and the new response shape.
  - Other constants (`CURRENCY_CACHE_TTL_MS`, cache keys, version constants, `DEFAULT_CURRENCY`, `APPROX_PREFIX`) unchanged.

- [src/lib/currency/exchangeRates.ts](src/lib/currency/exchangeRates.ts) —
  - Internal `fetchFromURL(url)` helper that fetches, validates the `eur` object on the response, iterates entries, filters to finite numbers, and uppercases keys before storing.
  - Public `fetchExchangeRates()` becomes a primary→fallback wrapper around `fetchFromURL`.
  - `[base]: 1` synthesis preserved (the provider already returns it, but the explicit assignment defends against future shape drift and keeps the EUR-EUR fast path's `rates[productCurrency] !== undefined` guard load-bearing).
  - Removed the Frankfurter-specific `FrankfurterResponse` shape type; replaced with a generic `CurrencyApiResponse` index-signature type.
  - Removed the now-unused `DEFAULT_CURRENCY` import (the new code uses `CURRENCY_API_BASE_KEY.toUpperCase()` directly, which is unconditionally `'EUR'`).
  - `isStale()` unchanged — operates on `ExchangeRateSnapshot`, not on URLs.

### Failover behavior

The two-host CDN failover means a single-host outage (jsdelivr CDN node misconfigured, Cloudflare Pages region routing problem) doesn't break the feature. With both hosts down, the existing fail-soft path keeps the last cached snapshot — until that goes stale, at which point users see product-currency display with no `≈` prefix. Same fallback semantics as H'.2; just less likely to trigger.

### Verification

- `npx tsc --noEmit` exits 0.
- Zero new npm dependencies (still using the global `fetch`).
- No dev-only `console.log` shipped — verified the parser logic against the live response payload via a one-shot `node -e` script during reconnaissance, then removed all temp probes.
- No other H'.2 file modified — `useDisplayCurrency`, `useExchangeRates`, `useExchangeRatesRefresh`, `useFormatDisplayPrice`, `formatDisplayPrice`, and the root-layout mount are untouched.

### Manual sanity (deferred to user, runtime)

After reload + ~1–2 s for the network fetch, the dev console should show:

```js
useExchangeRates.getState().snapshot.rates['AED']
// → ~4.30 (was undefined under Frankfurter)
useExchangeRates.getState().snapshot.rates['SAR']
// → ~4.40
useExchangeRates.getState().snapshot.rates['KWD']
// → ~0.36
useExchangeRates.getState().snapshot.rates['EUR']
// → 1 (synthesis preserved)
useExchangeRates.getState().snapshot.base
// → 'EUR'
```

With display currency manually set to `'AED'`:

```js
useDisplayCurrency.getState().setManual('AED');
const fmt = useFormatDisplayPrice();   // inside a component
fmt(299, 'EUR')
// → "≈ AED 1 287,54" (or similar — depends on the day's rate)
```

### H'.3 unblock

H'.3 (call-site migration + Settings UI) can now proceed knowing the rate source covers every geography the country→currency map names — including Marqe's stated MENA/GCC growth markets. The recommended pill set in the H'.2 handoff (`Auto`, `EUR`, `USD`, `GBP`, `AED`, `SAR`, `CHF`) is fully supported.

### Reversion

A single revert restores Frankfurter:

```
git revert <H'.2.1-commit>
```

Reverts both files atomically. The H'.2 store/hook/formatter scaffolding is unaffected by the revert.

---

## Step H'.3 Changelog (2026-05-04) — Currency Migration + Settings Picker

End-to-end completion of Phase H'. Migrates 5 display call sites to `useFormatDisplayPrice`, deletes the 2 local-shadow `formatPrice` declarations the audit specifically warned about, and adds a 5-pill currency picker to the profile settings card mirroring the language-toggle pattern.

After H'.3: every display surface auto-renders in the user's local currency with the `≈` prefix when converted; the 4 transactional surfaces flagged by [CURRENCY_AUDIT.md §1](CURRENCY_AUDIT.md) keep showing what was actually charged. A Dubai user with display currency set to AED now sees a French (EUR) listing as `"≈ AED 1 287,00"` instead of `"299,00 €"`.

### Reconnaissance

- Re-confirmed the 5 migration sites and 4 transactional sites against [CURRENCY_AUDIT.md §1](CURRENCY_AUDIT.md). All file:line citations matched the audit table.
- Verified the language-toggle pattern at [src/app/(protected)/(tabs)/profile.tsx:576-619](src/app/(protected)/(tabs)/profile.tsx:576): `<Surface>` containing a single `<View style={styles.settingsRow}>`, label `<Text>`, and a `<View style={styles.pillRow}>` rendering `<Pressable>` pills. Pill styles defined locally (`styles.pill`, `styles.pillActive`, `styles.pillInactive`, `styles.pillText`, `styles.pillTextActive`, `styles.pillTextInactive`, `styles.pillIcon`).
- Confirmed both local-shadow declarations verbatim:
  - [src/features/marketplace/components/PriceCard.tsx:21-26](src/features/marketplace/components/PriceCard.tsx:21) — `function formatPrice(value, currency: Product['currency'])` hardcoding `'fr-FR'`.
  - [src/features/marketplace/components/ProductDetailSheet.tsx:45-50](src/features/marketplace/components/ProductDetailSheet.tsx:45) — identical shape.
- Verified the `Product` type usage in each file before deleting shadows: `PriceCard.tsx` keeps `Product` for prop types (`Product['currency']`, `Product['stock']`, `Product['shipping']`); `ProductDetailSheet.tsx` no longer needs `Product` after shadow deletion (kept `ProductAttribute` only).

### Migration table

| # | File:Line | Before | After |
|---|---|---|---|
| 1 | [src/components/feed/PriceCard.tsx:50](src/components/feed/PriceCard.tsx:50) | `formatPrice(amount, currency, i18n.language)` | `fmt(amount, currency)` (hook supplies locale) |
| 2 | [src/components/categories/RailProductCard.tsx:53](src/components/categories/RailProductCard.tsx:53) | `formatPrice(product.price, product.currency)` (hardcoded `'fr-FR'`) | `fmt(product.price, product.currency)` |
| 3 | [src/features/marketplace/components/PriceCard.tsx:63](src/features/marketplace/components/PriceCard.tsx:63) | `formatPrice(price, currency)` via local shadow | `fmt(price, currency)` |
| 4 | [src/features/marketplace/components/ProductDetailSheet.tsx:315](src/features/marketplace/components/ProductDetailSheet.tsx:315) | `formatPrice(product.price, product.currency)` via local shadow | `fmt(product.price, product.currency)` |
| 5 | [src/features/marketplace/components/SellerProductCard.tsx:44-47,73](src/features/marketplace/components/SellerProductCard.tsx:44) | inline `Intl.NumberFormat('fr-FR', ...)` → `formatted` variable rendered in `<Text>` | `fmt(product.price, product.currency)` rendered directly |

Each migration is a 3–4 line change: import the hook, declare `const fmt = useFormatDisplayPrice()` alongside other hooks, swap the call. The `formatPrice` and `formatDistance` imports from `@/lib/format` were updated per file (kept where another exported helper is still used; removed entirely from the feed `PriceCard` since it imported only `formatPrice`).

### Deleted shadows

- [src/features/marketplace/components/PriceCard.tsx:21-26](src/features/marketplace/components/PriceCard.tsx:21) — entire local function block removed.
- [src/features/marketplace/components/ProductDetailSheet.tsx:45-50](src/features/marketplace/components/ProductDetailSheet.tsx:45) — entire local function block removed; also dropped now-unused `Product` from the import (kept `ProductAttribute`).

Post-deletion verification:

```bash
rg "function formatPrice" src/
# → src/lib/format.ts:35 only (the canonical)

rg "const formatPrice = " src/
# → no matches

rg "formatPrice\(" src/
# → src/lib/format.ts (4 internal uses inside formatDisplayPrice + the
#                     canonical export)
# → src/features/marketplace/components/ProductActionRail.tsx:61
#   (the share string — preserved per audit, transactional semantics)
```

### Transactional sites preserved (verified untouched)

`git diff --stat HEAD` confirms zero modifications to:

- [src/features/marketplace/components/ProductActionRail.tsx](src/features/marketplace/components/ProductActionRail.tsx) (share string, line 61)
- [src/app/(protected)/conversation/[id].tsx](src/app/(protected)/conversation/[id].tsx) (offer message, line 168 — latent EUR-hardcode bug, separate concern)
- [src/lib/format.ts:formatOrderAmount](src/app/(protected)/(tabs)/profile.tsx:60) is inside `profile.tsx` which **was** modified, but only to mount the picker + add a divider style; the inline `formatOrderAmount` at line 60 is unchanged. (verified via the `git diff` excerpt — no lines around the order-amount formatter appear in the diff).

### CurrencyPicker design

[src/components/profile/CurrencyPicker.tsx](src/components/profile/CurrencyPicker.tsx) — new self-contained component, ~145 lines. Renders:

```
"Devise" / "Currency" label
[Auto · EUR] [EUR] [USD] [GBP] [AED]    ← horizontal ScrollView
```

- Pill primitive: mirrors the language-toggle's `<Pressable>` + theme-key styling exactly. Same paddings, same radii, same active/inactive treatment (filled coral active, outlined glass inactive), same checkmark on active. No new pill primitive introduced.
- Active state logic:
  - `Auto` pill is active when `source === 'auto'`. Label shows `"Auto · {detectedCurrency}"` so users see what was detected at a glance.
  - Each currency pill is active when `source === 'manual' && currency === code`.
  - Tapping `Auto` calls `setAuto()` which re-runs the 3-tier detection inside `useDisplayCurrency` and clears the manual override.
  - Tapping a currency pill calls `setManual(code)` which sets `source: 'manual'`.
- Layout: outer `<View>` with `gap: spacing.sm` (label + scroll), inner `<ScrollView horizontal>` with `gap: spacing.xs` between pills. ScrollView (per brief) over flex-wrap (per language toggle) because 5 pills don't fit inline on narrow phones.
- Currencies in the quick-pick set: `EUR / USD / GBP / AED`. Covers the dominant audiences (EU, transatlantic, Gulf) without ballooning the UI. A "More currencies..." sheet for the remaining ~290 supported codes is v2 polish.
- Accessibility: each pill has `accessibilityRole="button"` and `accessibilityState={{ selected: isActive }}`.

### Profile screen wire-up

[src/app/(protected)/(tabs)/profile.tsx](src/app/(protected)/(tabs)/profile.tsx) changes:

1. Added `import CurrencyPicker from '@/components/profile/CurrencyPicker'` (line 32).
2. Inside the existing settings `<Surface>` (line 580+), added a hairline divider then `<CurrencyPicker />` as a sibling row to the language toggle (line 620-621).
3. Added `settingsDivider` style: `{ marginVertical: spacing.md, height: StyleSheet.hairlineWidth, backgroundColor: colors.border }` (line 871-875). Visual separation between language and currency rows.

The language toggle itself is unchanged — including its `flexWrap: 'wrap'` pillRow, since 2 pills always fit inline.

### i18n keys

Added under `profile.*` in both [src/i18n/locales/fr.json](src/i18n/locales/fr.json) and [src/i18n/locales/en.json](src/i18n/locales/en.json):

- `currencyLabel`: `"Devise"` / `"Currency"`
- `currencyAuto`: `"Auto"` / `"Auto"` (identical — universal abbreviation)

The currency codes (EUR/USD/GBP/AED) render directly without translation — they're universal ISO 4217 codes.

### Verification

- `npx tsc --noEmit` exits 0.
- Zero new npm dependencies.
- Grep confirms exactly one `formatPrice` function declaration repo-wide (the canonical at [src/lib/format.ts:35](src/lib/format.ts:35)).
- `git diff --stat HEAD` summary: 11 files changed, +295/-31. Matches expectations: 5 migration files + 2 i18n locales + 1 profile.tsx (picker mount) + 1 PROJECT_AUDIT.md (this changelog) + 1 new CurrencyPicker.tsx + 1 lib/format.ts (untouched in H'.3 — just listed because of staged H'.2 changes).

### Manual sanity (deferred to user, runtime)

- Open profile → settings card now shows two rows: Langue (existing) and Devise (new) separated by a hairline.
- Tap the EUR / USD / GBP / AED pills → pills toggle visually, every price across the app re-renders with the new currency.
- Tap "Auto · …" pill → reverts to detection. On a French simulator the label updates to "Auto · EUR"; on a UAE simulator it should read "Auto · AED".
- On the marketplace feed, a French (EUR) seller's listing displays as:
  - `"299,00 €"` when display = EUR (fast path, no `≈`).
  - `"≈ AED 1 287,00"` (or similar — depends on day's rate) when display = AED.
- Order history rows, conversation offer bubbles, and share strings continue to show product currency unchanged — confirming transactional record semantics preserved per audit.

### Phase H' end-to-end summary

| Step | Date | Outcome |
|---|---|---|
| H'.1 | 2026-05-04 | Read-only audit. Produced [CURRENCY_AUDIT.md](CURRENCY_AUDIT.md) — 12 sections enumerating call sites, locale-detection plan, persistence pattern reference, edge cases, migration risks. |
| H'.2 | 2026-05-04 | Foundation. Constants, country-currency map (249 codes), rate service, two Zustand stores, AppState-aware refresh hook, formatter helper, formatter hook, root-layout mount. No call site migration. |
| H'.2.1 | 2026-05-04 | Provider swap. Frankfurter (~30 currencies, no MENA/GCC) → jsdelivr-hosted fawazahmed0/currency-api (~300 currencies including AED, SAR, QAR, KWD, MAD). Two-host CDN failover for resilience. |
| H'.3 | 2026-05-04 | Migration + UI. 5 display sites migrated; 2 local shadows deleted; 4 transactional sites preserved; CurrencyPicker added to profile settings card; i18n keys added (FR + EN). |

### Known follow-ups (out of H' scope)

- **Latent EUR-hardcode at [src/app/(protected)/conversation/[id].tsx:168](src/app/(protected)/conversation/[id].tsx:168)** — the offer-message bubble hardcodes `'EUR'` regardless of the conversation's product currency. Pre-existing bug flagged by [CURRENCY_AUDIT.md §1 row 9](CURRENCY_AUDIT.md). Phase F territory (chat/messaging cleanup), not H'.
- **"More currencies…" sheet** for the remaining ~290 supported codes. v2 polish — defer until telemetry shows users hitting the gap.
- **Stripe-checkout currency clarity** — the wallet correctly settles in product currency, and the marketplace correctly displays the converted estimate. A small UX hint near the buy CTA ("You'll be charged 299,00 €") could pre-empt user confusion when the converted display estimate differs from the eventual charge. Phase F polish.
- **Top-N currencies derived from telemetry** — the quick-pick set (EUR/USD/GBP/AED) is a guess. Once telemetry is in place, refine to the actual most-used `setManual` codes.
- **`'Currency'` Display type widening** — H'.2's `useDisplayCurrency.currency` is `string`, while [src/features/marketplace/types/product.ts:3](src/features/marketplace/types/product.ts:3) defines `Currency = 'EUR' | 'USD' | 'GBP'` as the *product* currency union. They're intentionally different; if H' is ever extended to allow non-EUR product listings (Feature B), the listing/wallet path needs a separate widening — not just relabelling the display union.

### Reversion command

```
git restore --source=HEAD --staged --worktree -- \
  src/components/feed/PriceCard.tsx \
  src/components/categories/RailProductCard.tsx \
  src/features/marketplace/components/PriceCard.tsx \
  src/features/marketplace/components/ProductDetailSheet.tsx \
  src/features/marketplace/components/SellerProductCard.tsx \
  src/app/\(protected\)/\(tabs\)/profile.tsx \
  src/i18n/locales/fr.json \
  src/i18n/locales/en.json
git clean -fd -- src/components/profile/
```

(Then revert this changelog entry from PROJECT_AUDIT.md by hand if rolling all the way back. The H'.2 / H'.2.1 foundation is unaffected.)

---

## Step H.2 Changelog (2026-05-04) — Subscriptions Schema + is_pro Sync Trigger

Schema-only step. Adds the `subscriptions` table mirroring Stripe's subscription model, two supplementary indexes, a `SECURITY DEFINER` trigger function maintaining the denormalized `sellers.is_pro` flag, two triggers wiring it (`BEFORE INSERT OR UPDATE` for the is_pro sync + `updated_at` touch, `AFTER DELETE` for defensive cleanup), one RLS policy (own-subscription SELECT), and the table-level `GRANT SELECT` to `authenticated`. No TypeScript / source-code changes. Type regeneration required after apply — H.3 depends on it.

> **Audit referenced:** [PRO_AUDIT.md](PRO_AUDIT.md) — recommended schema direction §5 (denormalized `is_pro` synced by trigger; `subscriptions` table mirrors Stripe's enum verbatim; webhook-only writes via service_role).

### Reconnaissance findings (re-confirmed before authoring)

- **C.2 / D.2 trigger pattern is the verbatim template.** [supabase/migrations/20260518_follows_schema_and_counters.sql:158-184](supabase/migrations/20260518_follows_schema_and_counters.sql#L158) (`handle_follow_change()`) and [supabase/migrations/20260520_comments_schema.sql:190-210](supabase/migrations/20260520_comments_schema.sql#L190) (`handle_comment_change()`) both use `language plpgsql` + `security definer` + `set search_path = public, pg_catalog` + `if (TG_OP = 'INSERT') then ... elsif (TG_OP = 'DELETE') then ... return null; end if;` + a `DROP TRIGGER IF EXISTS` guard before each `CREATE TRIGGER`. H.2 mirrors this byte-for-byte, with one shape difference: the new function additionally handles `UPDATE` (since subscription status changes are the dominant case, not deletes) and modifies `NEW.updated_at` — which forces the INSERT/UPDATE trigger to be `BEFORE` (the only timing where a row trigger may return a modified `NEW`).
- **`sellers.is_pro` confirmed** — `boolean not null default false` declared at [supabase/migrations/20260501_initial_marketplace_schema.sql:26](supabase/migrations/20260501_initial_marketplace_schema.sql#L26); generated type `Database['public']['Tables']['sellers']['Row']['is_pro']: boolean` at [src/types/supabase.ts:451](src/types/supabase.ts#L451). The trigger writes this column; no DDL change to `sellers` is required.
- **B.1.5 grant constraint reaffirmed.** [supabase/migrations/20260515_tighten_sellers_update_grants.sql:53-64](supabase/migrations/20260515_tighten_sellers_update_grants.sql#L53) keeps `is_pro` (and the dormant `stripe_*` columns) outside the `authenticated` UPDATE allowlist. The trigger's `SECURITY DEFINER` bypasses this by design — same lineage as C.2 / D.2. No edits to B.1.5 are needed and none are made.
- **`uuid_generate_v4()` vs `gen_random_uuid()`.** Project convention is `uuid_generate_v4()` (uuid-ossp extension enabled at [20260501_initial_marketplace_schema.sql:16](supabase/migrations/20260501_initial_marketplace_schema.sql#L16)). All eight existing tables (`sellers`, `products`, `conversations`, `messages`, `orders`, `push_tokens`, `comments`, `follows`'s composite PK aside) use `uuid_generate_v4()`. H.2 matches.
- **Migration filename convention.** `YYYYMMDD_description.sql` — latest existing is `20260521_increment_share_count_rpc.sql`. New file is `20260522_subscriptions_schema_and_trigger.sql` (next lexical slot, today's calendar date 2026-05-04 lags behind the lexical sequence by intent — the convention prioritizes apply ordering).
- **Dormant `stripe_*` columns on `sellers` confirmed untouched.** Per PRO_AUDIT.md §2.4, `stripe_account_id` / `stripe_charges_enabled` / `stripe_payouts_enabled` ([20260511_seller_stripe.sql:1-4](supabase/migrations/20260511_seller_stripe.sql#L1)) are reserved for a future Stripe Connect integration and are out of Phase H scope. H.2 does not reference them.

### Migration

**File:** [supabase/migrations/20260522_subscriptions_schema_and_trigger.sql](supabase/migrations/20260522_subscriptions_schema_and_trigger.sql)

**Schema additions in six steps (all wrapped in a single `BEGIN; ... COMMIT;`):**

| # | Action | Statement |
| --- | --- | --- |
| 1 | `subscriptions` table | `create table if not exists public.subscriptions ( id uuid primary key default uuid_generate_v4(), seller_id uuid not null unique references public.sellers(id) on delete cascade, stripe_subscription_id text not null unique, stripe_customer_id text not null, stripe_price_id text not null, status text not null, current_period_start timestamptz, current_period_end timestamptz, cancel_at_period_end boolean not null default false, canceled_at timestamptz, trial_end timestamptz, created_at timestamptz not null default now(), updated_at timestamptz, constraint subscriptions_status_valid check (status in ('active','trialing','past_due','canceled','incomplete','incomplete_expired','unpaid','paused')) );` — `seller_id UNIQUE` enforces 1:1 (one Pro sub per seller); CASCADE on FK composes cleanly with B.4's `delete_my_account` chain. |
| 2 | Supplementary indexes (2) | `create index if not exists subscriptions_stripe_customer_id_idx on public.subscriptions (stripe_customer_id);` (webhook customer-side lookups) and `create index if not exists subscriptions_status_idx on public.subscriptions (status);` (admin-dashboard scans). The implicit unique indexes on `seller_id` + `stripe_subscription_id` cover the other access patterns. |
| 3 | Trigger function | `create or replace function public.handle_subscription_change() returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$ ... $$;` — `INSERT/UPDATE` branch: writes `sellers[NEW.seller_id].is_pro` based on `NEW.status IN ('active','trialing')`; on `UPDATE` additionally bumps `NEW.updated_at := now()`. `DELETE` branch: defensively flips `is_pro = false` on `OLD.seller_id`. |
| 4 | Trigger wiring (2) | `drop trigger if exists subscriptions_change_trigger on public.subscriptions; create trigger subscriptions_change_trigger before insert or update on public.subscriptions for each row execute function public.handle_subscription_change();` — `BEFORE` is required so the function may return a modified `NEW` (touching `updated_at`). Plus `drop trigger if exists subscriptions_delete_trigger on public.subscriptions; create trigger subscriptions_delete_trigger after delete on public.subscriptions for each row execute function public.handle_subscription_change();` — same function, separate `AFTER DELETE` wiring (BEFORE-row triggers cannot return a modified row on DELETE in a useful way). |
| 5 | RLS policy (1) | `alter table public.subscriptions enable row level security;` then `drop policy if exists "subscriptions_self_select" on public.subscriptions; create policy "subscriptions_self_select" on public.subscriptions for select to authenticated using (seller_id in (select id from public.sellers where user_id = auth.uid()));` — own-subscription SELECT only. **No INSERT/UPDATE/DELETE policies.** Webhooks write via `service_role` which bypasses RLS by design. |
| 6 | Table-level grant | `grant select on public.subscriptions to authenticated;` — SELECT only. No grant to `anon`, no INSERT/UPDATE/DELETE to anyone. Defense-in-depth: even if a future RLS policy were accidentally added that allowed a write, the missing grant would still block the JS client. |

### Trigger SECURITY DEFINER rationale (cite B.1.5 + C.2 / D.2 lineage)

After B.1.5 ([20260515_tighten_sellers_update_grants.sql](supabase/migrations/20260515_tighten_sellers_update_grants.sql)), the `authenticated` role has no UPDATE grant on `sellers.is_pro` (column-level allowlist excludes it deliberately). For the trigger function to UPDATE that column on every subscription INSERT / UPDATE / DELETE, it must be `SECURITY DEFINER` so it runs with the migration owner's rights instead of the calling user's rights — same justification as the C.2 follows-counter (`handle_follow_change`) and D.2 comments-counter (`handle_comment_change`) triggers. The function additionally pins `set search_path = public, pg_catalog` to defeat the classic SECURITY DEFINER hijack vector — without this, a malicious user could create a `public.sellers` shadow object in their own schema and trick the trigger into resolving it. Both clauses are required; neither is optional.

### is_pro v1 policy — strict

`sellers.is_pro = true` ONLY when `subscriptions.status IN ('active', 'trialing')`. Every other status flips the flag false:

| Status | is_pro | Notes |
| --- | --- | --- |
| `active` | true | Normal paying state. |
| `trialing` | true | Free-trial period (if H.9 enables a trial). |
| `past_due` | **false** | Stripe is retrying a failed payment. **Strict v1**: Pro access is revoked immediately. If support tickets show this is too aggressive (e.g., 24h grace during normal card-renewal failures), soften by extending the `IN (...)` set or by introducing a `grace_until` column. Not a v1 concern. |
| `canceled` | false | Subscription has ended. |
| `incomplete` | false | Initial payment failed and the subscription has not been activated yet. |
| `incomplete_expired` | false | Initial payment never succeeded; subscription expired before activation. |
| `unpaid` | false | All retries exhausted. |
| `paused` | false | Stripe-paused subscription (rare; admin-initiated). |

The `cancel_at_period_end = true` + `status = 'active'` combination keeps `is_pro = true` until the period rolls over and Stripe sends `customer.subscription.deleted` (or moves the row to `canceled`). UI should display "Plan canceled — access until {current_period_end}" in this state — H.10 surface.

### Four-scenario walk-through (informal proof)

| # | Trigger | Initial state | Webhook event | Trigger outcome |
| --- | --- | --- | --- | --- |
| **(a)** | `subscriptions_change_trigger` (BEFORE INSERT) | No row exists. | `customer.subscription.created` upserts a row with `status = 'active'`. | `NEW.status = 'active'` → matches `IN ('active','trialing')` → `update sellers set is_pro = true where id = NEW.seller_id`. `updated_at` not touched on INSERT (the explicit branch only fires on UPDATE). Row is then inserted. ProBadge surfaces in mobile clients on next read. |
| **(b)** | `subscriptions_change_trigger` (BEFORE UPDATE) | Row exists with `status = 'active'`. | `invoice.payment_failed` → handler updates `status = 'past_due'`. | `NEW.status = 'past_due'` → not in the active set → `update sellers set is_pro = false where id = NEW.seller_id`. `NEW.updated_at := now()`. Row's new state is then committed. The mobile client's `useMySeller` query refetches on next focus and sees `isPro = false`. The ProBadge disappears; the action-rail Buy button reverts to "Contact seller" branch ([src/features/marketplace/components/ProductActionRail.tsx:83](src/features/marketplace/components/ProductActionRail.tsx#L83)). |
| **(c)** | `subscriptions_change_trigger` (BEFORE UPDATE) | Row exists with `status = 'past_due'`. | `invoice.payment_succeeded` after card-recovery → handler updates `status = 'active'`. | `NEW.status = 'active'` → matches active set → `update sellers set is_pro = true where id = NEW.seller_id`. `NEW.updated_at := now()`. Pro state restored. |
| **(d)** | `subscriptions_delete_trigger` (AFTER DELETE) | Row exists. | Hard `DELETE FROM subscriptions WHERE ...` (rare; Stripe-side normally soft-cancels via status). | `update sellers set is_pro = false where id = OLD.seller_id`. Returns `OLD`. Sellers row is now `is_pro = false`; the deleted subscription row is gone. Defensive: covers the case where a CASCADE from `sellers.delete` (B.4 chain) fires — the AFTER DELETE branch runs against the (already-deleting) seller row, which is a harmless no-op since the seller is going away in the same transaction. |

### Disallowed (out of scope, deliberately deferred)

- **`subscription_events` audit-trail table** (PRO_AUDIT.md §5.3). Adds complexity without v1 value. Phase F or H.13 territory if support ever needs the audit log.
- **Edits to B.1.5's column-level UPDATE grants on `sellers`.** Trigger's `SECURITY DEFINER` bypasses the grants by design. Adding `is_pro` to the user-writable allowlist would re-open the self-elevation gap that B.1.5 closed.
- **Touching the dormant `stripe_account_id` / `stripe_charges_enabled` / `stripe_payouts_enabled` columns** ([20260511_seller_stripe.sql:1-4](supabase/migrations/20260511_seller_stripe.sql#L1)). Reserved for a future Stripe Connect integration (marketplace seller payouts). Out of Phase H scope.
- **An `application_fee_amount` write path** in the existing `create-checkout-session` Edge Function ([supabase/functions/create-checkout-session/index.ts:47-67](supabase/functions/create-checkout-session/index.ts#L47)). The Pro-tier reduced-fee feature (H.13(a)) is downstream of this migration and may or may not require Stripe Connect; deferred either way.

### Composition with B.4's `delete_my_account` RPC

The cascade chain in [20260517_delete_my_account_rpc.sql:11-28](supabase/migrations/20260517_delete_my_account_rpc.sql#L11) gains one new CASCADE-direct path via `subscriptions`:

```
auth.users → sellers (CASCADE on user_id)
           → subscriptions (CASCADE on seller_id)   -- NEW
```

No edit to the B.4 RPC is required. As the cascade unwinds:

1. `delete from auth.users where id = v_user_id` cascades to the deleted user's `sellers` row.
2. The `sellers` delete cascades to the deleted user's `subscriptions` row.
3. The `subscriptions_delete_trigger` (AFTER DELETE) fires `handle_subscription_change()`, which tries to flip `is_pro = false` on the (already-deleting) seller row. This is a harmless same-transaction write on a row that's about to vanish.

Stripe-side cleanup is the webhook's job, not this trigger's. When a seller deletes their account, the H.12 webhook handler (or H.13 admin path) should ALSO call `stripe.subscriptions.cancel()` for the seller's sub. The subsequent `customer.subscription.deleted` event arrives at the webhook with no DB-side row to update (the CASCADE already removed it), and the upsert no-ops against the missing FK. Acceptable.

### Production apply

```
npm run db:status                                                       # confirm 20260522 is pending
npm run db:push                                                         # applies the migration
npm run gen:types                                                       # REQUIRED — regenerates src/types/supabase.ts
git add src/types/supabase.ts && git commit -m "chore(types): generate supabase types after H.2"
```

Both commands are safe to re-run; the migration is idempotent (`IF NOT EXISTS` / `OR REPLACE` / `DROP IF EXISTS` on every DDL) and `gen:types` overwrites the types file deterministically.

### Type regen — REQUIRED before H.3

Unlike B.1.5 / D.1.5 (grant-only changes do not surface in generated types), this migration adds:

- A new public-schema table → `Database['public']['Tables']['subscriptions']` with `Row`, `Insert`, `Update`, `Relationships` (the FK to `sellers`).

`sellers.is_pro` is unchanged on the wire (still `boolean not null default false`), so the existing `Database['public']['Tables']['sellers']['Row']['is_pro']: boolean` type stays correct — the trigger maintains the underlying column without the type shape moving.

H.3 implements `useMySubscription()` reading from `from('subscriptions').select(...).eq('seller_id', mySellerId).maybeSingle()` and a thin `useIsPro()` reading from `useMySeller().data?.isPro`. Without `gen:types`, `from('subscriptions')` would require an `as never` escape-hatch cast (the same pattern B.4 used for `'delete_my_account' as never` while types were stale). To keep H.3 cleanly typed, run `gen:types` between H.2 apply and H.3 implementation.

### Verification (this step)

- `npx tsc --noEmit` → **exit 0**. No source changes; the migration file is SQL-only.
- Migration SQL syntactically inspected:
  - Balanced `BEGIN; ... COMMIT;` (single transaction wrapper).
  - Every `CREATE` has matching `IF NOT EXISTS` (table, indexes) or `OR REPLACE` (function) or `DROP ... IF EXISTS` + `CREATE` (triggers, policy). Re-running is a no-op.
  - No `GRANT ... TO anon` or `GRANT ... TO public` anywhere. Only `GRANT SELECT ON public.subscriptions TO authenticated`. **No INSERT/UPDATE/DELETE grants** to any role — webhooks bypass via service_role.
  - Trigger function is `SECURITY DEFINER` with `SET search_path = public, pg_catalog` — both required, both present.
  - `CHECK (status IN (...))` enumerates all 8 Stripe statuses verbatim and is named (`subscriptions_status_valid`) so a future drop/replace is unambiguous.
  - No `INSERT/UPDATE/DELETE` policy on `subscriptions` for `authenticated`. The single SELECT policy `"subscriptions_self_select"` is gated by the `sellers.user_id = auth.uid()` subquery.
  - The dormant `stripe_*` columns on `sellers` are NOT touched.
  - The optional `subscription_events` audit-trail table is NOT created (deferred).
  - Inline rollback SQL block is a complete reverse of the forward migration (revokes grant → drops policy → drops triggers → drops function → drops indexes → drops table) plus a documented manual is_pro restoration note.
- Local apply is OPTIONAL per Op.1's STOP boundary. The user runs production apply explicitly.

### Reversion

```
git revert <H.2 commit>
```

This removes [supabase/migrations/20260522_subscriptions_schema_and_trigger.sql](supabase/migrations/20260522_subscriptions_schema_and_trigger.sql) from source control. **If the migration was already applied to a database, `git revert` does NOT undo applied DDL** — the rollback SQL block at the top of the migration file must be run manually against each environment:

```sql
begin;
  revoke select                                       on public.subscriptions from authenticated;
  drop policy   if exists "subscriptions_self_select" on public.subscriptions;
  drop trigger  if exists subscriptions_delete_trigger on public.subscriptions;
  drop trigger  if exists subscriptions_change_trigger on public.subscriptions;
  drop function if exists public.handle_subscription_change();
  drop index    if exists public.subscriptions_status_idx;
  drop index    if exists public.subscriptions_stripe_customer_id_idx;
  drop table    if exists public.subscriptions;
commit;
```

**Note: the rollback above does NOT restore `sellers.is_pro` for any seller whose flag the trigger flipped while this migration was live.** Once the subscriptions table is gone, no future event can flip the flag, but the existing values reflect the trigger's last decision. To wipe Pro state cleanly post-rollback:

```sql
update public.sellers set is_pro = false where is_pro = true;
```

Then admins can manually re-flip whoever should legitimately be Pro (which, before H.2 lands, is the seed sellers in the initial migration only). After running, also `npm run gen:types` to remove `Database['public']['Tables']['subscriptions']` from the generated types.

### H.3 handoff

H.3 is unblocked once the migration is applied and types are regenerated. The hooks/services to write next:

- **`useMySubscription()`** — new hook in `src/features/marketplace/hooks/`. Reads `from('subscriptions').select('*').eq('seller_id', mySellerId).maybeSingle()`. Query key: `['marketplace', 'my-subscription']`. Joined with `useMySeller` so `seller_id` is resolved before fetch. Returns `{ status, current_period_end, cancel_at_period_end, ... } | null`. Used by H.10 (web dashboard) and by the H.4 mobile profile hero banner to show plan state.
- **`useIsPro()`** — thin wrapper over `useMySeller().data?.isPro ?? false`. The trigger maintains the flag on every status change, so the seller-side read is the source of truth at the JS layer. No need to derive from subscription status client-side.
- **Listing-cap enforcement (H.3 core feature)** — at sell-flow submit time ([src/app/(protected)/(tabs)/newPost.tsx](src/app/(protected)/(tabs)/newPost.tsx)), gate the create mutation by reading `useIsPro()` AND `useMyProducts().data?.length`. If non-Pro AND count >= 10, throw a structured `ListingCapReachedError` and surface a CTA-bearing modal that deep-links to the web upgrade page. The existing `useCreateProduct` mutation in [src/features/marketplace/hooks/useCreateProduct.ts](src/features/marketplace/hooks/useCreateProduct.ts) is the natural integration point.
- **No UI work in H.3 beyond the cap modal.** The strategic CTA placements (own-profile hero banner, sell-flow header banner) are H.4's scope per PRO_AUDIT.md §6.2.
- **Webhook side (H.12, web codebase) is pre-unblocked**: the schema is in place for service-role upserts. H.12 imports `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`, handles `customer.subscription.{created,updated,deleted}` + `invoice.payment_{succeeded,failed}`, and upserts on `stripe_subscription_id` (the unique index makes this idempotent). The DB trigger then syncs `is_pro` automatically — no client-side `is_pro` write code in the web codebase.

---

## Step H.3 Changelog (2026-05-04) — Pro State Hooks + Listing Cap

JS-only step. Ships the mobile-side data layer and create-product gate for the Pro subscription system. Six new files (one constant module, one error module, four hooks), seven modifications (sell.ts cap check, create/delete mutations' invalidation wiring, newPost catch branch, two locale files, the marketplace barrel). No new dependencies. No schema or migration changes.

> **Audit referenced:** [PRO_AUDIT.md](PRO_AUDIT.md) §6 (CTA strategy) for the cap-modal placement; §10 open-question 1 for the cap-value placeholder. The H.2 [subscriptions migration](supabase/migrations/20260522_subscriptions_schema_and_trigger.sql) is the prerequisite for the trigger-maintained `is_pro` flag this step's hooks read.

### Reconnaissance findings (re-confirmed before authoring)

- **Type regen confirmed.** [src/types/supabase.ts:544](src/types/supabase.ts#L544) now declares `Database['public']['Tables']['subscriptions']` with `Row`, `Insert`, `Update`, and the `subscriptions_seller_id_fkey` `Relationships` entry at line 592. The user ran `npm run db:push` + `npm run gen:types` between H.2 apply and H.3. H.3 imports the regenerated `Database` type directly — no `as never` / `as any` escape hatches.
- **`useMySeller(enabled: boolean)` shape.** [src/features/marketplace/hooks/useMySeller.ts:6](src/features/marketplace/hooks/useMySeller.ts#L6) requires an explicit `enabled` boolean; returns `UseQueryResult<SellerProfile | null, Error>`. The `SellerProfile` type ([src/features/marketplace/services/sellers.ts:5-24](src/features/marketplace/services/sellers.ts#L5)) is camelCased — `isPro: boolean` (not `is_pro`). Hooks that depend on `useMySeller` therefore read `seller.data?.isPro`, not `seller.data?.is_pro`.
- **No pre-existing `useMyProductsCount`.** [src/features/marketplace/hooks/useMyProducts.ts](src/features/marketplace/hooks/useMyProducts.ts) fetches the full `Product[]` via `listMyProducts()` — fine for the profile grid render but wasteful for cap-check (we only need the count). H.3 ships a separate count-only hook using PostgREST's `select('id', { count: 'exact', head: true })` HEAD trick — zero row payload, just the `Content-Range` count header.
- **`createProduct` shape ex-G.8.** [src/features/marketplace/services/sell.ts:84-142](src/features/marketplace/services/sell.ts#L84) sequenced `getCurrentUserOrThrow → uploadProductMedia → ensureSellerForCurrentUser → INSERT`. H.3 reorders to `getCurrentUserOrThrow → ensureSellerForCurrentUser → cap-check → uploadProductMedia → INSERT` — the upload was previously first because the original code didn't need seller_id earlier; reordering is semantically harmless (the upload uses `auth.user.id` for the storage path, not seller_id) and avoids wasting a storage write on a rejected create. Pure improvement, no behavior change for the success path.
- **Auth gating convention.** [src/app/(protected)/(tabs)/profile.tsx:192-196](src/app/(protected)/(tabs)/profile.tsx#L192) shows the established pattern: `useRequireAuth() → isAuthenticated → useMySeller(isAuthenticated)`. H.3's `useIsPro` / `useMyProductsCount` / `useMySubscription` read `useAuthStore((s) => s.isAuthenticated)` directly inside the hook so call sites don't have to thread the boolean through. The hooks remain "pure" in the sense the spec intends — no `Alert.alert` or routing inside them, no implicit redirects — but they do read the auth store so the underlying queries' `enabled` flag is correct.
- **`AuthRequiredError` / `StripeNotConfiguredError` precedent.** Both exist in `services/products.ts` and `services/orders.ts` respectively, both extend `Error`, both call `Object.setPrototypeOf(this, X.prototype)` for the Hermes / V8 prototype-fix. H.3's `ListingCapReachedError` follows the same pattern with one extra field (`cap`).
- **newPost submit handler.** [src/app/(protected)/(tabs)/newPost.tsx:280-300](src/app/(protected)/(tabs)/newPost.tsx#L280) — `createListing(payload, { onSuccess, onError })`. The existing `onError` is a single `Alert.alert(t('sell.fail'), err.message || t('common.errorGeneric'))`. H.3 adds a `if (err instanceof ListingCapReachedError) { ... return; }` branch above the generic alert; the success path and the form-reset logic are unchanged.
- **No `constants.ts` / `errors.ts` under `src/features/marketplace/`.** Both files are new in H.3.

### Files added (6)

| Path | Purpose |
| --- | --- |
| [src/features/marketplace/constants.ts](src/features/marketplace/constants.ts) | Single-export module: `FREE_TIER_LISTING_CAP = 10`. PRO_AUDIT.md §10 open-question 1 placeholder; user-decided final value lands as a one-line edit here. |
| [src/features/marketplace/errors.ts](src/features/marketplace/errors.ts) | `ListingCapReachedError extends Error` with `cap: number` field and `Object.setPrototypeOf` prototype-fix. Mirrors `AuthRequiredError` / `StripeNotConfiguredError`. |
| [src/features/marketplace/hooks/useMySubscription.ts](src/features/marketplace/hooks/useMySubscription.ts) | Reads `from('subscriptions').select('*').eq('seller_id', mySellerId).maybeSingle()`. Returns `SubscriptionRow \| null`. Key: `['marketplace', 'my-subscription', sellerId]`. Stale 5min. Exports the `SubscriptionRow` type alias for downstream consumers (H.10 web dashboard). |
| [src/features/marketplace/hooks/useIsPro.ts](src/features/marketplace/hooks/useIsPro.ts) | `useAuthStore → useMySeller(isAuthenticated) → seller.data?.isPro ?? false`. Two lines of real logic; the H.2 trigger does the work. |
| [src/features/marketplace/hooks/useMyProductsCount.ts](src/features/marketplace/hooks/useMyProductsCount.ts) | HEAD-only count query for cap-state aggregation. Key: `['marketplace', 'my-products-count', sellerId]`. Stale 30s. Exported `MY_PRODUCTS_COUNT_KEY` for invalidation by sibling mutations. |
| [src/features/marketplace/hooks/useListingCap.ts](src/features/marketplace/hooks/useListingCap.ts) | Pure aggregator: `useIsPro` + `useMyProductsCount` → `{ isPro, cap, used, remaining, isAtCap, loading }`. The advisory client-side state H.4 reads for banner / "X / 10 used" surfaces. |

### Files modified (7)

| Path | Change |
| --- | --- |
| [src/features/marketplace/services/sell.ts](src/features/marketplace/services/sell.ts) | (1) Two new imports: `FREE_TIER_LISTING_CAP`, `ListingCapReachedError`. (2) `createProduct` reordered: ensureSeller → is_pro lookup → conditional HEAD-count gate → throw `ListingCapReachedError` when over cap → upload → INSERT. The non-Pro path adds **two** server reads (single-row is_pro select + HEAD-count); Pro path adds **one** (just the is_pro select, the count is short-circuited). |
| [src/features/marketplace/hooks/useCreateProduct.ts](src/features/marketplace/hooks/useCreateProduct.ts) | `onSuccess` now also invalidates `MY_PRODUCTS_KEY` and `MY_PRODUCTS_COUNT_KEY` so `useListingCap.used / .remaining` refreshes immediately after a successful create. |
| [src/features/marketplace/hooks/useDeleteProduct.ts](src/features/marketplace/hooks/useDeleteProduct.ts) | `onSuccess` now also invalidates `MY_PRODUCTS_COUNT_KEY` so deleting a listing frees a slot in `useListingCap.remaining` on the next render. |
| [src/features/marketplace/index.ts](src/features/marketplace/index.ts) | Re-exports the six new symbols (`useMyProductsCount`, `MY_PRODUCTS_COUNT_KEY`, `useMySubscription`, `MY_SUBSCRIPTION_KEY`, `SubscriptionRow`, `useIsPro`, `useListingCap`, `ListingCapState`, `FREE_TIER_LISTING_CAP`, `ListingCapReachedError`). |
| [src/app/(protected)/(tabs)/newPost.tsx](src/app/(protected)/(tabs)/newPost.tsx) | (1) `ListingCapReachedError` added to the `'@/features/marketplace'` named imports. (2) `onError` of `createListing(payload, …)` now branches on `err instanceof ListingCapReachedError` and surfaces a two-button alert: cancel / "Upgrade to Pro" → placeholder coming-soon Alert (H.5 swaps for the real deep link). The generic `Alert.alert(t('sell.fail'), …)` path is preserved for non-cap errors. |
| [src/i18n/locales/en.json](src/i18n/locales/en.json) | Four new keys under `sell.*`: `listingCapReachedTitle`, `listingCapReachedBody` (with `{{cap}}` interpolation), `upgradeToPro`, `upgradeFlowComingSoonBody`. |
| [src/i18n/locales/fr.json](src/i18n/locales/fr.json) | Mirror of the English keys with French copy. |

### Race-condition acceptance (v1)

The cap check + INSERT is **not atomic**. Two simultaneous create requests from the same non-Pro seller (e.g., a double-tap on the submit button that the existing UI doesn't fully debounce, or two devices in flight) could in principle both observe `count = 9` before either inserts, race past 10 by one, and end up with 11 listings under the cap. We accept this v1 trade-off because:

1. The mutation hook (`useCreateProduct`) and the form submit haptic both naturally serialize a single user's clicks; the failure mode requires deliberate concurrency.
2. The cost of "one extra listing past the cap" is small — it does not break payment, security, or other invariants.
3. The fix (a `SECURITY DEFINER` RPC that wraps `count + INSERT` in a single transaction with a row-level advisory lock on the seller) adds non-trivial server-side complexity and changes the create path's error model. Phase F territory if support tickets surface it.

The race is documented in-line in [services/sell.ts:104-109](src/features/marketplace/services/sell.ts#L104) so future maintainers don't mistake it for a bug.

### "Upgrade to Pro" placeholder pending H.5

The cap-modal's "Upgrade to Pro" button currently fires a second `Alert.alert(t('common.comingSoonTitle'), t('sell.upgradeFlowComingSoonBody'))`. This is intentional — the actual deep link to the web upgrade flow lives in H.5, which itself depends on H.6 shipping the URL. When H.5 lands, the only edit at this site is replacing the inner Alert with `await WebBrowser.openBrowserAsync(deepLinkUrl)`. The H.3 placeholder ensures the cap-blocked user-flow is end-to-end functional today (they hit the cap, they see the upgrade prompt, they get told it's coming soon) without leaving a dead button.

### Verification

- `npx tsc --noEmit` → **exit 0**. No diagnostics. The new hooks consume `Database['public']['Tables']['subscriptions']['Row']` cleanly; the existing `SellerProfile.isPro` flows through unchanged.
- `node -e "JSON.parse(...)"` on both locale files → both parse OK. (Locale JSONs are sensitive to trailing commas and we appended fields mid-block, so this is the reliable smoke check.)
- No new dependencies. `package.json` untouched.
- Repo state on completion: 6 untracked new files + 7 modified files, exactly the planned surface — no incidental edits.
- Manual sanity (deferred to user, requires authed session against an H.2-applied database):
  - `useIsPro()` returns true for a seller with `is_pro = true`, false otherwise.
  - `useListingCap()` shape: free + 0 listings → `{ cap: 10, used: 0, remaining: 10, isAtCap: false }`; free + 10 listings → `{ cap: 10, used: 10, remaining: 0, isAtCap: true }`; Pro → `{ cap: null, remaining: Infinity, isAtCap: false }`.
  - Creating an 11th product as non-Pro → `ListingCapReachedError` thrown by `createProduct`; caught by `newPost.tsx`'s `onError` branch; cap modal renders with "Cancel" + "Upgrade to Pro" buttons; tapping Upgrade → "coming soon" sub-Alert.
  - Manual admin override: `update public.sellers set is_pro = true where id = '<uuid>'` (service_role required since B.1.5 grants block this from the JS client) → after the next `useMySeller` refetch, `useIsPro()` flips true and the cap lifts on the next mutation attempt.

### H.4 handoff

H.4 is unblocked — every piece of state H.4's banners need is already exposed:

- **"X / 10 used" indicator on `newPost.tsx`** reads `const { used, cap, isPro, remaining } = useListingCap()` and renders nothing for `isPro`, otherwise a small caption ("3 listings remaining" / "10 / 10 used"). Banner placement at the top of the form per PRO_AUDIT.md §6.2 secondary.
- **Own-profile hero banner** (PRO_AUDIT.md §6.2 primary) reads `useIsPro()` only — no count needed. Renders a pressable card under the existing `heroActions` row at [profile.tsx:444-471](src/app/(protected)/(tabs)/profile.tsx#L444) when `!isPro`. The press handler is the same placeholder Alert as H.3's cap-modal Upgrade button — H.5 unifies the two into a single shared `useUpgradeFlow()` hook that does the deep link.
- **Sell-flow header banner** (PRO_AUDIT.md §6.2 secondary) reads `useListingCap()` and shows "Pro: unlimited listings + reduced fees" when `!isPro`, with the same Upgrade-CTA shape.
- **Visual ProBadge sites** (`SellerPill`, `SellerMiniCard`, `FollowerRow`, `CommentItem`, `profile.tsx`) already read the `is_pro` field — no H.4 work there. They will start showing the badge automatically once the H.2 trigger flips a seller's `is_pro` to `true`.

### H.5 handoff (deep link)

H.5 wires the actual `expo-web-browser.openBrowserAsync(...)` call. Two integration points to update at H.5 time:

1. The cap-modal "Upgrade to Pro" `onPress` in [newPost.tsx](src/app/(protected)/(tabs)/newPost.tsx) — replace the inner placeholder `Alert.alert(t('common.comingSoonTitle'), …)` with the deep-link call.
2. Whatever H.4 ships for the profile banner / sell-flow banner Upgrade buttons — same swap.

The deep link's URL shape is pending H.6 (`pro.<domain>/upgrade?session=<short-lived-jwt>` per PRO_AUDIT.md §8.4 option A). H.5 also ships the new `issue-web-session` Edge Function that mints the short-lived token. For now, every Upgrade affordance routes through the same coming-soon Alert — refactor to a single `useUpgradeFlow()` hook at H.5 time so the swap is one edit.

### Reversion

```
git revert <H.3 commit>
```

This unwinds all seven modifications and removes the six new files. The H.2 schema and trigger are unaffected (untouched in H.3). After revert, also run `npm run gen:types` ONLY if you intend to drop the `subscriptions` table — H.3 itself does not regenerate types, so the `Database['public']['Tables']['subscriptions']` shape stays valid even with H.3 code gone.

If only the cap-enforcement is unwanted (keeping the hooks for telemetry / banners), the surgical revert is to delete just the cap-check block in [services/sell.ts:94-125](src/features/marketplace/services/sell.ts#L94) and remove the `ListingCapReachedError` branch in [newPost.tsx](src/app/(protected)/(tabs)/newPost.tsx) — the hooks themselves are read-only and have no side effects.

---

## Step H.4 Changelog (2026-05-04) — Strategic Pro CTA Placements

JS-only step. Three Pro upsell affordances render proactively for non-Pro users: a sell-flow cap reminder banner, a profile-screen pitch banner, and an own-listing checkout-gate swap on the product action rail. All three CTAs route through a single `useUpgradeFlow()` hook (H.5's one-file edit point). Per-banner 24h dismissal cooldown via a persisted Zustand store. Three new files, four modifications, two locale extensions. Zero new dependencies.

> **Audit referenced:** [PRO_AUDIT.md](PRO_AUDIT.md) §6 (CTA placement strategy — primary: own profile; secondary: sell flow + own-listing checkout gate). Phase H.3 hooks (`useIsPro`, `useListingCap`) are the data foundation; H.4 is purely the surface layer on top.

### Reconnaissance findings (re-confirmed before authoring)

- **`newPost.tsx` mount point.** [src/app/(protected)/(tabs)/newPost.tsx:367-374](src/app/(protected)/(tabs)/newPost.tsx#L367) — the `<ScrollView>`'s first child is a `<View>` with the title/subtitle pair. The banner mounts as a sibling immediately above this header view, inside the same ScrollView. The `styles.scrollContent` already provides `gap: spacing.xl` so the banner inherits clean vertical rhythm without extra margin.
- **`profile.tsx` mount point.** [src/app/(protected)/(tabs)/profile.tsx:516](src/app/(protected)/(tabs)/profile.tsx#L516) — between the hero card (closes around line 514) and the listings section (`{isAuthenticated ? (<View style={styles.section}> …`). Banner mounts as a sibling at the same level — neither inside the hero `<Surface>` nor inside the listings `<View style={styles.section}>` — so it picks up the parent ScrollView's `gap: spacing.xxl` rhythm.
- **`ProductActionRail.tsx` shape.** [src/features/marketplace/components/ProductActionRail.tsx:36](src/features/marketplace/components/ProductActionRail.tsx#L36) — the existing `isPro = product.seller.isPro` is the *seller's* Pro state, not the viewer's. The two are equal only when the viewer IS the seller (own listing). H.4 introduces a separate `isOwnListing` derived from `mySellerQuery.data?.id === product.seller.id` to distinguish.
- **`currentSellerId` source.** [src/features/marketplace/hooks/useMySeller.ts:6](src/features/marketplace/hooks/useMySeller.ts#L6) — `useMySeller(enabled)` returns `SellerProfile | null` with `.id`. Reading `useAuthStore((s) => s.isAuthenticated)` inline gives the action-rail the gate it needs without threading the boolean through props.
- **UI primitives surveyed.** [src/components/ui/Surface.tsx](src/components/ui/Surface.tsx), [src/components/ui/Chip.tsx](src/components/ui/Chip.tsx), [src/components/ui/IconButton.tsx](src/components/ui/IconButton.tsx) — the Surface + Chip combo covers the banner shape; `IconButton` (circular + label below) is the rail's column primitive — H.4 keeps the same shape and only swaps icon/label/onPress for the own-non-Pro case so the rail's vertical rhythm is preserved exactly.
- **Theme tokens.** [src/theme/index.ts:38-42](src/theme/index.ts#L38) — `colors.feedback.warning = '#FBBF24'` is the natural urgent-amber, but `colors.brand` (the coral `#FF5A5C`) reads as more "upgrade" than "warning" so the urgent emphasis uses brand-coral border + filled brand CTA rather than the amber. Keeps the upsell positive-toned even when escalating.
- **Persistence pattern.** [src/stores/useMarketplaceFilters.ts:30-42](src/stores/useMarketplaceFilters.ts#L30) and [src/stores/useDisplayCurrency.ts](src/stores/useDisplayCurrency.ts) both use `persist(...) + createJSONStorage(() => AsyncStorage)`. H.4's `useDismissedBanners` matches this byte-for-byte with storage key `dismissed-banners-v1`.

### Files added (3)

| Path | Purpose |
| --- | --- |
| [src/hooks/useUpgradeFlow.ts](src/hooks/useUpgradeFlow.ts) | Returns a stable `() => void` that fires the "coming soon" Alert. **Single integration point for H.5** — replacing the body with `WebBrowser.openBrowserAsync(getUpgradeUrl(...))` is the entire H.5 diff for this hook. |
| [src/stores/useDismissedBanners.ts](src/stores/useDismissedBanners.ts) | Zustand + persist store with `dismissals: Partial<Record<BannerKey, number>>`, `dismiss(key)`, `isDismissed(key)`. 24h cooldown via `Date.now() - ts < DISMISSAL_COOLDOWN_MS`. Per-banner-key (not global). Storage key `dismissed-banners-v1` (versioned for future state-shape migration). |
| [src/components/marketplace/ProUpgradeBanner.tsx](src/components/marketplace/ProUpgradeBanner.tsx) | Reusable banner: `Surface (variant=surfaceElevated)` + leading sparkle icon + title/body column + optional close button + Chip CTA on its own row. `emphasis: 'soft' \| 'urgent'` controls border (default vs `colors.brand` 1.5px) and CTA variant (`outlined` vs `filled`). |

### Files modified (4 source + 2 locales + 1 changelog)

| Path | Change |
| --- | --- |
| [src/app/(protected)/(tabs)/newPost.tsx](src/app/(protected)/(tabs)/newPost.tsx) | (1) Three new imports: `useListingCap`, `ProUpgradeBanner`, `useDismissedBanners`, `useUpgradeFlow`. (2) New banner-state derivation block: `cap`, `capDismissed`, `dismissBanner`, `openUpgradeFlow`, `showSellFlowBanner`, `sellFlowBannerEmphasis`. (3) Mount the banner as the first child of the ScrollView, above the header `<View>`. Hidden in edit mode (`!isEdit`) — the cap only applies to creates. |
| [src/app/(protected)/(tabs)/profile.tsx](src/app/(protected)/(tabs)/profile.tsx) | (1) Four new imports: `useIsPro`, `ProUpgradeBanner`, `useDismissedBanners`, `useUpgradeFlow`. (2) New banner-state block: `isPro`, `profilePitchDismissed`, `dismissBanner`, `openUpgradeFlow`, `showProfilePitch`. (3) Mount the banner between the hero card and the listings section. Always 'soft' emphasis. |
| [src/features/marketplace/components/ProductActionRail.tsx](src/features/marketplace/components/ProductActionRail.tsx) | (1) Five new imports: `useMySeller`, `useAuthStore`, `useDismissedBanners`, `useUpgradeFlow`. (2) Derive `isOwnListing`, `checkoutGateDismissed`, `showCheckoutGate`. (3) Existing `buyLabel` / `buyIconName` two-way ternary → three-way: `showCheckoutGate ? 'Activate' + sparkles : isPro ? 'Buy' + bag : 'Contact' + chat`. (4) New `onPressLeading` routes to `openUpgradeFlow` for the gate, otherwise `onPressBuy` (unchanged). The IconButton itself keeps `variant="filled" size="lg"` so the rail's column rhythm is preserved exactly. |
| [src/i18n/locales/en.json](src/i18n/locales/en.json) | (1) `common.dismiss = "Dismiss"`. (2) New top-level `pro` namespace with 9 keys: `sellFlowBannerTitle` (with `{{used}}` / `{{cap}}` interpolation), `sellFlowBannerBody`, `profileBannerTitle`, `profileBannerBody`, `checkoutGateLabel`, `checkoutGateAriaLabel`, `upgradeCta`, `upgradeComingSoonTitle`, `upgradeComingSoonBody`. |
| [src/i18n/locales/fr.json](src/i18n/locales/fr.json) | Mirror with French copy. |

### Banner visibility logic

All three banners share the same gate shape: **non-Pro AND not dismissed in the last 24h**, plus surface-specific gates:

| Banner | Surface gate | Pro gate | Cooldown gate |
| --- | --- | --- | --- |
| Sell flow (`sell-flow-cap`) | `!isEdit && !cap.loading` | `!cap.isPro` | `!isDismissed('sell-flow-cap')` |
| Profile pitch (`profile-pro-pitch`) | `isAuthenticated` | `!isPro` | `!isDismissed('profile-pro-pitch')` |
| Checkout gate (`checkout-gate`) | `isOwnListing` | `!product.seller.isPro` | `!isDismissed('checkout-gate')` (reserved; no UI dismiss in v1 — see §below) |

**Cross-banner invariant.** Pro sellers see ZERO upsell banners across the entire app — the `!isPro` (or `!product.seller.isPro` on own listings, which is the same person) check is part of every gate.

### Urgent vs soft emphasis decision

The sell-flow banner is the only surface that escalates: when `cap.remaining <= 2` (i.e., 8 or 9 of 10 listings used), the banner flips from `'soft'` to `'urgent'` emphasis. Visually:

| Emphasis | Surface border | CTA chip | Leading icon |
| --- | --- | --- | --- |
| soft | `colors.borderStrong` (default `surfaceElevated` border) | `Chip variant="outlined"` | `sparkles-outline` (subtle) |
| urgent | `colors.brand`, 1.5px | `Chip variant="filled"` (coral) | `sparkles` (filled, brand color) |

Rationale: catches the user *before* they hit the wall. Hitting the wall surfaces the H.3 cap-modal Alert (also CTA-bearing), so the urgent banner is the predictive heads-up that lets the upgrade decision happen *before* the friction moment.

The profile pitch is **always soft** — passive pitch, no urgency trigger. The action-rail checkout-gate has no emphasis flag (it's an icon-button swap, not a Surface), but its visual treatment is the existing `IconButton variant="filled"` (already brand-colored), so it has implicit "always-active" emphasis.

### Action-rail checkout-gate decision: shipped

The H.4 spec gave an opt-out: "if the layout gets awkward, STOP and surface — defer to H.13." H.4 ships the swap because the visual integration is clean — the `IconButton` keeps the same circular `variant="filled" size="lg"` shape, only the icon (`sparkles` instead of `bag-handle` / `chatbubble-ellipses`) and label (`'Activer'` instead of `'Buy'` / `'Contact'`) change. The rail's vertical column rhythm is preserved exactly.

**Trade-off accepted: no inline dismiss affordance.** Adding an X mark on a circular icon button would crowd the rail's tight column visually. The 'checkout-gate' key exists in `useDismissedBanners` but no UI in v1 writes to it. Two consequences:

1. The own-non-Pro user always sees the "Activate" button on their own listing, every time. They cannot opt out from the rail itself.
2. They CAN dismiss the *profile pitch* banner (which shows on the same screen flow) — that takes care of the "stop nagging me" use case at a different surface.

If user feedback indicates the action-rail swap feels nag-y, H.13 can add a long-press → dismiss affordance, or an X in the IconButton's container slot, both of which would consume the existing `'checkout-gate'` key.

### Race-condition / edge cases

- **Edit mode.** The sell-flow banner is hidden when `isEdit` is true. The cap only applies to *new* listings; editing an existing one is unconstrained, so an upsell on the edit path would be misleading.
- **Loading state.** Every banner gates on the underlying query's loading flag (`cap.loading` for sell flow; `mySellerQuery.data?.id` truthiness for the action rail). Avoids flash-of-banner-then-disappear when a Pro user opens a screen and the seller row is still in flight.
- **Unauth.** The profile screen's `isAuthenticated` gate already covers it; the sell flow's `cap.loading` gate covers it transitively (the underlying `useMyProductsCount` is `enabled: !!sellerId`, so it never resolves for unauth and `loading` stays true). The action rail gates on `mySellerQuery.data?.id` truthiness, which is null for unauth.
- **Pro flip mid-session.** Webhook fires → trigger flips `is_pro = true` → next `useMySeller` refetch (5min stale or focus-triggered) → all three banners disappear cleanly on the next render.

### Verification

- `npx tsc --noEmit` → **exit 0**. No diagnostics.
- `node -e "JSON.parse(...)"` on both locale files → both parse OK. The new `pro` namespace + the `common.dismiss` addition both serialize cleanly.
- No new dependencies. `package.json` untouched.
- Repo state on completion: 9 untracked new files (3 from H.4 + the 6 from H.3 still untracked) + 10 modified files (3 from H.4 over the 7 from H.3).
- Manual sanity (deferred to user, requires authed session against an H.2-applied database):
  - Open sell flow as non-Pro with 0 listings → soft banner: "0/10 listings used". Tap CTA → "Coming soon" alert. Tap close X → banner gone for 24h.
  - Reach 9 listings → banner flips to urgent: brand border, filled coral CTA.
  - Open own profile as non-Pro → soft "Become a Pro seller" banner above listings section. Dismiss → gone for 24h, independent of the sell-flow banner's dismiss state.
  - Open own listing in the feed → action rail's leading button shows sparkles + "Activer". Tap → "Coming soon" alert. (Existing Like/Comment/Share/More unchanged.)
  - Open someone else's Pro listing → existing "Acheter" + bag, routes to checkout. Open someone else's non-Pro listing → existing "Contacter" + chat, routes to DM. Both unchanged.
  - Toggle the user's `is_pro` to `true` via SQL → next focus refetch, all three banners disappear cross-app.

### H.5 handoff

H.5's diff is exactly this file: [src/hooks/useUpgradeFlow.ts](src/hooks/useUpgradeFlow.ts). Replace the `Alert.alert(...)` body with:

```ts
import * as WebBrowser from 'expo-web-browser';
import { getUpgradeUrl } from '@/lib/proUpgradeUrl'; // new in H.5

export function useUpgradeFlow(): () => void {
  return useCallback(async () => {
    const url = await getUpgradeUrl();
    await WebBrowser.openBrowserAsync(url);
  }, []);
}
```

Where `getUpgradeUrl()` reads the user's seller_id (via `useMySeller` or directly via Supabase) and resolves to the brand domain (pending PRO_AUDIT.md §10 brand-name + domain decision; H.6 blocker). H.5 also ships the new `issue-web-session` Edge Function per PRO_AUDIT.md §8.4 option A so the deep-link arrives at the web side already-authed.

The H.3 cap-modal "Upgrade to Pro" alert path in [newPost.tsx](src/app/(protected)/(tabs)/newPost.tsx)'s onError still hardcodes a sub-Alert; H.5 should also refactor that to call `openUpgradeFlow` so all upgrade entry points share the single hook.

### Reversion

```
git revert <H.4 commit>
```

Removes the three new files + reverts the four source modifications + the two locale extensions. The H.3 hooks and schema underneath stay intact — H.4 is a pure UI layer over them. No DB rollback needed; no type regen needed.

If only specific banners should be removed (e.g., keep the profile pitch but drop the action-rail swap), the surgical edits are independent — each banner's mount block can be individually deleted without affecting the others.

---

## Step H.5 Changelog (2026-05-04) — Web Upgrade Deep Link with Auto-Auth

JS + Edge Function step. Promotes H.4's `useUpgradeFlow()` placeholder into a real flow that mints a Supabase magic-link via a new `issue-web-session` Edge Function and opens it in an in-app browser, landing the user on the web upgrade page already-authenticated. Plus a `WEB_BASE_URL` constant module (single source of truth for the Vercel URL) and a one-line consolidation that routes the H.3 cap-modal "Upgrade to Pro" button through the same hook. Two new files (Edge Function + constants), three modifications (hook rewrite, cap-modal consolidation, locale files dropping 3 deprecated keys + adding 2 new). Zero new dependencies — `expo-web-browser ~15.0.11` was already installed.

> **Audit referenced:** [PRO_AUDIT.md](PRO_AUDIT.md) §8.4 option A (magic-link auth bridge over cookie / Universal Link); §10 open-question 14 (web-routed Stripe over IAP for v1) is pre-decided in the H.4 / H.5 scope.

### Reconnaissance findings (re-confirmed before authoring)

- **`useUpgradeFlow` H.4 shape.** [src/hooks/useUpgradeFlow.ts](src/hooks/useUpgradeFlow.ts) returned `() => void` and rendered an `Alert.alert(t('pro.upgradeComingSoonTitle'), t('pro.upgradeComingSoonBody'))`. H.5 changes the return type to `() => Promise<void>` — assignable to React Native's `onPress: () => void` (TypeScript discards the promised value), so the H.4 banner / H.3 cap-modal call sites need no shape changes.
- **Existing Edge Function pattern.** [supabase/functions/send-push-notification/index.ts:1-71](supabase/functions/send-push-notification/index.ts) and [supabase/functions/create-checkout-session/index.ts:1-95](supabase/functions/create-checkout-session/index.ts) both follow:
  - `// deno-lint-ignore-file` header
  - `import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'` (esm.sh, NOT jsr — the H.5 spec defaulted to jsr but the project convention is esm.sh)
  - Module-level admin client created from `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env vars
  - Plain-string responses for 4xx (`'Unauthorized'`, `'Method Not Allowed'`), JSON for 5xx with `{ error: (err as Error).message }`
  - Auth check: `Authorization: Bearer <jwt>` → `supabase.auth.getUser(jwt)` → reject if `!user`
  - `corsHeaders` constant exactly identical across functions
  H.5's new function matches verbatim.
- **`expo-web-browser` confirmed.** `package.json:52` declares `~15.0.11`. [src/features/marketplace/components/ProductDetailSheet.tsx:21,145](src/features/marketplace/components/ProductDetailSheet.tsx#L145) already uses `WebBrowser.openBrowserAsync(url)` for the existing Pro-checkout path. No new dependency.
- **H.3 cap-modal location.** [src/app/(protected)/(tabs)/newPost.tsx:336-341](src/app/(protected)/(tabs)/newPost.tsx#L336) — the "Upgrade to Pro" button's `onPress` rendered a placeholder `Alert.alert(t('common.comingSoonTitle'), t('sell.upgradeFlowComingSoonBody'))`. H.5 replaces the function body with `openUpgradeFlow` (already imported in this file by H.4 for the sell-flow banner), no additional imports required.
- **Deprecated key audit.** Grep across `src/` confirms three keys are referenced ONLY by the placeholder paths H.5 rewrites: `pro.upgradeComingSoonTitle`, `pro.upgradeComingSoonBody`, `sell.upgradeFlowComingSoonBody`. Safe to delete cleanly per the H.5 spec.

### Files added (2)

| Path | Purpose |
| --- | --- |
| [src/lib/web/constants.ts](src/lib/web/constants.ts) | Two exports: `WEB_BASE_URL = 'https://mony.vercel.app'` and `WEB_UPGRADE_PATH = '/upgrade'`. Single source of truth — the Edge Function reads its companion `WEB_BASE_URL` from a Supabase secret, kept in lockstep with this constant. Brand-name + final-domain decision (PRO_AUDIT.md §10) is a one-line edit here when known. |
| [supabase/functions/issue-web-session/index.ts](supabase/functions/issue-web-session/index.ts) | Deno Edge Function. POST with `Authorization: Bearer <jwt>` → verify caller via `supabase.auth.getUser(jwt)` → `supabase.auth.admin.generateLink({ type: 'magiclink', email: user.email, options: { redirectTo } })` → return `{ url: action_link }`. Whitelist: `redirect_to` must start with `/` (prevents off-domain redirect injection). Falls back to `https://mony.vercel.app` if the `WEB_BASE_URL` secret is unset (defense in depth — local dev shouldn't break). |

### Files modified (3 source + 2 locales)

| Path | Change |
| --- | --- |
| [src/hooks/useUpgradeFlow.ts](src/hooks/useUpgradeFlow.ts) | Full body rewrite. Imports `WebBrowser`, `supabase`, `WEB_BASE_URL`, `WEB_UPGRADE_PATH`. Adds `useRef` reentrancy flag. Flow: invoke Edge Function → pick minted URL or soft-fallback to bare URL → `openBrowserAsync(url, { presentationStyle: PAGE_SHEET })`. Hard-fail catch surfaces `pro.upgradeError*` Alert. Return type `() => Promise<void>` (assignable to `onPress: () => void`). |
| [src/app/(protected)/(tabs)/newPost.tsx](src/app/(protected)/(tabs)/newPost.tsx) | Cap-modal "Upgrade to Pro" button's `onPress` collapsed from a 4-line placeholder Alert to `onPress: openUpgradeFlow`. The `openUpgradeFlow` constant was already in scope (imported + assigned by H.4 for the sell-flow banner) so no new imports. |
| [src/i18n/locales/en.json](src/i18n/locales/en.json) | (1) Removed `sell.upgradeFlowComingSoonBody`. (2) Replaced `pro.upgradeComingSoonTitle` / `pro.upgradeComingSoonBody` with `pro.upgradeErrorTitle` / `pro.upgradeErrorBody`. |
| [src/i18n/locales/fr.json](src/i18n/locales/fr.json) | Mirror with French copy. |

### Soft-fallback behavior

The hook's URL resolution intentionally treats Edge Function failure as recoverable, not fatal:

```text
Edge Function success → urlToOpen = data.url               (magic link, auto-auth)
Edge Function error   → urlToOpen = WEB_BASE_URL + PATH    (bare URL, web prompts for login)
WebBrowser throws     → Alert(pro.upgradeError*)           (hard fail, user can retry)
```

Three motivating cases for the soft fallback:

1. **Function not deployed yet.** During dev / between H.5 mobile work and `supabase functions deploy issue-web-session`, the function returns 404. The fallback opens the bare URL — the user can still complete the upgrade by signing in on web.
2. **Network blip / Supabase transient error.** Better to land the user on the web (where they're one login away from upgrade) than to surface an error modal that requires a tap to dismiss.
3. **Misconfigured `WEB_BASE_URL` secret.** If the secret resolves to an unexpected origin, the magic-link redirect would fail allowlist checks. The fallback to the constant-defined URL still routes the user correctly.

The ONLY hard-fail path is `WebBrowser.openBrowserAsync` itself rejecting (rare; usually only when an in-app browser is unavailable on the platform). That's the right time to surface a generic error.

### Cap-modal consolidation

After H.5, every upgrade entry point in the app routes through the **single** `useUpgradeFlow` hook:

| Surface | File | Type | Pre-H.5 | Post-H.5 |
| --- | --- | --- | --- | --- |
| Sell-flow banner CTA | [newPost.tsx](src/app/(protected)/(tabs)/newPost.tsx) | banner | `useUpgradeFlow` (H.4) | unchanged |
| Profile pitch banner CTA | [profile.tsx](src/app/(protected)/(tabs)/profile.tsx) | banner | `useUpgradeFlow` (H.4) | unchanged |
| Action-rail "Activer" pill | [ProductActionRail.tsx](src/features/marketplace/components/ProductActionRail.tsx) | icon button | `useUpgradeFlow` (H.4) | unchanged |
| Cap-modal Upgrade button | [newPost.tsx](src/app/(protected)/(tabs)/newPost.tsx) | Alert button | placeholder Alert (H.3) | `useUpgradeFlow` ← **H.5 change** |

When the Vercel URL is finalized (H.6), zero edits to call sites — only [src/lib/web/constants.ts:24](src/lib/web/constants.ts#L24) + the matching `WEB_BASE_URL` Supabase secret.

### Manual setup required (user runs once)

Three steps the user runs explicitly — Claude Code does NOT execute these:

#### 1. Deploy the Edge Function

```bash
supabase functions deploy issue-web-session
```

The function inherits `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from Supabase's built-in function environment automatically.

#### 2. Set the `WEB_BASE_URL` secret

```bash
supabase secrets set WEB_BASE_URL=https://mony.vercel.app
```

(Or whatever URL the Vercel deploy ends up at after H.6. Update both this secret AND `src/lib/web/constants.ts` together.)

#### 3. Allowlist the redirect URL in Supabase Dashboard

**Dashboard → Authentication → URL Configuration → "Additional Redirect URLs":**

Add (one per line):
```
https://mony.vercel.app/*
https://*.vercel.app/*
```

The wildcard `*.vercel.app` allows preview deploys during dev. For production-only setups, drop the wildcard once the canonical URL is stable. Without this allowlist, `generateLink` succeeds but the magic-link click bounces with "Email link is invalid or has expired".

### Verification

- `npx tsc --noEmit` → **exit 0**. No diagnostics. The new `() => Promise<void>` return type assigns cleanly to every existing `onPress` consumer.
- `node -e "JSON.parse(...)"` on both locale files → both parse OK after the 3-key removal + 2-key addition.
- `grep -rn "upgradeComingSoon\|upgradeFlowComingSoon" src/` → **0 matches**. All deprecated keys are unreferenced; the deletion is clean.
- No new dependencies. `package.json` untouched.
- Repo state on completion: 11 untracked new files (2 from H.5 + 9 carry-overs from H.3 / H.4) + 10 modified files (matching H.4 surface plus the H.5 hook rewrite shows untracked since H.4 introduced it).
- **Manual / runtime verification (deferred to user, requires Manual Setup steps above):**
  - Tap any upgrade CTA on a non-Pro account → ~500ms in-app browser load → redirect to Vercel.
  - Until H.6 deploys, the Vercel response is **404** — that's expected and confirms the routing works. The auth flow itself is working (verifiable via Supabase Dashboard → Logs → Auth, which shows the magic-link issue + token exchange events).
  - To verify soft fallback: temporarily revoke the function's deploy (`supabase functions delete issue-web-session`) → tap an upgrade CTA → opens bare `mony.vercel.app/upgrade` (still 404 today, but via the fallback path).
  - To verify reentrancy: rapid-tap a CTA 5x → exactly one in-app browser opens, exactly one Edge Function invocation in logs.

### H.6 handoff

Mobile-side Phase H is complete. The next major piece is the web codebase, which lives in a separate repo per PRO_AUDIT.md §8.5.

Concrete H.6 work, in dependency order:

1. **Scaffold a Next.js 14+ App Router project at the chosen Vercel URL.** Until brand-name + custom-domain decisions land (PRO_AUDIT.md §10), the Vercel default URL (`mony.vercel.app` or alternative if taken) is the working address. Update [src/lib/web/constants.ts:24](src/lib/web/constants.ts#L24) AND the `WEB_BASE_URL` Supabase secret if the URL ends up different.
2. **`/auth/callback` route.** Receives the magic-link redirect; uses `@supabase/ssr` to exchange the link for a cookie session. Standard Supabase template — see [their Next.js auth docs](https://supabase.com/docs/guides/auth/server-side/nextjs).
3. **`/upgrade` page.** Lands the user, shows the Pro tier pricing (PRO_AUDIT.md §10 placeholders €19/mo, €190/yr until user confirms), routes them to Stripe Checkout via a server action / API route handler.
4. **Stripe Checkout integration.** Server: `app/api/stripe/checkout/route.ts` creates a `mode: 'subscription'` session. Client: redirect to `session.url` (or use `@stripe/stripe-js` `redirectToCheckout`). The server uses STRIPE_SECRET_KEY (Stripe test mode for dev).
5. **Stripe webhook handler.** `app/api/stripe/webhook/route.ts` verifies signatures, upserts on `subscriptions.stripe_subscription_id`, lets the H.2 trigger sync `is_pro`. Service-role Supabase client only.
6. **Dashboard + Customer Portal link.** `/dashboard` shows current plan; `app/api/stripe/portal/route.ts` creates a billing portal session. Defer to Stripe-hosted portal — no custom billing UI per PRO_AUDIT.md §8.3.

Single integration point on the mobile side: when the Vercel URL or path changes, edit [src/lib/web/constants.ts](src/lib/web/constants.ts) + the matching `WEB_BASE_URL` Supabase secret. Every other piece of the mobile-side upgrade flow is wired through `useUpgradeFlow` and stays untouched.

### Reversion

Two-part rollback if needed:

```
git revert <H.5 commit>
supabase functions delete issue-web-session     # only if function was deployed
supabase secrets unset WEB_BASE_URL              # only if secret was set
```

Note: the `git revert` restores `useUpgradeFlow` to its H.4 placeholder shape and the cap-modal to its H.3 placeholder Alert. The 3 deprecated i18n keys come back automatically with the locale-file revert. The Edge Function file vanishes from source control but remains deployed until `supabase functions delete` runs — the deployed function is harmless (ignored by mobile after the revert) but should be cleaned up for hygiene.

The Supabase Dashboard "Additional Redirect URLs" entries are forward-compatible (they don't affect anything until the magic-link feature is in use again) and can be left in place.

---

## Step H.6 Changelog (2026-05-04) — Mony Web Codebase Scaffold

Greenfield Next.js scaffold for the web companion that hosts the Pro upgrade flow + (future) seller dashboard + admin surface. 18 new files under `/web/`, two minimal touches to root config (`.gitignore` adds `/web/*` ignores; `tsconfig.json` excludes `web/**` so mobile tsc doesn't pull in Next-runtime files). Zero changes to mobile feature code. After the user runs `npm install` + creates the Vercel project, the H.5 magic-link mobile flow lands on a real authenticated `/upgrade` page on `mony.vercel.app` instead of a Vercel 404.

> **Audit referenced:** [PRO_AUDIT.md](PRO_AUDIT.md) §8 (web codebase architecture recommendation: Next.js 14+ App Router, Tailwind, `@supabase/ssr`, Vercel hosting, separate-repo decision relaxed to monorepo `/web/` per user choice). [BRAND.md](BRAND.md) for the design tokens (mobile theme remains the source of truth; web Tailwind config mirrors).

### Reconnaissance findings (re-confirmed before authoring)

- **`/web` directory absence verified** — `ls web` returned "no such file or directory". Clean scaffold, no clobber risk.
- **Mobile theme captured for porting.** [src/theme/index.ts:12-160](src/theme/index.ts#L12) exports `colors`, `spacing`, `radii`, `typography` (family/weight/size/lineHeight/tracking), `motion`, `elevation`, `zIndex`, `blur`. Every color value transcribed verbatim into [web/tailwind.config.ts](web/tailwind.config.ts) (e.g., `brand: '#FF5A5C'`, `surface: '#0A0A0A'`, `proBadge: '#8B5CF6'`). Spacing + radii scales mirrored to Tailwind's `extend.spacing` / `extend.borderRadius` 1:1. Typography variants (`display`/`title`/`body`/`caption`/`label`) defer to consumer-side Tailwind utility composition for v1 — formal port of `textVariants` is H.7's scope when real copy lands.
- **Brand naming gap noted, not closed.** [BRAND.md:13](BRAND.md#L13) still says `Name: TBD. Use the placeholder Marketplace …`. The H.6 spec locks the brand to "Mony" per the user decision in conversation, but BRAND.md as the human-readable source-of-truth was deliberately NOT updated in H.6 — that's a separate brand-locking step. The web's `<title>` / `metadata` and the placeholder landing display "Mony" per spec; if the user later edits BRAND.md to match, no re-work needed in `/web`.
- **Env var conventions confirmed.** Mobile reads `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` ([src/lib/supabase.ts:6-7](src/lib/supabase.ts#L6)). Web uses Next.js's `NEXT_PUBLIC_*` prefix convention with the same anon credentials — both client-safe per Supabase's RLS-gates-everything model. Service role key (NOT exposed in browser) is reserved for the H.5 Edge Function and the future H.12 webhook handler.
- **Existing root `.gitignore` style.** Simple comment-then-paths blocks ([.gitignore:1-54](.gitignore#L1)); no nested `gitignore_global` or pattern complexity. H.6 appends one block in the same style.
- **Mobile tsconfig** already excludes `supabase/functions/**` for the same reason H.6 needs `web/**` — Deno-runtime / Next-runtime files have their own type systems and shouldn't be picked up by Expo's tsc. One-line addition to the existing `exclude` array, mirroring the precedent.

### File inventory (18 new + 2 root touches)

#### Configuration (5 files)

| Path | Purpose |
| --- | --- |
| [web/package.json](web/package.json) | Next.js 15 + React 19 + Tailwind 3 + `@supabase/ssr` + TypeScript ~5.9.2 (matched to mobile's TS version). Scripts: `dev`, `build`, `start`, `lint`, `type-check`, `gen:types`. |
| [web/tsconfig.json](web/tsconfig.json) | Strict TS, ES2022 target, bundler module resolution, `@/*` path alias, Next.js plugin. |
| [web/next.config.ts](web/next.config.ts) | Minimal — `reactStrictMode: true`. Forward-provisioned for H.7+ (image domains, redirects). |
| [web/postcss.config.mjs](web/postcss.config.mjs) | Standard Tailwind v3 + autoprefixer pipeline. |
| [web/tailwind.config.ts](web/tailwind.config.ts) | Port of mobile design tokens. Colors / spacing / radii / fonts / sizes mirrored verbatim. `darkMode: 'class'`, with the `dark` class forced on `<html>` (BRAND.md "Mode: Dark-first only"). |

#### Application code (10 files)

| Path | Purpose |
| --- | --- |
| [web/src/theme.ts](web/src/theme.ts) | Programmatic theme module for non-Tailwind contexts (e.g., Stripe Elements appearance). v1 ships only the color subset; H.7+ extends. |
| [web/src/app/globals.css](web/src/app/globals.css) | Tailwind directives + dark-only base (color-scheme, body bg/text). |
| [web/src/app/layout.tsx](web/src/app/layout.tsx) | Root layout. Loads Inter (400/500/600/700) + Fraunces (400/500/600) via `next/font/google` as CSS vars `--font-inter` / `--font-fraunces` consumed by the Tailwind `fontFamily` extension. |
| [web/src/app/page.tsx](web/src/app/page.tsx) | Public landing — placeholder ("Mony / Coming soon"). Real H.7 work. |
| [web/src/app/upgrade/page.tsx](web/src/app/upgrade/page.tsx) | Auth-gated placeholder. Redirects to `/` when unauth'd via `getUser()` (NOT `getSession()`). Renders the user's email + "Stripe Checkout shipping soon". |
| [web/src/app/dashboard/page.tsx](web/src/app/dashboard/page.tsx) | Auth-gated placeholder, symmetric to `/upgrade`. Real H.10 work. |
| [web/src/app/auth/callback/route.ts](web/src/app/auth/callback/route.ts) | Magic-link handler — `verifyOtp({ token_hash, type })` → session cookie via `@supabase/ssr` → redirect to `next` (whitelisted to relative paths). |
| [web/src/app/auth/error/page.tsx](web/src/app/auth/error/page.tsx) | Generic auth-failure landing with a "Back to home" link. Doesn't surface the raw `reason` query param to the visitor. |
| [web/src/lib/supabase/server.ts](web/src/lib/supabase/server.ts) | Server Supabase client via `createServerClient` with `cookies()` adapter. Used by Server Components, Route Handlers, Server Actions. |
| [web/src/lib/supabase/client.ts](web/src/lib/supabase/client.ts) | Browser Supabase client via `createBrowserClient`. Forward-provision for H.7+ Client Components. |

#### Middleware + docs (3 files)

| Path | Purpose |
| --- | --- |
| [web/src/middleware.ts](web/src/middleware.ts) | Session refresh on every non-static request. Calls `supabase.auth.getUser()` for the side-effect cookie rotation. Matcher excludes `_next/static`, `_next/image`, `favicon.ico`, and image asset extensions. |
| [web/.env.local.example](web/.env.local.example) | Template for `.env.local` (gitignored). Documents `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |
| [web/README.md](web/README.md) | Local dev / build / deploy runbook. Documents the Vercel Root Directory requirement, env var setup, the magic-link auth flow, and the Phase H roadmap on this codebase. |

#### Root touches (2 files)

| Path | Change |
| --- | --- |
| [.gitignore](.gitignore) | Appended block: `/web/node_modules/`, `/web/.next/`, `/web/out/`, `/web/.env.local`, `/web/.env*.local`, `/web/.vercel`, `/web/next-env.d.ts`, `/web/*.tsbuildinfo`. Same comment-block style as the existing supabase / Expo / native blocks. |
| [tsconfig.json](tsconfig.json) | Added `"web/**"` to the existing `exclude` array. Mirror of the precedent set for `supabase/functions/**` — keeps mobile tsc from picking up Next-runtime files that need `/web/node_modules`. |

### Theme port — mobile to Tailwind

Mobile's [theme module](src/theme/index.ts) is the single source of truth on the React Native side. The web codebase's [tailwind.config.ts](web/tailwind.config.ts) mirrors the concrete values (not the JS module) because the two runtimes consume styles differently:

| Mobile (React Native) | Web (Tailwind) |
| --- | --- |
| `colors.brand` → inline `style={{ backgroundColor: colors.brand }}` | `bg-brand` utility class |
| `radii.lg` → `borderRadius: 16` | `rounded-lg` utility |
| `typography.size.xxxl` → `fontSize: 32` | `text-xxxl` utility |
| Inter via `expo-font` boot loader | Inter via `next/font/google` + CSS var |

The token names are kept identical so `BRAND.md` reads the same in both contexts. Adding a token requires three edits in lockstep:

1. `src/theme/index.ts` (mobile)
2. `web/tailwind.config.ts` (web)
3. `BRAND.md` (human-readable)

### Auth callback flow (end to end)

Magic-link bridging from mobile to web, post-H.6:

```
[Mobile] User taps "Upgrade to Pro"
  → useUpgradeFlow() (H.5) calls issue-web-session Edge Function
  → Function returns { url: <magic-link>?token_hash=…&type=magiclink&redirect_to=/upgrade }
  → expo-web-browser.openBrowserAsync(url)

[In-app browser]
  → Loads the magic-link URL directly to mony.vercel.app
  → Supabase Auth's email-style link redirects to:
    https://mony.vercel.app/auth/callback?token_hash=…&type=magiclink&next=/upgrade
  → /auth/callback (route.ts):
      • Whitelists `next` to relative paths
      • supabase.auth.verifyOtp({ token_hash, type }) → exchanges for session
      • @supabase/ssr writes the session cookie
      • Redirects to /upgrade
  → /upgrade (Server Component):
      • supabase.auth.getUser() validates the JWT cryptographically
      • Renders the placeholder with user.email
```

### Middleware rationale

Without the middleware, Supabase access tokens (1h default) would silently expire mid-session. The middleware:

1. Runs on every non-static request (matcher excludes `_next/*`, `favicon.ico`, image extensions).
2. Calls `supabase.auth.getUser()` for its side effect — `@supabase/ssr` transparently rotates near-expiry tokens and writes the new cookies via the `setAll` adapter.
3. Cookie writes go to BOTH the incoming request (so downstream Server Components see fresh values via `cookies().get(...)`) AND the outgoing response (so the browser persists them).

The middleware is intentionally one-job (refresh) — auth-gating decisions stay at the page level (`getUser() ? content : redirect('/')`). This keeps the auth gate explicit at the consumer rather than implicit in middleware route-matching, which would otherwise scale poorly as the auth surface grows (admin, dashboard, billing portal, etc., each needing different gates).

### Manual setup required (user runs once)

Two parts: local install + Vercel project creation.

#### 1. Install dependencies

```powershell
cd web
npm install
```

The lockfile lives at `web/package-lock.json` (auto-generated on first install). Commit it.

#### 2. Local dev verification (optional but recommended)

```powershell
cp .env.local.example .env.local
# Edit .env.local — paste your Supabase project's URL + anon key
npm run dev
# Visit http://localhost:3000 — should see "Mony / Coming soon"
```

#### 3. Vercel project creation

1. Push the repo to GitHub if not already (`git push origin main`).
2. **Vercel Dashboard → Add New → Project**.
3. Import the GitHub repo.
4. **Framework**: Next.js (auto-detected).
5. **Root Directory**: set to `web`. **This is critical** — without it, Vercel tries to build the Expo app at the repo root and fails.
6. **Environment Variables** (all environments):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://mkofisdyebcnmhgkpqws.supabase.co` (or whatever your project URL is)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your project's anon (publishable) key from Supabase Dashboard → Settings → API
7. Click **Deploy**.

#### 4. URL reconciliation

If the Vercel-assigned URL differs from `https://mony.vercel.app` (e.g., the slug is taken):

| Update | Where |
| --- | --- |
| `WEB_BASE_URL` constant | [src/lib/web/constants.ts](src/lib/web/constants.ts) (mobile codebase) |
| `WEB_BASE_URL` Supabase secret | `npx supabase secrets set WEB_BASE_URL=<new-url>` |
| Site URL | Supabase Dashboard → Authentication → URL Configuration |
| Additional Redirect URLs | Supabase Dashboard → Authentication → URL Configuration → add `<new-url>/*` |

### Verification

- **Mobile `tsc --noEmit`** → exit 0. The `tsconfig.json` exclusion for `web/**` is the load-bearing change here; without it, mobile tsc fails because /web's imports resolve against /web/node_modules which doesn't exist until the user runs `npm install` in /web.
- **Mobile codebase byte-identity** outside the two root touches: confirmed via `git status` — no `M` entries under `src/` from H.6 (the existing `M` entries are H.1–H.5 work). The two H.6-only edits are `.gitignore` (append) and `tsconfig.json` (one-line `exclude` extension).
- **JSON parse**: `web/package.json` and `web/tsconfig.json` both parse cleanly via `JSON.parse`.
- **File count**: 18 new files under `/web/`, 12 of them TS/TSX.
- **Manual verification (deferred to user, requires `npm install` + Vercel deploy):**
  - `cd web && npm install && npm run type-check` → exit 0 (after deps install).
  - `cd web && npm run build` → produces a clean `.next` directory; this is what Vercel runs.
  - `cd web && npm run dev` → boots on http://localhost:3000 with the placeholder landing rendering correctly.
  - End-to-end: tap any "Upgrade to Pro" CTA in the mobile app → in-app browser opens → ~500ms auth bounce → lands on `mony.vercel.app/upgrade` with the user's email displayed and **no double login**, **no Vercel 404**.

### Phase H mobile/web status (post-H.6)

| Step | Status | Surface |
| --- | --- | --- |
| H.1 | ✓ | Audit (PRO_AUDIT.md) |
| H.2 | ✓ | `subscriptions` table + trigger |
| H.3 | ✓ | `useIsPro` / `useListingCap` / cap enforcement |
| H.4 | ✓ | Three banner placements (sell-flow / profile / action-rail) |
| H.5 | ✓ | Magic-link Edge Function + `useUpgradeFlow` real flow |
| **H.6** | **✓ this step** | **Web scaffold + auth bridge + placeholders** |
| H.7 | next | Real public landing + Stripe Checkout on /upgrade |
| H.10 | future | Real /dashboard + Customer Portal link |
| H.11 | future | /admin/subscriptions |
| H.12 | future | /api/stripe/webhook (writes to subscriptions via service role per H.2) |

Mobile is feature-complete for v1 Pro upsell. The web side is scaffolded; H.7+ builds out the real surfaces.

### H.7 handoff

Three concrete next pieces:

1. **Real public landing.** Replace the H.6 placeholder at [web/src/app/page.tsx](web/src/app/page.tsx) with: hero, pricing card (PRO_AUDIT.md §10 placeholder €19/mo €190/yr until user confirms), feature grid, FAQ, footer. Stays Server Component — no client interactivity needed beyond `<a href="/upgrade">`.
2. **Stripe Checkout on /upgrade.** Replace [web/src/app/upgrade/page.tsx](web/src/app/upgrade/page.tsx)'s placeholder with a `<form>` that POSTs to a new `app/api/stripe/checkout/route.ts` Route Handler. The handler creates a `mode: 'subscription'` session via the Stripe Node SDK (server-side `STRIPE_SECRET_KEY`, never exposed to browser), returns `{ url }`, the page redirects via `<form action>` or `window.location`. Pin to TEST mode for v1; live-mode flip is a separate H.14.
3. **`@stripe/stripe-js`** dependency added to `/web/package.json` for the client-side `redirectToCheckout` flow if/when we move beyond the simple `<form action>` redirect.

### H.12 (Stripe webhooks) handoff

Pre-unblocked since H.2's schema landed. Concrete H.12 work:

- Add Route Handler at `/web/src/app/api/stripe/webhook/route.ts`.
- Verify the request signature with `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`.
- Switch on `event.type`: `customer.subscription.{created,updated,deleted}`, `invoice.payment_{succeeded,failed}`.
- Upsert into `public.subscriptions` keyed on `stripe_subscription_id` (the H.2 unique index makes this idempotent).
- Use a service-role Supabase client (NEW dependency on `SUPABASE_SERVICE_ROLE_KEY` in Vercel env vars — must be set as a non-public env var, not `NEXT_PUBLIC_*`).
- The H.2 `handle_subscription_change` trigger handles `is_pro` mirror automatically — the webhook handler does NOT touch `sellers.is_pro` directly.
- Configure the webhook endpoint URL in Stripe Dashboard → Webhooks once H.7 deploys.

### Reversion

```bash
git revert <H.6 commit>
```

Removes:
- All 18 files under `/web/`
- The `.gitignore` `/web/*` block
- The `tsconfig.json` `web/**` exclusion (mobile tsc keeps passing because /web is also gone, so there's nothing to pick up)

The Vercel project (if created) requires manual deletion via the Vercel Dashboard → Project Settings → Delete Project. The Supabase Dashboard's Site URL / Redirect URL allowlist entries are forward-compatible — they don't cause any problems with the H.6 revert in place and can be left alone.

If only the scaffold should go but `.gitignore` / `tsconfig.json` keep the changes (e.g., for a clean re-scaffold attempt), the surgical revert is `git rm -r web/` plus `git checkout HEAD -- .gitignore tsconfig.json`. But the simple `git revert` is preferred unless a re-scaffold is imminent.

---

## Step H.7 Changelog (2026-05-04) — Public Landing Page

Replaces the H.6 "Coming soon" placeholder at [web/src/app/page.tsx](web/src/app/page.tsx) with the real Mony marketing surface — header + hero + features grid + pricing card + FAQ accordion + footer — composed from three new UI primitives and six new landing-section components. SEO + Open Graph metadata expanded. One new dependency (`lucide-react` for the marketing icon set). Two H.6 latent typing bugs surfaced and fixed once `/web` actually had its `node_modules` to type-check against. French-only for v1; EN internationalization is a deliberate follow-up.

> **Audit referenced:** [PRO_AUDIT.md](PRO_AUDIT.md) (single Pro tier @ €19/mo / €190/yr placeholder, feature list, App Store routing posture). [BRAND.md](BRAND.md) (color discipline, typography variants, "generous, never dense", coral as signal).

### Reconnaissance findings (re-confirmed before authoring)

- **H.6 placeholder shape verified.** [web/src/app/page.tsx](web/src/app/page.tsx) was a 21-line "Mony / Coming soon" centered block — full replacement with no carry-over. The H.6 scaffold's Inter + Fraunces wiring at [web/src/app/layout.tsx](web/src/app/layout.tsx) is already in place via `next/font/google`, exposing `--font-inter` / `--font-fraunces` CSS variables consumed by the Tailwind `fontFamily` extension.
- **Tailwind token names are kebab-case.** The H.7 spec used camelCase (`brandText`, `brandPressed`, `borderStrong`) but [web/tailwind.config.ts:20-46](web/tailwind.config.ts#L20) ships kebab-case names (`brand-text`, `brand-pressed`, `border-strong`). All H.7 components use the actual H.6 names — `bg-brand`, `text-brand-text`, `hover:bg-brand-pressed`, `border-border-strong`, `bg-surface-elevated`, etc.
- **Font-size scale sufficient.** H.6 added custom keys (`xs/sm/md/lg/xl/xxl/xxxl/hero` mirroring mobile theme) under `extend.fontSize`; Tailwind's defaults (`2xl`–`9xl`) remain available alongside since `extend` merges. Marketing hero uses `text-5xl md:text-6xl lg:text-7xl` (48 / 60 / 72px) which fits without further extension. **No Tailwind config edit required.**
- **`lucide-react` confirmed absent.** Single new dep. The npm semver range was a footgun — `lucide-react@latest` resolved to legacy `1.14.0` from 2020 (the package restarted versioning at 0.x). Manually pinned to `^0.460.0` in [web/package.json](web/package.json) to get the modern API. All required icons present in `node_modules/lucide-react/dist/esm/icons/`: `zap`, `globe`, `shield-check`, `sparkles`, `check`, `chevron-down`.

### Latent H.6 bugs caught + fixed

H.6 didn't run `npx tsc --noEmit` against `/web` because `node_modules/` didn't exist yet. Once H.7's `npm install` populated deps, two implicit-`any` errors surfaced in the Supabase SSR cookie adapters:

- [web/src/lib/supabase/server.ts:33](web/src/lib/supabase/server.ts#L33) — `setAll(cookiesToSet)` parameter implicitly `any`.
- [web/src/middleware.ts:45](web/src/middleware.ts#L45) — same shape.

Fix: imported `CookieOptions` from `@supabase/ssr` and explicitly typed the parameter as `{ name: string; value: string; options: CookieOptions }[]`. Drop-in additive change; no behavior shift.

### Files added (9)

#### UI primitives (3)

| Path | Purpose |
| --- | --- |
| [web/src/components/ui/Button.tsx](web/src/components/ui/Button.tsx) | Pill-shaped `forwardRef` button. Three variants (`primary` brand-coral, `outline` border-strong, `ghost` no-chrome) × two sizes (`md` / `lg`). Focus-visible ring uses brand color over background offset for WCAG-friendly keyboard nav. |
| [web/src/components/ui/Container.tsx](web/src/components/ui/Container.tsx) | `max-w-6xl` centered horizontal container with responsive padding (`px-6 lg:px-8`). The page-wide horizontal rhythm. |
| [web/src/components/ui/Section.tsx](web/src/components/ui/Section.tsx) | Vertical-rhythm wrapper (`py-20 md:py-28`). Optional `id` for anchor scrolling. |

#### Landing sections (6)

| Path | Purpose |
| --- | --- |
| [web/src/components/landing/Header.tsx](web/src/components/landing/Header.tsx) | Sticky top nav with backdrop blur. `Mony` wordmark (Fraunces 2xl), three anchor links (`#features`, `#pricing`, `#faq`), single outline "Connexion" CTA pointing at `/upgrade`. |
| [web/src/components/landing/Hero.tsx](web/src/components/landing/Hero.tsx) | Full-viewport hero. Two-line Fraunces headline ("Vendez. Découvrez. Connectez-vous.") with the third clause in coral, Inter subhead, twin CTAs ("Découvrir Mony Pro" → `#pricing`, "Télécharger l'app" → `#download`). Decorative twin radial gradients (coral + violet) form the backdrop — pure CSS, no asset dependency. |
| [web/src/components/landing/Features.tsx](web/src/components/landing/Features.tsx) | Four-card grid. Each card: `bg-surface-elevated`, `border-border`, `rounded-xl`, `p-8`, lucide icon in coral, Fraunces title, Inter body. Cards: Vidéo first / Local et mondial / Paiement sécurisé / Communauté. |
| [web/src/components/landing/Pricing.tsx](web/src/components/landing/Pricing.tsx) | Single-tier "Mony Pro" card. Coral `RECOMMANDÉ` pill, "19 €" big-display + "/mois" + "ou 190 € / an" subnote, five-feature checklist with lucide `Check` icons in coral, full-width primary CTA, "open the app to upgrade" subcopy + placeholder App Store / Play Store badges (anchored to `#download` until apps publish). |
| [web/src/components/landing/FAQ.tsx](web/src/components/landing/FAQ.tsx) | Seven-question accordion using native `<details>` / `<summary>`. Pure CSS rotation on the chevron via Tailwind's `group-open:rotate-180`. No JS, full SEO indexing, native a11y. |
| [web/src/components/landing/Footer.tsx](web/src/components/landing/Footer.tsx) | Three link columns (Produit / Légal / Contact) + brand block. `bg-surface` (one elevation step DOWN from sections above) anchors page bottom. © 2026 line. |

### Files modified (3)

| Path | Change |
| --- | --- |
| [web/src/app/page.tsx](web/src/app/page.tsx) | H.6 placeholder fully replaced. Server Component composes Header + Hero + Features + Pricing + FAQ + Footer. |
| [web/src/app/layout.tsx](web/src/app/layout.tsx) | `lang="en"` → `lang="fr"`. Metadata expanded from minimal `{title, description}` to full SEO payload: `title`, `description`, `metadataBase`, `openGraph` (title, description, url, siteName, images, locale `fr_FR`, type), `twitter` (`summary_large_image` card with same image). |
| [web/next.config.ts](web/next.config.ts) | Added `outputFileTracingRoot: path.join(__dirname)` to silence the multi-lockfile warning (the repo has both `/package-lock.json` for mobile and `/web/package-lock.json` for web; the trace root pin tells Next.js the web build only needs `/web/`'s graph). |
| [web/src/lib/supabase/server.ts](web/src/lib/supabase/server.ts) | Imported `CookieOptions` type; explicitly typed the `setAll` parameter. H.6 latent-any fix. |
| [web/src/middleware.ts](web/src/middleware.ts) | Same H.6 latent-any fix. |
| [web/package.json](web/package.json) | Added `lucide-react: ^0.460.0` to dependencies. (npm auto-pinned to `1.14.0` first; manually corrected to `0.460.x` modern line.) |
| [web/package-lock.json](web/package-lock.json) | Auto-generated by `npm install` (committed). |

### FR-only locale decision

The H.7 landing ships in French only. Two reasons:

1. **Mobile precedent.** The mobile app's primary i18n surface is FR (with EN as the secondary). The web companion mirroring this skews the brand toward the launch market — France + francophone EU.
2. **Translation cost vs. v1 reach.** Half the landing copy is marketing language — careful EN translation of brand voice (the BRAND.md "premium-marketplace, not corporate-sterile" tone) is non-trivial work. v1 ships FR; EN follows when there's enough signal that anglophone visitors land here directly (referral analytics > 10–15% EN locale would justify the translation pass).

Internationalization-readiness pre-staged in two places for the future EN flip:

- `<html lang="fr">` + `openGraph.locale: 'fr_FR'` are explicit values, not defaults — flipping to a multi-locale build means adding `next-intl` or App Router's `[locale]` segment alongside, not retrofitting.
- All copy strings are plain JSX text (no string concatenation that would resist extraction); a future `next-intl` migration is mechanical.

### Pricing CTA decision: routes to "open in app", not /upgrade

The Pricing card's CTA is `<a href="#download">` (anchor scrolls to placeholder store badges) rather than `/upgrade`. Rationale:

`/upgrade` is auth-gated. An unauthenticated visitor — which is who lands on the marketing page from social/search/ads — would hit the H.6 redirect-to-`/`, ending up back on the same page. Confusing loop.

The correct path to upgrade is the mobile app's `useUpgradeFlow` (H.5), which mints a magic link and lands the user on `/upgrade` already-authed. The Pricing card's subcopy makes this explicit: *"Ouvrez l'app Mony et touchez « Passer Pro » dans votre profil."* Combined with the placeholder store badges, the message communicates "this is a mobile-first product" and avoids the dead-end loop.

### Open Graph image deferred

The metadata references `/og-image.png` (1200×630) at [web/src/app/layout.tsx](web/src/app/layout.tsx) but H.7 does not ship the asset. Two paths to close it post-H.7:

| Path | Work | Trade-off |
| --- | --- | --- |
| Static asset | Commit `web/public/og-image.png` (1200×630, brand mark on dark stack). | Static, cached, fastest. No dynamic per-page personalization. |
| Dynamic via `next/og` | New route at `app/api/og/route.tsx` that returns an `ImageResponse` with the brand mark. | Per-page customization possible (e.g., `/api/og?title=...`). Slightly slower first-paint of share preview. |

Until either lands, share previews on Twitter / LinkedIn / iMessage fall back to a plain link card with title + description (no hero image). Not a launch blocker.

### Verification

- **`cd web && npx tsc --noEmit`** → exit 0 (after the H.6 latent-any fixes).
- **`cd web && npx next build`** → succeeds. Build output:
  - `/` prerenders as **static**, 3.46 kB page + 106 kB First Load JS.
  - `/auth/error` static, 131 B.
  - `/auth/callback`, `/dashboard`, `/upgrade` server-rendered on demand (auth-gated).
  - Middleware 88.3 kB.
- **Mobile `tsc --noEmit`** → exit 0 (mobile is byte-identical; the `web/**` exclude from H.6 holds).
- **Mobile codebase changes outside /web** → zero. `git diff --name-only HEAD | grep -v "^web/"` returns empty (the line-ending CRLF warnings shown by git are harmless OS artifacts, not file modifications).
- **No new mobile dependencies.** `package.json` (root) untouched.
- **Manual / runtime (deferred to user):**
  - `cd web && npm run dev` → boots on `http://localhost:3000`. Real landing renders with header sticky, hero radial gradients, four feature cards, pricing tier card, seven-question FAQ accordion, footer.
  - Resize to phone width → grid collapses to 1 column, header nav links hide (only logo + Connexion remain), pricing card stays centered.
  - Click any FAQ summary → details opens, chevron rotates 180°. Works without JS (verifiable via DevTools "Disable JavaScript").
  - Push to GitHub → Vercel auto-redeploys → live at `mony.vercel.app`.

### Phase H mobile/web status (post-H.7)

| Step | Status | Surface |
| --- | --- | --- |
| H.1 | ✓ | Audit (PRO_AUDIT.md) |
| H.2 | ✓ | `subscriptions` table + trigger |
| H.3 | ✓ | `useIsPro` / `useListingCap` / cap enforcement |
| H.4 | ✓ | Three banner placements |
| H.5 | ✓ | Magic-link Edge Function + real `useUpgradeFlow` |
| H.6 | ✓ | Web scaffold + auth bridge + placeholders |
| **H.7** | **✓ this step** | **Real public landing** |
| H.8 | next | Stripe Checkout integration on `/upgrade` |
| H.10 | future | Real `/dashboard` + Customer Portal link |
| H.11 | future | `/admin/subscriptions` |
| H.12 | future | `/api/stripe/webhook` |

### H.8 handoff

H.8 ships the real Stripe Checkout integration on `/upgrade`. Concrete pieces:

1. **Stripe Dashboard prep (manual setup).**
   - Create a `Mony Pro` Product.
   - Create two Prices on it: monthly (€19) and yearly (€190).
   - Capture the price IDs (`price_1...`) for the env vars.
2. **Env vars (Vercel + local).**
   - `STRIPE_SECRET_KEY` (server-side, NOT `NEXT_PUBLIC`).
   - `STRIPE_PUBLISHABLE_KEY` (`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` for the client SDK if needed).
   - `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY`.
3. **Server-side: `app/api/stripe/checkout/route.ts`.**
   - POST handler. Verifies caller's auth via `getSupabaseServer().auth.getUser()`.
   - Creates a `mode: 'subscription'` Checkout session with `line_items: [{ price: STRIPE_PRICE_MONTHLY, quantity: 1 }]`, `customer_email: user.email`, `metadata: { user_id, seller_id }`, `success_url: ${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`, `cancel_url: ${origin}/upgrade`.
   - Returns `{ url }`.
4. **Client-side: `/upgrade` page upgrade.** Replace the H.6 placeholder with: heading + price chooser (monthly/yearly toggle) + a `<form action={...}>` that POSTs to `/api/stripe/checkout` and redirects to `session.url`. Stays auth-gated (existing `getUser()` redirect to `/`).
5. **Test mode for v1.** Use Stripe test keys + test prices. Live-mode flip is a separate H.14 step alongside DNS / production go-live.

The H.12 webhook handler is a pre-existing future step — shipped separately so subscription state syncs to `subscriptions` (the H.2 trigger handles `is_pro` mirroring automatically).

### Reversion

```bash
git revert <H.7 commit>
```

Removes:
- 9 new files (3 UI primitives, 6 landing components).
- The `lucide-react` dependency from `package.json` + lockfile.
- The H.7 modifications to `page.tsx`, `layout.tsx`, `next.config.ts`, `server.ts`, `middleware.ts`.

After revert, `cd web && npm install` re-resolves the dependency graph without `lucide-react`. The H.6 placeholder returns at `/`. Both H.6's auth bridge and the H.7-fixed Supabase SSR types stay intact (they were strict improvements not coupled to the landing).

If only the landing UI should be removed but the H.6 latent-any fixes should stay, the surgical revert is `git checkout HEAD -- web/src/app/page.tsx web/src/app/layout.tsx` plus `rm -r web/src/components/landing web/src/components/ui` plus `npm uninstall lucide-react`. But the simple `git revert` is preferred unless that surgical state is specifically wanted.

---

## Step H.7.1 Changelog (2026-05-04) — Web i18n Foundation (EN/FR/AR via next-intl)

JS-only step, scoped to `/web/`. Integrates `next-intl` with three locales (English default, French, Arabic), locale-prefixed routing for user-facing pages, full translations of every H.7 landing component + H.6 upgrade/dashboard placeholders, locale-detection middleware composed with the existing Supabase session-refresh, and a header language switcher. Auth callback + auth error stay non-localized at root paths. Mobile codebase byte-identical.

> **Audit referenced:** PRO_AUDIT.md §10 open-question 9 (multi-region pricing — H.7.3's scope) and the H.7 changelog's "FR-only locale decision" (now superseded as planned). next-intl v4 was the active stable line at install time.

### Reconnaissance findings (re-confirmed before authoring)

- **`next-intl` confirmed absent.** Single new dep, pinned to `^4.11.0`. Compatible with Next.js 15 + React 19.
- **Existing Tailwind tokens are kebab-case.** Carryover from H.6/H.7 — components already use `text-text-secondary`, `bg-surface-elevated`, etc. The LanguageSwitcher matches.
- **Routes pre-i18n:** `src/app/page.tsx`, `src/app/upgrade/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/layout.tsx` (the H.7 root), plus `src/app/auth/callback/route.ts` and `src/app/auth/error/page.tsx`.
- **H.8 pages don't exist yet.** The H.7.1 spec mentioned `/upgrade/success/page.tsx` and `/upgrade/canceled/page.tsx` for translation, but H.8 has not shipped — those don't exist on disk. H.7.1 only translates what's currently committed.
- **String inventory.** All FR copy lives in 6 landing components ([Header](web/src/components/landing/Header.tsx), [Hero](web/src/components/landing/Hero.tsx), [Features](web/src/components/landing/Features.tsx), [Pricing](web/src/components/landing/Pricing.tsx), [FAQ](web/src/components/landing/FAQ.tsx), [Footer](web/src/components/landing/Footer.tsx)). H.6's upgrade/dashboard/auth-error placeholders carry English copy. H.7.1 normalizes everyone to `t()`.

### Files added (8)

| Path | Purpose |
| --- | --- |
| [web/src/i18n/routing.ts](web/src/i18n/routing.ts) | `defineRouting({ locales: ['en','fr','ar'], defaultLocale: 'en', localePrefix: 'as-needed' })` + locale-aware nav primitives (`Link`, `redirect`, `usePathname`, `useRouter`, `getPathname`) for use under `[locale]/`. |
| [web/src/i18n/request.ts](web/src/i18n/request.ts) | `getRequestConfig` reads the per-request locale and dynamic-imports `messages/<locale>.json`. Wired via the `next-intl/plugin` in `next.config.ts`. Falls back to default locale on unknown values. |
| [web/messages/en.json](web/messages/en.json) | English catalog — source-of-truth voice. ~75 keys across 9 namespaces (`brand`, `nav`, `hero`, `features`, `pricing`, `faq`, `footer`, `upgrade`, `dashboard`, `languageSwitcher`). |
| [web/messages/fr.json](web/messages/fr.json) | French catalog — preserves the H.7 FR copy verbatim where appropriate, ports auth/dashboard placeholders to FR. |
| [web/messages/ar.json](web/messages/ar.json) | Arabic catalog — best-effort first pass, **pending professional review** before public AR launch. RTL layout polish is H.7.2. |
| [web/src/components/ui/LanguageSwitcher.tsx](web/src/components/ui/LanguageSwitcher.tsx) | `'use client'` dropdown — Globe icon + active locale label + chevron. Closes on outside click + Escape. Uses `next-intl`'s `useRouter().replace(pathname, { locale })` so the swap preserves the path and writes the `NEXT_LOCALE` cookie. |
| [web/src/app/layout.tsx](web/src/app/layout.tsx) | Top-level root layout — `<html>`/`<body>`/fonts. Resolves `<html lang>` from `NEXT_LOCALE` cookie → `x-next-intl-locale` header → defaultLocale. One root layout for both the locale tree AND the auth tree. |
| [web/src/app/[locale]/layout.tsx](web/src/app/[locale]/layout.tsx) | Nested layout for the locale tree. `setRequestLocale(locale)` + `NextIntlClientProvider` + `generateStaticParams` + locale-aware `generateMetadata`. No `<html>`/`<body>` (those live at the root). |

### Files moved (4 via git mv)

Preserves blame history.

```
src/app/layout.tsx           → src/app/[locale]/layout.tsx (then rewritten)
src/app/page.tsx             → src/app/[locale]/page.tsx
src/app/upgrade/page.tsx     → src/app/[locale]/upgrade/page.tsx
src/app/dashboard/page.tsx   → src/app/[locale]/dashboard/page.tsx
```

### Files modified (10)

| Path | Change |
| --- | --- |
| [web/package.json](web/package.json) | Added `next-intl: ^4.11.0`. |
| [web/package-lock.json](web/package-lock.json) | Auto-updated. |
| [web/next.config.ts](web/next.config.ts) | Wrapped export with `createNextIntlPlugin('./src/i18n/request.ts')(nextConfig)`. |
| [web/README.md](web/README.md) | Added Locales section (URL conventions, "adding a new locale" runbook, AR translation quality caveat). |
| [web/src/middleware.ts](web/src/middleware.ts) | Composed: `intlMiddleware(request)` first to resolve locale + emit any redirect/rewrite, then Supabase session refresh layered on the same response object. Matcher excludes `api`, `auth/callback`, `auth/error`. |
| [web/src/components/landing/Header.tsx](web/src/components/landing/Header.tsx) | `getTranslations('nav')` + `getTranslations('brand')`. Locale-aware `Link` from `@/i18n/routing` for `/` and `/upgrade`. Mounts `<LanguageSwitcher />` next to the Connexion CTA. |
| [web/src/components/landing/Hero.tsx](web/src/components/landing/Hero.tsx) | Headline split into `headlineLead` + `headlineAccent` so translators choose where the coral cut falls. |
| [web/src/components/landing/Features.tsx](web/src/components/landing/Features.tsx) | Constant 4-feature `[{Icon, key}]` array; copy resolves via `t('${key}.title')` / `t('${key}.body')`. |
| [web/src/components/landing/Pricing.tsx](web/src/components/landing/Pricing.tsx) | All copy through `t()`. Price strings (`priceMonthly`, `yearlyNote`) are per-locale to allow `19 €` vs `€19` conventions. Multi-currency conversion is H.7.3. |
| [web/src/components/landing/FAQ.tsx](web/src/components/landing/FAQ.tsx) | Constant 7-question key array; each `t('${key}.q')` + `t('${key}.a')`. |
| [web/src/components/landing/Footer.tsx](web/src/components/landing/Footer.tsx) | Locale-aware `Link` for the brand wordmark. Column headings + link labels through `t()`. |
| [web/src/app/[locale]/upgrade/page.tsx](web/src/app/[locale]/upgrade/page.tsx) | `setRequestLocale(locale)` + `redirect({ href: '/', locale })` for unauth + `t()` for placeholder copy. Carries `email` through `t('welcomeWith', { email })` interpolation. |
| [web/src/app/[locale]/dashboard/page.tsx](web/src/app/[locale]/dashboard/page.tsx) | Symmetric to upgrade. |
| [web/src/app/[locale]/page.tsx](web/src/app/[locale]/page.tsx) | `setRequestLocale(locale)` to keep static rendering. Composition unchanged. |

### Translations — quality and caveats

- **EN** — written by team. Source-of-truth voice. Will receive editorial polish before launch.
- **FR** — written by team. Preserves H.7's existing FR copy verbatim where the catalog key matches the original component literal; added new keys for upgrade/dashboard placeholders that were originally English.
- **AR** — best-effort initial translation. Native-quality Arabic for marketing copy is its own discipline; H.7.1 ships a working translation but the changelog flags this for **professional review before AR market launch**. The keys cover all 75 strings; sentences are grammatically correct and idiomatic, but a native marketing copywriter should review for tone consistency with BRAND.md's "premium, considered, mobile-native" positioning.

The README's Locales section documents this caveat for any contributor adding new strings.

### Routing decisions

- **`localePrefix: 'as-needed'`** keeps the default locale at `/` (no `/en` prefix). This protects canonical SEO (one URL per page) and matches the convention most modern multi-locale sites use. The trade-off vs `'always'` (everyone gets a prefix) is that analytics segmenting EN visitors requires reading the `NEXT_LOCALE` cookie or absence-of-prefix; acceptable for v1.
- **Auth callback + error stay at root** as required by the spec. The middleware matcher excludes `auth/callback` (so the H.5 magic-link landing URL stays canonical at `mony.vercel.app/auth/callback?...` regardless of any locale signal) and `auth/error` (so an error landing path doesn't get locale-prefixed weirdness). The auth/error page itself stays English-only — translating it would require either moving it under `[locale]/` (against spec) or reading `NEXT_LOCALE` cookie at request time and calling `getTranslations({locale: cookie})`. Acceptable v1 trade-off; auth/error is rare.
- **API routes** stay at root. None exist yet (H.8+); the matcher pre-excludes `api` so no future API endpoints accidentally get locale-redirected.

### Cookie persistence

`NEXT_LOCALE` cookie is written by `next-intl`'s middleware whenever locale changes, plus by the LanguageSwitcher's explicit `router.replace(pathname, { locale })` call. Default lifetime (per `next-intl`) is 1 year. Re-visit any time within that window → the cookie steers `<html lang>` correctly even before middleware runs (the root layout reads cookie first, header second, defaultLocale third).

### Layout architecture decision

The H.7.1 spec didn't address what happens to non-localized routes when the layout moves under `[locale]/`. Next.js requires every route to descend from a root layout that renders `<html>`/`<body>`; moving the only layout under `[locale]/` orphans `auth/error` and `auth/callback`.

Decision: keep ONE top-level root layout at [web/src/app/layout.tsx](web/src/app/layout.tsx) with the universal `<html>`/`<body>`/fonts, and demote `[locale]/layout.tsx` to a nested layout that ONLY adds `setRequestLocale` + `NextIntlClientProvider`. The `<html lang>` resolves at the root via cookie/header priority chain. The trade-off vs route groups (e.g., `(public)/[locale]/...` + `(technical)/auth/...`) is that route groups would force more file shuffling and duplicate the html/body/fonts boilerplate; one-root-plus-nested is simpler and the lang-resolution chain is robust enough.

### Verification

- **`cd web && npx tsc --noEmit`** → exit 0.
- **`cd web && npx next build`** → succeeds. 14 static pages prerendered:
  - `/[locale]` (●) → `/en`, `/fr`, `/ar` static at 2.56 kB each + 121 kB First Load JS.
  - `/[locale]/upgrade` (●) → `/en/upgrade`, `/fr/upgrade`, `/ar/upgrade` (172 B each — auth-gated, prerendered as redirect-to-/ for the no-cookie case; dynamically rendered with the user's email when cookies are present).
  - `/[locale]/dashboard` (●) → same pattern.
  - `/auth/callback` (ƒ) → dynamic, 124 B.
  - `/auth/error` (ƒ) → dynamic, 124 B.
  - Middleware bundle 129 kB (up from 88 kB pre-i18n; the next-intl middleware contributes the diff).
- **Mobile `tsc --noEmit`** → exit 0.
- **Mobile codebase outside /web** → unchanged. The only `M` entry outside /web is `src/lib/web/constants.ts`, which is the user's earlier `WEB_BASE_URL` edit (not part of H.7.1).
- **Manual / runtime (deferred to user):**
  - `cd web && npm run dev` → boots on http://localhost:3000.
  - Visit `/` → EN landing.
  - Visit `/fr` → FR landing.
  - Visit `/ar` → AR content (LTR layout for v1; H.7.2 ships RTL).
  - Tap LanguageSwitcher → URL updates, `NEXT_LOCALE` cookie set, page re-renders with the new locale.
  - Refresh after closing the browser → cookie sticks, locale persists.
  - Push to GitHub → Vercel auto-deploys → live at the configured Vercel URL across all 3 locales.

### Latent H.6 fix carry-forward

H.7.1 inherits H.7's H.6 fix for `@supabase/ssr`'s `setAll(cookiesToSet)` parameter typing — present in both [server.ts](web/src/lib/supabase/server.ts) and [middleware.ts](web/src/middleware.ts).

### Phase H mobile/web status (post-H.7.1)

| Step | Status | Surface |
| --- | --- | --- |
| H.1–H.5 | ✓ | Mobile feature-complete |
| H.6 | ✓ | Web scaffold + auth bridge |
| H.7 | ✓ | Real public landing (FR-only) |
| **H.7.1** | **✓ this step** | **i18n: EN/FR/AR** |
| H.7.2 | next | RTL polish for AR (Tailwind logical properties, dir="rtl", AR font fallback) |
| H.7.3 | next | Multi-currency picker (3 currencies × 2 cadences = 6 Stripe Price IDs) |
| H.8 | future | Stripe Checkout on `/upgrade` |
| H.10 | future | Real `/dashboard` + Customer Portal link |
| H.11 | future | `/admin/subscriptions` |
| H.12 | future | `/api/stripe/webhook` |

### H.7.2 handoff (RTL)

H.7.2 polishes the AR experience to feel native. Concrete pieces:

1. **`dir="rtl"` on AR pages.** Add `dir={locale === 'ar' ? 'rtl' : 'ltr'}` to either the root layout's `<html>` or a wrapper inside `[locale]/layout.tsx`. The fonts already support Arabic via Inter's broad coverage; a dedicated Arabic font (Cairo, Noto Naskh Arabic) is a follow-up if Inter's AR rendering looks visually weak.
2. **Tailwind logical properties.** Audit components for `ml-*` / `mr-*` / `pl-*` / `pr-*` and swap to `ms-*` / `me-*` / `ps-*` / `pe-*`. Tailwind v3.4 supports these natively; the H.7 components mostly use symmetric padding (`px-*`) so the audit should be quick.
3. **Icon flips.** `ChevronDown` is symmetric (no flip needed). The Hero's `→` arrow in "Go to dashboard →" should mirror to `←` in RTL — Tailwind's `[direction:ltr]` arbitrary or a flexbox-`row-reverse` toggle handles this.
4. **Read-pattern visual checks.** The Pricing card's checklist reads top-to-bottom in any direction, but the Header's logo-then-nav-then-CTA flow should mirror — with `dir="rtl"`, the flex container reverses naturally if the layout uses logical properties. Test in browser.

### H.7.3 handoff (multi-currency)

H.7.3 ships the currency picker. Concrete pieces:

1. **Stripe Dashboard prep (manual).** Create 6 Prices on the existing `Mony Pro` product: 3 currencies × 2 cadences (EUR-monthly, EUR-yearly, USD-monthly, USD-yearly, AED-monthly, AED-yearly).
2. **Mobile-side currency detection.** The mobile app already has `useDisplayCurrency` infrastructure — Phase H' currency conversion. The web side mirrors the same pattern: detect via Accept-Language country code → map to currency → store in NEXT_CURRENCY cookie.
3. **Pricing copy refactor.** The current `priceMonthly` / `yearlyNote` keys per-locale need additional per-currency variants. Probably restructure to `pricing.<locale>.<currency>.priceMonthly` or use ICU `selectordinal` on currency. Decision in H.7.3.
4. **Stripe Checkout session creation.** When H.8 lands, the `app/api/stripe/checkout/route.ts` reads the user's currency choice and selects the matching Stripe price ID. Multi-currency Checkout is a Stripe-supported feature out of the box.

### Reversion

```bash
git revert <H.7.1 commit>
```

Restores the FR-only H.7 state. Note: file moves are tracked via `git mv` so the revert correctly restores file paths. The `messages/` directory and `src/i18n/` are removed; the moved pages return to their `src/app/<page>/` locations; the H.7 FR-language root layout returns.

If only the AR locale should be removed (e.g., AR translation review goes south), the surgical edit is: remove `'ar'` from `routing.ts`'s `locales` array, remove the `LanguageSwitcher`'s AR option, delete `messages/ar.json`. EN + FR continue working.

---

## Step H.7.2 Changelog (2026-05-04) — RTL Polish for Arabic Locale

JS-only step, scoped to `/web/`. Adds `dir="rtl"` resolution on AR pages, converts the three directional Tailwind utilities found in the H.7 / H.7.1 codebase to logical equivalents (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`, `start-*`, `end-*`), flips the literal Unicode arrow in the AR `goToDashboard` translation. Five files touched in total (root layout + 2 components + 1 catalog + the changelog). EN and FR layouts remain byte-identical.

> **Audit referenced:** PRO_AUDIT.md §10 open-question 9 (multi-region pricing — H.7.3's scope) and the H.7.1 changelog's H.7.2 handoff list (this implements it).

### Reconnaissance findings

A single comprehensive grep covered the conversion surface:

```
rg "\\bml-|\\bmr-|\\bpl-|\\bpr-|\\btext-left\\b|\\btext-right\\b|\\bborder-l\\b|\\bborder-r\\b|\\brounded-l\\b|\\brounded-r\\b|\\bleft-|\\bright-" web/src/
```

Three non-comment hits across the entire H.7 + H.7.1 surface:

| File:line | Original | Why directional | Conversion |
| --- | --- | --- | --- |
| [LanguageSwitcher.tsx:99](web/src/components/ui/LanguageSwitcher.tsx#L99) | `absolute right-0 …` | Dropdown anchors to trailing edge of trigger; should flip in RTL. | `absolute end-0 …` |
| [LanguageSwitcher.tsx:110](web/src/components/ui/LanguageSwitcher.tsx#L110) | `text-left text-sm` | Dropdown option labels read in writing direction. | `text-start text-sm` |
| [Pricing.tsx:45](web/src/components/landing/Pricing.tsx#L45) | `absolute -top-3 left-10 …` | "Recommended" pill anchors to leading edge of pricing card; should flip in RTL. | `absolute -top-3 start-10 …` |

The H.7.2 spec also expected RTL audits across:
- `flex-row-reverse` / `justify-start` / etc. — none present (Tailwind's flex utilities honor writing direction natively, no explicit reversal needed).
- `border-l*` / `border-r*` / `rounded-l*` / `rounded-r*` — none present in H.7's components.
- Horizontal arrow icons (`ArrowRight`, `ArrowLeft`, `ChevronRight`, `ChevronLeft`) — **none rendered in components**. The only `→` characters in `.tsx` files are inside JSDoc comments (not user-visible). The only rendered arrows live in translation catalog strings.

### Arrow / chevron audit

| Rendered icon | File | Direction | RTL action |
| --- | --- | --- | --- |
| `ChevronDown` (FAQ accordion summary) | [FAQ.tsx:48](web/src/components/landing/FAQ.tsx#L48) | Vertical (rotates to ChevronUp via `group-open:rotate-180`) | **Skip** — vertical rotation is locale-invariant. |
| `ChevronDown` (LanguageSwitcher trigger chevron) | [LanguageSwitcher.tsx:88](web/src/components/ui/LanguageSwitcher.tsx#L88) | Vertical (rotates 180° on dropdown open) | **Skip** — same as above. |
| `Globe` (LanguageSwitcher trigger leading icon) | [LanguageSwitcher.tsx:84](web/src/components/ui/LanguageSwitcher.tsx#L84) | Symmetric glyph | **Skip** — no mirroring needed. |
| `Zap`, `Globe`, `ShieldCheck`, `Sparkles`, `Check` (Features + Pricing) | [Features.tsx](web/src/components/landing/Features.tsx), [Pricing.tsx](web/src/components/landing/Pricing.tsx) | Symmetric glyphs | **Skip** — no mirroring needed. |
| `→` U+2192 in `goToDashboard` translation (rendered) | [messages/ar.json:109](web/messages/ar.json#L109) | Horizontal | **Flip** — replace with `←` U+2190 in AR catalog. |

The Unicode `→` (U+2192 RIGHTWARDS ARROW) is a strong-LTR codepoint that does not auto-mirror in RTL contexts — the bidi algorithm preserves the glyph's visual direction regardless of paragraph direction. To make the AR sentence's arrow point in the RTL reading direction (forward = visually leftward in RTL), the AR translation uses `←` U+2190 LEFTWARDS ARROW. EN and FR keep `→`.

### Files modified (5)

| Path | Change |
| --- | --- |
| [web/src/app/layout.tsx](web/src/app/layout.tsx) | Added `RTL_LOCALES = new Set(['ar'])` constant; resolved `dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr'` from the same locale chain that resolves `lang`; rendered `<html lang={locale} dir={dir} …>`. The chain (cookie → `x-next-intl-locale` header → defaultLocale) means even non-locale routes (auth/error, auth/callback) honor the visitor's most recent choice. |
| [web/src/components/ui/LanguageSwitcher.tsx](web/src/components/ui/LanguageSwitcher.tsx) | `right-0` → `end-0` (dropdown anchor); `text-left` → `text-start` (option labels). |
| [web/src/components/landing/Pricing.tsx](web/src/components/landing/Pricing.tsx) | `left-10` → `start-10` (Recommended pill anchor). |
| [web/messages/ar.json](web/messages/ar.json) | `goToDashboard`: `"انتقل إلى لوحة التحكم →"` → `"← انتقل إلى لوحة التحكم"`. The `←` codepoint placed at the JSON-string start; in RTL render context it appears at the visual end of the rendered line, pointing toward the reading direction. |
| `PROJECT_AUDIT.md` | This changelog. |

### What flips automatically (no code change needed)

When `dir="rtl"` is set on `<html>`, the browser's CSS engine + the bidi algorithm flip these without per-component overrides:

- **Flexbox row direction.** `flex` + `justify-between` distributes children based on writing direction. The Header's `<Link>logo</Link>` ↔ `<nav>` ↔ `<switcher group>` row reverses in RTL with no `flex-row-reverse` needed.
- **Grid column order.** The Footer's `grid grid-cols-1 md:grid-cols-4` lays out columns in writing direction.
- **Logical Tailwind utilities** (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`, `border-s`, `border-e`, `rounded-s-*`, `rounded-e-*`). All resolve to physical properties based on `<html dir>`.
- **`text-align: start/end`** on paragraph text. Browser default for paragraph text inside an RTL document is right-aligned.

### What was already RTL-safe (no conversion required)

- All `px-*` / `py-*` / `mx-*` / `my-*` / `gap-*` utilities — symmetric, locale-invariant.
- `items-*` / `self-*` / `justify-*` (cross-axis) flex alignment — locale-invariant.
- The `space-y-*` utilities used in the upgrade / dashboard placeholders — vertical, locale-invariant.

### Arabic font decision

**Decision: ship Inter + system Arabic fallback for v1; document Cairo / Noto Sans Arabic as opt-in polish.**

Inter has limited Arabic glyph coverage; the browser falls back to system Arabic fonts:
- Mac / iOS: Geeza Pro
- Windows: Segoe UI
- Android: Noto Sans Arabic (already)

Quality varies across OS / browser combinations but is never broken — Arabic text renders legibly everywhere. The trade-off vs. shipping a dedicated webfont:

| Trade-off | Inter + system fallback (chosen) | Cairo / Noto Sans Arabic |
| --- | --- | --- |
| Visual consistency across OS | Lower (each OS uses its own Arabic font) | Higher (uniform on every device) |
| Initial load weight | Zero — system fonts | +~30–60 kB woff2 per AR visit |
| Marketing polish | Acceptable | Better |
| Implementation cost | None | ~20 lines (next/font import + conditional className + CSS selector) |

If a native AR speaker reviews the live `/ar` page and finds the rendering visually weak, the opt-in path is documented for the H.7.2 follow-up:

```ts
// web/src/app/[locale]/layout.tsx
import { Cairo } from 'next/font/google';

const cairo = Cairo({
  subsets: ['arabic'],
  variable: '--font-cairo',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

// Inside the LocaleLayout return:
<NextIntlClientProvider messages={messages} locale={locale}>
  <div className={locale === 'ar' ? cairo.variable : ''}>
    {children}
  </div>
</NextIntlClientProvider>
```

```css
/* web/src/app/globals.css */
html[lang="ar"] body {
  font-family: var(--font-cairo), var(--font-inter), system-ui, sans-serif;
}
```

This is a single-PR change requiring no other refactors. Defer until the AR visual review concludes.

### EN / FR regression check

The three Tailwind conversions (`right-0` → `end-0`, `text-left` → `text-start`, `left-10` → `start-10`) are mechanical drop-ins. In LTR (`<html dir="ltr">`):
- `end-0` resolves to `right: 0`. Same as before. ✓
- `text-start` resolves to `text-align: left`. Same as before. ✓
- `start-10` resolves to `left: 2.5rem`. Same as before. ✓

EN and FR layouts are byte-identical to H.7.1.

### Verification

- **`cd web && npx tsc --noEmit`** → exit 0.
- **`cd web && npx next build`** → succeeds. Same 14-route prerender as H.7.1; bundle sizes unchanged (the conversions are class-name-level edits with no JS impact).
- **Mobile `tsc --noEmit`** → exit 0.
- **Mobile codebase outside /web** → unchanged. The only non-/web `M` is `src/lib/web/constants.ts` (the user's prior WEB_BASE_URL edit, not part of H.7.2).
- **Manual / runtime (deferred to user):**
  - `cd web && npm run dev` → boots on http://localhost:3000.
  - Visit `/ar` → page reads RTL: brand wordmark anchors to visual right, nav/CTA group anchors to visual left, "Recommended" pill on the Pricing card sits on the visual right (leading edge in RTL), the LanguageSwitcher dropdown opens beneath its trigger anchored to the trailing edge. The `goToDashboard` arrow on `/ar/upgrade` points leftward (toward the RTL reading-direction end).
  - Visit `/` and `/fr` → byte-identical to H.7.1. No layout shifts.
  - Toggle the LanguageSwitcher between EN ↔ AR and watch the layout flip in real time on subsequent navigation.

### Phase H mobile/web status (post-H.7.2)

| Step | Status | Surface |
| --- | --- | --- |
| H.1–H.5 | ✓ | Mobile feature-complete |
| H.6 | ✓ | Web scaffold + auth bridge |
| H.7 | ✓ | Real public landing (FR-only at the time) |
| H.7.1 | ✓ | i18n EN/FR/AR |
| **H.7.2** | **✓ this step** | **RTL polish for AR** |
| H.7.3 | next | Multi-currency picker (3 currencies × 2 cadences) |
| H.8 | future | Stripe Checkout on `/upgrade` |
| H.10 | future | Real `/dashboard` + Customer Portal link |
| H.11 | future | `/admin/subscriptions` |
| H.12 | future | `/api/stripe/webhook` |

### H.7.3 handoff (multi-currency)

H.7.3 adds the currency picker. Concrete pieces, in dependency order:

1. **Stripe Dashboard prep (manual).** On the existing Mony Pro Product, create 6 Prices: `EUR-monthly`, `EUR-yearly`, `USD-monthly`, `USD-yearly`, `AED-monthly`, `AED-yearly`. Capture the `price_*` IDs into env vars.
2. **Currency catalog.** Restructure the `pricing` namespace: split per-currency price strings (`pricing.eur.priceMonthly = "€19"`, `pricing.usd.priceMonthly = "$22"`, `pricing.aed.priceMonthly = "AED 79"`) so the picker just reads the active currency. The yearly note follows the same shape.
3. **Currency cookie + picker.** New `NEXT_CURRENCY` cookie + a `<CurrencyPicker />` Client Component (similar shape to LanguageSwitcher) added next to it in the header. Detection priority: cookie → Accept-Language country (`fr-FR` → EUR, `en-US` → USD, `ar-AE` → AED) → fallback EUR.
4. **Pricing component.** Read currency via a server-side helper that mirrors the locale resolution chain. Pass to the active price strings.
5. **Stripe Checkout API route prep (H.8 dependency).** When H.8 lands, the `app/api/stripe/checkout/route.ts` reads cookies for both locale and currency, then selects the matching `STRIPE_PRICE_<CURRENCY>_<CADENCE>` env var.

### Reversion

```bash
git revert <H.7.2 commit>
```

Restores the H.7.1 state. The five edits are all mechanical drop-ins (one constant + three class-name swaps + one Unicode codepoint flip), so revert is clean. No deps changed; no files added or removed.

If only the dir resolution should be removed (keeping the logical Tailwind conversions for future RTL work), the surgical edit is to delete the `RTL_LOCALES` constant and `dir={dir}` attribute in `web/src/app/layout.tsx`. The logical utilities (`ms-*`, `text-start`, etc.) resolve to LTR by default with no `dir` set; EN/FR layouts stay correct.

---

## Step H.7.3 Changelog (2026-05-04) — Web Multi-currency (EUR / USD / AED)

JS-only step, scoped to `/web/`. Adds three-currency support to the public landing: EUR (default), USD, AED. Detection chain (cookie → Accept-Language country → fallback EUR) lives in a new server-side helper; a Client Component `CurrencyPicker` mirrors `LanguageSwitcher`'s shape in the header; pricing copy moves into per-currency subtrees in the message catalogs; the page opts into dynamic rendering so the cookie-driven currency resolves on every request. Six Stripe Price IDs (3 currencies × 2 cadences) documented in `.env.local.example` for the upcoming H.8 (revised) Checkout API route. Mobile codebase byte-identical.

> **Audit referenced:** PRO_AUDIT.md §10 open-question 9 (multi-region pricing — implemented here). The H.7.2 changelog's H.7.3 handoff list (this implements it).

### Reconnaissance findings

- **Pre-H.7.3 Pricing.tsx structure** ([web/src/components/landing/Pricing.tsx](web/src/components/landing/Pricing.tsx)) — single EUR-only flat namespace under `pricing.*`: `priceMonthly` (`"€19"`), `perMonth` (`"/ month"`), `yearlyNote` (`"or €190 / year (save ~17%)"`). Compound strings, easy to translate but only one currency.
- **Catalog layout** — three locale files (en/fr/ar) all carry the EUR copy. The H.7.3 refactor moves price atoms (`priceMonthly`, `cadenceMonthly`, `priceYearly`, `cadenceYearly`, `savings`) into per-currency subtrees while keeping locale-shared copy (heading, recommended, tierName, features, CTA, subcopy) flat at `pricing.*`.
- **LanguageSwitcher** ([web/src/components/ui/LanguageSwitcher.tsx](web/src/components/ui/LanguageSwitcher.tsx)) — Client Component, owns dropdown state, click-outside + Escape close, uses `next-intl`'s `useRouter().replace(pathname, { locale })` for navigation. The CurrencyPicker mirrors this shape verbatim.
- **Header mount point** — H.7.1's `<div className="flex items-center gap-4">` wrapper around LanguageSwitcher + Connexion CTA. H.7.3 inserts CurrencyPicker between them and tightens the gap to `gap-2` to fit three children.
- **Middleware composition** ([web/src/middleware.ts](web/src/middleware.ts)) — H.7.1's `intlMiddleware → Supabase` composition handles per-request locale routing. H.7.3 does NOT add a third middleware layer; currency is read via cookies on each request inside `getCurrency()`, no enforcement at the middleware level.

### Files added (3)

| Path | Purpose |
| --- | --- |
| [web/src/i18n/currency.ts](web/src/i18n/currency.ts) | `CURRENCIES` tuple, `Currency` type, `DEFAULT_CURRENCY`, `CURRENCY_COOKIE` name, `CURRENCY_LABELS` (code/symbol/label per currency), `COUNTRY_CURRENCY` mapping (Eurozone → EUR, Gulf → AED, English-speaking + AP → USD, fallthrough → EUR), `isCurrency()` type-guard. |
| [web/src/i18n/getCurrency.ts](web/src/i18n/getCurrency.ts) | Async server-side helper. Resolution priority: NEXT_CURRENCY cookie → Accept-Language country → fallback EUR. Cheap (two header/cookie reads); could be wrapped in React `cache()` if v1's call sites multiply. |
| [web/src/components/ui/CurrencyPicker.tsx](web/src/components/ui/CurrencyPicker.tsx) | Client Component mirroring LanguageSwitcher's shape. Coins icon trigger + dropdown of three currencies. On pick: writes `NEXT_CURRENCY` cookie via `document.cookie` (1-year max-age, SameSite=Lax) then `router.refresh()` to re-fetch the RSC payload — server reads the new cookie via `getCurrency()` and prices update without a full document reload. |

### Files modified (8)

| Path | Change |
| --- | --- |
| [web/messages/en.json](web/messages/en.json) | `pricing.*` flattened atoms (`priceMonthly`, `perMonth`, `yearlyNote`) replaced with per-currency subtrees `pricing.eur.*` / `pricing.usd.*` / `pricing.aed.*`. New shared template `pricing.yearlyTemplate` = `"or {price} {cadence} ({savings})"`. |
| [web/messages/fr.json](web/messages/fr.json) | Mirror — `pricing.yearlyTemplate` = `"ou {price} {cadence} ({savings})"`. EUR pricing uses `19 €` (FR convention), USD `19 $`, AED `AED 79`. |
| [web/messages/ar.json](web/messages/ar.json) | Mirror — `pricing.yearlyTemplate` = `"أو {price} {cadence} ({savings})"`. AR uses `/ شهرياً` for monthly cadence, `/ سنوياً` for yearly. |
| [web/src/components/landing/Pricing.tsx](web/src/components/landing/Pricing.tsx) | Reads `currency = await getCurrency()` then `getTranslations('pricing')` (shared) + `getTranslations(\`pricing.${currency}\`)` (per-currency atoms). The yearly note composes via `t('yearlyTemplate', { price, cadence, savings })` with values from the per-currency subtree. |
| [web/src/components/landing/Header.tsx](web/src/components/landing/Header.tsx) | Now async — reads `currency = await getCurrency()` and seeds `<CurrencyPicker initial={currency} />` so the trigger label matches the server-rendered Pricing card on first paint (no SSR-hydration flicker). Right-edge cluster: LanguageSwitcher + CurrencyPicker + Connexion CTA, with `gap-2` between pickers and `ms-2` margin on the CTA. |
| [web/src/app/[locale]/page.tsx](web/src/app/[locale]/page.tsx) | Added `export const dynamic = 'force-dynamic'`. The page now renders on every request so `getCurrency()`'s cookie read inside Pricing returns the actual visitor's choice rather than empty (Next.js 15's static-rendering behavior). |
| [web/.env.local.example](web/.env.local.example) | **Re-created** — was missing from git tracking (H.6 created it but never committed). Added the six `STRIPE_PRICE_<CURRENCY>_<CADENCE>` env vars + `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` per the H.8-revised env convention. |
| [web/README.md](web/README.md) | New "Currency" section — three currencies, detection chain, cookie name, six Stripe Price ID convention, "Adding a new currency" runbook, mobile-vs-web detection-independence note. |

### Pricing copy structure

Each locale catalog now has the shape:

```jsonc
"pricing": {
  // Locale-shared (one copy per locale)
  "heading": "Become a Pro seller",
  "sub": "One simple price. No commitment. Cancel anytime.",
  "recommended": "Recommended",
  "tierName": "Mony Pro",
  "yearlyTemplate": "or {price} {cadence} ({savings})",
  "feature1": "Unlimited listings (vs 10 on free)",
  // ... features / CTA / subcopy

  // Per-currency atoms (three copies per locale)
  "eur": { "priceMonthly": "€19", "cadenceMonthly": "/ month",
           "priceYearly": "€190", "cadenceYearly": "/ year",
           "savings": "save 17%" },
  "usd": { "priceMonthly": "$19", … },
  "aed": { "priceMonthly": "AED 79", … "savings": "save 21%" }
}
```

Renders compose like:

| Locale × currency | Monthly line | Yearly note |
| --- | --- | --- |
| EN × EUR | `€19 / month` | `or €190 / year (save 17%)` |
| FR × EUR | `19 € / mois` | `ou 190 € / an (économisez 17%)` |
| AR × USD | `19 $ / شهرياً` | `أو 19 $ / سنوياً (وفِّر 17%)` |
| EN × AED | `AED 79 / month` | `or AED 749 / year (save 21%)` |

The 21% AED savings vs. 17% EUR/USD reflects the actual per-currency price math — AED 79 × 12 = 948 vs. AED 749, so 199/948 ≈ 21%. Surface honestly rather than rounding to a uniform "save 17%" across currencies.

### Six Stripe Prices (env var convention)

User creates these on the existing Mony Pro Product in the Stripe Dashboard (test mode for v1):

```
STRIPE_PRICE_EUR_MONTHLY  = price_…  (€19  recurring monthly)
STRIPE_PRICE_EUR_YEARLY   = price_…  (€190 recurring yearly)
STRIPE_PRICE_USD_MONTHLY  = price_…  ($19  recurring monthly)
STRIPE_PRICE_USD_YEARLY   = price_…  ($190 recurring yearly)
STRIPE_PRICE_AED_MONTHLY  = price_…  (AED 79  recurring monthly)
STRIPE_PRICE_AED_YEARLY   = price_…  (AED 749 recurring yearly)
```

Naming convention is `STRIPE_PRICE_<CURRENCY>_<CADENCE>` (uppercase), enabling the H.8-revised Checkout route to compose the env-var name via `\`STRIPE_PRICE_${currency.toUpperCase()}_${cadence.toUpperCase()}\``. The `STRIPE_WEBHOOK_SECRET` env var is left commented in `.env.local.example` for H.9 (Stripe webhook handler).

### Why the page downgrades from static to dynamic

Pre-H.7.3, `/[locale]/page.tsx` was statically prerendered for /, /fr, /ar via H.7.1's `setRequestLocale` + the layout's `generateStaticParams`. H.7.3 introduces `getCurrency()` which calls `cookies()` and `headers()` — Next.js 15's static-rendering path silently returns empty cookie/header stores in that mode. Without forcing dynamic rendering, every visitor would see the EUR default regardless of their `NEXT_CURRENCY` cookie.

Adding `export const dynamic = 'force-dynamic'` to [web/src/app/[locale]/page.tsx](web/src/app/[locale]/page.tsx) opts the page out of static rendering so the cookie / header reads execute per-request. Trade-offs:

| | Static (pre-H.7.3) | Dynamic (post-H.7.3) |
| --- | --- | --- |
| First-paint TTFB | Edge-cached HTML, ~50ms | Server render, ~100–150ms |
| Currency correctness | Broken (always default) | Correct (per visitor) |
| Vercel cost | Lower (static hits) | Higher (Function invocations) |
| Hydration flicker | None | None (server already has the right currency) |

The build output's `●` symbol next to /[locale] reflects that the layout's `generateStaticParams` has enumerated the three locale paths; the page's `force-dynamic` overrides per-render mode at request time. This composition is documented and supported by Next.js 15.

### Mobile vs. web detection independence

The mobile app already has currency detection via `expo-localization` + jsdelivr live FX rates (Phase H' / H'.2.1). Web's H.7.3 detection is independent and serves a different purpose:

- **Mobile**: detects the BUYER's preferred display currency for marketplace products listed in the SELLER's local currency. Live FX rates needed because product prices vary.
- **Web**: detects the visitor's preferred Stripe Checkout currency for the Mony Pro subscription. Static per-currency authoring (€19 / $19 / AED 79) — no FX rates needed.

Both surfaces converge for a UAE visitor: AED on mobile (via H'.2.1 jsdelivr), AED on web (via H.7.3 cookie/header). The mechanisms are different but the result is consistent.

### Verification

- **JSON parse**: en/fr/ar message catalogs all parse cleanly after the per-currency restructure.
- **`cd web && npx tsc --noEmit`** → exit 0.
- **`cd web && npx next build`** → succeeds. Build output:
  - `/[locale]` (●, paths /en, /fr, /ar): 3.11 kB (up from 2.56 kB in H.7.2 — the CurrencyPicker hydration weight + per-currency logic). Renders dynamically per request despite the static path enumeration.
  - `/[locale]/upgrade` and `/[locale]/dashboard` unchanged (172 B each, auth-gated).
  - `/auth/callback` and `/auth/error` at root (124 B each).
  - Middleware 130 kB (up from 129 kB — currency module's tiny addition).
- **Mobile `tsc --noEmit`** → exit 0. Mobile codebase byte-identical to H.7.2; the only `M` outside `/web` is `src/lib/web/constants.ts` (the user's prior `WEB_BASE_URL` edit, not part of H.7.3).
- **Manual / runtime (deferred to user):**
  - `cd web && npm run dev` → boots on http://localhost:3000.
  - Visit `/` → pricing in EUR (default), or USD/AED if Accept-Language country mapped.
  - Open CurrencyPicker → pick AED → page re-renders, prices show `AED 79 / month` and `or AED 749 / year (save 21%)`.
  - Pick USD → re-render shows `$19 / month`.
  - Cookie persists across navigation + browser restart.
  - Visit `/fr` → same currency-driven prices, in French copy. Visit `/ar` → same prices, RTL Arabic copy.

### Phase H mobile/web status (post-H.7.3)

| Step | Status | Surface |
| --- | --- | --- |
| H.1–H.5 | ✓ | Mobile feature-complete |
| H.6 | ✓ | Web scaffold + auth bridge |
| H.7 | ✓ | Real public landing (FR-only at the time) |
| H.7.1 | ✓ | i18n EN/FR/AR |
| H.7.2 | ✓ | RTL polish for AR |
| **H.7.3** | **✓ this step** | **Multi-currency EUR/USD/AED** |
| H.8 (revised) | next | Stripe Checkout on `/upgrade` consuming NEXT_CURRENCY |
| H.10 | future | Real `/dashboard` + Customer Portal link |
| H.11 | future | `/admin/subscriptions` |
| H.12 | future | `/api/stripe/webhook` |

The web codebase is now **tri-lingual + tri-currency**. UAE launch surface complete.

### H.8 (revised) handoff

The H.7.3 multi-currency foundation pre-shapes the H.8 Stripe Checkout API route. Concrete pieces:

1. **Stripe Dashboard prep (manual).** Create the six Prices listed above. Capture the `price_…` IDs into the env vars in `.env.local.example`.
2. **API route at `app/api/stripe/checkout/route.ts`.** POST handler verifies caller via `getSupabaseServer().auth.getUser()`, reads `NEXT_CURRENCY` cookie + a `cadence: 'monthly' | 'yearly'` body param, composes the env var name (`\`STRIPE_PRICE_${currency.toUpperCase()}_${cadence.toUpperCase()}\``), creates a `mode: 'subscription'` Checkout Session with that price ID, returns `{ url }`.
3. **Stripe Customer metadata.** When creating the Checkout Session, set `customer_email: user.email` and `metadata: { user_id, seller_id, currency }`. The H.9 webhook reads `metadata.currency` to record on the `subscriptions` row.
4. **`/upgrade` page upgrade.** Replace H.6's placeholder with a monthly/yearly toggle + a `<form>` POSTing to the API route. The form's hidden inputs carry the cadence; the cookie carries the currency. Stays auth-gated via H.6's `getUser()` redirect-to-/.
5. **Test mode for v1.** Live keys flip in H.14 alongside production go-live.

The H.9 webhook handler (separate step) reads `customer.subscription.*` events, looks up `metadata.currency`, and stores it on the H.2 `subscriptions` row. The H.2 trigger then mirrors `is_pro` automatically as before — no changes to the schema or trigger needed.

### Reversion

```bash
git revert <H.7.3 commit>
```

Removes:
- The three new files (`currency.ts`, `getCurrency.ts`, `CurrencyPicker.tsx`).
- The per-currency catalog refactor (reverts to H.7.2's flat EUR-only `pricing.*`).
- The `force-dynamic` directive on `/[locale]/page.tsx` (page returns to SSG).
- The Header's CurrencyPicker mount.
- `.env.local.example`'s six Stripe Price entries.
- The README's Currency section.

The revert is clean — no dependencies added, no schema changes, no Stripe Dashboard cleanup needed. EN/FR/AR locales continue working with EUR-only pricing.

If only the Pricing refactor should be removed (keeping `currency.ts` / `getCurrency.ts` / CurrencyPicker for future H.8 consumption), the surgical edit is to revert just `Pricing.tsx`, the message catalogs' `pricing` namespace, and the `force-dynamic` directive — leaving the currency primitives in place for later use.

---

## Step Op.3 Changelog (2026-05-04) — WEB_BASE_URL Reconciliation (mony-psi.vercel.app)

One-line source change. The Vercel deploy assigned `mony-psi.vercel.app` (the `mony` slug was taken), so the H.5/H.6/H.7.x placeholder `https://mony.vercel.app` is updated in the single source of truth on the mobile side. Two server-side updates (Supabase secret + Auth allowlist) are documented below for the user to run in lockstep.

> **Audit referenced:** PRO_AUDIT.md §10 open-question (final domain decision). H.5's manual setup section originally specified `mony.vercel.app` as a placeholder; this step closes that placeholder against the actual Vercel-assigned URL.

### Reconnaissance findings

- **Pre-edit value**: `WEB_BASE_URL = 'https://mony-psi.vercel.app/'` (trailing slash) at [src/lib/web/constants.ts:25](src/lib/web/constants.ts#L25). The user had manually updated the URL between H.5 and Op.3 but kept the trailing slash from a copy-paste of the dashboard URL.
- **Trailing-slash bug uncovered.** The mobile-side magic-link assembly at [src/hooks/useUpgradeFlow.ts:65](src/hooks/useUpgradeFlow.ts#L65) does string concatenation `${WEB_BASE_URL}${WEB_UPGRADE_PATH}` (where `WEB_UPGRADE_PATH = '/upgrade'`). With the trailing slash, this produces `https://mony-psi.vercel.app//upgrade` (double slash) — browsers may normalize this on navigation, but Supabase Auth's redirect-URL allowlist matching is path-exact and rejects double-slash variants. The Edge Function at [supabase/functions/issue-web-session/index.ts:90](supabase/functions/issue-web-session/index.ts#L90) is robust either way (it uses `new URL(redirectPath, webBaseUrl)` which normalizes), but the JS-client concatenation is not. Op.3 fixes this by dropping the trailing slash.
- **No other hardcoded references.** `grep -rn "mony.vercel.app\|mony-psi.vercel.app" src/` returns only the constants.ts line. Web-side has no hardcoded URL either — its API routes consume `process.env.NEXT_PUBLIC_WEB_BASE_URL` from Vercel env vars (user's responsibility, not source-tracked).

### Files modified (1)

| Path | Change |
| --- | --- |
| [src/lib/web/constants.ts](src/lib/web/constants.ts#L25) | `'https://mony-psi.vercel.app/'` → `'https://mony-psi.vercel.app'` (drop trailing slash). |

### User-manual server-side steps (run in lockstep)

These keep the mobile constant + Supabase secret + auth allowlist consistent. Without them, magic links will redirect correctly URL-wise but Supabase Auth will reject the redirect with "Email link is invalid or has expired".

#### 1. Update the Edge Function secret

```powershell
npx supabase secrets set WEB_BASE_URL=https://mony-psi.vercel.app
```

This is what the [issue-web-session Edge Function](supabase/functions/issue-web-session/index.ts#L91) reads at runtime to compose the magic-link `redirectTo`. The previous value (`https://mony.vercel.app`) is overwritten.

#### 2. Update Supabase Auth's redirect URL allowlist

**Dashboard → Authentication → URL Configuration → Redirect URLs**

Add (keep existing entries; allowlist accepts multiple):

```
https://mony-psi.vercel.app/*
http://localhost:3000/*
```

The `localhost:3000/*` entry enables local web dev to receive magic links during testing. The legacy `https://mony.vercel.app/*` and `https://*.vercel.app/*` entries can stay — they're harmless extras since the Edge Function only redirects to whatever is in the `WEB_BASE_URL` secret.

Click **Save**.

#### 3. Update the Vercel project's environment variable (if/when H.8 ships)

Pre-staged: when H.8's API route goes live, it'll read `process.env.NEXT_PUBLIC_WEB_BASE_URL` for any same-origin URL composition. Set this in **Vercel Dashboard → Project Settings → Environment Variables**:

```
NEXT_PUBLIC_WEB_BASE_URL = https://mony-psi.vercel.app
```

Not blocking for Op.3 — H.8 hasn't shipped yet — but list it here so the env-var inventory stays current.

### Verification

- **`grep -rn "mony.vercel.app\|mony-psi.vercel.app" src/`** → single hit at [src/lib/web/constants.ts:25](src/lib/web/constants.ts#L25). No other hardcoded URLs in mobile source.
- **`npx tsc --noEmit`** → exit 0.
- **Manual / runtime (deferred to user, after the two server-side steps):**
  - Tap any "Upgrade to Pro" CTA in the mobile app.
  - In-app browser opens with a brief loading state, then lands on `https://mony-psi.vercel.app/upgrade` — auth-gated, so the user sees the placeholder for now.
  - Verify in Supabase Dashboard → Logs → Auth that the magic-link issue + token verification events succeed (no "redirect URL not allowed" rejections).

### Why a `/` trailing slash matters

| Form | Concatenation | Result | Allowlist match? |
| --- | --- | --- | --- |
| `https://mony-psi.vercel.app/` + `/upgrade` | `https://mony-psi.vercel.app//upgrade` | **double slash** | ✗ |
| `https://mony-psi.vercel.app` + `/upgrade` | `https://mony-psi.vercel.app/upgrade` | clean | ✓ |

Defensive alternatives (URL-builder helper, `pathJoin()` etc.) are over-engineered for a single concatenation site. The single-line constant fix is the right shape.

### Reversion

```bash
git revert <Op.3 commit>
```

Restores the `WEB_BASE_URL = 'https://mony-psi.vercel.app/'` value (the trailing-slash form, since that's the previous state — not the original `mony.vercel.app` placeholder). Plus, run the matching secret rollback if needed:

```powershell
npx supabase secrets set WEB_BASE_URL=https://mony-psi.vercel.app/
```

The Supabase Auth allowlist entries are forward-compatible and don't need to be removed; leaving extras in place doesn't affect normal operation.

### Phase H mobile/web status (post-Op.3)

| Step | Status | Surface |
| --- | --- | --- |
| H.1–H.5 | ✓ | Mobile feature-complete |
| H.6 | ✓ | Web scaffold + auth bridge |
| H.7 | ✓ | Real public landing |
| H.7.1 | ✓ | i18n EN/FR/AR |
| H.7.2 | ✓ | RTL polish for AR |
| H.7.3 | ✓ | Multi-currency EUR/USD/AED |
| **Op.3** | **✓ this step** | **WEB_BASE_URL points at mony-psi.vercel.app** |
| H.8 | next | Stripe Checkout on `/upgrade` (consumes NEXT_CURRENCY) |
| H.10 | future | Real `/dashboard` + Customer Portal |
| H.11 | future | `/admin/subscriptions` |
| H.12 | future | `/api/stripe/webhook` |

---

## Step H.8 Changelog (2026-05-04) — Multi-currency Stripe Checkout

JS-only step, scoped to `/web/`. Replaces H.6's `/upgrade` "shipping soon" placeholder with a real multi-currency-aware Stripe Checkout flow. Six new files (Stripe SDK init, API route, UpgradeForm, success page, canceled page, plus the modified upgrade page). Three message catalogs extended with the `upgrade.*` namespace tree. One new dependency (`stripe` Node SDK, server-only). Mobile codebase byte-identical.

> **Audit referenced:** PRO_AUDIT.md §3 (charge model + customer creation strategy), §10 open-question 9 (multi-region pricing — H.7.3 + H.8 close it), §10 open-question 7 (trial period — deferred). The H.7.3 changelog's H.8-revised handoff list (this implements it).

### Reconnaissance findings (re-confirmed before authoring)

- **Pre-edit `[locale]/upgrade/page.tsx`** — H.6 placeholder still in place (post-H.7.1 move under `[locale]/`). Renders email + "shipping soon" message with three keys: `welcomeWith`, `comingSoonBody`, `goToDashboard`. H.8 fully replaces.
- **`/upgrade/success/page.tsx` + `/upgrade/canceled/page.tsx` did NOT exist.** The H.8 spec said "replace placeholder" but H.6/H.7.1 never created them — Stripe needs `success_url` + `cancel_url` so H.8 ships these new.
- **Currency / locale infrastructure intact.** [src/i18n/getCurrency.ts](web/src/i18n/getCurrency.ts) (H.7.3, cookie + Accept-Language chain), [src/i18n/currency.ts](web/src/i18n/currency.ts) (`CURRENCIES`, `Currency`, `isCurrency` type-guard, `CURRENCY_COOKIE`), [src/i18n/routing.ts](web/src/i18n/routing.ts) (`routing.locales`, `routing.defaultLocale`, `redirect`, `Link`).
- **No Stripe dep.** `package.json` clean. H.8 adds `stripe@^22.1.0` (single new dep, server-only).
- **Stripe SDK API version pinned to `'2026-04-22.dahlia'`.** The H.8 spec defaulted to `'2024-06-20'` but stripe@22's TypeScript types are pinned to the newer dahlia version — using a mismatched literal would fail typecheck. Read from `node_modules/stripe/cjs/apiVersion.d.ts` to find the correct value.
- **`.env.local` placeholders accept Stripe init.** The user's `.env.local` has `STRIPE_SECRET_KEY=sk_test_...` and `STRIPE_PRICE_*=price_...` (literal placeholder strings, not real values). Stripe's `new Stripe(secret, options)` constructor doesn't network — it accepts any non-empty string, so `next build` succeeds. The actual API calls (creating Checkout Sessions) will fail at runtime until the user replaces with real test keys. That's the correct behavior — fail at request, not at build.

### Files added (5)

| Path | Purpose |
| --- | --- |
| [web/src/lib/stripe.ts](web/src/lib/stripe.ts) | Module-level Stripe SDK singleton + `getStripePriceId(currency, cadence)` env-var lookup. Throws at module load if `STRIPE_SECRET_KEY` is missing — fail-fast for ops. Pinned to API version `'2026-04-22.dahlia'`. |
| [web/src/app/api/stripe/checkout/route.ts](web/src/app/api/stripe/checkout/route.ts) | POST handler at `/api/stripe/checkout`. Auth → cadence parse → currency/locale cookies → seller lookup → Stripe customer (lookup or create with metadata) → locale-aware `success_url`/`cancel_url` → `getStripePriceId` → `stripe.checkout.sessions.create({ mode: 'subscription', ... })` → returns `{ url }`. Lives outside `[locale]/` because it's a technical endpoint; H.7.1's middleware matcher already excludes `/api`. |
| [web/src/components/upgrade/UpgradeForm.tsx](web/src/components/upgrade/UpgradeForm.tsx) | Client Component. Cadence toggle (monthly/yearly), feature list (iterates `pricing.feature1`–`feature5` matching the landing's [Pricing.tsx](web/src/components/landing/Pricing.tsx) FEATURE_KEYS pattern), submit handler that POSTs to `/api/stripe/checkout` and `window.location.href`s to the returned Stripe URL. |
| [web/src/app/[locale]/upgrade/success/page.tsx](web/src/app/[locale]/upgrade/success/page.tsx) | Auth-gated. Renders "processing" copy + dashboard link + check icon. The `?session_id={CHECKOUT_SESSION_ID}` query param Stripe appends is captured but not displayed in v1. |
| [web/src/app/[locale]/upgrade/canceled/page.tsx](web/src/app/[locale]/upgrade/canceled/page.tsx) | Auth-gated. Low-friction "no charge" copy + retry button back to `/upgrade`. |

### Files modified (5)

| Path | Change |
| --- | --- |
| [web/src/app/[locale]/upgrade/page.tsx](web/src/app/[locale]/upgrade/page.tsx) | Replaced H.6 placeholder. Now: `force-dynamic`, auth-gated via `getUser()`, resolves currency via `getCurrency()`, loads `getTranslations('upgrade')` + `getTranslations(\`pricing.${currency}\`)`, mounts `<UpgradeForm />` with currency-aware pricing strings as props. |
| [web/messages/en.json](web/messages/en.json) | Removed obsolete `welcomeWith` / `comingSoonBody` / `goToDashboard` (placeholder copy). Added: `sub`, `signedInAs`, `chooseFormula`, `planMonthly`, `planYearly`, `subscribe`, `redirecting`, `securityNote`, `genericError` + nested `upgrade.success.{title, processing, returnHint, dashboardLink}` + `upgrade.canceled.{title, body, retry}`. |
| [web/messages/fr.json](web/messages/fr.json) | Mirror with French copy. |
| [web/messages/ar.json](web/messages/ar.json) | Mirror with Arabic copy (best-effort, pending professional review per H.7.1). |
| [web/package.json](web/package.json) | Added `stripe: ^22.1.0`. |
| [web/package-lock.json](web/package-lock.json) | Auto-updated. |

### Currency + locale resolution chain (server-side)

The API route reads BOTH cookies on every request:

```
NEXT_CURRENCY → CURRENCY_COOKIE = 'NEXT_CURRENCY' → isCurrency() guard → DEFAULT_CURRENCY (eur) fallback
NEXT_LOCALE   → LOCALE_COOKIE   = 'NEXT_LOCALE'   → hasLocale() guard  → routing.defaultLocale ('en') fallback
```

Both cookies are set by the H.7.3 CurrencyPicker / H.7.1 LanguageSwitcher / next-intl middleware. The API route doesn't accept currency/locale in the request body — they're transparent context, not user-controllable per-request inputs.

### Locale-aware redirect URLs

H.7.1's `'as-needed'` prefix means EN URLs lack a locale segment. The API route composes `success_url` and `cancel_url` accordingly:

```ts
const localePath = locale === routing.defaultLocale ? '' : `/${locale}`;
// EN: https://mony-psi.vercel.app/upgrade/success?session_id=...
// FR: https://mony-psi.vercel.app/fr/upgrade/success?session_id=...
// AR: https://mony-psi.vercel.app/ar/upgrade/success?session_id=...
```

The `?session_id={CHECKOUT_SESSION_ID}` placeholder is Stripe-template syntax — Stripe substitutes the actual session ID before redirecting. The cancel URL doesn't get a session ID (Stripe only adds it on success).

### Stripe Checkout's `locale` parameter

Stripe's hosted Checkout natively supports a fixed list of locales. From `stripe-node`'s type definition, the relevant subset for our launch:
- `'en'` → English ✓
- `'fr'` → French ✓
- `'auto'` → Browser-detected (used as the AR fallback)
- **No `'ar'`** — Stripe doesn't ship Arabic localization

Mapping logic:

```ts
const stripeLocale: 'en' | 'fr' | 'auto' =
  locale === 'en' || locale === 'fr' ? locale : 'auto';
```

For AR visitors: Stripe Checkout's hosted page lands in EN (or whatever the browser auto-detects, occasionally FR). The visitor's preference is honored on the Mony pages (EN/FR/AR landing + upgrade page); only the Stripe step itself displays in the auto-detected locale. Acceptable v1 — Stripe Checkout is a single transactional step, not the full marketing surface; an EN payment form on an AR-flagged session is intelligible. Documented for the user; if AR-quality Checkout becomes a launch blocker, [Stripe Custom Checkout](https://docs.stripe.com/payments/checkout/build-payment-form) lets us own the form (separate H.X if needed).

### Customer creation strategy

Per the audit's lookup-or-create pattern:

1. Look up existing `subscriptions.stripe_customer_id` by `seller_id`. The webhook (H.9) is the writer of this column — for a returning subscriber whose previous subscription has been cancelled, the customer id persists.
2. If found: reuse — pass to Stripe so the new subscription attaches to the same customer. Stripe knows their email, payment methods, etc.
3. If absent (first-time upgrader): `stripe.customers.create({ email, metadata: { seller_id, user_id } })`. Capture the new ID and pass it to the Checkout Session.
4. Either way, set `subscription_data.metadata = { seller_id, user_id, currency }` on the session so the H.9 webhook can correlate the eventual `customer.subscription.created` event back to our schema.

This route does NOT write to `public.subscriptions`. Writing happens only in the H.9 webhook handler against the H.2 schema's RLS-protected table (service-role only). Pre-creating the customer here is safe because:
- Stripe customer objects are cheap and benign — orphaned customers (no subscription) sit harmless in Stripe.
- The webhook upsert is keyed on `stripe_subscription_id` (UNIQUE per H.2), not `stripe_customer_id`, so duplicate customer rows don't cause schema conflicts.

### Race condition: success page deliberately shows "processing"

Stripe's payment confirmation does NOT mutate `public.subscriptions` directly. The flow is:

```
User completes Checkout
  → Stripe redirects to success_url (immediate, ~50ms)
  → Stripe asynchronously fires `customer.subscription.created` (typically <2s in test mode)
  → H.9 webhook receives event, upserts into `public.subscriptions`
  → H.2 SQL trigger flips `sellers.is_pro = true`
```

When the user lands on `/upgrade/success`, the subscription row may or may not exist yet. Claiming "you are now Pro!" before the row exists is wrong. The page renders "processing" copy, sets the user's expectation correctly, and links to `/dashboard` (where H.10 will eventually show real subscription state).

Future polish (H.10+): poll `subscriptions` from a Client Component on the success page, swap to a "You are now Pro!" celebratory state once the row appears.

### Verification

- **`cd web && npx tsc --noEmit`** → exit 0.
- **JSON parse** for all three message catalogs → OK.
- **`cd web && npx next build`** → succeeds. Build output:
  - `/[locale]/upgrade` (●, paths /en, /fr, /ar): 2.11 kB → 121 kB First Load JS (up from 172 B placeholder — adds the UpgradeForm Client Component bundle).
  - `/[locale]/upgrade/success` (●): 177 B per locale.
  - `/[locale]/upgrade/canceled` (●): 177 B per locale.
  - `/api/stripe/checkout` (ƒ, dynamic, **root path**): 177 B. **Outside the `[locale]` tree** as required for technical endpoints; H.7.1 middleware already excludes `/api` from locale prefixing.
  - Middleware 130 kB (unchanged from H.7.3).
- **Mobile `tsc --noEmit`** → exit 0.
- **Mobile codebase byte-identical** outside /web. The only non-/web `M` is `src/lib/web/constants.ts` (the Op.3 URL fix, not part of H.8).
- **Manual / runtime (deferred to user, requires Stripe Dashboard prep + 6 real Price IDs in .env.local + Vercel env):**
  - On mobile, tap "Upgrade to Pro" → magic-link auth → lands on `/upgrade` (or `/fr/upgrade` / `/ar/upgrade`).
  - Page renders the cadence toggle + feature list + Subscribe button in the user's locale + currency.
  - Click Subscribe → form POSTs to `/api/stripe/checkout` → `window.location.href`s to the Stripe URL.
  - In Stripe test mode: card `4242 4242 4242 4242` + any future date / CVC → completes Checkout → Stripe redirects to `/[locale]/upgrade/success`.
  - Success page renders "processing" copy. The `subscriptions` row WON'T exist yet — H.9 closes that loop.
  - `/dashboard` still says "shipping soon" (H.6 placeholder; H.10 ships the real subscription management).

### Manual setup required (Stripe Dashboard, in test mode for v1)

User runs once before runtime testing:

1. **Create the Mony Pro Product** in Stripe Dashboard → Products → Add product. Name: `Mony Pro`. Description: optional.
2. **Create six Prices** on that product:
   - Monthly recurring, EUR €19 → capture the `price_…` ID into `STRIPE_PRICE_EUR_MONTHLY`
   - Yearly recurring, EUR €190 → `STRIPE_PRICE_EUR_YEARLY`
   - Monthly recurring, USD $19 → `STRIPE_PRICE_USD_MONTHLY`
   - Yearly recurring, USD $190 → `STRIPE_PRICE_USD_YEARLY`
   - Monthly recurring, AED 79 → `STRIPE_PRICE_AED_MONTHLY`
   - Yearly recurring, AED 749 → `STRIPE_PRICE_AED_YEARLY`
3. **Update `.env.local`** with the real price IDs (replace `price_...` placeholders) + the test mode `STRIPE_SECRET_KEY=sk_test_...` from Stripe Dashboard → API keys.
4. **Update Vercel env vars** (Project Settings → Environment Variables) with the same eight values plus `NEXT_PUBLIC_WEB_BASE_URL=https://mony-psi.vercel.app` (per Op.3).
5. **Restart `npm run dev`** (kill, clear `.next/`, re-run) so the new env vars are picked up.

### Phase H mobile/web status (post-H.8)

| Step | Status | Surface |
| --- | --- | --- |
| H.1–H.5 | ✓ | Mobile feature-complete |
| H.6 | ✓ | Web scaffold + auth bridge |
| H.7 | ✓ | Real public landing |
| H.7.1 | ✓ | i18n EN/FR/AR |
| H.7.2 | ✓ | RTL polish for AR |
| H.7.3 | ✓ | Multi-currency EUR/USD/AED |
| Op.3 | ✓ | WEB_BASE_URL → mony-psi.vercel.app |
| **H.8** | **✓ this step** | **Multi-currency Stripe Checkout (test mode)** |
| H.9 | next | Stripe webhook handler |
| H.10 | future | Real `/dashboard` + Customer Portal |
| H.11 | future | `/admin/subscriptions` |
| H.14 | future | Stripe live-mode flip + production go-live |

The web codebase now charges real money in test mode. The data loop closes in H.9.

### H.9 handoff (Stripe webhook handler)

H.9's job: receive Stripe events at a dedicated webhook endpoint, write subscription state into `public.subscriptions` (the H.2-shipped table), let the H.2 trigger mirror `is_pro`. Concrete pieces:

1. **Route**: `/web/src/app/api/stripe/webhook/route.ts`.
2. **Signature verification**: Stripe sends a `stripe-signature` header on every webhook. Use `stripe.webhooks.constructEventAsync(rawBody, sig, STRIPE_WEBHOOK_SECRET)` to validate. Reject any request that fails signature with HTTP 400.
3. **Service-role Supabase client** (NEW env var: `SUPABASE_SERVICE_ROLE_KEY` in Vercel + local `.env.local`, server-only — NEVER `NEXT_PUBLIC`). Only this role can write to `public.subscriptions` per the H.2 RLS policy.
4. **Events to handle**:
   - `customer.subscription.created` → upsert with `status: 'active' | 'trialing'`, period_start/end, currency from `metadata.currency`, etc.
   - `customer.subscription.updated` → upsert with new status/period values. Includes plan changes, cancellations-at-period-end, payment-method updates.
   - `customer.subscription.deleted` → set `status: 'canceled'`, capture `canceled_at`. Don't delete the row — keep the audit trail.
   - `invoice.payment_failed` → reflects in `customer.subscription.updated` with `status: 'past_due'`. The H.9 handler may not need to do anything separately if the subscription event arrives in the same batch; check Stripe's event ordering.
5. **Idempotency**: upsert keyed on `stripe_subscription_id` (the H.2 schema's UNIQUE constraint). Stripe sends events at-least-once; the upsert pattern handles duplicates cleanly.
6. **The H.2 trigger** (`handle_subscription_change`) automatically mirrors `is_pro` — H.9 doesn't touch the column directly.
7. **Webhook endpoint registration**: in Stripe Dashboard → Developers → Webhooks → Add endpoint, point at `https://mony-psi.vercel.app/api/stripe/webhook` (test mode), select the four event types above. Capture the `whsec_…` signing secret into `STRIPE_WEBHOOK_SECRET` env var (local + Vercel).
8. **Local dev**: use `stripe listen --forward-to localhost:3000/api/stripe/webhook` (Stripe CLI) to forward events to the dev server during testing.

After H.9 lands: tap Upgrade → complete Checkout → land on `/upgrade/success` ("processing") → ~2s later the webhook fires → `subscriptions` row exists → `is_pro = true` → mobile profile picks up the flag on next focus. End-to-end Pro upgrade works in test mode.

### Reversion

```bash
git revert <H.8 commit>
```

Removes the five new files + reverts the upgrade page + drops the `stripe` dep + restores the H.6 placeholder copy in catalogs. Manual cleanup if the user already created Stripe products: optional (orphaned Stripe products are benign and free).

If only the API route should be removed but the form / pages kept (e.g., to swap to a different payment provider), the surgical edit is to delete `/api/stripe/checkout/route.ts` + `lib/stripe.ts` + uninstall `stripe`, then update `UpgradeForm.handleSubmit` to POST to the new endpoint. Pages and copy stay.

---

## Step H.9 Changelog (2026-05-04) — Stripe Webhook Handler

JS-only step, scoped to `/web/`. Closes the Phase H data loop: Stripe charge → webhook event → `public.subscriptions` row → H.2 trigger flips `sellers.is_pro`. Two new files (service-role admin client + webhook route handler), two doc updates (env example + README). No new dependencies — `@supabase/supabase-js ^2.45.4` was already a direct dep from H.6. Mobile codebase byte-identical.

> **Audit referenced:** PRO_AUDIT.md §5 (subscriptions schema design — H.2 ships, H.9 writes). The H.8 changelog's H.9 handoff list (this implements it).

### Reconnaissance findings (re-confirmed before authoring)

- **`@supabase/supabase-js`** is a direct dep at `^2.45.4` (added in H.6). The service-role admin client uses `createClient` from this package — NOT from `@supabase/ssr` (cookies don't apply server-to-server). No install needed.
- **Middleware excludes `/api/*`** ([web/src/middleware.ts:113](web/src/middleware.ts#L113)). The webhook route runs without intl middleware redirects or Supabase session-refresh interference. Same pattern as H.8's `/api/stripe/checkout`.
- **Stripe API `2026-04-22.dahlia` moved `current_period_start` / `current_period_end`** off the `Subscription` type onto the `SubscriptionItem` type. Confirmed by inspecting `node_modules/stripe/cjs/resources/Subscriptions.d.ts` (no top-level fields; lines 50/54 of `SubscriptionItems.d.ts` declare them). The H.9 spec read these from `subscription.current_period_*` directly — that would fail typecheck on stripe@22. **Critical reconciliation**: read from `subscription.items.data[0].current_period_*` instead. Mony Pro is a single-item subscription, so `items.data[0]` is the canonical source.
- **Existing fields on `Subscription` are unchanged**: `status` (line 257), `cancel_at_period_end` (129), `canceled_at` (133), `trial_end` (269). Read directly from the subscription object as planned.
- **Next.js 15 raw body discipline** — `req.text()` exposes the exact bytes Stripe signed. No `bodyParser: false` config needed (that was a Pages Router convention).

### Files added (2)

| Path | Purpose |
| --- | --- |
| [web/src/lib/supabase/admin.ts](web/src/lib/supabase/admin.ts) | `getSupabaseAdmin()` factory returning a module-cached `SupabaseClient` initialized with `SUPABASE_SERVICE_ROLE_KEY`. Bypasses RLS. `auth: { autoRefreshToken: false, persistSession: false }` because service-role keys don't expire and we don't want session state. Throws clearly if either env var is missing. |
| [web/src/app/api/stripe/webhook/route.ts](web/src/app/api/stripe/webhook/route.ts) | POST handler at `/api/stripe/webhook`. Reads raw body via `req.text()` → verifies `stripe-signature` header against `STRIPE_WEBHOOK_SECRET` via `stripe.webhooks.constructEventAsync` → switches on `event.type` for the three subscription events → upserts into `public.subscriptions` keyed on `seller_id`. The H.2 trigger handles `is_pro` mirroring. |

### Files modified (3 + changelog)

| Path | Change |
| --- | --- |
| [web/.env.local.example](web/.env.local.example) | Promoted the H.8-commented `STRIPE_WEBHOOK_SECRET` placeholder to an active entry + added `SUPABASE_SERVICE_ROLE_KEY` with a "CRITICAL" comment block. Both flagged as server-only (NEVER `NEXT_PUBLIC_*`). |
| [web/README.md](web/README.md) | New "Stripe webhook (H.9)" section. Documents: production setup (Stripe Dashboard endpoint config), local testing via `stripe listen --forward-to`, end-to-end test mode flow, idempotency + edge-case notes. |
| `PROJECT_AUDIT.md` | This changelog. |

### Three event types handled

| Stripe event | Handler action | DB shape after |
| --- | --- | --- |
| `customer.subscription.created` | Upsert with status `'active'` / `'trialing'` / `'incomplete'`, periods, currency from `metadata.currency`, etc. | New row exists; H.2 trigger flips `is_pro = true` if status maps. |
| `customer.subscription.updated` | Upsert with new status / period / cancel-at-period-end values. Covers plan changes, payment-method updates, scheduled cancellations, `past_due` transitions. | Row updated; H.2 trigger re-evaluates `is_pro`. |
| `customer.subscription.deleted` | Upsert with `status: 'canceled'` and `canceled_at` set. **Does NOT delete the row** — keeps it for audit trail and for next upsert if user resubscribes. | Row stays with `status='canceled'`; H.2 trigger flips `is_pro = false`. |

All other event types are acknowledged with HTTP 200 + a diagnostic log line — Stripe shouldn't retry events we deliberately ignore.

### Idempotency strategy

`upsert(row, { onConflict: 'seller_id' })` exploits H.2's `seller_id UNIQUE` constraint. Properties:

- **Re-delivery is a no-op** — Stripe retries on 5xx; the same event upserts the same row state.
- **Resubscribe replaces the row** — different `stripe_subscription_id` value but same `seller_id`. Historical Stripe IDs persist in Stripe Dashboard but not in the local DB. Acceptable v1 single-row trade-off; the alternative (multi-row history) breaks H.2's UNIQUE seller_id invariant.
- **Out-of-order delivery risk (v1 trade-off)** — Stripe usually delivers in chronological order, but during retries an older event for the same seller could overwrite a newer state. Mitigation (compare `event.created` timestamps before write) is H.13 territory if support tickets surface it.

### Subscription type field migration (Stripe API dahlia)

The H.9 spec referenced `subscription.current_period_start` / `current_period_end` directly on the Subscription type. Stripe API `2026-04-22.dahlia` (the version stripe@22 pins) moved these fields onto `SubscriptionItem`:

```ts
// Wrong (would fail typecheck on stripe@22):
current_period_start: new Date(subscription.current_period_start * 1000)

// Correct (read from item):
const item = subscription.items.data[0];
current_period_start: new Date(item.current_period_start * 1000)
```

For single-item subscriptions like Mony Pro, this is a straightforward `items.data[0]` read with a guard for the (very rare) empty-items case. Multi-item subscriptions in the future would need a more sophisticated reconciliation; out of v1 scope.

### Two new server-only secrets

Both go in `.env.local` for dev AND in Vercel project env vars for production. Both MUST stay server-only (no `NEXT_PUBLIC_*` prefix):

| Env var | Source | Risk if leaked |
| --- | --- | --- |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks → endpoint → "Reveal signing secret". Different secrets for test mode vs live mode and for each registered endpoint. Local CLI testing uses its own secret emitted by `stripe listen`. | Attacker could forge webhook events → arbitrary subscription state injection. **High** for the test mode key, **critical** for live mode. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → "service_role" (under Project API keys). | **Critical** — bypasses every RLS policy. Attacker reads / writes any row in any table. Treat as production-grade secret. |

The admin client at [web/src/lib/supabase/admin.ts](web/src/lib/supabase/admin.ts) throws clearly at first use if either env var is missing — fail-fast for ops rather than silent runtime failures during a paying customer's checkout.

### Logging discipline

The handler logs only diagnostic context — never raw payloads (which contain customer email + payment metadata):

| Code path | Log shape |
| --- | --- |
| Unhandled event type | `[H.9] ignoring event type=<type> id=<event-id>` |
| Missing `seller_id` metadata | `[H.9] subscription <sub-id> missing seller_id metadata; skipping (status=<status>)` |
| Empty subscription items | `[H.9] subscription <sub-id> has no line items; skipping (seller_id=<id>)` |
| Successful upsert | `[H.9] upserted subscription seller=<id> status=<status> sub=<sub-id>` |
| Handler error | `[H.9] handler error for <event-type> id=<event-id>: <message>` |
| Bad signature | `[H.9] webhook signature verification failed: <message>` (warn) |
| Missing `STRIPE_WEBHOOK_SECRET` | `[H.9] STRIPE_WEBHOOK_SECRET is not set` (error) |

### Status code semantics

| Response | Stripe behavior | Used for |
| --- | --- | --- |
| 200 | Acknowledged, no retry | Successful upsert; intentionally-ignored event types; subscriptions missing `metadata.seller_id` |
| 400 | Permanent failure, no retry | Missing `stripe-signature` header; signature verification failed |
| 500 | Retry with exponential backoff | Missing `STRIPE_WEBHOOK_SECRET`; DB upsert error; any unexpected handler exception |

The 5xx-on-handler-error pattern lets transient DB blips (network glitch, brief Supabase maintenance) recover automatically — Stripe retries up to 3 days with exponential backoff. The 200-on-skip pattern (missing metadata, ignored event types) prevents Stripe from retrying events we definitively can't / won't process.

### Verification

- **`cd web && npx tsc --noEmit`** → exit 0.
- **`cd web && npx next build`** → succeeds. Build output:
  - `/api/stripe/webhook` (ƒ, dynamic, root path): 128 B. Outside `[locale]/` as required for technical endpoints.
  - All other routes unchanged (H.8's checkout, H.7.x landing, etc.).
  - Middleware unchanged at 130 kB (the `/api` matcher exclusion handles H.9 transparently).
- **Mobile `tsc --noEmit`** → exit 0. Mobile codebase byte-identical (no `/src/` changes).
- **Manual / runtime (deferred to user, requires Stripe Dashboard webhook config + service-role key in Vercel):**

  **Local dev:**
  ```bash
  # Terminal A: Next.js dev server
  cd web; npm run dev
  # Terminal B: Stripe CLI forwards events to localhost
  stripe listen --forward-to localhost:3000/api/stripe/webhook
  # Note the whsec_… emitted; set STRIPE_WEBHOOK_SECRET=<that>
  # in .env.local; restart dev server.
  # Terminal C: trigger a test event
  stripe trigger customer.subscription.created
  # Terminal A logs the event; Supabase: subscriptions row exists,
  # sellers.is_pro flipped if status maps to 'active'.
  ```

  **Production:**
  1. Stripe Dashboard → Developers → Webhooks → Add endpoint → `https://mony-psi.vercel.app/api/stripe/webhook`. Subscribe to: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
  2. Reveal signing secret → set `STRIPE_WEBHOOK_SECRET` in Vercel env vars (all environments).
  3. Set `SUPABASE_SERVICE_ROLE_KEY` in Vercel env vars from Supabase Dashboard → API.
  4. Redeploy (Vercel auto-redeploys on env var change after a fresh push, or trigger manually).
  5. End-to-end test: tap "Upgrade to Pro" in mobile → magic-link → /upgrade → Subscribe → Stripe Checkout → card `4242 4242 4242 4242` → success page → wait ~2s → verify in Supabase Dashboard: `subscriptions` row exists with `status='active'`, `sellers.is_pro = true`.
  6. Mobile: pull-to-refresh profile → user is Pro. Banners + cap modal disappear. Acheter button shows on listings.

### Phase H mobile/web status (post-H.9)

| Step | Status | Surface |
| --- | --- | --- |
| H.1–H.5 | ✓ | Mobile feature-complete |
| H.6 | ✓ | Web scaffold + auth bridge |
| H.7 | ✓ | Real public landing |
| H.7.1 | ✓ | i18n EN/FR/AR |
| H.7.2 | ✓ | RTL polish for AR |
| H.7.3 | ✓ | Multi-currency EUR/USD/AED |
| Op.3 | ✓ | WEB_BASE_URL → mony-psi.vercel.app |
| H.8 | ✓ | Multi-currency Stripe Checkout |
| **H.9** | **✓ this step** | **Stripe webhook handler — data loop closes** |
| H.10 | next | Real `/dashboard` + Customer Portal |
| H.11 | future | `/admin/subscriptions` |
| H.14 | future | Stripe live-mode flip + production go-live |

### Phase H data loop closes

After H.9 + the user's webhook config + env vars, the end-to-end Pro upgrade flow works in test mode:

```
[Mobile]
  Tap "Upgrade to Pro"
  → useUpgradeFlow() (H.5) → issue-web-session Edge Function → magic link
  → in-app browser opens link

[Web — mony-psi.vercel.app]
  /auth/callback verifies OTP → session cookie
  → redirects to /[locale]/upgrade
  → Pricing card renders with cookie-driven currency (H.7.3)
  → User clicks Subscribe → POSTs to /api/stripe/checkout (H.8)
  → API route resolves price_id, creates Stripe Checkout Session
  → Browser redirects to checkout.stripe.com/...

[Stripe — hosted Checkout]
  User enters card 4242 4242 4242 4242
  → Stripe completes payment
  → Stripe redirects browser to /[locale]/upgrade/success ("processing" copy)
  → Stripe asynchronously fires customer.subscription.created event

[Web webhook — H.9]
  POST /api/stripe/webhook with signed event
  → Verify signature
  → Read metadata.seller_id from subscription
  → Upsert public.subscriptions (service-role)
  → Return 200

[Database — H.2 schema + trigger]
  subscriptions row created
  → handle_subscription_change trigger fires
  → sellers.is_pro = true (status in 'active','trialing')

[Mobile — next data fetch]
  useMySeller refetches (5min stale or focus-trigger)
  → seller.isPro = true
  → useIsPro() returns true
  → useListingCap.isPro = true
  → CTAs / banners / cap modal disappear
  → ProBadge appears next to seller name
  → Action rail Buy button shows (instead of Contact / Activate)
```

Every layer of Phase H is now connected and the data flows end-to-end.

### H.10 handoff (real `/dashboard` + Customer Portal)

H.10 ships the seller-side subscription management surface:

1. **Real `/dashboard` page.** Replaces H.6's "shipping soon" placeholder. Reads from `public.subscriptions` (server-side, scoped to caller via H.2's RLS SELECT policy `seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid())`). Displays:
   - Current plan (cadence + price)
   - Next renewal date (`current_period_end`)
   - Status pill (active / past_due / canceled)
   - "Cancellation scheduled" notice if `cancel_at_period_end = true`, with revert option
2. **Customer Portal link.** Stripe-hosted billing portal handles cancel, payment-method updates, invoice history, all for free. Implementation: new API route `app/api/stripe/portal/route.ts` that calls `stripe.billingPortal.sessions.create({ customer: <stripe_customer_id>, return_url: '<dashboard>' })`, returns `{ url }`. Client redirects via `window.location.href`. Per PRO_AUDIT.md §10 open-question 5: Stripe-hosted is the recommended choice (zero maintenance, complete feature set).
3. **Cancellation revert.** When `cancel_at_period_end = true` (user has scheduled cancellation), surface an "Undo cancellation" button that calls a new API route to call `stripe.subscriptions.update(id, { cancel_at_period_end: false })`. The webhook then fires `customer.subscription.updated` → upsert flips the local row, trigger keeps `is_pro = true`.
4. **Locale + currency awareness.** Same `force-dynamic` + cookie-driven resolution pattern as H.7.3 / H.8.

### Reversion

```bash
git revert <H.9 commit>
```

Removes both new files + reverts the env example + the README section. The Stripe Dashboard webhook endpoint (if registered) requires manual deletion via Dashboard → Webhooks → endpoint → Delete. Setting that aside is harmless — the endpoint will just receive 404s on the now-deleted route.

If only the webhook handler is unwanted but the admin client should stay (e.g., for a future H.X that needs RLS bypass for some other reason), the surgical revert is to delete just `app/api/stripe/webhook/route.ts` — `lib/supabase/admin.ts` remains untouched and ready for re-use.

---

## Step H.10 Changelog (2026-05-04) — Real Pro Dashboard + Stripe Customer Portal

JS-only step, scoped to `/web/`. Replaces H.6's `/dashboard` "shipping soon" placeholder with a real subscription management surface: subscription summary card with status pill + renewal date + cancel-state notice, "Manage subscription" button that opens the Stripe-hosted Customer Portal, empty state for users without subscriptions. Five new components, one new API route, one page replacement, three message catalog extensions. Zero new dependencies. Mobile codebase byte-identical.

> **Audit referenced:** PRO_AUDIT.md §10 open-question 5 ("Stripe-hosted vs custom billing portal" — Stripe-hosted chosen, this implements it). The H.9 changelog's H.10 handoff list (this implements it).

### Reconnaissance findings (re-confirmed before authoring)

- **Pre-edit `/dashboard` placeholder** ([web/src/app/[locale]/dashboard/page.tsx](web/src/app/[locale]/dashboard/page.tsx)) — H.6 minimal "Hi, {email}. Subscription management is shipping soon" copy. Three keys: `title`, `greetingWith`, `comingSoonBody`. Full replacement.
- **`/web/src/lib/stripe.ts` from H.8** — exports `stripe` singleton with API version pinned to `'2026-04-22.dahlia'`. Reused in the H.10 portal route via the same `import { stripe }` pattern.
- **`getSupabaseServer` from H.6** — returns the SSR cookie-authed client. Used for the dashboard read AND the portal API route's auth gate. Service-role admin client (H.9) is NOT used here — RLS-scoped reads are the right shape for personal-data surfaces.
- **Stripe `billingPortal.sessions.create`** — confirmed available in stripe@22 at `node_modules/stripe/cjs/resources/BillingPortal/Sessions.d.ts`. Standard params: `{ customer, return_url }`. Configuration of what the portal exposes (cancel, plan-change, etc.) lives in Stripe Dashboard, NOT in our code.
- **Existing `dashboard.*` namespace** — three keys (`title`, `greetingWith`, `comingSoonBody`). H.10 fully replaces with the real subscription-management copy: 25+ keys including `plan.*`, `status.*` (8 statuses matching H.2's CHECK constraint), `empty.*`.
- **Local `SubRow` type vs generated** — the H.10 spec referenced `Database['public']['Tables']['subscriptions']['Row']` from `@/types/supabase`, but web's `npm run gen:types` script (defined in package.json) hasn't been executed and the file doesn't exist. Two options: (a) require the user to run gen:types as a manual step, (b) hand-roll a local `SubRow` type matching H.2's stable schema. Chose (b) — H.2's schema won't change without a deliberate H.X step, and a local type avoids a manual ops step before the user can build. The type is exported from `SubscriptionSummaryCard` so it can be reused later if the dashboard surface grows. Documented for future replacement once gen:types lands web-side.

### Files added (5)

| Path | Purpose |
| --- | --- |
| [web/src/components/dashboard/StatusPill.tsx](web/src/components/dashboard/StatusPill.tsx) | Server Component. 8-status union (matching H.2 CHECK constraint). Color-coded tone tokens via Tailwind theme (success / warning / danger / verified / tertiary). Translated label via `dashboard.status.<status>`. |
| [web/src/components/dashboard/SubscriptionSummaryCard.tsx](web/src/components/dashboard/SubscriptionSummaryCard.tsx) | Server Component. Plan title + cadence (yearly detection by comparing `stripe_price_id` to env-configured yearly Price IDs) + StatusPill + locale-aware renewal date (`toLocaleDateString` per locale tag) + `<ManageSubscriptionButton />`. Cancel-at-period-end flips the label to "Cancels on" + adds an amber notice block. Exports `SubRow` type for downstream reuse. |
| [web/src/components/dashboard/ManageSubscriptionButton.tsx](web/src/components/dashboard/ManageSubscriptionButton.tsx) | Client Component. POSTs to `/api/stripe/portal` and `window.location.href`s to the returned Stripe Customer Portal URL. Inline error state on failure; submitting state on the button copy. |
| [web/src/components/dashboard/EmptyDashboard.tsx](web/src/components/dashboard/EmptyDashboard.tsx) | Server Component. Sparkles icon + "No active subscription" heading + body copy + CTA button → locale-aware `Link` to `/upgrade`. |
| [web/src/app/api/stripe/portal/route.ts](web/src/app/api/stripe/portal/route.ts) | POST handler. Auth → seller lookup → RLS-scoped read of `stripe_customer_id` → 400 if user has no subscription → locale-aware `return_url` → `stripe.billingPortal.sessions.create` → returns `{ url }`. Lives at root `/api/stripe/portal` per the established H.7.1 / H.8 convention. |

### Files modified (4)

| Path | Change |
| --- | --- |
| [web/src/app/[locale]/dashboard/page.tsx](web/src/app/[locale]/dashboard/page.tsx) | Replaced H.6 placeholder. Server Component, `force-dynamic`, auth-gated via `getUser()` + locale-aware redirect. Resolves seller via `sellers.user_id = auth.uid()`, reads subscription RLS-scoped (own-only per H.2 `subscriptions_self_select` policy). Renders `<SubscriptionSummaryCard />` if subscription exists, `<EmptyDashboard />` otherwise. |
| [web/messages/en.json](web/messages/en.json) | Removed obsolete `greetingWith` / `comingSoonBody`. Added 25+ keys: `signedInAs`, `plan.{title, monthly, yearly}`, `status.{8 statuses}`, `renewsOnLabel`, `cancelsOnLabel`, `cancelingNotice`, `manageButton`, `manageOpening`, `manageError`, `empty.{title, body, cta}`. |
| [web/messages/fr.json](web/messages/fr.json) | Mirror with French copy. |
| [web/messages/ar.json](web/messages/ar.json) | Mirror with Arabic copy (best-effort, pending professional review per H.7.1 caveat). |

### RLS-scoped subscription read decision

The H.10 dashboard reads from `public.subscriptions` via `getSupabaseServer()` — the SSR cookie-authed client — NOT via the service-role admin client from H.9. Three reasons:

1. **Defense in depth.** The H.2 RLS policy `subscriptions_self_select` already gates reads to the caller's own row via `seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid())`. Using the cookie-authed client means a misconfigured query (or a future bug) physically can't return another user's subscription.
2. **Service-role is for server-to-server contexts.** The H.9 webhook needs admin because Stripe → our server has no user context. The dashboard is a personal-data surface where the user IS the context.
3. **Audit trail.** Service-role queries skip RLS audit hooks. Cookie-authed queries flow through standard auth — easier to trace if anything ever goes wrong.

Reserved use of admin: webhook handler (H.9) only. Do not import `getSupabaseAdmin()` from any user-facing route or page.

### Cadence detection

Comparing `subscription.stripe_price_id` against `STRIPE_PRICE_<CURRENCY>_YEARLY` env vars resolves whether the user is on monthly or yearly:

```ts
const yearlyIds = new Set(
  [
    process.env.STRIPE_PRICE_EUR_YEARLY,
    process.env.STRIPE_PRICE_USD_YEARLY,
    process.env.STRIPE_PRICE_AED_YEARLY,
  ].filter((id): id is string => Boolean(id)),
);
const isYearly = yearlyIds.has(subscription.stripe_price_id);
```

Pure server-side — env vars are not exposed to client. Avoids a Stripe API call to `stripe.prices.retrieve(id)` per dashboard render. The env vars are the authoritative source per H.7.3's six-Price convention.

The trade-off: if a user's price ID is unknown to the env (e.g., a future seventh price not yet wired), it defaults to "monthly". The fallback is benign — labels are translated copy, not billing logic — but the catalog should track all six configured prices in lockstep.

### Locale-aware return URL

The `/api/stripe/portal` route mirrors H.8's locale-aware redirect URL pattern verbatim. After the user finishes in the Stripe Customer Portal:

```ts
const localePath = locale === routing.defaultLocale ? '' : `/${locale}`;
const returnUrl = `${origin}${localePath}/dashboard`;
```

Three concrete return URLs:
- EN visitor: `https://mony-psi.vercel.app/dashboard`
- FR visitor: `https://mony-psi.vercel.app/fr/dashboard`
- AR visitor: `https://mony-psi.vercel.app/ar/dashboard`

The user lands back on their localized dashboard with whatever changes they made in the portal already reflected (after the H.9 webhook propagates the Stripe event, typically <5s).

### Inline "Undo cancellation" deferred

Stripe Customer Portal already provides a "Don't cancel" reactivation flow with appropriate legal-compliance language and one-click reversal. Building an inline reactivation button on `/dashboard` would:

1. Duplicate Stripe's polished UX
2. Require maintaining cancellation-revert legal copy across three locales
3. Add a third API route (or Server Action) for the underlying `stripe.subscriptions.update(id, { cancel_at_period_end: false })` call

Decision: punt to Stripe's portal. The `cancelingNotice` block on the SubscriptionSummaryCard already directs users to the manage button, where Stripe handles the reactivation fully. Documented as deferred for H.10.1 if future user feedback warrants inline reactivation.

### Verification

- **`cd web && npx tsc --noEmit`** → exit 0 (after replacing the spec's `@/types/supabase` import with a local `SubRow` type — see Recon findings above).
- **JSON parse** for all three message catalogs → OK.
- **`cd web && npx next build`** → succeeds. Build output:
  - `/[locale]/dashboard` (●, paths /en, /fr, /ar): 1.06 kB → 120 kB First Load JS (up from H.6's 177 B placeholder — adds the SubscriptionSummaryCard server bundle + ManageSubscriptionButton client hydration).
  - `/api/stripe/portal` (ƒ, dynamic, root): 177 B.
  - `/api/stripe/checkout` (ƒ, H.8): 177 B.
  - `/api/stripe/webhook` (ƒ, H.9): 128 B.
  - Middleware 131 kB (up 1 kB from H.9 — `next-intl` middleware imports the new `dashboard.*` keys from the catalogs).
- **Mobile `tsc --noEmit`** → exit 0. Mobile codebase byte-identical (no `/src/` changes).
- **Manual / runtime (deferred to user, requires a real subscription created via H.8 + propagated by H.9):**
  1. Visit `/dashboard` without a subscription → empty state with "Get Mony Pro" CTA → routes to `/upgrade`.
  2. Complete Checkout via H.8 + wait for H.9 webhook (~2s) → reload `/dashboard` → real subscription card with status pill, plan name, renewal date, manage button.
  3. Click "Manage subscription" → button enters "Opening…" state → redirects to `https://billing.stripe.com/...` (Stripe-hosted portal).
  4. In portal: cancel subscription → return to `/dashboard` → status pill flips to "Canceled" or shows "Cancels on [date]" notice within ~5s (webhook propagates `customer.subscription.updated`).
  5. Reactivate via portal → "Don't cancel" → return to `/dashboard` → status flips back to "Active" within ~5s.
  6. Repeat in `/fr/dashboard` + `/ar/dashboard` to verify locale-aware copy + return URLs.

### User-manual setup (one-time, before runtime testing)

Stripe Dashboard configuration of what the Customer Portal exposes:

1. **Stripe Dashboard → Settings → Billing → Customer portal** (test mode tab).
2. Click **Activate test link** if not already active.
3. Configure portal settings:
   - **Cancellations**: ✅ Allow customers to cancel subscriptions
     - **Cancellation mode**: "End of period" (matches our `cancel_at_period_end` flow + the H.2 trigger's status-driven `is_pro` mirroring)
   - **Subscriptions → Subscription update**: ✅ Allow customers to switch between plans
     - **Products**: select "Mony Pro" + the 6 prices created in H.8
   - **Payment methods**: ✅ Allow customers to update payment methods
   - **Invoice history**: ✅ Allow customers to view billing history
4. Save. Settings persist for test mode.
5. Live mode requires a separate activation when H.14 ships — the Dashboard has a separate "Live mode" tab with its own configuration.

### Phase H mobile/web status (post-H.10)

| Step | Status | Surface |
| --- | --- | --- |
| H.1–H.5 | ✓ | Mobile feature-complete |
| H.6 | ✓ | Web scaffold + auth bridge |
| H.7 | ✓ | Real public landing |
| H.7.1 | ✓ | i18n EN/FR/AR |
| H.7.2 | ✓ | RTL polish for AR |
| H.7.3 | ✓ | Multi-currency EUR/USD/AED |
| Op.3 | ✓ | WEB_BASE_URL → mony-psi.vercel.app |
| H.8 | ✓ | Multi-currency Stripe Checkout |
| H.9 | ✓ | Stripe webhook handler |
| **H.10** | **✓ this step** | **Real Pro dashboard + Customer Portal** |
| H.11 | next | Admin dashboard at `/admin/subscriptions` |
| H.14 | future | Stripe live-mode flip + production go-live |

Phase H **seller-side surface complete**: visitors can subscribe (H.8), the data syncs (H.9), and they can manage their subscription (H.10). H.11 is the admin counterpart — list all subscriptions, refund/cancel manually if needed.

### H.11 handoff (admin dashboard)

Concrete next pieces:

1. **Admin role detection.** No precedent in the codebase yet. Two viable shapes:
   - **`is_admin BOOLEAN` flag on `sellers`** (or a new `auth.users` JWT claim). Simple, integrates with existing RLS via `EXISTS (SELECT 1 FROM sellers WHERE user_id = auth.uid() AND is_admin)`.
   - **Separate `admins(user_id PK → auth.users)` table.** More auditable, easier to revoke admin without touching seller data.
   PRO_AUDIT.md §10 open-question 15 defaulted to the dedicated table — recommend that. Schema decision lands in H.11.
2. **`/admin/subscriptions` page.** Reads ALL subscription rows via the H.9 service-role admin client (RLS would block normal users). Lists with seller name, status, plan, MRR contribution. Filterable by status (`active`, `past_due`, `canceled`).
3. **Per-row actions**: refund, cancel manually, view in Stripe (deep-link).
4. **Auth-gating**: a wrapper layout at `app/admin/layout.tsx` checks `is_admin` and `redirect`s to `/` for non-admins. The role check is server-side (cookie-authed, then admin lookup).
5. **Locale-aware** (English-only might be acceptable for v1 admin — internal staff usage). Decide in H.11.

### Reversion

```bash
git revert <H.10 commit>
```

Removes the five new files + reverts the dashboard page + the catalog extensions. The Stripe Customer Portal configuration in the Dashboard is forward-compatible (no harm leaving it active even when this revert is in place — nothing in the revert links to it).

If only the Customer Portal API route should be removed but the dashboard kept (e.g., to swap to a custom billing UI), the surgical edit is to delete just `app/api/stripe/portal/route.ts` + `components/dashboard/ManageSubscriptionButton.tsx`, then update SubscriptionSummaryCard to render a different action. The status pill, layout, and empty state survive.

---

## Step H.11 Changelog (2026-05-04) — Admin Dashboard for Subscription Oversight

Mixed schema + JS step. Adds the `is_admin` flag on `public.sellers` (one new migration, REVOKE'd from user UPDATE per the B.1.5 lineage), then ships the admin counterpart to H.10's seller dashboard: subscription list with search + status filter, detail page with destructive actions, two API routes for cancel + refund. Defense-in-depth gate at every layer (page + API). Mobile codebase byte-identical.

> **Audit referenced:** PRO_AUDIT.md §10 open-question 15 (admin role storage — defaulted to a separate `admins` table; H.11 lands on a column on `sellers` for v1 simplicity, with a documented upgrade path if multi-role admin becomes necessary). The H.10 changelog's H.11 handoff list (this implements it).

### Reconnaissance findings (re-confirmed before authoring)

- **Latest migration timestamp** is `20260522_subscriptions_schema_and_trigger.sql` (H.2). Next slot is `20260523`.
- **`getSupabaseAdmin()`** from H.9 ([web/src/lib/supabase/admin.ts](web/src/lib/supabase/admin.ts)) is the service-role client. Reused for cross-user subscription reads — RLS would block these via `subscriptions_self_select`, so service-role is correct here.
- **`stripe` singleton** from H.8 ([web/src/lib/stripe.ts](web/src/lib/stripe.ts)) reused for cancel + refund Stripe API calls.
- **Web has no Dialog/Modal primitive.** H.11 uses HTML5 native `<dialog>` + `<form method="dialog">` for typed-confirmation flows on destructive actions. Built-in browser support: Escape-close, scrim, keyboard nav for free.
- **Stripe Invoice.payment_intent migration in API dahlia.** Stripe API `2026-04-22.dahlia` (stripe@22's pinned version) moved `payment_intent` off the `Invoice` type onto the `InvoicePayment` sub-resource. H.11's spec used `invoice.payment_intent` directly, which would fail typecheck. **Reconciled** by switching the refund flow to `stripe.charges.list({ customer, limit: 1 })` + `stripe.refunds.create({ charge: charge.id, ... })` — Charge is unchanged in dahlia and refundable directly.
- **Web has no generated Supabase types** (`npm run gen:types` documented but not enforced; H.10 noted this and used a local `SubRow` type). H.11 follows the same pattern — local types for the join shape with documented casts.
- **Existing admin.* keys** — none. H.11 introduces the namespace.

### Files added (8)

#### Schema migration (1)

| Path | Purpose |
| --- | --- |
| [supabase/migrations/20260523_add_is_admin_to_sellers.sql](supabase/migrations/20260523_add_is_admin_to_sellers.sql) | `is_admin boolean NOT NULL DEFAULT false` on `public.sellers` + partial index `WHERE is_admin = true`. System-managed via B.1.5's positive-list grant pattern (no grant changes needed). Idempotent + reversible. |

#### Helpers (1)

| Path | Purpose |
| --- | --- |
| [web/src/lib/admin/auth.ts](web/src/lib/admin/auth.ts) | `requireAdmin(locale)` for Server Component pages — locale-aware redirect to `/` for non-admins. `requireAdminApi()` for Route Handlers — returns `{ ok: false, response }`. Both use the cookie-authed SSR client (NOT admin) for the `is_admin` lookup. |

#### Pages (2)

| Path | Purpose |
| --- | --- |
| [web/src/app/[locale]/admin/page.tsx](web/src/app/[locale]/admin/page.tsx) | Admin home — subscription list. `requireAdmin` first, then service-role query reads `subscriptions` joined with `sellers`. Filters via `?q=&status=`. v1 cap: 100 rows + in-memory search. |
| [web/src/app/[locale]/admin/subscriptions/[id]/page.tsx](web/src/app/[locale]/admin/subscriptions/[id]/page.tsx) | Detail page. Seller card + state card + Stripe IDs (truncated) + AdminActions panel. |

#### Components (2)

| Path | Purpose |
| --- | --- |
| [web/src/components/admin/AdminSubscriptionTable.tsx](web/src/components/admin/AdminSubscriptionTable.tsx) | Server Component. Filter form (`<form method="get">`) + table with avatar / name / email / status pill (reused from H.10) / renewal date / "Open" link. |
| [web/src/components/admin/AdminActions.tsx](web/src/components/admin/AdminActions.tsx) | Client Component. Three buttons: cancel-period-end (single click), cancel-immediate (typed `CANCEL` confirm), refund-last-charge (typed `REFUND` confirm). HTML5 `<dialog>` for typed confirmations. Inline result panel + auto-reload after success. |

#### API routes (2)

| Path | Purpose |
| --- | --- |
| [web/src/app/api/admin/cancel-subscription/route.ts](web/src/app/api/admin/cancel-subscription/route.ts) | POST. `requireAdminApi` → `stripe.subscriptions.update(id, { cancel_at_period_end: true })` (period_end) or `stripe.subscriptions.cancel(id)` (immediate). No DB write — H.9 webhook syncs. |
| [web/src/app/api/admin/refund-last-charge/route.ts](web/src/app/api/admin/refund-last-charge/route.ts) | POST. `requireAdminApi` → `stripe.charges.list({ customer, limit: 1 })` → guards (no charges / not succeeded / already refunded) → `stripe.refunds.create({ charge, reason: 'requested_by_customer', metadata: { refunded_by_admin } })`. |

### Files modified (3)

- [web/messages/en.json](web/messages/en.json) — added `admin.*` namespace (~30 keys: title, total interpolation, search/filter, table columns, detail-page sections, action buttons, typed-confirmation prompts, success/error toasts, status enum mapping)
- [web/messages/fr.json](web/messages/fr.json) — French mirror
- [web/messages/ar.json](web/messages/ar.json) — Arabic mirror (best-effort, pending professional review per H.7.1)

### Schema decision: `is_admin` column on `sellers` vs. separate `admins` table

| Choice | Pro | Con |
| --- | --- | --- |
| **Column on `sellers`** (H.11 choice) | One less join. One less RLS policy. Existing B.1.5 column-level grants cover it. | Couples admin-ness to having a seller row. Single-role today. |
| Separate `admins` table | Cleaner separation. Multi-role expansion is a column add. | Extra join on every admin gate. New RLS policy. |

H.11 chose the column for v1 simplicity. Upgrade path documented (widen to enum or migrate to dedicated table).

### Defense-in-depth (3-layer admin gate)

```
Layer 1: Page-level gate (Server Component)
  /admin            → requireAdmin(locale) → redirect to / on miss
  /admin/subs/[id]  → requireAdmin(locale) → redirect to / on miss

Layer 2: API-level gate (Route Handler)
  /api/admin/cancel-subscription  → requireAdminApi() → 403 on miss
  /api/admin/refund-last-charge   → requireAdminApi() → 403 on miss

Layer 3: Service-role usage (privileged data + Stripe API)
  Only AFTER layers 1-2 pass.
```

A direct curl POST to `/api/admin/*` from an unauth'd session gets a 401 from Layer 2 even if Layer 1's page were misconfigured.

### Refund flow: `stripe.charges.list` (not invoice indirection)

In Stripe API `2026-04-22.dahlia`, `payment_intent` moved off `Invoice` onto `InvoicePayment` (same migration pattern that affected `current_period_*` per H.9). Switched to charges-then-refund — `Charge` is unchanged. Edge cases handled: `no_charges` 404, `charge_not_succeeded` 400, `already_refunded` 400. Refund's `metadata.refunded_by_admin` records which admin triggered it.

### Typed confirmations for destructive actions

| Action | Reversible? | Friction |
| --- | --- | --- |
| Cancel at period end | Yes (Stripe portal "Don't cancel") | Single click |
| Cancel immediately | No | Type `CANCEL` to confirm |
| Refund last charge | No | Type `REFUND` to confirm |

HTML5 `<dialog>` + `<form method="dialog">` — browser-native modal with Escape-close, scrim, keyboard navigation. Submit button stays disabled until typed phrase exactly matches (case-sensitive).

### Single-writer invariant preserved

H.11's API routes do NOT write to `public.subscriptions`. They call Stripe API methods which fire webhook events; H.9 receives those events, upserts into the table, and the H.2 trigger updates `is_pro`. Single-writer (the H.9 webhook) preserved.

Refunds don't currently propagate to `public.subscriptions` — refunds are charge-level events. H.X could extend H.9 to handle `charge.refunded` events into a `refunds` audit table if support tickets warrant.

### Verification

- **`cd web && npx tsc --noEmit`** → exit 0.
- **JSON parse** for all three message catalogs → OK.
- **`cd web && npx next build`** → succeeds. Build output:
  - `/[locale]/admin` (●, /en, /fr, /ar): 186 B per locale.
  - `/[locale]/admin/subscriptions/[id]` (ƒ, dynamic): 2.01 kB → 121 kB First Load JS (AdminActions Client Component bundles dialog logic).
  - `/api/admin/cancel-subscription` (ƒ): 186 B.
  - `/api/admin/refund-last-charge` (ƒ): 186 B.
  - All previous routes unchanged.
- **Mobile `tsc --noEmit`** → exit 0. Mobile codebase byte-identical (no `/src/` changes).

### Manual setup required (one-time, in lockstep)

1. **Apply the migration:**
   ```powershell
   cd C:\Users\MwL\Desktop\hubb
   npm run db:push
   ```
2. **Regenerate mobile types** (the new `is_admin` column appears in the generated `Database` types):
   ```powershell
   npm run gen:types
   git add src/types/supabase.ts
   git commit -m "chore(types): regenerate after H.11 (is_admin)"
   ```
3. **Designate the first admin** via Supabase SQL Editor (Dashboard → SQL Editor):
   ```sql
   -- Look up your auth user id:
   select id, email from auth.users;

   -- Make yourself admin:
   update public.sellers
      set is_admin = true
    where user_id = '<your_auth_user_id>';
   ```
4. **No new env vars** — H.11 reuses H.8's Stripe + H.9's service-role keys.

### Manual / runtime verification

- Visit `/admin` while logged in as a non-admin → redirects to `/`.
- Visit `/admin` after the SQL update → admin list renders.
- Filter `?status=active` / search `?q=...` → server re-renders.
- Click "Open" → detail page.
- Click "Cancel at period end" → POST → ~5s later (after H.9 webhook) reload shows `cancel_at_period_end = true`.
- Click "Cancel immediately" → typed `CANCEL` → POST → reload shows `status = canceled`.
- Click "Refund last charge" → typed `REFUND` → POST → success message + Stripe Dashboard reflects the refund.
- Repeat in `/fr/admin` + `/ar/admin` to verify locale-aware copy.

### Phase H mobile/web status (post-H.11)

| Step | Status | Surface |
| --- | --- | --- |
| H.1–H.5 | ✓ | Mobile feature-complete |
| H.6 | ✓ | Web scaffold + auth bridge |
| H.7 | ✓ | Real public landing |
| H.7.1 | ✓ | i18n EN/FR/AR |
| H.7.2 | ✓ | RTL polish for AR |
| H.7.3 | ✓ | Multi-currency EUR/USD/AED |
| Op.3 | ✓ | WEB_BASE_URL → mony-psi.vercel.app |
| H.8 | ✓ | Multi-currency Stripe Checkout |
| H.9 | ✓ | Stripe webhook handler |
| H.10 | ✓ | Real Pro dashboard + Customer Portal |
| **H.11** | **✓ this step** | **Admin dashboard — subscription oversight** |
| H.12 | next | Pro feature gates (transaction fee discount, featured boost, analytics) |
| H.14 | future | Stripe live-mode flip + production go-live |

Phase H seller-side AND admin-side surfaces are both complete in test mode.

### H.12 handoff (Pro feature gates)

H.12 ships the actual Pro perks beyond ProBadge + listing-cap removal:

1. **Reduced transaction fee** — when a Pro seller's product is purchased, apply ~4% application fee instead of ~7%. Implementation likely in `supabase/functions/create-checkout-session/index.ts`: read `sellers.is_pro`, set `application_fee_amount` accordingly. Requires Stripe Connect (currently dormant per PRO_AUDIT.md §2.4) — H.12 may need to ship Connect onboarding first OR apply the fee at platform level (since Connect isn't wired, all funds go to the platform; "fee discount" becomes a platform-side bookkeeping number).
2. **Featured-listing boost** — 1 boosted listing per week per Pro seller. New column `products.featured_at timestamptz` + RPC `boost_listing(product_id)` that checks `sellers.is_pro` AND no boost in the last 7 days. Marketplace feed sorts featured-then-newest.
3. **Analytics stub** — basic view counts per listing. New `product_views` table with RLS scoped to seller. Mobile `useProductAnalytics(productId)` hook. v1 stays simple (just view counts).

### Reversion

```bash
git revert <H.11 commit>
```

Removes all 8 new files + reverts the catalog extensions. The migration revert requires manual SQL execution if applied:

```sql
begin;
  drop index if exists public.sellers_is_admin_idx;
  alter table public.sellers drop column if exists is_admin;
commit;
```

Then run `npm run gen:types` to drop `is_admin` from the mobile `Database` types.

If only the admin pages should be removed but the schema kept, the surgical edit is to delete just the `/web/src/app/[locale]/admin/` tree + `/web/src/app/api/admin/` tree + `/web/src/components/admin/` tree + `/web/src/lib/admin/auth.ts`, leaving the migration and the column in place.

## Step H.12 Changelog (2026-05-05) — Featured Listing Boost

Pro perk H.12: Pro sellers can boost ONE of their listings per 7-day window. Boosted listings render with an "À la une" / "Featured" badge anywhere they appear and surface on a dedicated rail at the top of the Categories page during their boost window. This step gives the Pro subscription its first **visible operational** benefit beyond the badge + unlimited listings.

### Reconnaissance

Before writing code I read:

- `src/features/marketplace/hooks/useTrendingProducts.ts` and `src/features/marketplace/hooks/useNewestProducts.ts` for the rail-data hook pattern. Both wrap `useQuery` with a `['marketplace', 'products', '<rail>', ...]` cache key, a 60-300s `staleTime`, and a service helper that returns a typed list. `useFeaturedProducts` mirrors this exactly with the key `['marketplace', 'featured', 'list', LIMIT]`.
- `src/components/categories/CategoryRail.tsx` and `src/components/categories/RailProductCard.tsx` so the new Featured rail could compose `<CategoryRail>` directly with no new wrapper component. The badge overlay lives inside `RailProductCard` rather than as a new component — a single-purpose rendering primitive that activates whenever a `Product.featuredUntil` is in the future, no parent flag required.
- `src/features/marketplace/components/ProductDetailSheet.tsx` for the own-listing detection pattern. The sheet did not previously read the caller's seller row; H.12 introduces `useMySeller(isAuthenticated)` and an `isOwn = mySeller?.id === product.seller.id` guard.
- `src/features/marketplace/services/products.ts` for the existing `select('*, seller:sellers(*)')` query shape. The new `listFeaturedProducts(limit)` reuses this shape and adds `.gt('featured_until', now)` + `.order('featured_until', { ascending: false })` so the partial index `products_featured_until_idx` is the planner's chosen path. `featureProduct(productId)` is a thin RPC wrapper that re-throws Postgres errors verbatim so call sites can pattern-match (`'not_pro'`, `'cooldown_active'`, `'not_owner_or_product_missing'`).
- The migration convention from H.2 / D.2: `uuid_generate_v4()` (uuid-ossp from 20260501) over `gen_random_uuid()` (pgcrypto), `BEGIN`/`COMMIT`-wrapped, idempotent guards (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`), inline rollback SQL at top.

### Files created

- **`supabase/migrations/20260524_featured_listings.sql`** — 1 column on `public.products` (`featured_until timestamptz nullable`), 1 column on `public.sellers` (`last_boost_at timestamptz nullable`), 1 partial BTREE index on `products(featured_until DESC) WHERE featured_until IS NOT NULL`, 1 SECURITY DEFINER RPC `feature_product(uuid) returns jsonb`. The RPC verifies Pro state + ownership + cooldown atomically, then writes both timestamps and returns a JSON payload `{ product_id, featured_until, next_available_at }`. `revoke all from public` + `grant execute to authenticated` locks the function down.
- **`src/features/marketplace/hooks/useFeaturedProducts.ts`** — read-side hook. `useQuery` with key `['marketplace', 'featured', 'list', LIMIT=10]` and `staleTime: 60_000`.
- **`src/features/marketplace/hooks/useFeatureProductMutation.ts`** — write-side hook. Plain mutation (no optimistic state — the boost is server-validated, there is no useful local approximation). On success invalidates `['marketplace', 'featured']`, `['marketplace', 'products', 'byId', productId]`, and `['marketplace', 'my-seller']` (the latter so `lastBoostAt` refreshes for the cooldown countdown).
- **`src/components/feed/BoostButton.tsx`** — Pro-perk CTA. Five-state machine in priority order: `loading` → `gate` (non-Pro, routes to `useUpgradeFlow`) → `featured` (currently boosted, disabled) → `cooldown` (within 7d of last boost, disabled with localized next-date) → `idle` (tappable, opens confirm Alert). Errors map to upgrade flow / cooldown Alert / generic Alert as belt-and-suspenders against the UI gate.

### Files modified

- **`src/features/marketplace/types/product.ts`** — added `featuredUntil?: string | null` to `Product`.
- **`src/features/marketplace/services/products.ts`** — added `featured_until` to `ProductRow`, propagated through `rowToProduct`. New exports: `featureProduct`, `listFeaturedProducts`, type `FeatureProductResult`. The `featureProduct` RPC call uses an `as never` cast on the function name + args and an `as unknown as FeatureProductResult` cast on the return — documented exception until `npm run gen:types` registers `feature_product` in `Database['public']['Functions']`. Same precedent as E.2's `incrementShareCount` cast.
- **`src/features/marketplace/services/sellers.ts`** — added `last_boost_at` to `SellerRow` and `lastBoostAt: string | null` to `SellerProfile`. Propagated through `rowToSeller`.
- **`src/components/categories/RailProductCard.tsx`** — added the `isFeatured` derivation and the absolute-positioned badge overlay on top of the image (top-left corner, `position: absolute`, sparkle icon + "À la une" text in `colors.brand`).
- **`src/features/marketplace/components/ProductFeedItem.tsx`** — added the same badge overlay above `SellerPill` in the swipe feed. Positioned with absolute `left: spacing.lg` and `top: topRowTop - 28` so it sits just above the SellerPill row.
- **`src/app/(protected)/(tabs)/friends.tsx`** — wired `useFeaturedProducts()`. The Featured rail renders ABOVE the Tendances rail and **only** when there are featured products (or the query is loading); when the query resolves to `[]` the section disappears entirely so we don't show a "no featured products" placeholder for the (early-launch) common case.
- **`src/features/marketplace/components/ProductDetailSheet.tsx`** — mounted `<BoostButton/>` after the `sellerCard` block, gated by `isOwn = mySeller?.id === product.seller.id`. Imports `useMySeller`, `useAuthStore`, `BoostButton`. Did not modify the footer or any non-owner action.
- **`src/i18n/locales/en.json`** + **`src/i18n/locales/fr.json`** — new keys: `feed.featured`, `categories.featuredRailTitle`, and a new `boost.*` namespace with 12 keys (`buttonIdle`, `buttonFeatured`, `buttonCooldown`, `buttonProGate`, `confirmTitle`, `confirmBody`, `confirmAction`, `successTitle`, `successBody`, `errorNotPro`, `errorCooldown`, `errorGeneric`).

### SECURITY DEFINER rationale (cite B.1.5 + C.2 + D.1.5 + E.2)

`featured_until` is a NEW column on `public.products`. D.1.5 (`20260519_tighten_products_update_grants.sql`) revoked the table-wide UPDATE grant on `products` and re-granted column-level UPDATE only on the user-controlled allowlist; H.12 deliberately does NOT extend that allowlist. Likewise `last_boost_at` is a new column on `public.sellers` and B.1.5 (`20260515_tighten_sellers_update_grants.sql`) restricts UPDATE on sellers to user-controlled columns only. Either column is therefore unwritable to `authenticated`.

The boost RPC must run as the migration owner to bypass both column-grant allowlists. SECURITY DEFINER + `set search_path = public, pg_catalog` defeats the classic shadow-object hijack vector — same shape and same justification as E.2's `increment_share_count` and D.2's `handle_comment_change`. The function additionally enforces `auth.uid() IS NULL` → exception, joins sellers↔products on `seller_id` filtered by `sellers.user_id = auth.uid()` for ownership, and re-checks `is_pro` in-function. A compromised mobile build that bypassed the BoostButton state machine would still hit `RAISE EXCEPTION 'not_pro'` or `'cooldown_active'`.

### Cooldown model: 7-day window from last boost START

Boost duration = 7 days. Cooldown = 7 days. The cooldown is computed FROM `sellers.last_boost_at`, not from `products.featured_until`. Because durations match, `last_boost_at + cooldown` is exactly the moment the current boost expires — there is no dead time and there is no second boost mid-window. One Pro perk per week, period. The mobile `BoostButton` derives its disabled-with-countdown state from `lastBoostAt + 7d`; the server independently re-checks `now < last_boost_at + interval '7 days'`.

The model is deliberately simple. A "boost when current expires" or "rolling 7d from completion" model would invite re-boosting the same listing perpetually and dilute the rail. We accept the simplicity tradeoff of exactly-one-boost-per-week.

### Pro gate (defense in depth)

The `BoostButton`'s `state.kind === 'gate'` branch routes non-Pro taps through `useUpgradeFlow` (the same hook the H.4 cap-modal / sell-flow banner / profile pitch banner / action-rail checkout-gate use). The RPC re-checks `is_pro` and raises `'not_pro'` if the seller is not Pro — error-handler maps that error back through `useUpgradeFlow` so the caller still gets the upgrade affordance even if the UI gate was bypassed.

### Reduced fee + analytics deferred

Reduced transaction fee: not implemented in this step. Reduced fees are a payment-flow concern (Stripe `application_fee_amount` plumbing through H.8's `create-checkout-session` Edge Function) that should be tackled with the rest of the post-launch fee-tier work, not with the visible boost perk. **Deferred to post-launch.**

Analytics: not implemented in this step. The natural next step is a `boost_events` table populated from `feature_product` (audit trail: who boosted what, when, with what RPC outcome), surfaced in the admin web tooling. **Deferred to H.13.**

### Verification

- **`npx tsc --noEmit`** → exit 0. Mobile codebase type-clean against the new `Product.featuredUntil`, `SellerProfile.lastBoostAt`, `featureProduct` / `listFeaturedProducts` services, and the BoostButton state machine.
- **JSON parse** for both `src/i18n/locales/en.json` and `src/i18n/locales/fr.json` → OK. No structural drift; the 12 new `boost.*` keys + 2 new top-level keys (`feed.featured`, `categories.featuredRailTitle`) are present in both locales.
- **Migration parse**: `BEGIN`/`COMMIT` balance verified, idempotent guards on every DDL (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`), inline rollback SQL block at top.
- **Manual / runtime (deferred to user — requires applying the migration + admin granting self Pro for testing):**
  - As Pro: open own product → "Boost listing" button visible. Tap → confirm → success Alert with localized expiration. Listing card immediately gains the "À la une" badge.
  - Visit Categories → "À la une" rail renders the boosted product above Tendances.
  - Wait < 7 days → BoostButton shows "Prochain boost {date}" with the cooldown expiration date.
  - Wait 7 days → BoostButton re-enables.
  - As non-Pro: BoostButton shows "Booster (Pro)" → tap = upgrade flow.
  - As another seller viewing the boosted listing: badge visible; no boost button.

### Manual setup required (one-time, in lockstep)

1. **Apply the migration:**
   ```powershell
   cd C:\Users\MwL\Desktop\hubb
   npm run db:push
   ```
2. **Regenerate mobile types** (registers `featured_until`, `last_boost_at`, and the `feature_product` Function in the generated `Database` types — at which point the documented `as unknown as FeatureProductResult` cast in `featureProduct` can be replaced with the generated function-return type):
   ```powershell
   npm run gen:types
   git add src/types/supabase.ts
   git commit -m "chore(types): regenerate after H.12 (featured_until / last_boost_at / feature_product)"
   ```
3. **No new env vars** — H.12 reuses the existing Supabase connection.

### Phase H feature-gate matrix (post-H.12)

| Perk | Status | Surface |
| --- | --- | --- |
| Listing cap (free 5 / Pro unlimited) | ✓ H.3 | Mobile sell flow + `newPost.tsx` cap modal |
| "PRO" badge on listings + profile | ✓ existing | Mobile (`SellerPill`, profile header) |
| Acheter direct (direct-checkout gate) | ✓ existing | Mobile `ProductDetailSheet` Buy now button |
| **Featured listing boost (1× per 7d)** | **✓ H.12** | **Mobile (BoostButton, badge, Categories rail)** |
| Reduced transaction fee | ⏸ deferred post-launch | Stripe `application_fee_amount` |
| Analytics dashboard (incl. boost outcomes) | ⏸ H.13 | TBD |

### Reversion command

```powershell
git revert <h12-commit-sha>
```

…then run the documented rollback SQL from the migration's header to drop the columns + index + RPC. The mobile codebase is fully reverted by the `git revert`; the database needs the manual rollback because migrations are forward-only by convention.

```sql
begin;
  revoke execute on function public.feature_product(uuid) from authenticated;
  drop function if exists public.feature_product(uuid);
  drop index    if exists public.products_featured_until_idx;
  alter table   public.sellers  drop column if exists last_boost_at;
  alter table   public.products drop column if exists featured_until;
commit;
```

Then run `npm run gen:types` to drop `featured_until` / `last_boost_at` / `feature_product` from the mobile `Database` types.

## Step H.13 Changelog (2026-05-05) — Pro-gated Product-View Analytics

H.13 turns the Pro perk story from "boost + badge" into "boost + badge + visibility into who's looking." A Pro seller opening their own listing now sees a 3-tile analytics card (24h / 7d / 30d view counts). A free-tier seller sees a soft Pro-upsell teaser in the same slot. Anonymous and authenticated views are tracked; owner self-views are filtered out server-side.

**Audit-first deliverable:** `ANALYTICS_AUDIT.md` at the repo root captures the design decisions and the deviations from the literal H.13 prompt (which referenced symbols that don't exist in this repo verbatim). The summary below is intentionally brief; the full rationale lives there.

### Reconnaissance

- `src/hooks/useUpgradeFlow.ts` and `src/features/marketplace/hooks/useIsPro.ts` are reused as-is (same hooks the H.4 cap-modal / banner / action-rail and the H.12 BoostButton consume). The H.13 prompt's destructured `{ data: isPro } = useIsPro()` form is wrong — the hook returns a plain `boolean`.
- `src/components/marketplace/ProUpgradeBanner.tsx` already accepts `emphasis="soft"|"urgent"` plus title / body / ctaLabel / onPressCta. The H.13 teaser slot reuses it without modification.
- The H.13 prompt suggested `gen_random_uuid()` (pgcrypto). The codebase convention is `uuid_generate_v4()` (uuid-ossp from 20260501); H.13 follows the convention so no new extension dependency is introduced. Captured in ANALYTICS_AUDIT.md §2.4.
- The H.13 prompt referenced `useSupabase()`. The codebase has no such hook — every service file imports the `supabase` singleton directly from `@/lib/supabase`. H.13 matches the existing pattern. Captured in ANALYTICS_AUDIT.md §2.1.
- `web/messages/{en,fr,ar}.json` use ICU placeholders (`{message}`) under next-intl; mobile uses i18next (`{{date}}`). H.13's web copy has no placeholders so the difference is moot, but it's worth recording for future parity work.

### Files created

- **`ANALYTICS_AUDIT.md`** (repo root) — design audit. Schema, RPC contract, hook semantics, UI state machine, i18n key table, open questions / handoffs.
- **`supabase/migrations/20260605_product_views.sql`** — `public.product_views` append-only event log (cascade-on-product-delete, set-null-on-viewer-delete), composite index `(product_id, viewed_at DESC)`, RLS enabled with **no policies** (table is locked to service-role + SECURITY DEFINER RPCs only), plus two RPCs:
  - `track_product_view(uuid)` — anon-callable, owner-self-view excluded server-side. Granted to `anon, authenticated`.
  - `get_product_analytics(uuid)` — authed-only, ownership-gated. Returns `(views_24h, views_7d, views_30d)` as a single-row table. Pro state is NOT checked server-side (gated client-side; cf. ANALYTICS_AUDIT.md §2.8). Granted to `authenticated`.
- **`src/features/marketplace/services/analytics.ts`** — `trackProductView(productId)` (silent, fire-and-forget) and `getProductAnalytics(productId)` (re-throws RPC errors so React Query can transition to `isError`). Both use the documented `as never` RPC-name + args casts pending `npm run gen:types`. Same pattern as H.12's `featureProduct`.
- **`src/features/marketplace/hooks/useTrackProductView.ts`** — effect-based, fires once per `productId` per app session via a `useRef<Set<string>>` dedup. No return value.
- **`src/features/marketplace/hooks/useProductAnalytics.ts`** — `useQuery` with three-way enable gate (`!!productId && isOwner && isPro`), 60s `staleTime`, returns `UseQueryResult<ProductAnalytics, Error>`.
- **`src/components/marketplace/AnalyticsCard.tsx`** — owner-only / Pro-gated UI. Returns `null` for non-owners (mount-anywhere safety), renders `<ProUpgradeBanner emphasis="soft"/>` for free-tier owners, and renders 3 stat tiles for Pro owners. Errors fall through to `—` placeholders rather than surfacing an Alert.

### Files modified

- **`src/features/marketplace/components/ProductDetailSheet.tsx`** — added `useTrackProductView(productId)` (fires unconditionally on every product-id change) and mounted `<AnalyticsCard productId isOwner={isOwn}/>` inside the existing `isOwn` block, directly below the H.12 BoostButton.
- **`src/i18n/locales/en.json`** + **`src/i18n/locales/fr.json`** — new `analytics.*` namespace (6 keys: `title`, `views24h`, `views7d`, `views30d`, `upgradeTeaser`, `upgradeCta`).
- **`web/messages/{en,fr,ar}.json`** — same `analytics.*` namespace added on the web side for parity (the namespace is ready for a future H.14 / admin console without a second i18n PR; H.13 itself ships no new web UI). The Arabic block carries an `_arNote` flag noting it is pending native-speaker review (same caveat as H.7.1).

### SECURITY DEFINER + RLS rationale

`product_views` has RLS enabled with **no policies** plus an explicit `revoke all from anon, authenticated, public` on the table grants. Effect: the table is unreachable from PostgREST regardless of any future policy authoring mistakes. The only writers are the SECURITY DEFINER RPCs (which run as the migration owner and bypass RLS), the service_role (Edge Functions, admin), and direct DB superuser access.

`set search_path = public, pg_catalog` on both functions defeats the classic SECURITY DEFINER hijack vector — same shape as C.2's `handle_follow_change`, D.2's `handle_comment_change`, E.2's `increment_share_count`, and H.12's `feature_product`.

### Owner-self-view exclusion via SECURITY DEFINER

`track_product_view` resolves the caller's `seller.id` from `auth.uid()`, looks up the product owner, and returns without inserting if they match. Anonymous callers (`auth.uid() IS NULL`) cannot match by definition. This is server-side enforcement — a compromised mobile build that skipped the dedup ref would still be filtered out at the database layer.

### Pro gate enforced two ways: client (useIsPro) + server (RPC ownership check)

The Pro check on the analytics view itself is **deliberately client-side**. The `get_product_analytics` RPC verifies *ownership* (you can only read counts for products you own) but not Pro state. Aggregates on a public listing are not legally sensitive — the perk is the polished in-app surface, not the raw integer. A free seller hitting the RPC from a Supabase shell gets numbers back; they still don't get the in-app Pro UI. Removing the server-side Pro check keeps the RPC stable across future Pro/free-tier rule changes (grandfathering, regional pricing) without migration churn. Cf. ANALYTICS_AUDIT.md §2.8.

### Verification

- **Mobile `npx tsc --noEmit`** → exit 0. Type-clean against the new service helpers, hooks, AnalyticsCard, and the ProductDetailSheet wiring.
- **Web `cd web && npx tsc --noEmit`** → exit 0. The web codebase is byte-identical except for the three locale files; tsc confirms the JSON imports remain valid.
- **JSON parse** for all five locale files (`src/i18n/locales/{en,fr}.json`, `web/messages/{en,fr,ar}.json`) → OK.
- **Migration parse**: `BEGIN`/`COMMIT` balance verified, every DDL idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`), inline rollback SQL block at top.
- **Manual / runtime (deferred to user — requires applying the migration + admin granting self Pro for testing):**
  - Open another seller's product detail → `select count(*) from public.product_views where product_id = ...` increments by 1.
  - Open your own product detail → no row inserted (owner self-view excluded).
  - As free-tier seller on your own product → soft teaser banner with "View analytics" CTA → magic-link upgrade flow.
  - Resubscribe to Pro → reload product detail → 24h / 7d / 30d numbers render (likely 0/0/0 unless you triggered scenario #1 from another account).
  - As Pro, attempt `select * from public.get_product_analytics('<not-your-product-id>')` from a Supabase shell → `not_authorized` error.
  - Anon tracking: log out / use an incognito client, open a product, confirm `viewer_seller_id IS NULL` and the row exists.

### Manual setup required (one-time, in lockstep)

1. **Apply the migration:**
   ```powershell
   cd C:\Users\MwL\Desktop\hubb
   npm run db:push
   ```
2. **Regenerate mobile types** (registers `product_views` Table + the two new Functions in the generated `Database` types — at which point the documented `as never` casts in `analytics.ts` can be replaced with the generated function-arg / function-return types):
   ```powershell
   npm run gen:types
   git add src/types/supabase.ts
   git commit -m "chore(types): regenerate after H.13 (product_views + analytics RPCs)"
   ```
3. **No new env vars** — H.13 reuses the existing Supabase connection.

### Phase H feature-gate matrix (post-H.13)

| Perk | Status | Surface |
| --- | --- | --- |
| Listing cap (free 5 / Pro unlimited) | ✓ H.3 | Mobile sell flow + cap modal |
| "PRO" badge on listings + profile | ✓ existing | Mobile (`SellerPill`, profile header) |
| Acheter direct (direct-checkout gate) | ✓ existing | Mobile `ProductDetailSheet` Buy now button |
| Featured listing boost (1× per 7d) | ✓ H.12 | Mobile (BoostButton, badge, Categories rail) |
| **Product-view analytics (24h/7d/30d)** | **✓ H.13** | **Mobile (`AnalyticsCard` in ProductDetailSheet)** |
| Reduced transaction fee | ⏸ deferred post-launch | Stripe `application_fee_amount` |
| Charts / breakdowns / click-through | ⏸ later phase | TBD |
| Web admin analytics surface | ⏸ later phase | i18n keys ready (`analytics.*`); no UI yet |

### Reversion command

```powershell
git revert <h13-commit-sha>
```

…then run the documented rollback SQL from the migration's header to drop the table + indexes + RPCs. The mobile codebase is fully reverted by `git revert`; the database needs the manual rollback because migrations are forward-only by convention.

```sql
begin;
  revoke execute on function public.get_product_analytics(uuid)
    from authenticated;
  drop function if exists public.get_product_analytics(uuid);
  revoke execute on function public.track_product_view(uuid)
    from anon, authenticated;
  drop function if exists public.track_product_view(uuid);
  drop index if exists public.product_views_product_id_viewed_at_idx;
  drop table if exists public.product_views;
commit;
```

Then run `npm run gen:types` to drop `product_views` + `track_product_view` + `get_product_analytics` from the mobile `Database` types.



## H.15 — Legal pages
- Three new routes: /legal/{privacy,terms,child-safety}, locale-aware (en/fr/ar)
- Markdown content at web/src/content/legal/*.{en,fr,ar}.md, rendered via react-markdown + remark-gfm
- Shared LegalLayout (web/src/app/[locale]/legal/layout.tsx) with .legal-prose Tailwind styles (LTR + RTL-aware) in globals.css
- Footer updated: real locale-aware Link components replace placeholder <a href="#"> for Terms, Privacy, Child Safety (linkChildSafety replaces linkCookies slot — no cookies page yet)
- Sitemap (web/src/app/sitemap.ts) includes 9 legal URLs (3 slugs × 3 locales); robots.txt created at web/public/robots.txt
- Mobile Settings (src/app/(protected)/(tabs)/profile.tsx): Legal section with 3 AccountRow entries — Privacy Policy, Terms of Use, Child Safety Standards — each launching WebBrowser.openBrowserAsync to the corresponding web URL
- i18n keys added: web legal.{backHome,footer.*} in all 3 locales; mobile settings.legal.* in en + fr
- Contact email throughout: Support@app-mony.com
- DRAFT: AR translations are placeholder stubs linking to EN; native-speaker review needed before UAE public launch
- Pending placeholders in EN/FR content: [LEGAL ENTITY NAME], [REGISTERED ADDRESS], [LICENSE NUMBER], [DATE] — fill once UAE entity is incorporated and counsel approves copy

## Bugfix — auth bridge (BUG-001 / BUG-002 / BUG-003 / BUG-004)

**Files created:**
- `web/src/app/[locale]/sign-in/page.tsx` — magic-link sign-in page (server component, locale-aware, redirects already-authed users)
- `web/src/components/auth/SignInForm.tsx` — client component; calls `signInWithOtp` → "check email" confirmation state
- `AUTH_FIX_AUDIT.md` — full root-cause analysis, fix log, and Supabase Dashboard instructions

**Files modified:**
- `supabase/functions/issue-web-session/index.ts` — `redirectTo` now routes through `/auth/callback?next=<path>` so `@supabase/ssr` can set session cookies; fallback `WEB_BASE_URL` default corrected to `mony-psi.vercel.app`
- `web/src/components/landing/Header.tsx` — "Sign in" button now links to `/sign-in` instead of `/upgrade`
- `web/src/app/globals.css` — added `scroll-padding-top: 5rem; scroll-behavior: smooth` so `#pricing` / `#features` / `#faq` anchors aren't obscured by the sticky header
- `web/messages/{en,fr,ar}.json` — added `signIn` namespace (title, sub, emailLabel, cta, sending, checkEmailTitle, checkEmailBody)

**User-facing behavior changes:**
- "Sign in" in the landing header now opens a real `/sign-in` form instead of bouncing silently
- The mobile "Upgrade to Pro" magic-link flow now lands on `/upgrade` with an active session
- Pricing / Features / FAQ anchor scrolls now land with section heading visible below the header
