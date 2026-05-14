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
