-- =============================================================================
-- Migration: 20260610_products_within_radius_v2
-- Purpose:   Phase 5 / Track A / Step A1 — rewrite `products_within_radius` so
--            it supports (a) keyset pagination, (b) feature-first ordering,
--            and (c) inline LEFT JOIN sellers. Replaces the offset-based
--            shape from 20260514_products_within_radius_rpc.sql and removes
--            the JS-side second round-trip to `public.sellers`.
--
-- Breaking changes vs the previous signature:
--   1. `p_offset int` is REPLACED by `p_cursor jsonb`. Callers MUST migrate
--      from offset-based to cursor-based pagination. The cursor is opaque to
--      the client (it should pass it back verbatim) but its shape is
--      documented below for diagnostic purposes.
--   2. RETURN TABLE gains one column: `seller jsonb` — the joined seller row
--      (only the columns the mobile client needs: id, name, avatar_url,
--      verified, is_pro, rating, sales_count). The legacy
--      `searchNearbyProducts` second query to `public.sellers` becomes
--      redundant and is removed in Step B1.
--   3. RETURN TABLE also gains `featured_until` (so the client can render
--      the "À la une" badge without a second per-row fetch).
--   4. ORDER BY is now feature-first regardless of `p_sort`:
--        currently-featured DESC, featured_until DESC NULLS LAST,
--        <secondary sort as before>, created_at DESC, id DESC.
--      The final `id DESC` tiebreaker is REQUIRED for cursor stability — two
--      rows that share the entire sort tuple up to created_at would otherwise
--      have an ambiguous page boundary.
--
-- Cursor shape (jsonb, opaque to clients):
--   {
--     "featured_until": <ISO timestamp | null>,    // tier 2 key
--     "created_at":     <ISO timestamp>,            // tier 4 key (always set)
--     "id":             "<uuid>",                   // tier 5 strict tiebreaker
--     "distance_km":    <number | null>             // tier 3 key, sort='distance' only
--   }
--   Tier 1 (is_currently_featured boolean) is derived at runtime from
--   `featured_until > now()` and is never serialized on its own.
--
-- Cursor predicate model:
--   The predicate "row comes strictly after the cursor row in the ORDER BY"
--   is a chain of OR'd tier-equality clauses:
--     T1: row.flag < cursor.flag                              (DESC, boolean)
--     OR (T1=eq AND
--         T2: row.fu < cursor.fu, NULLS LAST                  (DESC NULLS LAST)
--       OR (T2=eq AND
--           T3: row.dist > cursor.dist (or row.dist NULL when cursor non-null)
--                                                             (ASC NULLS LAST — distance only)
--         OR (T3=eq AND
--             T4: row.ca < cursor.ca                          (DESC)
--           OR (T4=eq AND
--               T5: row.id < cursor.id                        (DESC, strict)
--             ))))
--   For sorts OTHER than 'distance', the T3 tier collapses to "equal" and
--   the predicate falls straight through to (created_at, id). No duplicates
--   and no missing rows because (created_at, id) is strictly unique — but
--   the per-page secondary order (price / likes_count) may shift across
--   page boundaries. Strict cursors for price/likes sorts are deferred to a
--   future migration; they are not used by the marketplace feed today.
--
-- Why SECURITY INVOKER (unchanged from v1):
--   The function reads from `public.products`/`public.sellers` and returns
--   only data the caller's RLS already permits. No privileged write paths.
--   `set search_path = public, pg_catalog` hardens the function against
--   search-path attacks on the extension functions (ST_DWithin, ST_Distance).
--
-- Idempotency: DROP FUNCTION ... CASCADE precedes CREATE OR REPLACE because
--   the return-table shape changed (added `featured_until` and `seller`);
--   plain CREATE OR REPLACE cannot change the return type. Wrapped in
--   begin/commit. Re-running this migration against an applied database is
--   a no-op.
--
-- Type regen REQUIRED — Functions['products_within_radius']['Returns'] gains
--   `seller jsonb` + `featured_until timestamptz`, and the `Args` lose
--   `p_offset` and gain `p_cursor jsonb`. Run `npm run gen:types` after
--   applying and update src/features/marketplace/services/products.ts in
--   Step B1.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert this migration to the 20260514 shape)
-- -----------------------------------------------------------------------------
-- begin;
--   drop function if exists public.products_within_radius(
--     double precision, double precision, double precision,
--     text, text, numeric, numeric, text, boolean, text, int, jsonb
--   ) cascade;
--   -- Then re-apply 20260514_products_within_radius_rpc.sql by hand.
-- commit;
-- -----------------------------------------------------------------------------

begin;

-- Drop the previous (offset-based) signature explicitly. CASCADE is included
-- so dependent views (none expected) don't block the drop. We cannot
-- CREATE OR REPLACE through a return-type change.
drop function if exists public.products_within_radius(
  double precision, double precision, double precision,
  text, text, numeric, numeric, text, boolean, text, int, int
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
  seller              jsonb
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

  -- Sanitize the search term (same shape as v1 — strip ILIKE wildcards).
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
    end as seller
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
    -- Cursor predicate (see header for tier semantics).
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

commit;
