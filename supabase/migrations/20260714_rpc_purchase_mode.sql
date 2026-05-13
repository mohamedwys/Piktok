-- =============================================================================
-- Migration: 20260714_rpc_purchase_mode
-- Purpose:   Phase 8 / Track B follow-up -- project `products.purchase_mode`
--            through the two feed read-path RPCs so the client's action rail
--            can render Buy-now vs Contact correctly.
--
-- Why this exists:
--   20260712_products_purchase_mode added the `purchase_mode` column to
--   `public.products` ('buy_now' | 'contact_only', default 'contact_only')
--   and a trigger that downgrades non-Pro sellers silently. The client's
--   `rowToProduct` mapper already reads `row.purchase_mode`, and the
--   `ProductActionRail` already branches on `product.purchaseMode`.
--
--   BUT: the two RPCs that power the marketplace and For-You feeds --
--   `products_within_radius` (rewritten by 20260610) and `feed_for_you`
--   (introduced by 20260613) -- predate Track B and do not include the
--   column in their RETURNS TABLE list. The JS layer therefore receives
--   `purchase_mode: undefined` for every feed row, so `rowToProduct`
--   falls back to 'contact_only' regardless of seller intent. The "Buy"
--   button never appears in the feed even when a Pro seller chose it.
--
-- What changes:
--   1. `public.products_within_radius` RETURN TABLE gains `purchase_mode text`,
--      placed directly after `seller jsonb`. SELECT list gains `p.purchase_mode`.
--   2. `public.feed_for_you`           RETURN TABLE gains `purchase_mode text`,
--      placed directly after `seller jsonb` (same position) and before
--      `slice text`. The per-slice CTEs continue to `select p.*` -- they
--      already carry `purchase_mode` implicitly since Track B added it as a
--      column on `public.products`. The only explicit edit is in the final
--      projection from `combined c`, which gains `c.purchase_mode`.
--
--   All other body content (parameter lists, search_path hardening,
--   security mode, cursor predicates, ORDER BY, GRANT EXECUTE) is preserved
--   BYTE-FOR-BYTE from the source migrations. The intent is a minimal,
--   purely-additive column-projection change. No semantics shift.
--
-- Security modes preserved exactly:
--   - products_within_radius : SECURITY INVOKER (same as 20260610).
--   - feed_for_you           : SECURITY DEFINER (Phase 5 deviation -- the
--                              function reads `public.product_views`, which
--                              has RLS enabled but no policies, so only
--                              DEFINER RPCs and the service_role can touch
--                              it). Same rationale as 20260613.
--   - search_path = public, pg_catalog preserved on both.
--   - GRANT EXECUTE preserved exactly:
--       products_within_radius -> authenticated, anon
--       feed_for_you           -> authenticated only
--
-- Why DROP FUNCTION ... CASCADE before CREATE OR REPLACE:
--   Both functions are RETURN TABLE functions and the table shape changes
--   (one new column added). Postgres does not allow CREATE OR REPLACE to
--   alter the return-table columns, so we must DROP first. CASCADE handles
--   any dependent views (none expected today). The CREATE that follows
--   restores the state immediately, so applied-db re-runs converge.
--
-- Idempotent:    DROP IF EXISTS + CREATE OR REPLACE. Re-applying this
--                migration against a database that already has the new
--                shape is a no-op (the DROP succeeds, the CREATE OR
--                REPLACE re-installs the same function body).
-- Transactional: wrapped in begin / commit. The two DROP+CREATE pairs
--                ride the same transaction, so a partial apply cannot
--                leave one feed RPC updated and the other missing.
--
-- Type regen REQUIRED:
--   After applying, run `npm run gen:types`.
--   Functions['products_within_radius']['Returns'] gains `purchase_mode: string`.
--   Functions['feed_for_you']['Returns']           gains `purchase_mode: string`.
--   The `rowToProduct` mappers in src/features/marketplace/services/products.ts
--   already read this field, so no client-side changes are required -- the
--   runtime value will start matching the type after regen.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (complex -- restoring the prior bodies requires consulting
-- the source migrations 20260610_products_within_radius_v2.sql and
-- 20260613_feed_for_you.sql verbatim, since this migration's CREATE OR
-- REPLACE bodies are themselves modified copies of those files. The
-- block below shows the DROP half; the CREATE half must be hand-restored
-- by re-applying the two prior migrations after the DROPs run.)
-- -----------------------------------------------------------------------------
-- begin;
--   drop function if exists public.products_within_radius(
--     double precision, double precision, double precision,
--     text, text, numeric, numeric, text, boolean, text, int, jsonb
--   ) cascade;
--   drop function if exists public.feed_for_you(
--     double precision, double precision, double precision, jsonb, int
--   ) cascade;
--   -- Then re-apply 20260610_products_within_radius_v2.sql and
--   -- 20260613_feed_for_you.sql by hand to restore the pre-purchase_mode
--   -- function bodies.
-- commit;
-- -----------------------------------------------------------------------------

begin;

-- =============================================================================
-- 1. public.products_within_radius -- adds `purchase_mode text` after `seller`
-- =============================================================================

-- Return-table shape changes; CREATE OR REPLACE cannot alter return columns.
drop function if exists public.products_within_radius(
  double precision, double precision, double precision,
  text, text, numeric, numeric, text, boolean, text, int, jsonb
) cascade;

create or replace function public.products_within_radius(
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
  p_cursor         jsonb            default null
)
returns table (
  id                  uuid,
  seller_id           uuid,
  title               jsonb,
  description         jsonb,
  category            jsonb,
  attributes          jsonb,
  dimensions          text,
  price               numeric,
  currency            text,
  media_type          text,
  media_url           text,
  thumbnail_url       text,
  stock_available     boolean,
  stock_label         jsonb,
  shipping_free       boolean,
  shipping_label      jsonb,
  likes_count         integer,
  comments_count      integer,
  shares_count        integer,
  bookmarks_count     integer,
  created_at          timestamptz,
  pickup_available    boolean,
  location            text,
  category_id         text,
  subcategory_id      text,
  latitude            double precision,
  longitude           double precision,
  location_updated_at timestamptz,
  location_point      geography(Point, 4326),
  featured_until      timestamptz,
  distance_km         double precision,
  seller              jsonb,
  purchase_mode       text
)
language plpgsql
stable
security invoker
set search_path = public, pg_catalog
as $$
declare
  user_point  geography;
  search_term text;
  v_now       timestamptz := now();
  -- Cursor extracts. All NULL when p_cursor is NULL (first page).
  v_cur_featured_until timestamptz;
  v_cur_created_at     timestamptz;
  v_cur_id             uuid;
  v_cur_distance_km    double precision;
  v_cur_is_featured    boolean := false;
begin
  if p_latitude is not null and p_longitude is not null then
    user_point := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography;
  end if;

  -- Sanitize the search term (same shape as v1 -- strip ILIKE wildcards).
  if p_search_query is not null and length(trim(p_search_query)) > 0 then
    search_term := replace(replace(trim(p_search_query), '%', ''), '_', '');
    if length(search_term) = 0 then
      search_term := null;
    end if;
  end if;

  -- Decode the cursor. Empty-string-to-null normalization is defense against
  -- clients that build the jsonb manually and emit "" for missing keys.
  if p_cursor is not null then
    v_cur_featured_until := nullif(p_cursor->>'featured_until', '')::timestamptz;
    v_cur_created_at     := nullif(p_cursor->>'created_at',     '')::timestamptz;
    v_cur_id             := nullif(p_cursor->>'id',             '')::uuid;
    v_cur_distance_km    := nullif(p_cursor->>'distance_km',    '')::double precision;
    v_cur_is_featured    := v_cur_featured_until is not null
                             and v_cur_featured_until > v_now;
  end if;

  return query
  select
    p.id,
    p.seller_id,
    p.title,
    p.description,
    p.category,
    p.attributes,
    p.dimensions,
    p.price,
    p.currency,
    p.media_type,
    p.media_url,
    p.thumbnail_url,
    p.stock_available,
    p.stock_label,
    p.shipping_free,
    p.shipping_label,
    p.likes_count,
    p.comments_count,
    p.shares_count,
    p.bookmarks_count,
    p.created_at,
    p.pickup_available,
    p.location,
    p.category_id,
    p.subcategory_id,
    p.latitude,
    p.longitude,
    p.location_updated_at,
    p.location_point,
    p.featured_until,
    case
      when user_point is not null and p.location_point is not null
        then ST_Distance(p.location_point, user_point) / 1000.0
      else null
    end as distance_km,
    case
      when s.id is not null then jsonb_build_object(
        'id',          s.id,
        'name',        s.name,
        'avatar_url',  s.avatar_url,
        'verified',    s.verified,
        'is_pro',      s.is_pro,
        'rating',      s.rating,
        'sales_count', s.sales_count
      )
      else null
    end as seller,
    p.purchase_mode
  from public.products p
  left join public.sellers s on s.id = p.seller_id
  where
    -- Existing filters (unchanged from v1).
    (p_category_id    is null or p.category_id    = p_category_id)
    and (p_subcategory_id is null or p.subcategory_id = p_subcategory_id)
    and (p_min_price is null or p.price >= p_min_price)
    and (p_max_price is null or p.price <= p_max_price)
    and (p_pickup_only is null or p_pickup_only = false or p.pickup_available = true)
    and (
      search_term is null
      or (p.title       ->> 'fr') ilike '%' || search_term || '%'
      or (p.title       ->> 'en') ilike '%' || search_term || '%'
      or (p.description ->> 'fr') ilike '%' || search_term || '%'
      or (p.description ->> 'en') ilike '%' || search_term || '%'
    )
    and (
      user_point is null
      or p_radius_km is null
      or (
        p.location_point is not null
        and ST_DWithin(p.location_point, user_point, p_radius_km * 1000.0)
      )
    )
    -- Cursor predicate (see 20260610 header for tier semantics).
    and (
      p_cursor is null
      or (
        -- T1: is_currently_featured DESC (boolean as 0/1).
        ((case when p.featured_until is not null and p.featured_until > v_now
               then 1 else 0 end)
          < (case when v_cur_is_featured then 1 else 0 end))
        or (
          ((case when p.featured_until is not null and p.featured_until > v_now
                 then 1 else 0 end)
            = (case when v_cur_is_featured then 1 else 0 end))
          and (
            -- T2: featured_until DESC NULLS LAST.
            -- Row comes after cursor iff cursor non-null AND
            --   (row null OR row < cursor).
            (v_cur_featured_until is not null
              and (p.featured_until is null
                   or p.featured_until < v_cur_featured_until))
            or (
              -- T2 equal: both null OR both non-null and equal.
              ((p.featured_until is null and v_cur_featured_until is null)
                or (p.featured_until is not null
                    and v_cur_featured_until is not null
                    and p.featured_until = v_cur_featured_until))
              and (
                -- T3: distance_km ASC NULLS LAST. Only contributes when
                -- sort='distance' and we have both a user point and a
                -- cursor distance. For all other sorts, this tier is
                -- always "equal" and falls straight through to T4.
                (p_sort = 'distance'
                  and user_point is not null
                  and v_cur_distance_km is not null
                  and (
                    (case
                       when p.location_point is not null
                         then ST_Distance(p.location_point, user_point) / 1000.0
                       else null
                     end) is null
                    or (case
                          when p.location_point is not null
                            then ST_Distance(p.location_point, user_point) / 1000.0
                          else null
                        end) > v_cur_distance_km
                  ))
                or (
                  -- T3 equal (either non-distance sort, no user point, no
                  -- cursor distance, or distance equality).
                  (
                    p_sort <> 'distance'
                    or user_point is null
                    or v_cur_distance_km is null
                    or (case
                          when p.location_point is not null
                            then ST_Distance(p.location_point, user_point) / 1000.0
                          else null
                        end) = v_cur_distance_km
                  )
                  and (
                    -- T4: created_at DESC.
                    p.created_at < v_cur_created_at
                    or (
                      -- T5: id DESC (strict tiebreaker).
                      p.created_at = v_cur_created_at and p.id < v_cur_id
                    )
                  )
                )
              )
            )
          )
        )
      )
    )
  order by
    -- T1: is_currently_featured DESC.
    (case when p.featured_until is not null and p.featured_until > v_now
          then 1 else 0 end) desc,
    -- T2: featured_until DESC NULLS LAST.
    p.featured_until desc nulls last,
    -- T3: per-sort secondary.
    case when p_sort = 'distance' and user_point is not null and p.location_point is not null
         then ST_Distance(p.location_point, user_point) end asc nulls last,
    case when p_sort = 'price_asc'  then p.price       end asc  nulls last,
    case when p_sort = 'price_desc' then p.price       end desc nulls last,
    case when p_sort = 'most_liked' then p.likes_count end desc nulls last,
    -- T4: created_at DESC (also the natural ordering for sort='newest').
    p.created_at desc,
    -- T5: id DESC (final strict tiebreaker for cursor stability).
    p.id desc
  limit greatest(p_limit, 0);
end;
$$;

grant execute on function public.products_within_radius(
  double precision, double precision, double precision,
  text, text, numeric, numeric, text, boolean, text, int, jsonb
) to authenticated, anon;

-- =============================================================================
-- 2. public.feed_for_you -- adds `purchase_mode text` after `seller`,
--    before `slice`. Per-slice CTEs continue to `select p.*` and therefore
--    already carry `purchase_mode` since Track B added it as a real column
--    on `public.products`. The only explicit body edit is in the final
--    projection from `combined c`, which gains `c.purchase_mode`.
-- =============================================================================

drop function if exists public.feed_for_you(
  double precision, double precision, double precision, jsonb, int
) cascade;

create or replace function public.feed_for_you(
  p_lat        double precision default null,
  p_lng        double precision default null,
  p_radius_km  double precision default null,
  p_cursor     jsonb            default null,
  p_limit      int              default 30
)
returns table (
  id                  uuid,
  seller_id           uuid,
  title               jsonb,
  description         jsonb,
  category            jsonb,
  attributes          jsonb,
  dimensions          text,
  price               numeric,
  currency            text,
  media_type          text,
  media_url           text,
  thumbnail_url       text,
  stock_available     boolean,
  stock_label         jsonb,
  shipping_free       boolean,
  shipping_label      jsonb,
  likes_count         integer,
  comments_count      integer,
  shares_count        integer,
  bookmarks_count     integer,
  created_at          timestamptz,
  pickup_available    boolean,
  location            text,
  category_id         text,
  subcategory_id      text,
  latitude            double precision,
  longitude           double precision,
  location_updated_at timestamptz,
  location_point      geography(Point, 4326),
  featured_until      timestamptz,
  distance_km         double precision,
  seller              jsonb,
  purchase_mode       text,
  slice               text
)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id        uuid;
  v_caller_seller  uuid;
  v_now            timestamptz := now();
  user_point       geography;
  -- Per-slice budgets. greatest(_, 1) guards p_limit=0 / tiny p_limit.
  v_follow_limit   int := greatest(ceil(p_limit * 0.40)::int, 1);
  v_boost_limit    int := greatest(ceil(p_limit * 0.30)::int, 1);
  v_trending_limit int := greatest(ceil(p_limit * 0.20)::int, 1);
  v_serendip_limit int := greatest(ceil(p_limit * 0.10)::int, 1);
  -- Cursor extracts. NULL on the first page or when the cursor lacks the
  -- slice's field; predicates degrade to "no filter" in that case.
  v_cur_f          timestamptz;
  v_cur_b          timestamptz;
  v_cur_t          timestamptz;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  -- Resolve the caller's seller row. May be NULL (auth user without a
  -- seller row yet) -- slices that need it degrade gracefully.
  select id into v_caller_seller
    from public.sellers
   where user_id = v_user_id
   limit 1;

  if p_lat is not null and p_lng is not null then
    user_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  end if;

  if p_cursor is not null then
    v_cur_f := nullif(p_cursor->>'f', '')::timestamptz;
    v_cur_b := nullif(p_cursor->>'b', '')::timestamptz;
    v_cur_t := nullif(p_cursor->>'t', '')::timestamptz;
  end if;

  return query
  with
    -- -----------------------------------------------------------------
    -- Caller context shared across all four slices.
    -- -----------------------------------------------------------------
    caller_interests as (
      select coalesce(
        (select s.interests
           from public.sellers s
          where s.id = v_caller_seller),
        '[]'::jsonb
      ) as interests
    ),
    hidden as (
      select product_id
        from public.product_hides
       where user_id = v_user_id
    ),
    follow_targets as (
      select following_id as seller_id
        from public.follows
       where follower_id = v_caller_seller
    ),
    -- Top-3 viewed categories in the last 30 days. Empty when the user
    -- has no view history yet; the interests fallback kicks in below.
    top_cats_raw as (
      select p.category_id
        from public.product_views pv
        join public.products      p on p.id = pv.product_id
       where pv.viewer_seller_id = v_caller_seller
         and pv.viewed_at > v_now - interval '30 days'
         and p.category_id is not null
       group by p.category_id
       order by count(*) desc
       limit 3
    ),
    interests_cats as (
      select jsonb_array_elements_text(ci.interests) as category_id
        from caller_interests ci
       where not exists (select 1 from top_cats_raw)
    ),
    effective_cats as (
      select category_id from top_cats_raw
      union
      select category_id from interests_cats
    ),

    -- -----------------------------------------------------------------
    -- follow_slice (40%)
    -- -----------------------------------------------------------------
    follow_slice as (
      select sq.*, 'follow'::text as slice,
             row_number() over (order by sq.created_at desc, sq.id desc) as rn
        from (
          select p.*
            from public.products p
           where p.seller_id in (select seller_id from follow_targets)
             and (v_caller_seller is null or p.seller_id <> v_caller_seller)
             and not exists (select 1 from hidden h where h.product_id = p.id)
             and (
               user_point is null
               or p_radius_km is null
               or (p.location_point is not null
                   and ST_DWithin(p.location_point, user_point, p_radius_km * 1000.0))
             )
             and (v_cur_f is null or p.created_at < v_cur_f)
           order by p.created_at desc, p.id desc
           limit v_follow_limit
        ) sq
    ),

    -- -----------------------------------------------------------------
    -- boost_slice (30%)
    -- -----------------------------------------------------------------
    boost_slice as (
      select sq.*, 'boost'::text as slice,
             row_number() over (order by sq.featured_until desc, sq.id desc) as rn
        from (
          select p.*
            from public.products p
           where p.featured_until is not null
             and p.featured_until > v_now
             and (v_caller_seller is null or p.seller_id <> v_caller_seller)
             and not exists (select 1 from hidden h where h.product_id = p.id)
             and (
               user_point is null
               or p_radius_km is null
               or (p.location_point is not null
                   and ST_DWithin(p.location_point, user_point, p_radius_km * 1000.0))
             )
             and (v_cur_b is null or p.featured_until < v_cur_b)
           order by p.featured_until desc, p.id desc
           limit v_boost_limit
        ) sq
    ),

    -- -----------------------------------------------------------------
    -- trending_slice (20%)
    -- -----------------------------------------------------------------
    trending_slice as (
      select sq.*, 'trending'::text as slice,
             row_number() over (order by sq.likes_count desc nulls last,
                                          sq.created_at desc,
                                          sq.id desc) as rn
        from (
          select p.*
            from public.products p
           where p.category_id in (select category_id from effective_cats)
             and (v_caller_seller is null or p.seller_id <> v_caller_seller)
             and not exists (select 1 from hidden h where h.product_id = p.id)
             and (
               user_point is null
               or p_radius_km is null
               or (p.location_point is not null
                   and ST_DWithin(p.location_point, user_point, p_radius_km * 1000.0))
             )
             and (v_cur_t is null or p.created_at < v_cur_t)
           order by p.likes_count desc nulls last,
                    p.created_at desc,
                    p.id desc
           limit v_trending_limit
        ) sq
    ),

    -- -----------------------------------------------------------------
    -- serendipity_slice (10%)
    -- v0: pure random, no cursor. Accepts cross-page duplicates per spec.
    -- The row_number is anchored on id so the interleave ranking has a
    -- stable per-row position once the random set has been materialised.
    -- -----------------------------------------------------------------
    serendipity_slice as (
      select sq.*, 'serendipity'::text as slice,
             row_number() over (order by sq.id) as rn
        from (
          select p.*
            from public.products p
           where (v_caller_seller is null or p.seller_id <> v_caller_seller)
             and not exists (select 1 from hidden h where h.product_id = p.id)
             and (
               user_point is null
               or p_radius_km is null
               or (p.location_point is not null
                   and ST_DWithin(p.location_point, user_point, p_radius_km * 1000.0))
             )
           order by random()
           limit v_serendip_limit
        ) sq
    ),

    combined as (
      select * from follow_slice
      union all
      select * from boost_slice
      union all
      select * from trending_slice
      union all
      select * from serendipity_slice
    )

  -- Final projection + interleave.
  --   ORDER BY rn ASC interleaves slices: row 1 of every slice first
  --   (creates "ring 1"), then row 2 of every slice ("ring 2"), and so on.
  --   Within a ring, the slice-priority CASE puts boost first -> follow ->
  --   trending -> serendipity. p_limit clips the result.
  select
    c.id,
    c.seller_id,
    c.title,
    c.description,
    c.category,
    c.attributes,
    c.dimensions,
    c.price,
    c.currency,
    c.media_type,
    c.media_url,
    c.thumbnail_url,
    c.stock_available,
    c.stock_label,
    c.shipping_free,
    c.shipping_label,
    c.likes_count,
    c.comments_count,
    c.shares_count,
    c.bookmarks_count,
    c.created_at,
    c.pickup_available,
    c.location,
    c.category_id,
    c.subcategory_id,
    c.latitude,
    c.longitude,
    c.location_updated_at,
    c.location_point,
    c.featured_until,
    case
      when user_point is not null and c.location_point is not null
        then ST_Distance(c.location_point, user_point) / 1000.0
      else null
    end as distance_km,
    case
      when s.id is not null then jsonb_build_object(
        'id',          s.id,
        'name',        s.name,
        'avatar_url',  s.avatar_url,
        'verified',    s.verified,
        'is_pro',      s.is_pro,
        'rating',      s.rating,
        'sales_count', s.sales_count
      )
      else null
    end as seller,
    c.purchase_mode,
    c.slice
  from combined c
  left join public.sellers s on s.id = c.seller_id
  order by
    c.rn asc,
    case c.slice
      when 'boost'       then 0
      when 'follow'      then 1
      when 'trending'    then 2
      when 'serendipity' then 3
      else 4
    end asc
  limit greatest(p_limit, 0);
end;
$$;

revoke all   on function public.feed_for_you(
  double precision, double precision, double precision, jsonb, int
) from public;
grant execute on function public.feed_for_you(
  double precision, double precision, double precision, jsonb, int
) to authenticated;

commit;
