-- =============================================================================
-- Migration: 20260812_fix_dashboard_summary_ambiguity
-- Purpose:   Hotfix for the `get_seller_dashboard_summary` RPC introduced by
--            20260810_pro_dashboard_rpcs.sql. The original function body
--            referenced `followers_count` and `rating` as bare column names
--            inside the `seller_row` CTE:
--
--              seller_row as (
--                select followers_count, rating
--                from public.sellers
--                where id = v_seller_id
--              )
--
--            Inside a plpgsql function with `returns table (...)`, the OUT
--            parameters (here `followers_count` and `rating`) are in scope
--            as variables throughout the function body. Postgres cannot
--            decide whether the bare references mean the OUT parameter or
--            the `public.sellers` column of the same name, and raises:
--
--              ERROR:  column reference "followers_count" is ambiguous
--              (Postgres error 42702)
--
--            The defect was build-time invisible — `CREATE OR REPLACE
--            FUNCTION` accepted the body, and `tsc` / `next build` had no
--            way to inspect SQL. It surfaced the first time a real Pro
--            seller landed on /pro in production, crashing the Server
--            Component with a 500 (digest 1909850870 in Vercel logs).
--
--            This migration replaces the function body with the CTE bodies
--            qualified by table aliases (`s.followers_count`, `s.rating`).
--            The other four RPCs in 20260810 already use table aliases
--            consistently and are unaffected.
--
-- Per project workflow: this file is the on-disk audit-trail record. The
-- corrected function was applied via the Supabase SQL editor against the
-- production project; this file mirrors what was run there.
--
-- Idempotent:    CREATE OR REPLACE FUNCTION — re-running this migration
--                against an applied database is a no-op.
-- Transactional: wrapped in BEGIN / COMMIT.
-- Reversibility: see ROLLBACK SQL block immediately below. The rollback
--                restores the pre-fix (broken) function body — only useful
--                if a yet-unseen regression in the fixed version forces a
--                temporary backout while a second hotfix is prepared.
-- Type regen:    NOT REQUIRED. Function signature (parameters + returns
--                table) is unchanged. Only the body changes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert to the pre-fix function body)
-- -----------------------------------------------------------------------------
-- begin;
--   create or replace function public.get_seller_dashboard_summary()
--   returns table (
--     total_listings          int,
--     active_listings         int,
--     total_paid_sales_count  int,
--     gross_revenue_all_time  numeric,
--     gross_revenue_30d       numeric,
--     gross_revenue_7d        numeric,
--     followers_count         int,
--     rating                  numeric,
--     total_views_30d         int
--   )
--   language plpgsql
--   security definer
--   set search_path = public, pg_catalog
--   as $$
--   declare
--     v_user_id   uuid;
--     v_seller_id uuid;
--   begin
--     v_user_id := auth.uid();
--     if v_user_id is null then
--       raise exception 'unauthenticated';
--     end if;
--     select id into v_seller_id from public.sellers where user_id = v_user_id;
--     if v_seller_id is null then
--       raise exception 'no_seller';
--     end if;
--     return query
--     with
--       listings as (
--         select count(*)::int as total_listings
--         from public.products where seller_id = v_seller_id
--       ),
--       sales as (
--         select
--           count(*)::int                                       as total_paid_sales_count,
--           coalesce(sum(amount), 0)::numeric                   as gross_revenue_all_time,
--           coalesce(sum(amount) filter (
--             where created_at >= now() - interval '30 days'
--           ), 0)::numeric                                      as gross_revenue_30d,
--           coalesce(sum(amount) filter (
--             where created_at >= now() - interval '7 days'
--           ), 0)::numeric                                      as gross_revenue_7d
--         from public.orders
--         where seller_id = v_seller_id and status = 'paid'
--       ),
--       views as (
--         select count(*)::int as total_views_30d
--         from public.product_views pv
--         join public.products p on p.id = pv.product_id
--         where p.seller_id = v_seller_id
--           and pv.viewed_at >= now() - interval '30 days'
--       ),
--       seller_row as (
--         -- the broken form: bare column names, collides with OUT params.
--         select followers_count, rating
--         from public.sellers
--         where id = v_seller_id
--       )
--     select
--       listings.total_listings                              as total_listings,
--       listings.total_listings                              as active_listings,
--       sales.total_paid_sales_count                         as total_paid_sales_count,
--       sales.gross_revenue_all_time                         as gross_revenue_all_time,
--       sales.gross_revenue_30d                              as gross_revenue_30d,
--       sales.gross_revenue_7d                               as gross_revenue_7d,
--       coalesce(seller_row.followers_count, 0)::int         as followers_count,
--       coalesce(seller_row.rating, 0)::numeric              as rating,
--       views.total_views_30d                                as total_views_30d
--     from listings, sales, views, seller_row;
--   end;
--   $$;
-- commit;
-- -----------------------------------------------------------------------------

begin;

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
    views as (
      select count(*)::int as total_views_30d
      from public.product_views pv
      join public.products p on p.id = pv.product_id
      where p.seller_id = v_seller_id
        and pv.viewed_at >= now() - interval '30 days'
    ),
    seller_row as (
      -- Qualify both column references with the table alias so they cannot
      -- be confused with the homonymous OUT parameters declared by the
      -- enclosing function's RETURNS TABLE clause. The original migration
      -- 20260810 used bare names here, which raised
      -- "column reference 'followers_count' is ambiguous" at execution time.
      select s.followers_count, s.rating
      from public.sellers s
      where s.id = v_seller_id
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

commit;
