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




