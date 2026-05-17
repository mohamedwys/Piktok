import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Pro dashboard SSR data fetchers (Track 2).
 *
 * Two exports for the Home page:
 *   - `fetchDashboardSummary` — calls the `get_seller_dashboard_summary`
 *     SECURITY DEFINER RPC. The RPC already filters by `auth.uid()`, so
 *     the `sellerId` argument is informational (used in the throw message
 *     when the RPC returns a zero-row result, which should never happen
 *     in practice since the calling page goes through `requirePro` first
 *     and `requirePro` resolves the same seller row).
 *   - `fetchRecentActivity` — composite query against `orders` and
 *     `messages` (plus a single `conversations` lookup to scope the
 *     message read). Both tables have RLS policies that allow the
 *     seller-side reads (see 20260510_orders.sql §orders select seller
 *     and 20260509_messaging.sql §messages select own + conversations
 *     select own).
 *
 * Why no RPC for the activity merge:
 *   The merge is small (two short-list queries + a JS merge-sort) and
 *   the underlying tables already have indexes that make each leg cheap:
 *     - orders_seller_idx (seller_id, created_at desc)        — 20260510
 *     - conversations_seller_idx (seller_user_id, last_message_at desc)
 *                                                              — 20260509
 *     - messages_conversation_idx (conversation_id, created_at) — 20260509
 *   A dedicated RPC would add a migration round-trip without saving
 *   meaningful round-trip latency against the existing RLS-allowed reads.
 *
 * Why hand-rolled row types (vs generated `Database` types):
 *   `web/src/types/supabase.ts` is not committed yet. Same posture as
 *   `web/src/components/dashboard/SubscriptionSummaryCard.tsx` — define
 *   the subset shape the dashboard needs locally, swap to generated
 *   types when the file lands.
 */

// -----------------------------------------------------------------------------
// Public types — consumed by Server Components in the dashboard tree.
// -----------------------------------------------------------------------------

/**
 * Shape of one row returned by `get_seller_dashboard_summary`. The RPC
 * always returns exactly one row (CTE composition fans out a single
 * record), so this is the entire fetcher payload.
 *
 * Numeric fields (revenue / rating) come back as JS `number` because
 * Supabase JS deserializes `numeric` columns through `parseFloat` for
 * values that fit in Number range. `orders.amount` is `numeric(10,2)`
 * which fits comfortably, so per-currency sums never exceed Number's
 * safe integer range.
 */
export type DashboardSummary = {
  total_listings: number;
  active_listings: number;
  total_paid_sales_count: number;
  gross_revenue_all_time: number;
  gross_revenue_30d: number;
  gross_revenue_7d: number;
  followers_count: number;
  rating: number;
  total_views_30d: number;
};

/**
 * One row of the products list (Track 3). Mirrors the RETURN TABLE of
 * `get_seller_products_with_stats()` from 20260810. The RPC is the only
 * read path for this surface — it joins product_views and orders on the
 * SECURITY DEFINER side, so the JS client gets aggregates without needing
 * direct access to the RLS-protected `product_views` table.
 *
 * Title is the localized jsonb (`{ fr: string, en: string }`); the list
 * UI picks the locale at render time.
 */
export type SellerProductStatsRow = {
  product_id: string;
  title: { fr?: string; en?: string } | null;
  thumbnail_url: string | null;
  price: number;
  currency: string;
  purchase_mode: 'buy_now' | 'contact_only';
  featured_until: string | null;
  created_at: string;
  views_7d: number;
  paid_sales_count: number;
  gross_revenue: number;
};

/**
 * Full product row for the editor (Track 3). Pulled directly from
 * `public.products` so every editable column is in scope. RLS on the
 * cookie-authed client scopes the read to the caller's own rows; the
 * `seller_id` equality below is defense-in-depth.
 */
export type SellerProductFullRow = {
  id: string;
  seller_id: string;
  title: { fr?: string; en?: string } | null;
  description: { fr?: string; en?: string } | null;
  price: number;
  currency: string;
  purchase_mode: 'buy_now' | 'contact_only';
  media_type: string;
  media_url: string;
  thumbnail_url: string | null;
  stock_available: boolean;
  stock_label: { fr?: string; en?: string } | null;
  shipping_free: boolean;
  shipping_label: { fr?: string; en?: string } | null;
  pickup_available: boolean;
  location: string | null;
  dimensions: string | null;
  featured_until: string | null;
  created_at: string;
};

/**
 * Tagged-union event for the recent-activity feed. The page Server
 * Component renders one row per event. New event kinds (e.g.,
 * 'follow_received', 'product_liked') would extend this union.
 */
export type ActivityEvent =
  | {
      kind: 'order_paid';
      id: string;
      productId: string;
      amount: number;
      currency: string;
      at: string;
      buyerName: string | null;
    }
  | {
      kind: 'message_received';
      id: string;
      conversationId: string;
      preview: string;
      at: string;
    };

// -----------------------------------------------------------------------------
// Internal row types — kept inside this module; not exported.
// -----------------------------------------------------------------------------

type OrderRow = {
  id: string;
  product_id: string;
  amount: number;
  currency: string;
  created_at: string;
  buyer_name: string | null;
};

type ConversationIdRow = {
  id: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  body: string;
  created_at: string;
};

// -----------------------------------------------------------------------------
// Fetchers
// -----------------------------------------------------------------------------

/**
 * Fetch the one-row dashboard summary via the SECURITY DEFINER RPC.
 *
 * Bails with a thrown error on RPC failure (PostgREST surfaces RAISE
 * EXCEPTION 'unauthenticated' / 'no_seller' as `error.message`). The
 * page-level `requirePro` gate makes those branches unreachable in
 * practice, but the throw is appropriate — Server Components surface
 * thrown errors through the nearest error boundary.
 *
 * `sellerId` is unused at the SQL layer (the RPC filters by auth.uid())
 * but accepted in the signature to (a) document the scoping intent at
 * the call site and (b) allow a future implementation to fall back to
 * a direct query if the RPC is ever rotated out.
 */
export async function fetchDashboardSummary(
  supabase: SupabaseClient,
  sellerId: string,
): Promise<DashboardSummary> {
  const { data, error } = await supabase.rpc('get_seller_dashboard_summary');
  if (error) {
    throw new Error(
      `fetchDashboardSummary failed (seller ${sellerId}): ${error.message}`,
    );
  }

  // RPC returns `setof record` — Supabase JS hands it back as an array
  // even though the function always emits exactly one row.
  const rows = (data ?? []) as DashboardSummary[];
  const row = rows[0];
  if (!row) {
    throw new Error(
      `fetchDashboardSummary returned no rows (seller ${sellerId})`,
    );
  }

  // Defensive number-coercion. Supabase JS deserializes `numeric` as
  // string in some configurations (notably when the column doesn't have
  // a typmod the driver recognizes); the RPC's `::numeric` casts can
  // surface this. Coerce once at the boundary so the rest of the
  // dashboard treats every metric as a plain JS number.
  return {
    total_listings:         Number(row.total_listings),
    active_listings:        Number(row.active_listings),
    total_paid_sales_count: Number(row.total_paid_sales_count),
    gross_revenue_all_time: Number(row.gross_revenue_all_time),
    gross_revenue_30d:      Number(row.gross_revenue_30d),
    gross_revenue_7d:       Number(row.gross_revenue_7d),
    followers_count:        Number(row.followers_count),
    rating:                 Number(row.rating),
    total_views_30d:        Number(row.total_views_30d),
  };
}

/**
 * Fetch the most-recent activity for the dashboard's activity feed.
 *
 * Two short list-reads + a JS merge-sort, capped at `limit`. The
 * messages query reads via `conversation_id IN (...)` rather than a
 * SQL JOIN because we don't need any conversation row fields in the
 * payload — just message rows that belong to one of the seller's
 * conversations.
 *
 * sender_id filter: we exclude messages sent BY the seller (where
 * sender_id = the caller's auth.users.id) so the feed surfaces only
 * inbound messages — outbound replies don't count as "activity to
 * notice". The RLS policy on `messages` already restricts the SELECT
 * to messages the caller is a participant in, so this filter is
 * a content filter (not a security filter).
 */
export async function fetchRecentActivity(
  supabase: SupabaseClient,
  sellerId: string,
  limit = 10,
): Promise<ActivityEvent[]> {
  // 1. Resolve the caller's auth.users.id. We need it to (a) filter out
  //    the seller's own outbound messages from the activity feed and
  //    (b) scope the conversations lookup (conversations.seller_user_id
  //    is an auth.users FK — see 20260509_messaging.sql).
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error(
      `fetchRecentActivity could not resolve caller: ${userError?.message ?? 'no user'}`,
    );
  }

  // 2. Two RLS-allowed reads in parallel: paid orders for this seller,
  //    and the ids of every conversation the seller participates in
  //    (the latter scopes the messages-IN query below).
  const [ordersResult, conversationsResult] = await Promise.all([
    supabase
      .from('orders')
      .select('id, product_id, amount, currency, created_at, buyer_name')
      .eq('seller_id', sellerId)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('conversations')
      .select('id')
      .eq('seller_user_id', user.id),
  ]);

  if (ordersResult.error) {
    throw new Error(
      `fetchRecentActivity orders read failed: ${ordersResult.error.message}`,
    );
  }
  if (conversationsResult.error) {
    throw new Error(
      `fetchRecentActivity conversations read failed: ${conversationsResult.error.message}`,
    );
  }

  const orderRows = (ordersResult.data ?? []) as OrderRow[];
  const conversationIds = ((conversationsResult.data ?? []) as ConversationIdRow[])
    .map((c) => c.id);

  // 3. Messages — only if the seller has any conversation at all. An
  //    empty `in()` clause returns zero rows, which is the correct
  //    behavior, but the empty-list branch saves the round trip.
  let messageRows: MessageRow[] = [];
  if (conversationIds.length > 0) {
    const messagesResult = await supabase
      .from('messages')
      .select('id, conversation_id, body, created_at')
      .in('conversation_id', conversationIds)
      .neq('sender_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (messagesResult.error) {
      throw new Error(
        `fetchRecentActivity messages read failed: ${messagesResult.error.message}`,
      );
    }
    messageRows = (messagesResult.data ?? []) as MessageRow[];
  }

  // 4. Merge + sort by created_at DESC + slice to limit.
  const events: ActivityEvent[] = [
    ...orderRows.map<ActivityEvent>((o) => ({
      kind: 'order_paid',
      id: o.id,
      productId: o.product_id,
      amount: Number(o.amount),
      currency: o.currency,
      at: o.created_at,
      buyerName: o.buyer_name,
    })),
    ...messageRows.map<ActivityEvent>((m) => ({
      kind: 'message_received',
      id: m.id,
      conversationId: m.conversation_id,
      // Mirror the conversations.last_message_preview convention (80-char
      // truncation, no ellipsis — the column on conversations does the
      // same and downstream UI handles the display ellipsis via CSS).
      preview: m.body.length > 80 ? m.body.slice(0, 80) : m.body,
      at: m.created_at,
    })),
  ];

  events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return events.slice(0, limit);
}

/**
 * Fetch every product owned by the caller, each row carrying server-side
 * view + sales aggregates from `get_seller_products_with_stats`. The RPC
 * is SECURITY DEFINER and resolves the seller from `auth.uid()`, so no
 * sellerId argument is needed — the cookie-authed client identifies the
 * caller and the RPC scopes the result set.
 *
 * Returns an empty array for sellers with no listings (the RPC emits zero
 * rows, not NULL). Throws on RPC failure so the Server Component's error
 * boundary handles surfacing the error.
 *
 * Numeric coercion mirrors `fetchDashboardSummary`: `numeric` columns
 * occasionally arrive as strings depending on the driver path, so we
 * Number() at the boundary instead of pushing the conversion into every
 * caller.
 */
export async function fetchProductsWithStats(
  supabase: SupabaseClient,
): Promise<SellerProductStatsRow[]> {
  const { data, error } = await supabase.rpc(
    'get_seller_products_with_stats',
  );
  if (error) {
    throw new Error(
      `fetchProductsWithStats failed: ${error.message}`,
    );
  }
  const rows = (data ?? []) as SellerProductStatsRow[];
  return rows.map((row) => ({
    product_id: row.product_id,
    title: row.title,
    thumbnail_url: row.thumbnail_url,
    price: Number(row.price),
    currency: row.currency,
    purchase_mode: row.purchase_mode,
    featured_until: row.featured_until,
    created_at: row.created_at,
    views_7d: Number(row.views_7d),
    paid_sales_count: Number(row.paid_sales_count),
    gross_revenue: Number(row.gross_revenue),
  }));
}

/**
 * Server-derived state for the post-IAP onboarding checklist surfaced
 * on the Pro home (Track 7, retrofitted in F.C.4). Mirrors mobile's
 * `useProOnboardingState` predicates for the legacy steps and adds a
 * Connect step gating Buy Now on Stripe charge capability.
 *
 * Predicate sources:
 *   - Step 2 (profile completion) — `bio` AND `location_text` both
 *     trim-non-empty on the seller row.
 *   - Step 3 (Connect Stripe) — `stripe_charges_enabled = true` on
 *     the seller row. NOT skippable — Connect is required for Buy Now
 *     to work end-to-end (destination charges land on the connected
 *     account, see F.C.1).
 *   - Step 4 (enable buy-now on a listing) — at least one product
 *     row owned by the seller has `purchase_mode = 'buy_now'`.
 *   - Step 5 (boost a listing) — `last_boost_at IS NOT NULL` on the
 *     seller row.
 *
 * Skip state lives in the BROWSER (localStorage flags
 * `mony.pro.step3Skipped` / `mony.pro.step4Skipped` — note these keys
 * were named before the renumber and now correspond to Step 4 / Step 5
 * client-side, see ProOnboardingChecklist.tsx) so it cannot be
 * resolved server-side. The Client Component merges these flags with
 * the server result before deciding which rows to render as done.
 *
 * `allServerDone` is convenience for the rare case where every
 * predicate is satisfied without any skip flag — the page can short-
 * circuit and skip mounting the checklist Client Component at all.
 * When false (the common case), the Client Component is still
 * needed to consult localStorage.
 *
 * Two cheap reads, both RLS-allowed against the cookie-authed client:
 *   1. SELECT bio, location_text, last_boost_at, stripe_charges_enabled
 *      FROM sellers WHERE id = sellerId
 *   2. SELECT id FROM products WHERE seller_id = sellerId AND
 *      purchase_mode = 'buy_now' LIMIT 1   (existence check only)
 */
export type ProOnboardingServerState = {
  step2Done: boolean;
  step3Done: boolean;
  step4Done: boolean;
  step5Done: boolean;
  allServerDone: boolean;
};

type SellerOnboardingRow = {
  bio: string | null;
  location_text: string | null;
  last_boost_at: string | null;
  stripe_charges_enabled: boolean | null;
};

export async function fetchOnboardingState(
  supabase: SupabaseClient,
  sellerId: string,
): Promise<ProOnboardingServerState> {
  const [sellerResult, buyNowResult] = await Promise.all([
    supabase
      .from('sellers')
      .select('bio, location_text, last_boost_at, stripe_charges_enabled')
      .eq('id', sellerId)
      .maybeSingle(),
    supabase
      .from('products')
      .select('id')
      .eq('seller_id', sellerId)
      .eq('purchase_mode', 'buy_now')
      .limit(1),
  ]);

  if (sellerResult.error) {
    throw new Error(
      `fetchOnboardingState seller read failed (seller ${sellerId}): ${sellerResult.error.message}`,
    );
  }
  if (buyNowResult.error) {
    throw new Error(
      `fetchOnboardingState products read failed (seller ${sellerId}): ${buyNowResult.error.message}`,
    );
  }

  const seller = (sellerResult.data ?? null) as SellerOnboardingRow | null;
  const bio = seller?.bio ?? '';
  const locationText = seller?.location_text ?? '';
  const step2Done = bio.trim().length > 0 && locationText.trim().length > 0;
  const step3Done = seller?.stripe_charges_enabled === true;
  const step4Done = (buyNowResult.data?.length ?? 0) > 0;
  const step5Done = seller?.last_boost_at != null;
  const allServerDone = step2Done && step3Done && step4Done && step5Done;

  return { step2Done, step3Done, step4Done, step5Done, allServerDone };
}

/**
 * Fetch a single product row scoped to the calling seller. The query
 * narrows by both `id` and `seller_id` so a forged `productId` belonging
 * to another seller resolves to NULL — RLS would also block it, but the
 * explicit seller filter keeps the failure mode crisp ("not found"
 * instead of "RLS denied").
 *
 * Returns `null` when no matching row exists; the caller (Server
 * Component) is responsible for `notFound()` on null. Throws on database
 * error so it bubbles to the nearest error boundary.
 */
export async function fetchProductForEdit(
  supabase: SupabaseClient,
  productId: string,
  sellerId: string,
): Promise<SellerProductFullRow | null> {
  const { data, error } = await supabase
    .from('products')
    .select(
      'id, seller_id, title, description, price, currency, purchase_mode, media_type, media_url, thumbnail_url, stock_available, stock_label, shipping_free, shipping_label, pickup_available, location, dimensions, featured_until, created_at',
    )
    .eq('id', productId)
    .eq('seller_id', sellerId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `fetchProductForEdit failed (product ${productId}): ${error.message}`,
    );
  }
  if (!data) return null;
  const row = data as unknown as SellerProductFullRow;
  return { ...row, price: Number(row.price) };
}

// -----------------------------------------------------------------------------
// Seller orders (Track 4) — reads for /pro/orders and /pro/orders/[id].
// -----------------------------------------------------------------------------

/**
 * Stripe Checkout shipping projection persisted on `orders.shipping_address`
 * by the stripe-webhook handler (see 20260713_order_shipping.sql). All fields
 * are nullable — Stripe may omit any individual line. Pre-Phase-8 orders rows
 * carry NULL for the whole jsonb.
 */
export type ShippingAddress = {
  name: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  postal_code: string | null;
  state: string | null;
  country: string | null;
};

/**
 * The five values of the `orders.status` CHECK constraint (20260510).
 * Adding a new status to the CHECK requires adding it here AND to the
 * `pro.orders.filter.*` locale catalog used by the filter pills.
 */
export type SellerOrderStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refunded';

/**
 * One row of the Pro orders list. Camel-case at the data-layer boundary so
 * Server Components don't carry the DB's snake_case all the way into JSX.
 * Title is the localized jsonb pulled through the `products` to-one join —
 * each consumer picks the locale at render time.
 */
export type SellerOrderRow = {
  id: string;
  productId: string;
  productTitle: { fr?: string; en?: string } | null;
  productThumbnail: string | null;
  amount: number;
  currency: string;
  status: SellerOrderStatus;
  createdAt: string;
  buyerName: string | null;
  buyerPhone: string | null;
  shippingAddress: ShippingAddress | null;
  // Mony's marketplace fee captured at checkout-session creation
  // (F.C.1). Stored as `numeric(10,2)` in currency units — same scale as
  // `amount`. NULL for legacy orders created before F.C.1 deployed, in
  // which case the detail page hides the commission/net section.
  applicationFeeAmount: number | null;
};

export type SellerOrderFilters = {
  status?: SellerOrderStatus;
  from?: string;
  to?: string;
};

type SellerOrderJoinedRow = {
  id: string;
  product_id: string;
  amount: number;
  currency: string;
  status: SellerOrderStatus;
  created_at: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  shipping_address: ShippingAddress | null;
  application_fee_amount: number | string | null;
  products:
    | { title: { fr?: string; en?: string } | null; thumbnail_url: string | null }
    | { title: { fr?: string; en?: string } | null; thumbnail_url: string | null }[]
    | null;
};

function pickJoinedProduct(
  joined: SellerOrderJoinedRow['products'],
): { title: { fr?: string; en?: string } | null; thumbnail_url: string | null } | null {
  if (joined == null) return null;
  if (Array.isArray(joined)) return joined[0] ?? null;
  return joined;
}

function mapJoinedOrderRow(row: SellerOrderJoinedRow): SellerOrderRow {
  const product = pickJoinedProduct(row.products);
  // application_fee_amount is `numeric(10,2)` — the same boundary
  // Number()-coercion the other numeric columns use. NULL stays NULL so
  // pre-F.C.1 orders render without the commission/net section.
  const fee = row.application_fee_amount;
  return {
    id: row.id,
    productId: row.product_id,
    productTitle: product?.title ?? null,
    productThumbnail: product?.thumbnail_url ?? null,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
    buyerName: row.buyer_name,
    buyerPhone: row.buyer_phone,
    shippingAddress: row.shipping_address,
    applicationFeeAmount: fee == null ? null : Number(fee),
  };
}

/**
 * Fetch every order belonging to the caller's seller row, ordered newest
 * first. Optional filters narrow at the DB layer:
 *   - status: exact match against the CHECK enum.
 *   - from:   `created_at >= from` (YYYY-MM-DD interpreted as 00:00:00 UTC).
 *   - to:     `created_at <= to + end-of-day` so a `to=2026-05-15` filter
 *             includes every order created on the 15th in UTC.
 *
 * The list-page text search (buyer name / product title) is NOT applied
 * here — it's an in-memory pass on the returned page so the same fetcher
 * also feeds the CSV export route. RLS "orders select seller" (20260510)
 * keeps the read scoped to the caller; the explicit `seller_id` eq is
 * defense-in-depth, matching the convention used elsewhere in this module.
 */
export async function fetchSellerOrders(
  supabase: SupabaseClient,
  sellerId: string,
  filters: SellerOrderFilters,
): Promise<SellerOrderRow[]> {
  let query = supabase
    .from('orders')
    .select(
      'id, product_id, amount, currency, status, created_at, buyer_name, buyer_phone, shipping_address, application_fee_amount, products(title, thumbnail_url)',
    )
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });

  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.from) {
    query = query.gte('created_at', filters.from);
  }
  if (filters.to) {
    query = query.lte('created_at', `${filters.to}T23:59:59.999Z`);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(
      `fetchSellerOrders failed (seller ${sellerId}): ${error.message}`,
    );
  }

  const rows = (data ?? []) as SellerOrderJoinedRow[];
  return rows.map(mapJoinedOrderRow);
}

/**
 * Fetch a single order scoped to the calling seller. Narrows by both `id`
 * and `seller_id` so a forged id belonging to another seller resolves to
 * NULL instead of a generic RLS-denied error. Returns `null` when no
 * matching row exists; the caller (Server Component) is responsible for
 * `notFound()` on null.
 */
export async function fetchSellerOrderById(
  supabase: SupabaseClient,
  sellerId: string,
  orderId: string,
): Promise<SellerOrderRow | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, product_id, amount, currency, status, created_at, buyer_name, buyer_phone, shipping_address, application_fee_amount, products(title, thumbnail_url)',
    )
    .eq('id', orderId)
    .eq('seller_id', sellerId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `fetchSellerOrderById failed (order ${orderId}): ${error.message}`,
    );
  }
  if (!data) return null;
  return mapJoinedOrderRow(data as SellerOrderJoinedRow);
}

/**
 * In-memory text filter for the orders list. The list page and the CSV
 * export both pass the same `q` searchParam through here so the visible
 * results and the exported file stay in sync. Matches against buyer name
 * and product title (both locales) — case-insensitive substring.
 */
export function filterOrdersByQuery(
  rows: SellerOrderRow[],
  query: string,
): SellerOrderRow[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return rows;
  return rows.filter((row) => {
    const buyer = (row.buyerName ?? '').toLowerCase();
    if (buyer.includes(q)) return true;
    const titleFr = (row.productTitle?.fr ?? '').toLowerCase();
    if (titleFr.includes(q)) return true;
    const titleEn = (row.productTitle?.en ?? '').toLowerCase();
    if (titleEn.includes(q)) return true;
    return false;
  });
}

// -----------------------------------------------------------------------------
// Seller customers (Track 5) — reads for /pro/customers and the per-buyer
// detail page.
// -----------------------------------------------------------------------------

/**
 * One row of the Pro customers list. Mirrors the RETURN TABLE of
 * `get_seller_customers()` from 20260810, camel-cased at the data-layer
 * boundary. `conversationId` is NULL when the buyer has never messaged
 * this seller (e.g., an instant-checkout flow without a prior thread).
 *
 * `buyerName` is the snapshot persisted on `orders.buyer_name` at the time
 * of the most recent order (the RPC uses `max(buyer_name)` to pick a
 * single deterministic value from the buyer's history). Pre-Phase-8
 * orders rows carry NULL there; the JS surface renders NULL as '—'.
 *
 * `totalSpend` ignores the per-order currency dimension — same posture as
 * the revenue timeseries RPC. The list view formats it against the
 * visitor's display-currency cookie without FX conversion.
 */
export type SellerCustomerRow = {
  buyerUserId: string;
  buyerName: string | null;
  totalSpend: number;
  orderCount: number;
  lastOrderAt: string;
  conversationId: string | null;
};

type SellerCustomerRpcRow = {
  buyer_user_id: string;
  buyer_name: string | null;
  total_spend: number | string;
  order_count: number | string;
  last_order_at: string;
  conversation_id: string | null;
};

function mapCustomerRpcRow(row: SellerCustomerRpcRow): SellerCustomerRow {
  return {
    buyerUserId: row.buyer_user_id,
    buyerName: row.buyer_name,
    totalSpend: Number(row.total_spend),
    orderCount: Number(row.order_count),
    lastOrderAt: row.last_order_at,
    conversationId: row.conversation_id,
  };
}

/**
 * Fetch every distinct buyer who has placed a paid order with the calling
 * seller, sorted by last-order-at descending (the RPC orders the result
 * set; we preserve it). Throws on RPC failure so the Server Component's
 * error boundary handles surfacing the error.
 *
 * In-memory text search is applied by the page layer via
 * `filterCustomersByQuery` — same posture as the orders list, which keeps
 * server filters (status / date) at the SQL layer and the free-text pass
 * client-side so a future CSV export can re-use the same fetch.
 */
export async function fetchSellerCustomers(
  supabase: SupabaseClient,
): Promise<SellerCustomerRow[]> {
  const { data, error } = await supabase.rpc('get_seller_customers');
  if (error) {
    throw new Error(`fetchSellerCustomers failed: ${error.message}`);
  }
  const rows = (data ?? []) as SellerCustomerRpcRow[];
  return rows.map(mapCustomerRpcRow);
}

/**
 * Fetch the customer-detail header for a single buyer — the same
 * aggregate row that `fetchSellerCustomers` returns, narrowed to one
 * buyer. Returns `null` when no matching row exists (the buyer has no
 * paid orders with this seller, or the buyerId is forged); the calling
 * page is responsible for `notFound()` on null.
 *
 * Implementation note: re-filters the full customers RPC result in-memory
 * instead of issuing a targeted SQL query. The RPC is already
 * RLS-equivalent (SECURITY DEFINER + auth.uid() scoping) and the row
 * count is bounded by the seller's distinct-buyer set — typically dozens,
 * not thousands. A dedicated single-row RPC would add a migration
 * round-trip without measurable latency savings; if the customer-detail
 * page ever ends up on a hot path independent of the list, that's the
 * trigger to extract a `get_seller_customer(uuid)` variant.
 */
export async function fetchCustomerSummary(
  supabase: SupabaseClient,
  sellerId: string,
  buyerUserId: string,
): Promise<SellerCustomerRow | null> {
  // sellerId is unused at the SQL layer (the RPC scopes by auth.uid())
  // but accepted for symmetry with the other Pro fetchers and so the
  // call site documents the scoping intent.
  void sellerId;
  const rows = await fetchSellerCustomers(supabase);
  return rows.find((row) => row.buyerUserId === buyerUserId) ?? null;
}

/**
 * Fetch every order this buyer has placed with the calling seller,
 * newest first. Returns the same `SellerOrderRow` shape as
 * `fetchSellerOrders` so the customer-detail page can render the
 * familiar order list affordances (thumbnail, title, amount, status)
 * without a divergent component.
 *
 * No status filter — the detail view shows the complete history
 * (pending, paid, refunded, …). The buyer ended up on the customers
 * list because at least one of their orders is paid; the detail page
 * is where the seller goes to inspect everything that buyer has done.
 *
 * RLS "orders select seller" (20260510) keeps the read scoped to the
 * caller; the explicit `seller_id` + `buyer_id` eq filters are
 * defense-in-depth + crisp "not found" semantics for forged ids.
 */
export async function fetchCustomerOrders(
  supabase: SupabaseClient,
  sellerId: string,
  buyerUserId: string,
): Promise<SellerOrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, product_id, amount, currency, status, created_at, buyer_name, buyer_phone, shipping_address, application_fee_amount, products(title, thumbnail_url)',
    )
    .eq('seller_id', sellerId)
    .eq('buyer_id', buyerUserId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(
      `fetchCustomerOrders failed (seller ${sellerId}, buyer ${buyerUserId}): ${error.message}`,
    );
  }

  const rows = (data ?? []) as SellerOrderJoinedRow[];
  return rows.map(mapJoinedOrderRow);
}

/**
 * In-memory text filter for the customers list. Matches against the
 * buyer name (case-insensitive substring). The buyer's user-id isn't
 * included in the match space — sellers don't think about buyers by
 * UUID, and matching against id would surface unintuitive hits.
 */
export function filterCustomersByQuery(
  rows: SellerCustomerRow[],
  query: string,
): SellerCustomerRow[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return rows;
  return rows.filter((row) =>
    (row.buyerName ?? '').toLowerCase().includes(q),
  );
}

// -----------------------------------------------------------------------------
// Analytics (Track 8) — timeseries + top-listings for /pro/analytics.
// -----------------------------------------------------------------------------

/**
 * The three windows the analytics page exposes. Matches the
 * `get_seller_*_timeseries` RPC `p_days` validation (1..90); the UI
 * limits the user to these three preset values.
 */
export type AnalyticsRange = 7 | 30 | 90;

/**
 * One point of the views timeseries. `day` is an ISO-8601 date string
 * (`YYYY-MM-DD`) — the server returns Postgres `date` and PostgREST
 * serializes it as such. Keeping it as a string at the data-layer
 * boundary lets Server Components pass the array to a Client Component
 * chart without crossing a Date object across the RSC payload (which is
 * fine for Date in v13+ but cheaper to skip).
 */
export type ViewsTimeseriesPoint = {
  day: string;
  value: number;
};

/**
 * One point of the revenue timeseries. `value` is the day's
 * gross_revenue sum; `paidSalesCount` is the day's paid order count —
 * the latter is currently unused by the chart but kept on the payload
 * so future tooltip / secondary-axis work doesn't need a new fetch.
 */
export type RevenueTimeseriesPoint = {
  day: string;
  value: number;
  paidSalesCount: number;
};

/**
 * Top-listings row consumed by the analytics surface's leaderboard.
 * Field shape is intentionally narrow — only what the table renders —
 * so adding new analytics tables doesn't bloat this type.
 */
export type TopListingRow = {
  productId: string;
  title: { fr?: string; en?: string } | null;
  thumbnail_url: string | null;
  views_7d: number;
  gross_revenue: number;
};

type ViewsTimeseriesRpcRow = {
  day: string;
  views_count: number | string;
};

type RevenueTimeseriesRpcRow = {
  day: string;
  gross_revenue: number | string;
  paid_sales_count: number | string;
};

/**
 * Fetch the views timeseries for the calling seller across the trailing
 * `days`-day window. The RPC emits one row per day (zero-view days as
 * 0), so the array length equals `days` exactly — the chart renders a
 * continuous line without client-side gap fill.
 *
 * `views_count` is `int` in the RPC return signature but Supabase JS
 * occasionally surfaces integer types as strings depending on driver
 * path. Number-coerce at the boundary, same as elsewhere in this module.
 */
export async function fetchViewsTimeseries(
  supabase: SupabaseClient,
  days: AnalyticsRange,
): Promise<ViewsTimeseriesPoint[]> {
  const { data, error } = await supabase.rpc('get_seller_views_timeseries', {
    p_days: days,
  });
  if (error) {
    throw new Error(`fetchViewsTimeseries failed: ${error.message}`);
  }
  const rows = (data ?? []) as ViewsTimeseriesRpcRow[];
  return rows.map((row) => ({
    day: row.day,
    value: Number(row.views_count),
  }));
}

/**
 * Fetch the revenue timeseries for the calling seller across the
 * trailing `days`-day window. Same generate_series shape as the views
 * RPC, so the array length equals `days` exactly.
 *
 * The aggregate ignores the per-order currency dimension — see the
 * RPC's currency note (20260810 §5). The chart formats the result in
 * the visitor's display-currency cookie without FX conversion.
 */
export async function fetchRevenueTimeseries(
  supabase: SupabaseClient,
  days: AnalyticsRange,
): Promise<RevenueTimeseriesPoint[]> {
  const { data, error } = await supabase.rpc('get_seller_revenue_timeseries', {
    p_days: days,
  });
  if (error) {
    throw new Error(`fetchRevenueTimeseries failed: ${error.message}`);
  }
  const rows = (data ?? []) as RevenueTimeseriesRpcRow[];
  return rows.map((row) => ({
    day: row.day,
    value: Number(row.gross_revenue),
    paidSalesCount: Number(row.paid_sales_count),
  }));
}

/**
 * Fetch the top-N most-viewed listings (by `views_7d`) for the calling
 * seller. Re-uses `fetchProductsWithStats` rather than a dedicated RPC
 * because the products-with-stats fetch already runs once on the
 * Products tab and is cheap; a future surge in listings volume would
 * be the trigger to push the ordering + limit into a dedicated SQL
 * function. Stable sort: ties keep the RPC's original order (featured
 * first, then created_at DESC).
 */
export async function fetchTopListings(
  supabase: SupabaseClient,
  limit = 5,
): Promise<TopListingRow[]> {
  const rows = await fetchProductsWithStats(supabase);
  return [...rows]
    .sort((a, b) => b.views_7d - a.views_7d)
    .slice(0, limit)
    .map<TopListingRow>((row) => ({
      productId: row.product_id,
      title: row.title,
      thumbnail_url: row.thumbnail_url,
      views_7d: row.views_7d,
      gross_revenue: row.gross_revenue,
    }));
}

// -----------------------------------------------------------------------------
// Stripe Connect onboarding (Track F.C.2) — payouts dashboard read.
// -----------------------------------------------------------------------------

/**
 * The six Stripe Connect columns mirrored from the Express account onto
 * `public.sellers`. The first three landed in 20260511 (with `is_pro` and
 * the subscription columns); the latter three landed in 20260820 alongside
 * F.C.1 to back the destination-charge marketplace flow.
 *
 * `status` is derived from the raw flags so consumers branch on a single
 * tag instead of juggling three booleans:
 *   - `accountId === null` → `'not_started'` (never clicked Connect).
 *   - `accountId !== null && detailsSubmitted === false` → `'in_progress'`
 *     (started Stripe's onboarding form but didn't finish it).
 *   - `accountId !== null && chargesEnabled === true` → `'connected'`
 *     (Stripe greenlit charges; payouts may still be pending verification
 *     but the seller can transact).
 *   - `accountId !== null && detailsSubmitted === true && chargesEnabled
 *     === false` is ALSO `'in_progress'` — Stripe is reviewing KYC.
 *     The same "Resume" CTA + a verification-pending sub-copy applies;
 *     the page distinguishes it from the unfinished-form case via
 *     `detailsSubmitted` itself.
 */
export type SellerConnectState = {
  accountId: string | null;
  country: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  onboardedAt: string | null;
  status: 'not_started' | 'in_progress' | 'connected';
};

type SellerConnectRow = {
  stripe_account_id: string | null;
  stripe_country: string | null;
  stripe_charges_enabled: boolean | null;
  stripe_payouts_enabled: boolean | null;
  stripe_details_submitted: boolean | null;
  stripe_onboarded_at: string | null;
};

/**
 * Fetch the seller's Stripe Connect state.
 *
 * One cookie-authed read against the seller's own row — RLS allows it via
 * the existing "sellers user read own" policy (the Connect columns are
 * authenticated-only per 20260622 and 20260820). Returns a normalized
 * shape; the `'connected'` derivation lives here so the page Server
 * Component branches on a single tag instead of repeating the logic
 * across the three render paths and the polling endpoint.
 *
 * Throws on read error so the Server Component surfaces it through the
 * nearest error boundary — same posture as the other fetchers in this
 * module.
 */
export async function fetchSellerConnectState(
  supabase: SupabaseClient,
  sellerId: string,
): Promise<SellerConnectState> {
  const { data, error } = await supabase
    .from('sellers')
    .select(
      'stripe_account_id, stripe_country, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted, stripe_onboarded_at',
    )
    .eq('id', sellerId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `fetchSellerConnectState failed (seller ${sellerId}): ${error.message}`,
    );
  }

  const row = (data ?? null) as SellerConnectRow | null;
  const accountId = row?.stripe_account_id ?? null;
  const chargesEnabled = row?.stripe_charges_enabled === true;
  const payoutsEnabled = row?.stripe_payouts_enabled === true;
  const detailsSubmitted = row?.stripe_details_submitted === true;

  let status: SellerConnectState['status'];
  if (accountId === null) {
    status = 'not_started';
  } else if (chargesEnabled) {
    status = 'connected';
  } else {
    // Two flavors of in_progress collapse here:
    //   - detailsSubmitted=false → seller bailed mid-form, "Resume" CTA.
    //   - detailsSubmitted=true  → KYC pending at Stripe, same CTA but
    //     surfaced sub-copy can flag the verification-pending sub-state.
    status = 'in_progress';
  }

  return {
    accountId,
    country: row?.stripe_country ?? null,
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted,
    onboardedAt: row?.stripe_onboarded_at ?? null,
    status,
  };
}
