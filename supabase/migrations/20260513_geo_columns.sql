-- =============================================================================
-- Migration: 20260513_geo_columns
-- Purpose:   Add geographic coordinates to `products` and `sellers` so
--            subsequent Phase G steps (geocoding, device location, radius RPC,
--            feed integration, posting flow) have a database to read/write.
--
-- Tables affected:
--   * public.products  — adds latitude, longitude, location_updated_at,
--                        location_point (generated, geography).
--                        Existing `location text` column UNCHANGED — it
--                        becomes the human-readable display name going forward.
--   * public.sellers   — adds latitude, longitude, location_text,
--                        location_updated_at, location_point (generated).
--                        (`sellers` is the de-facto user profile table in
--                        this project. The G.1 brief refers to "profiles";
--                        we map that to `sellers` because no `profiles`
--                        table exists. See PROJECT_AUDIT.md changelog.)
--
-- Path: PRIMARY (PostGIS).
--   Supabase supports the `postgis` extension on every project tier. If a
--   target environment cannot enable it, swap to the FALLBACK section below
--   (drop the CREATE EXTENSION + the location_point columns + the GIST
--   indexes; keep everything else). G.5's RPC must use Haversine in that
--   case instead of ST_DWithin.
--
-- Idempotency: every DDL statement uses `if not exists`.
-- Transactional: wrapped in BEGIN/COMMIT — partial application is impossible.
-- Reversibility: see ROLLBACK SQL block immediately below.
-- Backfill: out of scope. Existing rows get NULL lat/lng. A future one-off
--           script can geocode `products.location` text into coordinates.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually if you need to revert this migration)
-- -----------------------------------------------------------------------------
-- begin;
--   drop index if exists public.products_location_point_gix;
--   drop index if exists public.products_lat_lng_idx;
--   alter table public.products drop column if exists location_point;
--   alter table public.products drop column if exists location_updated_at;
--   alter table public.products drop column if exists longitude;
--   alter table public.products drop column if exists latitude;
--
--   drop index if exists public.sellers_location_point_gix;
--   drop index if exists public.sellers_lat_lng_idx;
--   alter table public.sellers drop column if exists location_point;
--   alter table public.sellers drop column if exists location_updated_at;
--   alter table public.sellers drop column if exists location_text;
--   alter table public.sellers drop column if exists longitude;
--   alter table public.sellers drop column if exists latitude;
--
--   -- NOTE: do NOT drop the postgis extension on rollback — other tables
--   -- or future migrations may rely on it.
-- commit;
-- -----------------------------------------------------------------------------

begin;

create extension if not exists postgis;

-- -----------------------------------------------------------------------------
-- products: add lat/lng + generated geography point + indexes
-- -----------------------------------------------------------------------------
alter table public.products
  add column if not exists latitude            double precision,
  add column if not exists longitude           double precision,
  add column if not exists location_updated_at timestamptz;

alter table public.products
  add column if not exists location_point geography(Point, 4326)
    generated always as (
      case
        when latitude is not null and longitude is not null
          then ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
        else null
      end
    ) stored;

create index if not exists products_location_point_gix
  on public.products using gist (location_point);

create index if not exists products_lat_lng_idx
  on public.products (latitude, longitude)
  where latitude is not null and longitude is not null;

-- -----------------------------------------------------------------------------
-- sellers: add lat/lng + human-readable location_text + generated point + indexes
-- (Maps to "profiles" in the Phase G brief — see header note.)
-- -----------------------------------------------------------------------------
alter table public.sellers
  add column if not exists latitude            double precision,
  add column if not exists longitude           double precision,
  add column if not exists location_text       text,
  add column if not exists location_updated_at timestamptz;

alter table public.sellers
  add column if not exists location_point geography(Point, 4326)
    generated always as (
      case
        when latitude is not null and longitude is not null
          then ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
        else null
      end
    ) stored;

create index if not exists sellers_location_point_gix
  on public.sellers using gist (location_point);

create index if not exists sellers_lat_lng_idx
  on public.sellers (latitude, longitude)
  where latitude is not null and longitude is not null;

commit;

-- =============================================================================
-- FALLBACK (no PostGIS) — only use if `create extension postgis` fails on
-- a target environment due to permissions/tier restrictions. Drop everything
-- above and use this instead. G.5's RPC must then use Haversine, not ST_DWithin.
-- =============================================================================
-- begin;
--   alter table public.products
--     add column if not exists latitude            double precision,
--     add column if not exists longitude           double precision,
--     add column if not exists location_updated_at timestamptz;
--   create index if not exists products_lat_lng_idx
--     on public.products (latitude, longitude)
--     where latitude is not null and longitude is not null;
--
--   alter table public.sellers
--     add column if not exists latitude            double precision,
--     add column if not exists longitude           double precision,
--     add column if not exists location_text       text,
--     add column if not exists location_updated_at timestamptz;
--   create index if not exists sellers_lat_lng_idx
--     on public.sellers (latitude, longitude)
--     where latitude is not null and longitude is not null;
-- commit;
-- =============================================================================
