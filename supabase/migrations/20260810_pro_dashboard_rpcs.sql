-- =============================================================================
-- Migration: 20260810_pro_dashboard_rpcs
-- Purpose:   Pro Dashboard data layer (Phase Pro / Tracks 2, 3, 5, 8).
--            Ships FIVE seller-scoped read RPCs in a single migration so the
--            downstream UI tracks (Home / Products / Customers / Analytics)
--            can land independently against a stable contract:
--
--              1. get_seller_dashboard_summary()
--                 — Track 2 (this commit's Home page). One-row aggregate of
--                   listings count, paid-sales count, revenue (all-time / 30d
--                   / 7d), followers, rating, and 30-day product views.
--              2. get_seller_products_with_stats()
--                 — Track 3 (Products tab). Per-product view + sales rollups
--                   joined to the products row, sorted with featured first
--                   then newest. LEFT JOINs so zero-view / zero-order
--                   products still surface with 0 stats.
--              3. get_seller_customers()
--                 — Track 5 (Customers tab). One row per distinct buyer that
--                   has placed a paid order with the caller, with total
--                   spend / order count / last-order timestamp and an
--                   optional conversation_id back-link.
--              4. get_seller_views_timeseries(p_days int)
--                 — Track 8 (Analytics). One row per day in a trailing
--                   p_days window (1..90) with the views count for that
--                   day, generated via generate_series so zero-view days
--                   appear with views_count = 0 (no client-side gap fill).
--              5. get_seller_revenue_timeseries(p_days int)
--                 — Track 8 (Analytics). Same generate_series shape, but
--                   over paid orders: per-day gross_revenue + paid_sales_count.
--
-- One migration, one rollback block:
--   All five functions ship together because they share the same security
--   profile (SECURITY DEFINER, search_path-hardened, EXECUTE granted to
--   `authenticated` only) and the same authorization spine (resolve the
--   caller's seller_id via `sellers.user_id = auth.uid()`, bail with the
--   conventional 'unauthenticated' / 'no_seller' exceptions). Tracks 3 / 5
--   / 8 can ship UI without a separate migration round-trip.
--
-- SECURITY DEFINER rationale:
--   Two of these RPCs (a, b, d) read from `public.product_views`, which
--   has RLS enabled with NO policies and all table grants revoked from
--   `anon` / `authenticated` (see 20260605_product_views.sql §3). The
--   only legal read path is a SECURITY DEFINER function that gates by
--   ownership before returning aggregates — exactly the model
--   `get_product_analytics` uses for the per-listing analytics card.
--
--   The other two (c, e) read from RLS-protected tables (orders,
--   conversations) where the caller's own rows ARE visible through the
--   table-level RLS policies. We still use SECURITY DEFINER for them
--   for two reasons: (1) symmetry across the five Pro Dashboard RPCs,
--   (2) generate_series + LEFT JOIN aggregates are easier to reason about
--   without RLS rewrites in the planner, especially for the
--   customers / revenue grouping shapes.
--
--   `set search_path = public, pg_catalog` on every function defeats the
--   classic SECURITY DEFINER hijack vector (a malicious user creating a
--   shadow `public.products` or `public.orders` in their own schema and
--   tricking the function into resolving it). Same shape as C.2's
--   `handle_follow_change`, D.2's `handle_comment_change`, E.2's
--   `increment_share_count`, H.12's `feature_product`, and H.13's
--   `get_product_analytics`.
--
-- Authorization spine — every RPC:
--   1. `if auth.uid() is null then raise exception 'unauthenticated';`
--      blocks anonymous callers. PostgREST exposes RAISE EXCEPTION as a
--      400 / 401, the JS layer renders the appropriate UX.
--   2. Resolve `v_seller_id` via
--        select id from public.sellers where user_id = auth.uid()
--      and `raise exception 'no_seller'` if missing. We do NOT additionally
--      re-check `is_pro` here — the page-level `requirePro()` Server
--      Component gate (web/src/lib/pro/auth.ts) is the canonical Pro check.
--      Pro status can also be inspected by clients via the existing
--      `sellers.is_pro` column read (RLS-allowed). Re-checking inside every
--      RPC would duplicate that gate and create a per-call source-of-truth
--      seam if Pro semantics ever evolve (e.g., grace period for lapsed
--      subs).
--   3. EVERY row this function returns is filtered by
--      `seller_id = v_seller_id`. The caller can ONLY see their own data.
--
-- Grants:
--   - revoke all from public  -- defeats the implicit "anyone can execute"
--     grant PostgREST otherwise applies.
--   - grant execute to authenticated  -- the auth.uid() guard above is
--     the second line of defense.
--
-- Idempotent:    CREATE OR REPLACE FUNCTION + GRANT EXECUTE — re-running
--                this migration against an applied database is a no-op.
-- Transactional: wrapped in BEGIN / COMMIT.
-- Reversibility: see ROLLBACK SQL block immediately below.
-- Type regen:    REQUIRED. Five new Functions land in the generated
--                Database['public']['Functions'] map. Run `npm run gen:types`
--                from repo root (mobile types — committed) AND from `web/`
--                (web types — currently uncommitted; the dashboard reads
--                via hand-rolled row types until the web file lands, same
--                pattern as web/src/components/dashboard/SubscriptionSummaryCard.tsx).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert this migration)
-- -----------------------------------------------------------------------------
-- begin;
--   revoke execute on function public.get_seller_revenue_timeseries(int)  from authenticated;
--   drop function    if exists public.get_seller_revenue_timeseries(int);
--   revoke execute on function public.get_seller_views_timeseries(int)    from authenticated;
--   drop function    if exists public.get_seller_views_timeseries(int);
--   revoke execute on function public.get_seller_customers()              from authenticated;
--   drop function    if exists public.get_seller_customers();
--   revoke execute on function public.get_seller_products_with_stats()    from authenticated;
--   drop function    if exists public.get_seller_products_with_stats();
--   revoke execute on function public.get_seller_dashboard_summary()      from authenticated;
--   drop function    if exists public.get_seller_dashboard_summary();
-- commit;
-- -----------------------------------------------------------------------------

begin;

-- =============================================================================
-- 1. get_seller_dashboard_summary
--    One-row aggregate consumed by the /pro home page (Track 2).
--
--    `active_listings` is aliased to `total_listings` in v1 — there is no
--    soft-delete column on products yet (deletion cascades via ON DELETE
--    CASCADE from sellers / auth.users). When a future track introduces
--    an explicit `products.is_archived` or `products.deleted_at`, this is
--    the function to amend so the dashboard surface can distinguish
--    active from total listings without an additional client-side fetch.
--
--    `total_views_30d` joins `product_views` to `products` on
--    `product_views.product_id = products.id` and filters by
--    `products.seller_id = v_seller_id`. Going through products is
--    necessary because `product_views.viewer_seller_id` is the VIEWER
--    (NULL for anon, the viewer's seller row otherwise), NOT the
--    product's seller. The product_views (product_id, viewed_at desc)
--    composite index from 20260605 covers the join + time filter.
--
--    Revenue sums coalesce to 0::numeric so the row is never NULL even
--    when the seller has no paid orders. The client-side currency
--    formatting renders 0 as the locale-appropriate zero
--    (e.g., "€0.00") without any extra null guards.
-- =============================================================================
create or replace function public.get_seller_dashboard_summary()
returns table (
  total_listings          int,
  active_listings         int,
  total_paid_sales_count  int,
  gross_revenue_all_time  numeric,
  gross_revenue_30d       numeric,
  gross_revenue_7d        numeric,
  followers_count         int,
  rating                  numeric,
  total_views_30d         int
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id   uuid;
  v_seller_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  select id
    into v_seller_id
  from public.sellers
  where user_id = v_user_id;

  if v_seller_id is null then
    raise exception 'no_seller';
  end if;

  return query
  with
    listings as (
      select count(*)::int as total_listings
      from public.products
      where seller_id = v_seller_id
    ),
    sales as (
      select
        count(*)::int                                       as total_paid_sales_count,
        coalesce(sum(amount), 0)::numeric                   as gross_revenue_all_time,
        coalesce(sum(amount) filter (
          where created_at >= now() - interval '30 days'
        ), 0)::numeric                                      as gross_revenue_30d,
        coalesce(sum(amount) filter (
          where created_at >= now() - interval '7 days'
        ), 0)::numeric                                      as gross_revenue_7d
      from public.orders
      where seller_id = v_seller_id
        and status = 'paid'
    ),
    -- Two-step: products owned by this seller, then count their views in
    -- the trailing 30d window. The intermediate CTE lets the planner use
    -- the products_seller_idx (B-tree on seller_id from 20260501) before
    -- it hits the larger product_views table.
    views as (
      select count(*)::int as total_views_30d
      from public.product_views pv
      join public.products p on p.id = pv.product_id
      where p.seller_id = v_seller_id
        and pv.viewed_at >= now() - interval '30 days'
    ),
    seller_row as (
      select followers_count, rating
      from public.sellers
      where id = v_seller_id
    )
  select
    listings.total_listings                              as total_listings,
    listings.total_listings                              as active_listings,
    sales.total_paid_sales_count                         as total_paid_sales_count,
    sales.gross_revenue_all_time                         as gross_revenue_all_time,
    sales.gross_revenue_30d                              as gross_revenue_30d,
    sales.gross_revenue_7d                               as gross_revenue_7d,
    coalesce(seller_row.followers_count, 0)::int         as followers_count,
    coalesce(seller_row.rating, 0)::numeric              as rating,
    views.total_views_30d                                as total_views_30d
  from listings, sales, views, seller_row;
end;
$$;

revoke all on function public.get_seller_dashboard_summary() from public;
grant execute on function public.get_seller_dashboard_summary() to authenticated;

-- =============================================================================
-- 2. get_seller_products_with_stats
--    One row per product owned by the caller, each carrying:
--      - the product row's display fields (title, thumb, price, etc.)
--      - views_7d        — count of product_views rows in trailing 7 days
--      - paid_sales_count — count of paid orders for this product
--      - gross_revenue   — sum of paid order amounts for this product
--
--    Sort order: featured_until DESC NULLS LAST, then created_at DESC.
--    "Currently featured" rows (featured_until in the future) bubble to
--    the top of the list — same surface affordance the boost rail uses.
--    Older non-featured products fall through naturally as the
--    featured_until ordering hits NULL, where created_at DESC takes over.
--
--    LEFT JOINs to product_views and orders so a product with zero
--    views and zero orders still appears with views_7d = 0 and
--    paid_sales_count = 0 (a brand-new listing should not be hidden
--    from its own seller's product list).
--
--    Sub-queries (not LATERAL joins) so each per-product aggregate is
--    independent of the others and the planner can pick the best index
--    per call. The per-product LIMIT pattern from feed RPCs isn't
--    appropriate here — we want every product, not a top-N.
-- =============================================================================
create or replace function public.get_seller_products_with_stats()
returns table (
  product_id        uuid,
  title             jsonb,
  thumbnail_url     text,
  price             numeric,
  currency          text,
  purchase_mode     text,
  featured_until    timestamptz,
  created_at        timestamptz,
  views_7d          int,
  paid_sales_count  int,
  gross_revenue     numeric
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id   uuid;
  v_seller_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  select id
    into v_seller_id
  from public.sellers
  where user_id = v_user_id;

  if v_seller_id is null then
    raise exception 'no_seller';
  end if;

  return query
  select
    p.id                                              as product_id,
    p.title                                           as title,
    coalesce(p.thumbnail_url, p.media_url)            as thumbnail_url,
    p.price                                           as price,
    p.currency                                        as currency,
    p.purchase_mode                                   as purchase_mode,
    p.featured_until                                  as featured_until,
    p.created_at                                      as created_at,
    coalesce((
      select count(*)::int
      from public.product_views pv
      where pv.product_id = p.id
        and pv.viewed_at >= now() - interval '7 days'
    ), 0)                                             as views_7d,
    coalesce((
      select count(*)::int
      from public.orders o
      where o.product_id = p.id
        and o.status = 'paid'
    ), 0)                                             as paid_sales_count,
    coalesce((
      select sum(o.amount)
      from public.orders o
      where o.product_id = p.id
        and o.status = 'paid'
    ), 0)::numeric                                    as gross_revenue
  from public.products p
  where p.seller_id = v_seller_id
  order by p.featured_until desc nulls last, p.created_at desc;
end;
$$;

revoke all on function public.get_seller_products_with_stats() from public;
grant execute on function public.get_seller_products_with_stats() to authenticated;

-- =============================================================================
-- 3. get_seller_customers
--    Distinct buyers who have placed a paid order with the calling seller.
--
--    Schema note (verified against 20260509_messaging.sql + 20260510_orders.sql
--    before authoring): conversations.seller_user_id is an auth.users.id FK,
--    NOT a sellers.id FK. orders.buyer_id is also an auth.users.id FK. So
--    the conversation match is:
--        conversations.seller_user_id = v_user_id  (the caller's auth.users.id)
--      AND conversations.buyer_id     = orders.buyer_id
--    The LATERAL sub-select returns the FIRST matching conversation_id
--    (there's exactly one per (product, buyer) pair, and we don't care
--    which product the conversation is about — the customer screen will
--    open whichever conversation exists, if any).
--
--    Buyer-name nullability: orders.buyer_name was added by 20260713 and
--    is nullable; orders predating that migration won't have it. The JS
--    layer renders NULL as a placeholder ("—").
-- =============================================================================
create or replace function public.get_seller_customers()
returns table (
  buyer_user_id    uuid,
  buyer_name       text,
  total_spend      numeric,
  order_count      int,
  last_order_at    timestamptz,
  conversation_id  uuid
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id   uuid;
  v_seller_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  select id
    into v_seller_id
  from public.sellers
  where user_id = v_user_id;

  if v_seller_id is null then
    raise exception 'no_seller';
  end if;

  return query
  select
    o.buyer_id                                  as buyer_user_id,
    max(o.buyer_name)                           as buyer_name,
    coalesce(sum(o.amount), 0)::numeric         as total_spend,
    count(*)::int                               as order_count,
    max(o.created_at)                           as last_order_at,
    (
      -- Optional back-link. NULL when the buyer has never messaged this
      -- seller (e.g., an instant-checkout flow without a prior thread).
      select c.id
      from public.conversations c
      where c.seller_user_id = v_user_id
        and c.buyer_id       = o.buyer_id
      order by c.last_message_at desc
      limit 1
    )                                           as conversation_id
  from public.orders o
  where o.seller_id = v_seller_id
    and o.status    = 'paid'
  group by o.buyer_id
  order by max(o.created_at) desc;
end;
$$;

revoke all on function public.get_seller_customers() from public;
grant execute on function public.get_seller_customers() to authenticated;

-- =============================================================================
-- 4. get_seller_views_timeseries(p_days int)
--    One row per day in the trailing p_days window (1..90), with the
--    views_count for that day. Implementation uses generate_series so
--    days with zero views still appear with views_count = 0 — the
--    client renders a continuous curve without a gap-fill pass.
--
--    p_days range cap (1..90): we don't expose more than a 90-day
--    rolling window via this RPC. Long-range historical analytics would
--    use a dedicated rollup table (not the raw product_views log) once
--    the volume justifies it. The lower bound is 1 (a single-day chart
--    is a valid call; e.g., "show me today's views by hour" would be a
--    different RPC altogether).
--
--    date_trunc('day', viewed_at)::date normalizes the timezone before
--    the JOIN. Both sides of the equality are `date` so the BTREE on
--    (product_id, viewed_at desc) can still filter by the trailing-window
--    predicate.
-- =============================================================================
create or replace function public.get_seller_views_timeseries(
  p_days int
)
returns table (
  day          date,
  views_count  int
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id   uuid;
  v_seller_id uuid;
begin
  if p_days is null or p_days < 1 or p_days > 90 then
    raise exception 'invalid_days_range'
      using hint = 'p_days must be between 1 and 90 inclusive';
  end if;

  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  select id
    into v_seller_id
  from public.sellers
  where user_id = v_user_id;

  if v_seller_id is null then
    raise exception 'no_seller';
  end if;

  return query
  select
    d.day::date                                                          as day,
    coalesce(count(pv.id) filter (where pv.id is not null), 0)::int      as views_count
  from generate_series(
    (current_date - (p_days - 1))::date,
    current_date,
    interval '1 day'
  ) as d(day)
  left join public.product_views pv
       on date_trunc('day', pv.viewed_at)::date = d.day::date
      and pv.product_id in (
        select id from public.products where seller_id = v_seller_id
      )
  group by d.day
  order by d.day asc;
end;
$$;

revoke all on function public.get_seller_views_timeseries(int) from public;
grant execute on function public.get_seller_views_timeseries(int) to authenticated;

-- =============================================================================
-- 5. get_seller_revenue_timeseries(p_days int)
--    Same generate_series shape as (4) but against paid orders. Each row
--    is one day with the day's gross_revenue (sum of amounts) and
--    paid_sales_count (count of orders). Both are 0 / 0::numeric on
--    days with no orders so the client doesn't gap-fill.
--
--    Currency note: orders.currency is per-order (EUR/USD/GBP) but this
--    aggregate ignores the currency dimension — it sums numerics across
--    whatever currencies the seller has transacted in. This matches the
--    Track-2 KPI tile spec which formats the result against the caller's
--    preferred display currency cookie without converting amounts. If
--    multi-currency revenue display becomes a requirement, this RPC
--    should grow a `currency text` group-by column and the client should
--    render multiple lines / stacked totals.
-- =============================================================================
create or replace function public.get_seller_revenue_timeseries(
  p_days int
)
returns table (
  day               date,
  gross_revenue     numeric,
  paid_sales_count  int
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id   uuid;
  v_seller_id uuid;
begin
  if p_days is null or p_days < 1 or p_days > 90 then
    raise exception 'invalid_days_range'
      using hint = 'p_days must be between 1 and 90 inclusive';
  end if;

  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  select id
    into v_seller_id
  from public.sellers
  where user_id = v_user_id;

  if v_seller_id is null then
    raise exception 'no_seller';
  end if;

  return query
  select
    d.day::date                                                  as day,
    coalesce(sum(o.amount), 0)::numeric                          as gross_revenue,
    coalesce(count(o.id) filter (where o.id is not null), 0)::int as paid_sales_count
  from generate_series(
    (current_date - (p_days - 1))::date,
    current_date,
    interval '1 day'
  ) as d(day)
  left join public.orders o
       on date_trunc('day', o.created_at)::date = d.day::date
      and o.seller_id = v_seller_id
      and o.status    = 'paid'
  group by d.day
  order by d.day asc;
end;
$$;

revoke all on function public.get_seller_revenue_timeseries(int) from public;
grant execute on function public.get_seller_revenue_timeseries(int) to authenticated;

commit;
