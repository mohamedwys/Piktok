# PRO_AUDIT.md

Read-only audit of the existing Pro-state surface and the recommended
architecture for a self-service Pro subscription system spanning the
mobile app and a new Next.js web codebase. No source files were
modified. This document is the single input H.2+ should reference —
follow-up steps should ship migrations, hooks, and screens against
these findings without re-discovering them.

> **Important framing:** The repo already has *most* of the Stripe
> plumbing it needs for one-shot product checkout (Edge Functions,
> webhook, orders schema). It has **zero** subscription plumbing. It
> has **zero** Stripe Connect onboarding flow despite having three
> `stripe_*` columns on `sellers`. The Pro subscription system is a
> new, mostly-greenfield surface that *reuses* the existing Edge
> Function pattern but does not collide with the order-side flow.

---

## 1. Existing Pro-State Code

### 1.1 The `is_pro` column

Defined in [supabase/migrations/20260501_initial_marketplace_schema.sql:26](supabase/migrations/20260501_initial_marketplace_schema.sql:26):

```sql
create table public.sellers (
  id uuid primary key default uuid_generate_v4(),
  ...
  is_pro boolean not null default false,
  ...
);
```

Surfaced to the JS client as `sellers.is_pro: boolean` in the generated
types — see [src/types/supabase.ts:451](src/types/supabase.ts:451)
(`Row`), [:476](src/types/supabase.ts:476) (`Insert`),
[:501](src/types/supabase.ts:501) (`Update`).

### 1.2 Confirmed: REVOKE'd from authenticated UPDATE per B.1.5

The PROFILE_AUDIT §3.3 finding is real and shipped. Verbatim from
[supabase/migrations/20260515_tighten_sellers_update_grants.sql:45-66](supabase/migrations/20260515_tighten_sellers_update_grants.sql:45):

```sql
begin;

revoke update on public.sellers from authenticated;

grant update (
  name,
  avatar_url,
  bio,
  website,
  phone_public,
  email_public,
  latitude,
  longitude,
  location_text,
  location_updated_at
) on public.sellers to authenticated;

commit;
```

**Disallowed for `authenticated`** (system-managed; only `service_role`
can write): `id, user_id, created_at, verified, is_pro, rating,
sales_count, stripe_account_id, stripe_charges_enabled,
stripe_payouts_enabled`.

**Implication for H.2+:** the Stripe webhook (which runs with the
service role) is the *only* path that may flip `is_pro`. A subscription
"upsert → trigger → set is_pro" wiring is therefore safe and does not
require any RLS change. The existing column-level grant carve-out is
the right shape.

### 1.3 `is_pro` consumer sites

Two categories: (a) display-only ProBadge gates, (b) one real flow
branch in the action rail / product sheet.

| Site | File:line | Type | Behavior |
| --- | --- | --- | --- |
| Action rail Buy button | [src/features/marketplace/components/ProductActionRail.tsx:36](src/features/marketplace/components/ProductActionRail.tsx:36), [:83-84](src/features/marketplace/components/ProductActionRail.tsx:83) | **FLOW BRANCH** | `isPro ? Buy ('bag-handle') : Contact ('chatbubble-ellipses')`. Both paths open the global `ProductDetailSheet`; the actual divergence happens in the footer. |
| Product detail sheet footer | [src/features/marketplace/components/ProductDetailSheet.tsx:214](src/features/marketplace/components/ProductDetailSheet.tsx:214), [:221-260](src/features/marketplace/components/ProductDetailSheet.tsx:221) | **FLOW BRANCH** | Pro: single CTA `marketplace.buyNow` → `onPressBuyNow` → `useCreateCheckoutSession` → opens Stripe URL via `expo-web-browser`. Non-Pro: split CTA `Make offer` (DM with offer kind) + `Message seller` (DM no offer). |
| Profile screen — own | [src/app/(protected)/(tabs)/profile.tsx:342](src/app/(protected)/(tabs)/profile.tsx:342) | Visual | `{seller?.isPro ? <ProBadge size="sm" /> : null}` |
| `SellerPill` (feed overlay) | [src/components/feed/SellerPill.tsx:87-106](src/components/feed/SellerPill.tsx:87) | Visual | Renders ProBadge + `marketplace.sellerPro` caption. |
| `SellerMiniCard` | [src/components/feed/SellerMiniCard.tsx:79](src/components/feed/SellerMiniCard.tsx:79), [:34-36](src/components/feed/SellerMiniCard.tsx:34) | Visual + label | Switches `seller.kindLabel` between `seller.professional` / `seller.individual`. |
| `FollowerRow` | [src/components/profile/FollowerRow.tsx:61](src/components/profile/FollowerRow.tsx:61) | Visual | ProBadge inline next to verified check. |
| `CommentItem` | [src/components/feed/CommentItem.tsx:82](src/components/feed/CommentItem.tsx:82) | Visual | ProBadge next to author name in comment thread. |
| `SellerCard` (legacy) | [src/features/marketplace/components/SellerCard.tsx:48](src/features/marketplace/components/SellerCard.tsx:48) | Visual | Legacy of `SellerPill`; per PROJECT_AUDIT it has been superseded by `SellerPill`. |

### 1.4 `is_pro` data-layer plumbing

`is_pro` is selected on every seller-shaped query and surfaced as
`isPro` (camelCased) in the service layer:

- [src/features/marketplace/services/sellers.ts:31](src/features/marketplace/services/sellers.ts:31), [:53](src/features/marketplace/services/sellers.ts:53)
- [src/features/marketplace/services/products.ts:34](src/features/marketplace/services/products.ts:34), [:100](src/features/marketplace/services/products.ts:100)
- [src/features/marketplace/services/follows.ts:18](src/features/marketplace/services/follows.ts:18), [:29](src/features/marketplace/services/follows.ts:29), [:32](src/features/marketplace/services/follows.ts:32) (`SELLER_JOIN_COLUMNS` constant)
- [src/features/marketplace/services/messaging.ts:60](src/features/marketplace/services/messaging.ts:60), [:106](src/features/marketplace/services/messaging.ts:106), [:132](src/features/marketplace/services/messaging.ts:132), [:157](src/features/marketplace/services/messaging.ts:157), [:177](src/features/marketplace/services/messaging.ts:177)
- [src/features/marketplace/services/comments.ts:16](src/features/marketplace/services/comments.ts:16), [:32](src/features/marketplace/services/comments.ts:32)
- Optimistic comment seed in [src/features/marketplace/hooks/usePostComment.ts:37](src/features/marketplace/hooks/usePostComment.ts:37), [:45](src/features/marketplace/hooks/usePostComment.ts:45)

`ProBadge` itself ([src/components/ui/ProBadge.tsx:1-58](src/components/ui/ProBadge.tsx:1)) is the single source of truth for the violet pill ("PRO" by default, optional `label`/`size`). Re-exported from [src/components/ui/index.ts](src/components/ui/index.ts).

---

## 2. Existing Stripe Integration

### 2.1 What exists, in one sentence

A **one-shot guest checkout** flow for buying a single product, via
Supabase Edge Function → Stripe Checkout (web) → webhook → `orders`
update. There is **no** Stripe Connect onboarding, **no** destination
charges, **no** subscriptions, **no** Customer Portal, and **no**
Stripe SDK in the mobile app — only a `WebBrowser.openBrowserAsync(url)`.

### 2.2 Edge Functions

| Function | File | Purpose | Notes |
| --- | --- | --- | --- |
| `create-checkout-session` | [supabase/functions/create-checkout-session/index.ts:1-95](supabase/functions/create-checkout-session/index.ts:1) | Auth's the user via `Authorization` header; loads product; creates a `stripe.checkout.sessions.create({ mode: 'payment', ... })`; inserts `orders` row with `stripe_session_id` and `status='pending'`; returns `{ url, session_id, order_id }`. | Uses `Stripe@14.21.0` esm.sh import. **No `application_fee_amount` / `transfer_data` / `on_behalf_of`** — funds go to the platform Stripe account, not the seller's. The `application_fee_amount` column on `orders` is reserved but never written. |
| `stripe-webhook` | [supabase/functions/stripe-webhook/index.ts:1-54](supabase/functions/stripe-webhook/index.ts:1) | Verifies signature with `STRIPE_WEBHOOK_SECRET`, handles `checkout.session.completed` / `checkout.session.expired` / `charge.refunded` events. Updates `orders.status` and writes `stripe_payment_intent_id` / `stripe_charge_id`. | **No subscription events** (`customer.subscription.{created,updated,deleted}`, `invoice.payment_failed`, etc.). |

Both run as Deno + `@supabase/supabase-js@2` against the
`SUPABASE_SERVICE_ROLE_KEY` so they can write past RLS.

### 2.3 Stripe SDK presence

| Surface | SDK |
| --- | --- |
| Mobile app (`package.json`) | **None.** No `@stripe/stripe-react-native`, no `@stripe/stripe-js`. The only Stripe code is the `Stripe` import inside the two Edge Functions on the server. |
| Edge Functions | `https://esm.sh/stripe@14.21.0?target=deno` (both functions). |
| Mobile redirect mechanism | `expo-web-browser` opens the `session.url` returned by the Edge Function — see [src/features/marketplace/components/ProductDetailSheet.tsx:21](src/features/marketplace/components/ProductDetailSheet.tsx:21), [:145](src/features/marketplace/components/ProductDetailSheet.tsx:145). The user completes checkout in the in-app browser; the webhook updates the order asynchronously. |

### 2.4 The three `stripe_*` columns on `sellers` are dormant

[supabase/migrations/20260511_seller_stripe.sql:1-4](supabase/migrations/20260511_seller_stripe.sql:1):

```sql
alter table public.sellers
  add column if not exists stripe_account_id text,
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_payouts_enabled boolean not null default false;
```

`stripe_account_id` is **never written** anywhere in the codebase — no
RPC, no Edge Function, no client write. The columns appear to have
been forward-provisioned for a future Stripe Connect onboarding (per
PROJECT_AUDIT §6 their values stay `null` / `false` for every seller).

The `create-checkout-session` function does not read `stripe_account_id`
either. Today's checkout flow is **platform-only** — the platform takes
the full payment, and there is no payout split. Building Stripe Connect
remains a separate workstream from Phase H (ship Pro subscriptions
first; Connect onboarding for marketplace payouts is a later phase).

### 2.5 Webhook-touchable rows today

Only `orders.{status, stripe_payment_intent_id, stripe_charge_id, updated_at}`. Nothing on `sellers` is currently webhook-driven; H.2 introduces that pattern.

### 2.6 `start_or_get_conversation` RPC — *not* part of the payment flow

Per [supabase/migrations/20260509_messaging.sql:88-128](supabase/migrations/20260509_messaging.sql:88), this is the messaging RPC — buyer ↔ seller idempotent conversation creator, used for the **non-Pro** "Contact / Make offer" branch. Mentioned in C.4 of the messaging audit; no Stripe involvement.

---

## 3. Existing Checkout / Payment Flow

End-to-end trace, Pro path only (the only path that touches Stripe):

| # | Step | File:line |
| --- | --- | --- |
| 1 | User taps the right-rail Buy button on a feed item. Button shows `'bag-handle'` icon + `actionRail.buy` label only when `product.seller.isPro === true`. | [src/features/marketplace/components/ProductActionRail.tsx:36](src/features/marketplace/components/ProductActionRail.tsx:36), [:43-47](src/features/marketplace/components/ProductActionRail.tsx:43), [:83-98](src/features/marketplace/components/ProductActionRail.tsx:83) |
| 2 | `onPressBuy` opens the global `ProductDetailSheet` via `useProductSheetStore`. | [src/features/marketplace/components/ProductActionRail.tsx:43-47](src/features/marketplace/components/ProductActionRail.tsx:43) |
| 3 | Sheet's footer renders the Pro CTA when `product.seller.isPro`. | [src/features/marketplace/components/ProductDetailSheet.tsx:214-235](src/features/marketplace/components/ProductDetailSheet.tsx:214) |
| 4 | `onPressBuyNow` runs `useRequireAuth().requireAuth()`, then `checkout.mutateAsync(productId)`. | [src/features/marketplace/components/ProductDetailSheet.tsx:137-156](src/features/marketplace/components/ProductDetailSheet.tsx:137) |
| 5 | The mutation calls `createCheckoutSession(productId)` which invokes the `create-checkout-session` Edge Function with `{ product_id, return_url }`. | [src/features/marketplace/hooks/useCreateCheckoutSession.ts:1-19](src/features/marketplace/hooks/useCreateCheckoutSession.ts:1), [src/features/marketplace/services/orders.ts:50-72](src/features/marketplace/services/orders.ts:50) |
| 6 | If Edge Function returns 404 / "not found", the service throws `StripeNotConfiguredError`; the sheet alerts `checkout.notConfiguredTitle`. | [src/features/marketplace/services/orders.ts:43-48](src/features/marketplace/services/orders.ts:43), [src/features/marketplace/components/ProductDetailSheet.tsx:147-151](src/features/marketplace/components/ProductDetailSheet.tsx:147) |
| 7 | Edge Function: `auth.getUser(token)` → load product → `stripe.checkout.sessions.create({ mode: 'payment', line_items, metadata: { product_id, buyer_id, seller_id } })` → `orders.insert({ buyer_id, product_id, seller_id, amount, currency, stripe_session_id, status: 'pending' })` → return `{ url, session_id, order_id }`. | [supabase/functions/create-checkout-session/index.ts:21-87](supabase/functions/create-checkout-session/index.ts:21) |
| 8 | Sheet calls `useProductSheetStore.getState().close()` and `WebBrowser.openBrowserAsync(url)` — the user lands on hosted Stripe Checkout. | [src/features/marketplace/components/ProductDetailSheet.tsx:143-145](src/features/marketplace/components/ProductDetailSheet.tsx:143) |
| 9 | After payment, Stripe POSTs the webhook. `checkout.session.completed` updates `orders.status='paid'` and writes `stripe_payment_intent_id`. | [supabase/functions/stripe-webhook/index.ts:23-32](supabase/functions/stripe-webhook/index.ts:23) |
| 10 | The mutation's `onSettled` invalidates `MY_ORDERS_KEY`; the profile screen's "Orders" section refetches and shows the new row. | [src/features/marketplace/hooks/useCreateCheckoutSession.ts:14-17](src/features/marketplace/hooks/useCreateCheckoutSession.ts:14), [src/app/(protected)/(tabs)/profile.tsx:540-575](src/app/(protected)/(tabs)/profile.tsx:540) |

### 3.1 `orders` schema

[supabase/migrations/20260510_orders.sql:1-29](supabase/migrations/20260510_orders.sql:1):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `buyer_id` | uuid → `auth.users(id)` | `on delete cascade` |
| `product_id` | uuid → `public.products(id)` | `on delete restrict` ✓ confirms Op.2 |
| `seller_id` | uuid → `public.sellers(id)` | `on delete restrict` ✓ confirms Op.2 |
| `amount` | numeric(10,2) | |
| `currency` | text check `in ('EUR','USD','GBP')` | |
| `status` | text check `in ('pending','paid','failed','cancelled','refunded')` | |
| `stripe_session_id` | text | unique partial idx where not null |
| `stripe_payment_intent_id` | text | |
| `stripe_charge_id` | text | |
| `application_fee_amount` | numeric(10,2) | **Reserved but never written** |
| `created_at`, `updated_at` | timestamptz | |

RLS: SELECT only — buyers see own, sellers see rows where they are
the seller. **No client-side INSERT/UPDATE/DELETE policies.** Writes
are gated through the Edge Function with the service role.

### 3.2 Charge model

`mode: 'payment'` (one-shot), platform-only. No `transfer_data`,
`on_behalf_of`, or `application_fee_amount` is set in
[supabase/functions/create-checkout-session/index.ts:47-67](supabase/functions/create-checkout-session/index.ts:47). The platform retains the full payment amount; the marketplace
payout-to-seller flow does not exist yet.

For Phase H (Pro subscriptions), this is fine — the *platform itself*
sells the Pro tier, so platform-only checkout is exactly what we want.
The marketplace destination-charge work is a separate later workstream.

---

## 4. Sellers Schema — Pro Columns

Seven Pro / Stripe-related columns currently exist on `sellers`. Origin
file in parens.

| Column | Type | Nullable | Default | Current write path |
| --- | --- | --- | --- | --- |
| `is_pro` | boolean | NOT NULL | `false` (`20260501`) | **Manual SQL only** today (matches PROJECT_AUDIT initial inventory). Seed migration sets a few demo sellers to `true`. No app code path can write it (REVOKE'd from `authenticated` per `20260515`). |
| `verified` | boolean | NOT NULL | `false` (`20260501`) | Same — system-managed via column grant. Adjacent flag, included for parity. |
| `stripe_account_id` | text | NULL | `null` (`20260511`) | **Never written.** Reserved for Stripe Connect onboarding. |
| `stripe_charges_enabled` | boolean | NOT NULL | `false` (`20260511`) | **Never written.** |
| `stripe_payouts_enabled` | boolean | NOT NULL | `false` (`20260511`) | **Never written.** |
| `rating` | numeric(3,2) | NOT NULL | `0` (`20260501`) | System-managed (later phase: aggregated from reviews). |
| `sales_count` | integer | NOT NULL | `0` (`20260501`) | System-managed. |

System-managed columns per [supabase/migrations/20260515_tighten_sellers_update_grants.sql:24-25](supabase/migrations/20260515_tighten_sellers_update_grants.sql:24): `id, user_id, created_at, verified, is_pro, rating, sales_count, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled`. These stay system-managed in H.2.

User-writable allowlist (unchanged): `name, avatar_url, bio, website, phone_public, email_public, latitude, longitude, location_text, location_updated_at`.

---

## 5. Subscription Schema Design Proposal

**Recommendation: ADD a `subscriptions` table, KEEP `is_pro` as a denormalized flag synced by trigger.**

The current schema has zero subscription state. Rationale for the
denormalized-flag-plus-table approach over a derived view:

1. Every seller-shaped query already projects `is_pro` ([src/features/marketplace/services/follows.ts:32](src/features/marketplace/services/follows.ts:32) `SELLER_JOIN_COLUMNS`, etc.). Switching to a derived view would require either rewriting those `select(...)` strings or adding a join — both noisy and slower.
2. A boolean column is index-friendly (`partial index where is_pro` for analytics).
3. The webhook is the only writer of subscription state, so the denormalization is single-writer and trivial to keep correct via a row-level trigger.
4. Existing visual ProBadge consumers (§1.3) keep working unchanged.

### 5.1 Proposed `subscriptions` table

```sql
create table public.subscriptions (
  id                       uuid primary key default uuid_generate_v4(),
  seller_id                uuid not null references public.sellers(id) on delete cascade,
  stripe_subscription_id   text not null unique,
  stripe_customer_id       text not null,
  stripe_price_id          text not null,
  status                   text not null check (status in (
                              'incomplete',
                              'incomplete_expired',
                              'trialing',
                              'active',
                              'past_due',
                              'canceled',
                              'unpaid',
                              'paused'
                           )),
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  cancel_at_period_end     boolean not null default false,
  canceled_at              timestamptz,
  trial_end                timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index subscriptions_seller_idx on public.subscriptions(seller_id);
create unique index subscriptions_stripe_sub_uidx on public.subscriptions(stripe_subscription_id);

alter table public.subscriptions enable row level security;

create policy "subscriptions select own" on public.subscriptions
  for select using (
    seller_id in (select id from public.sellers where user_id = auth.uid())
  );
-- No insert / update / delete policies — service role only (webhook).
```

The status check matches Stripe's [Subscription.status enum](https://stripe.com/docs/api/subscriptions/object#subscription_object-status) verbatim so deserialization stays a no-op.

### 5.2 `is_pro` sync trigger

```sql
create or replace function public.sync_seller_is_pro()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.sellers
  set is_pro = exists (
    select 1
    from public.subscriptions s
    where s.seller_id = coalesce(new.seller_id, old.seller_id)
      and s.status in ('active', 'trialing')
  )
  where id = coalesce(new.seller_id, old.seller_id);
  return null;
end;
$$;

create trigger subscriptions_sync_is_pro
after insert or update of status or delete
on public.subscriptions
for each row execute function public.sync_seller_is_pro();
```

**Why this shape:** the trigger is the single source of truth for
`is_pro`. The webhook upserts a row into `subscriptions` (service
role, bypasses grants), the trigger fires, `sellers.is_pro` flips. No
new client code needs to write `is_pro` directly. Column-level grants
from `20260515` stay valid because the trigger runs `security definer`
under the function owner.

### 5.3 Optional: `subscription_events` audit log (later step, not H.2)

Defer to H.13 or post-launch. Useful for support ("when did this
subscription start past_due?") but not load-bearing. Shape would be
`(id, stripe_event_id unique, type, payload jsonb, received_at)` —
written by the webhook for every event before processing. Skipping for
v1 keeps the migration small.

### 5.4 What the schema delegates to Stripe

We deliberately do **not** mirror: `Customer` (use the
`stripe_customer_id` reference), `Invoice` (link out to the Customer
Portal), `PaymentMethod` (Stripe-only), `Price`/`Product` definitions
(create them in the Stripe dashboard, hardcode the price ids in the
web codebase env). This keeps the schema small and avoids a perpetual
mirroring problem.

---

## 6. CTA Placement Strategy (Mobile)

Surfaces ranked by ROI for v1. The actual upgrade action **must deep-
link to the web** (per §7) — every in-app CTA is essentially "tell the
user to upgrade somewhere else."

### 6.1 Surfaces inventory

| # | Surface | File:line (anchor) | Audience | Trigger | Click target |
| --- | --- | --- | --- | --- | --- |
| (a) | **Own profile hero — "Become Pro" banner** | [src/app/(protected)/(tabs)/profile.tsx:444-471](src/app/(protected)/(tabs)/profile.tsx:444) (heroActions) | Self (seller) | Always visible when authed + non-Pro | Deep link → web upgrade |
| (b) | **Sell flow header banner** | [src/app/(protected)/(tabs)/newPost.tsx:1-80](src/app/(protected)/(tabs)/newPost.tsx:1) (top of form) | Self (seller) | Visible when non-Pro on the sell screen | Deep link → web upgrade |
| (c) | **Listing-cap blocker** | `useCreateProduct` mutation onError, surfaced at `newPost.tsx` submit | Self (seller) | When non-Pro tries to create their 11th listing | Modal → "Upgrade" CTA → deep link |
| (d) | **Action-rail Buy = own product, non-Pro** | [src/features/marketplace/components/ProductActionRail.tsx:83-98](src/features/marketplace/components/ProductActionRail.tsx:83) | Self viewing own listing | Currently shows `Contact seller` even on own listing — replace with `Enable direct checkout` for own + non-Pro | Deep link → web upgrade |
| (e) | **Featured-boost gate** | Future feed-priority surface | Self (seller) | Tap "Feature this listing" on own product | Deep link → web upgrade |
| (f) | **Analytics teaser** | New profile section | Self (seller) | Always visible when non-Pro authed | Deep link → web upgrade |
| (g) | **Currency / price-card legibility** (no change) | [src/features/marketplace/components/PriceCard.tsx:1-130](src/features/marketplace/components/PriceCard.tsx:1) | Buyer | n/a | Buyer-side, irrelevant to CTAs |

### 6.2 Recommended phasing

**Primary for v1 (H.4):**
- (a) **Own profile hero banner.** Highest visibility; first place a seller looks. One pressable card under `heroActions`.

**Secondary for follow-up (H.4 stretch or H.13):**
- (b) Sell flow header banner — second-highest discovery moment.
- (c) Listing-cap blocker — necessary the moment H.3 lands the cap.

**Tertiary (later):**
- (d) own-product Acheter affordance, (e) featured-boost gate, (f) analytics teaser.

The visual ProBadge sites in §1.3 keep working as-is and serve as a
*positive* signal — they're how non-Pro sellers learn the badge exists
when browsing other sellers' profiles.

### 6.3 Deep-link target shape

`pro.<domain>/upgrade?seller_id=<uuid>&token=<short-lived-supabase-jwt-or-sso>` opened with `expo-web-browser` (already a project dep — see `package.json`). The web codebase exchanges the token for a Supabase session and starts Stripe Checkout. See §8 for the auth-bridge mechanics.

---

## 7. App Store / Play Store Policy Constraints

**TL;DR:** for v1, **route the actual subscription purchase to the web** via deep link. Do not use IAP. This is the lowest-risk path under current Apple/Google policies for a marketplace seller-tier subscription. Document trade-offs honestly so the user can override if revenue capture justifies the IAP cost.

### 7.1 Apple App Store

| Topic | Position |
| --- | --- |
| **App Review Guideline 3.1.1 (IAP requirement)** | "Apps offering 'in-app purchases' for digital goods must use IAP." Subscriptions for digital services qualify. Marketplace **goods themselves** (physical or services rendered in person) are exempt under 3.1.3(e). |
| **What category is "Pro tier for sellers"?** | Genuinely gray. Etsy Plus is sold via IAP on iOS. Vinted, Depop, eBay sell seller perks via web only. Both approaches have shipped without rejection. |
| **3.1.3(a) reader rule update (Jan 2024)** | Reader apps may link out to external sites for account creation/management. *Not* directly applicable to marketplaces but reflects Apple's softening stance. |
| **EU DMA — External Purchase Link Entitlement (March 2024)** | Apps in EU storefronts may include a single in-app link to an external purchase page (Apple still takes 17% / 10% of external sales tracked via this link, subject to terms). |
| **US "anti-steering" injunction (Epic v Apple, 2024)** | US storefronts may include external purchase links for any app (no IAP fee on those). |

**Practical reading:** for a *marketplace seller subscription*, web-routed Stripe is the safer cross-platform choice. The argument against rejection is: "Pro is a benefit tier for sellers in a physical-goods marketplace, not 'digital content' per 3.1.1." This argument has held for major incumbents.

### 7.2 Google Play

Similar structure (Play Billing required for digital goods), more permissive in practice — external billing allowed in EU and South Korea explicitly, and physical-goods marketplaces commonly process subscriptions via web.

### 7.3 Recommended approach for v1

| Layer | Behavior |
| --- | --- |
| In-app | Show CTAs / educational content / pricing teaser. **Do not** invoke any payment SDK or initiate any checkout in-app on iOS. |
| Web | Hosted at `pro.<domain>/upgrade`. Stripe Checkout session created server-side, redirected client-side. |
| Deep link | `expo-web-browser.openBrowserAsync(deepLinkUrl)`. The system sheet (SFSafariViewController on iOS) is acceptable; we are not embedding a checkout page in our own UI. |
| Compliance posture | Conservative. No IAP, no inline payment forms, no "external purchase link entitlement" filing on day one (file later if needed for EU). Cross-platform consistency > revenue-share optimization. |

### 7.4 Trade-offs

| Path | Pros | Cons |
| --- | --- | --- |
| **Web-routed Stripe (recommended for v1)** | No 30/15% fee. No SKU duplication across stores. Single source of truth (Stripe). | Slight friction (browser hop). Some risk of Apple challenge despite incumbent precedent. |
| **iOS IAP + Android Play Billing** | Smoothest UX. Lowest rejection risk on Apple side. | 30% / 15% fee. Two separate SKU systems to maintain. SKU prices must match across web and stores. Refund / cancellation flows fragmented across three vendors. |
| **Hybrid (web via DMA entitlement on iOS EU, IAP elsewhere)** | Best fee outcome where allowed, IAP fallback where not. | Significant complexity. Per-region SKU resolution. Probably wrong choice for a v1. |

**This audit recommends web-routed Stripe for v1.** Future iteration can add IAP if revenue justifies the fee, or hybrid if the market expands to regions where DMA does not yet apply.

---

## 8. Web Codebase Architecture Recommendation

### 8.1 Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | **Next.js 14+ App Router** | RSC for server-rendered marketing pages, server actions for Stripe session creation, route handlers for webhooks. |
| Language | TypeScript strict | Mirrors mobile config. |
| Styling | **Tailwind CSS** | Pragmatic for marketing + dashboard. Port mobile design tokens (`colors.brand`, `colors.proBadge`, etc.) into a shared `tokens.ts` consumed by both Tailwind config and React Native theme. |
| Auth | `@supabase/ssr` (cookie-based session) | Same Supabase project as mobile — single user table, single seller row. |
| Data | `@supabase/supabase-js` server-side; `@tanstack/react-query` client-side | Mirrors mobile patterns. |
| Stripe | Server: `stripe` Node SDK in route handlers; Client: `@stripe/stripe-js` for `redirectToCheckout`. | Customer Portal: link-out (zero custom UI). |
| Deployment | **Vercel** | Free tier ample for v1; paid when traffic grows. Webhooks behave well on Vercel (route handler). |
| DNS | Two subdomains: `marketing-domain.tld` (apex landing) + `pro.marketing-domain.tld` (auth dashboard). Or single apex. User decides at H.6. |

### 8.2 Roles served

| Role | Routes | Auth |
| --- | --- | --- |
| Public | `/` (landing), `/pricing`, `/faq`, `/terms`, `/privacy` | none |
| Seller | `/dashboard`, `/dashboard/billing`, `/dashboard/listings`, `/dashboard/analytics`, `/upgrade` | Supabase session via `@supabase/ssr` |
| Admin | `/admin/subscriptions`, `/admin/sellers/[id]` | Supabase session + role check (e.g., `admins(user_id)` table — out of scope for H.2, in scope for H.11) |

### 8.3 Stripe wiring on the web

| Concern | Implementation |
| --- | --- |
| Checkout session creation | `app/api/stripe/checkout/route.ts` — POST → `stripe.checkout.sessions.create({ mode: 'subscription', line_items: [{ price: STRIPE_PRICE_PRO_MONTHLY \|\| STRIPE_PRICE_PRO_YEARLY }], customer_email, success_url, cancel_url, metadata: { seller_id }})`. Returns `{ url }`. |
| Webhook | `app/api/stripe/webhook/route.ts` — verifies via `stripe.webhooks.constructEventAsync`, switches on `customer.subscription.created/updated/deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`. Upserts into `public.subscriptions` via service-role Supabase client. The DB trigger (§5.2) syncs `is_pro`. |
| Customer Portal | `app/api/stripe/portal/route.ts` — `stripe.billingPortal.sessions.create({ customer, return_url })`. Link from `/dashboard/billing`. **Do not build a custom billing UI.** Stripe-hosted portal handles cancel, payment-method, invoice history for free. |

### 8.4 Auth bridge from mobile to web

The mobile deep link must hand the user to the web pre-authenticated.
Two viable shapes:

| Shape | How | Trade-off |
| --- | --- | --- |
| **A. Magic-link short JWT** | Mobile invokes a new Edge Function `issue-web-session` that returns a Supabase session token; deep link is `pro.<domain>/upgrade?session=<token>`; web exchanges via `supabase.auth.setSession`. | Requires one Edge Function. Token must be short-TTL (≤ 5 min). |
| **B. Same-domain cookie + universal links** | Web sets the Supabase auth cookie; iOS/Android Universal/App Links pass the user to the browser already-cookied. | Requires `apple-app-site-association` / Digital Asset Links and the user must have visited the web before — fragile. |

**Recommend (A)** for v1 — a single dedicated Edge Function is well within the project's existing pattern.

### 8.5 Repo structure

| Choice | Trade-off |
| --- | --- |
| **Separate repo (recommended)** | Simpler CI; independent deploy cadence; web team can ship without touching the mobile pipeline. |
| Monorepo | Useful only if you anticipate sharing many React components, which is unlikely between an Expo Native app and a marketing/admin web dashboard. Defer indefinitely. |

The shared module that *should* be extracted regardless of repo choice
is the design-token map (`colors`, `radii`, `spacing`, `typography`).
Ship it as a tiny private npm package or copy-paste-and-keep-in-sync.
For v1, copy-paste is fine — it's ~150 lines and stable.

---

## 9. Phase H Detailed Roadmap (15 steps)

Calibrated against findings above. Each step is independently
shippable and verifiable. Estimated total: **4–6 focused weeks**.

| # | Step | Codebase | Output | Blocked on |
| --- | --- | --- | --- | --- |
| **H.1** | Audit (this document) | n/a | `PRO_AUDIT.md` | — |
| **H.2** | `subscriptions` schema migration | mobile (supabase/) | `20260522_subscriptions.sql`: table + indexes + RLS + `sync_seller_is_pro()` trigger (per §5). Regenerate `src/types/supabase.ts`. | — |
| **H.3** | Free-tier listing cap + `useIsPro` hook | mobile | `useIsPro` reading `mySellerQuery.data.isPro`; cap enforcement in `useCreateProduct` mutation; structured error type `ListingCapReachedError`. | H.2 |
| **H.4** | Strategic CTA placements (mobile) | mobile | (a) own-profile hero banner per §6.2 primary; copy + i18n. Optional: (b) sell-flow banner. | H.3 |
| **H.5** | Deep link to web upgrade flow | mobile + supabase | `expo-web-browser.openBrowserAsync(...)` wired into the H.4 CTAs. New `issue-web-session` Edge Function per §8.4(A). i18n strings. | H.4, H.6 (URL needs final domain) |
| **H.6** | **Web scaffold + design tokens port** | **web (new repo)** | `npx create-next-app`; Tailwind config; tokens.ts; layout shell; Supabase SSR helper. | **Brand name + domain decision (user)** |
| **H.7** | Public landing page | web | `/`, `/pricing`, `/faq`, `/terms`, `/privacy`. Static, SEO-friendly. | H.6 |
| **H.8** | Auth bridge | web + supabase | `/auth/exchange?session=...` route consumes the H.5 token; `@supabase/ssr` cookie session; `/dashboard` protected route group. | H.5, H.6 |
| **H.9** | Pro onboarding (Stripe Checkout) | web | `/upgrade` page; `app/api/stripe/checkout/route.ts`; success / cancel return pages; idempotent against repeat clicks. Stripe TEST mode prices. | H.8 |
| **H.10** | Pro dashboard | web | `/dashboard` showing current plan, renewal date, cancel state, link to Customer Portal; `/dashboard/billing` returns a portal session. | H.9 |
| **H.11** | Admin dashboard (subscriptions only) | web + supabase | `admins(user_id)` table or role claim; `/admin/subscriptions` list; manual cancel + refund actions calling Stripe API. | H.10 |
| **H.12** | Stripe webhooks + sync | web + supabase | `app/api/stripe/webhook/route.ts` handling `customer.subscription.{created,updated,deleted}`, `invoice.payment_{succeeded,failed}`. Verifies signature. Upserts `subscriptions`. Trigger from H.2 syncs `is_pro`. | H.9 |
| **H.13** | Pro feature gates | mobile + supabase | (a) reduced fee % in `create-checkout-session` Edge Function via `application_fee_amount` (requires Stripe Connect — could be deferred); (b) featured-boost surfacing in feed; (c) analytics endpoint + screen. | H.12 |
| **H.14** | Production deploy + DNS + Stripe live flip | web + ops | Vercel prod env; DNS records; Stripe live keys; live webhook secret; smoke tests against live. | H.13 |
| **H.15** | E2E smoke tests + handoff | web + mobile | Manual test matrix: signup → upgrade → webhook → mobile shows PRO; cancel → mobile loses PRO; refund → status reflects. Document runbook. | H.14 |

### 9.1 Critical-path notes

- H.2 and H.6 can run in parallel once the brand/domain decision lands.
- H.9 → H.12 are tightly coupled — recommend bundling the checkout creation, webhook, and Customer Portal in a single PR to avoid half-shipped Stripe state.
- H.13(a) (reduced fee) is the *only* Pro feature that requires Stripe Connect. If Connect is not in scope for Phase H, ship reduced fee as a flat platform-side discount applied in `create-checkout-session` (no destination charge change needed) or defer to Phase I.

### 9.2 Decisions still pending (user-gated)

| Decision | Blocks |
| --- | --- |
| Final brand name | H.6 onward |
| Domain registration | H.6 onward (and the deep link in H.5) |
| Final monthly price | H.9 (Stripe price object) |
| Final annual price | H.9 |
| Free-tier listing cap (10 placeholder) | H.3 |
| Reduced fee % (4% vs 7% placeholder) | H.13(a) |

---

## 10. Open Questions

These need answers before or during the steps that consume them.
Suggested answers in italics where the audit has a default.

1. **Free-tier listing cap exact number?** *Default: 10.* Easy to change later via a single constant in `useIsPro` consumer.
2. **Reduced transaction fee %?** *Default: 4% Pro vs 7% free.* Phase H.13(a) ships this; fees today are platform-only because Stripe Connect is not wired (§2.4), so this is just a code-side number.
3. **Featured boost surfacing — which mechanism?** Three candidates: (i) algorithmic priority in `searchProducts`; (ii) dedicated "Featured" rail above the feed; (iii) top-of-feed slot. Recommend (ii) — easiest to A/B and visually obvious.
4. **Analytics scope?** Minimum: views, profile visits. Stretch: conversion (view→message→buy), saves, likes.
5. **Billing portal — Stripe-hosted vs custom?** *Default: Stripe-hosted.* Zero maintenance, complete feature set. Strong recommendation — do not build custom unless a specific gap shows up.
6. **Refund policy?** Stripe's default is fine (manual via admin dashboard). Decide whether annual prorated refunds are auto or manual.
7. **Trial period?** *Default: 7-day free trial* for monthly tier, none for annual (avoid trial-then-annual abuse). Easy to toggle in the Stripe price configuration.
8. **Annual prepay discount %?** *Default: ~17%* (€19/mo × 12 = €228; €190/yr ≈ €15.83/mo, 16.7% off). User confirms placeholder vs final.
9. **Multi-region pricing?** Stripe supports it natively. Recommend **single-currency for v1** (€) to minimize launch complexity. Add USD/AED in Phase I when buyer signals exist.
10. **Tax handling?** Stripe Tax can auto-compute and collect VAT. Cost: 0.5% per transaction. Recommend enabling — manual VAT collection is a regulatory landmine.
11. **What happens when a Pro seller cancels but has active listings >10?** *Default: read-only listings beyond 10 — they stay visible but cannot be edited until reduced or upgrade re-activated.* Or hard-cap (hide overflow). User decision.
12. **Email transactional?** Stripe sends invoices automatically. Welcome / cancellation / past-due emails — decide whether to add Resend / Postmark for transactional or rely on Stripe's defaults for v1. Recommend Stripe defaults for v1.
13. **Referral / promo codes?** Stripe Promotion Codes work out of the box. Just enable in Checkout config — no extra schema needed.
14. **iOS IAP fallback?** Document the trade-off (§7.4). Current recommendation: web only for v1. User can override.
15. **Web admin role storage?** New `admins` table vs JWT role claim vs Supabase RLS check on a user_metadata flag. *Default: dedicated `admins(user_id pk → auth.users)` table* — explicit, auditable. H.11 ships this.

---

*End of PRO_AUDIT.md. Phase H.2 ships the subscriptions schema migration without re-discovering anything in this document.*
