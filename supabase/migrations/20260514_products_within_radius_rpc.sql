-- =============================================================================
-- Migration: 20260514_products_within_radius_rpc
-- Purpose:   Add `public.products_within_radius(...)` — a geo-aware product
--            search function used by Phase G.6's marketplace feed integration.
--            PostGIS-backed (PRIMARY path from G.1, see 20260513_geo_columns).
--
-- Function summary:
--   * Returns every column of `public.products` plus a computed
--     `distance_km double precision`.
--   * All filter parameters are NULL-tolerant: calling with no arguments
--     returns all products (subject to LIMIT).
--   * Sort options: 'distance' (default — only meaningful when coords given),
--     'newest', 'price_asc', 'price_desc', 'most_liked'. `created_at desc`
--     is the deterministic tiebreaker.
--   * `security invoker` + RLS-respecting: callers see exactly what they would
--     see via a normal `select` on `public.products`.
--   * `set search_path = public, pg_catalog` to harden against search_path
--     manipulation (Postgres best practice for INVOKER functions that call
--     extension functions like ST_DWithin / ST_Distance).
--
-- Param naming mirrors `useMarketplaceFilters` so G.6's hook can pass the
-- store's filter shape through unchanged. `p_pickup_only` is included to
-- let G.6 fully replace the existing `searchProducts` service. The legacy
-- `locationQuery` (ILIKE on `products.location` text) is intentionally NOT
-- exposed here — geo radius supersedes it.
--
-- Idempotent: `create or replace function`. Wrapped in begin/commit.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually if you need to revert this migration)
-- -----------------------------------------------------------------------------
-- begin;
--   drop function if exists public.products_within_radius(
--     double precision, double precision, double precision,
--     text, text, numeric, numeric, text, boolean, text, int, int
--   );
-- commit;
-- -----------------------------------------------------------------------------

begin;

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
  p_offset         int              default 0
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
  distance_km         double precision
)
language plpgsql
stable
security invoker
set search_path = public, pg_catalog
as $$
declare
  user_point geography;
  search_term text;
begin
  -- Build user point only when both coords are provided.
  if p_latitude is not null and p_longitude is not null then
    user_point := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography;
  end if;

  -- Strip ILIKE wildcards from caller-supplied text so a user typing "%"
  -- searches literally rather than matching everything. Mirrors the
  -- sanitization the JS client (`searchProducts`) already does.
  if p_search_query is not null and length(trim(p_search_query)) > 0 then
    search_term := replace(replace(trim(p_search_query), '%', ''), '_', '');
    if length(search_term) = 0 then
      search_term := null;
    end if;
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
    case
      when user_point is not null and p.location_point is not null
        then ST_Distance(p.location_point, user_point) / 1000.0
      else null
    end as distance_km
  from public.products p
  where
    -- Category / subcategory
    (p_category_id    is null or p.category_id    = p_category_id)
    and (p_subcategory_id is null or p.subcategory_id = p_subcategory_id)
    -- Price range
    and (p_min_price is null or p.price >= p_min_price)
    and (p_max_price is null or p.price <= p_max_price)
    -- Pickup-only toggle
    and (p_pickup_only is null or p_pickup_only = false or p.pickup_available = true)
    -- Text search across localized title + description (jsonb)
    and (
      search_term is null
      or (p.title       ->> 'fr') ilike '%' || search_term || '%'
      or (p.title       ->> 'en') ilike '%' || search_term || '%'
      or (p.description ->> 'fr') ilike '%' || search_term || '%'
      or (p.description ->> 'en') ilike '%' || search_term || '%'
    )
    -- Geo radius (uses GIST index on location_point via ST_DWithin)
    and (
      user_point is null
      or p_radius_km is null
      or (
        p.location_point is not null
        and ST_DWithin(p.location_point, user_point, p_radius_km * 1000.0)
      )
    )
  order by
    case when p_sort = 'distance' and user_point is not null
         then ST_Distance(p.location_point, user_point) end asc nulls last,
    case when p_sort = 'newest'    then p.created_at  end desc nulls last,
    case when p_sort = 'price_asc' then p.price       end asc  nulls last,
    case when p_sort = 'price_desc' then p.price      end desc nulls last,
    case when p_sort = 'most_liked' then p.likes_count end desc nulls last,
    p.created_at desc                              -- deterministic tiebreaker
  limit  greatest(p_limit, 0)
  offset greatest(p_offset, 0);
end;
$$;

grant execute on function public.products_within_radius(
  double precision, double precision, double precision,
  text, text, numeric, numeric, text, boolean, text, int, int
) to authenticated, anon;

commit;
