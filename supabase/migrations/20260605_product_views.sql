-- =============================================================================
-- Migration: 20260605_product_views
-- Purpose:   Phase H.13 — Pro-gated product-view analytics. Adds:
--              1. `public.product_views` append-only event log (one row per
--                 detail-sheet open) with RLS enabled but NO policies (locked
--                 down to service-role + SECURITY DEFINER RPCs only).
--              2. Composite index `(product_id, viewed_at desc)` for the hot
--                 read path: "aggregate views for a single product over a
--                 trailing N-day window".
--              3. `track_product_view(p_product_id uuid)` SECURITY DEFINER
--                 RPC. Anonymous-callable. Resolves the caller's seller_id
--                 (NULL for anon), looks up the product owner, and inserts
--                 the row IF AND ONLY IF the caller is not the owner. Owners
--                 cannot inflate their own counts.
--              4. `get_product_analytics(p_product_id uuid)` SECURITY DEFINER
--                 RPC. Authed-only. Verifies the caller owns the product
--                 (sellers.user_id = auth.uid() AND sellers.id =
--                 products.seller_id), then returns
--                 (views_24h, views_7d, views_30d) as a single row.
--                 Pro-state check is deliberately CLIENT-SIDE only — see
--                 ANALYTICS_AUDIT.md §2.8 for the full rationale.
--
-- See ANALYTICS_AUDIT.md (repo root) for the full design rationale,
-- including the deviations from the literal H.13 prompt
-- (uuid_generate_v4 over gen_random_uuid, search_path hardening,
-- single-day intervals vs calendar-day bucketing, etc.).
--
-- SECURITY DEFINER rationale:
--   `product_views` has NO RLS policies — `authenticated` and `anon` have
--   no SELECT/INSERT path through PostgREST. The only way to write a row
--   is through `track_product_view`, which runs as the migration owner;
--   the only way to read aggregates is through `get_product_analytics`,
--   which runs as the migration owner and gates by ownership. `set
--   search_path = public, pg_catalog` defeats the classic SECURITY
--   DEFINER hijack vector — same shape as C.2's `handle_follow_change`,
--   D.2's `handle_comment_change`, E.2's `increment_share_count`, and
--   H.12's `feature_product`.
--
-- Owner self-view exclusion:
--   The `track_product_view` body resolves the caller's seller via
--   `sellers.user_id = auth.uid()`. If that equals the product's
--   `seller_id`, the function returns without inserting. Anon callers
--   (auth.uid() IS NULL) cannot match by definition and always insert.
--   Server-side enforcement — not relying on client to suppress its own
--   tracking.
--
-- FK semantics:
--   - product_id ON DELETE CASCADE: when a listing is removed (B.4
--     account-deletion sweep, owner manual delete) its view log is
--     meaningless and should disappear with it.
--   - viewer_seller_id ON DELETE SET NULL: a deleted viewer should NOT
--     destroy the row — the OWNER's aggregate still owes a count for
--     that view (it was a real view; the viewer just no longer exists).
--     SET NULL preserves the count while severing the viewer-PII link.
--   - viewer_seller_id NULL: anonymous (signed-out) views. By design.
--
-- Idempotent:    CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
--                CREATE OR REPLACE FUNCTION + GRANT EXECUTE — re-running
--                this migration is a no-op against an applied database.
-- Transactional: wrapped in BEGIN / COMMIT.
-- Reversibility: see ROLLBACK SQL block immediately below.
-- Type regen:    REQUIRED. New table + 2 new Functions land in the
--                generated `Database['public']['Tables']['product_views']`
--                / `Database['public']['Functions']['track_product_view']`
--                / `Database['public']['Functions']['get_product_analytics']`
--                keys. Run `npm run gen:types` after applying this
--                migration; until then the JS service helpers use
--                documented `as never` casts on the RPC name + args.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert this migration)
-- -----------------------------------------------------------------------------
-- begin;
--   revoke execute on function public.get_product_analytics(uuid)
--     from authenticated;
--   drop function if exists public.get_product_analytics(uuid);
--   revoke execute on function public.track_product_view(uuid)
--     from anon, authenticated;
--   drop function if exists public.track_product_view(uuid);
--   drop index if exists public.product_views_product_id_viewed_at_idx;
--   drop table if exists public.product_views;
-- commit;
-- -----------------------------------------------------------------------------

begin;

-- -----------------------------------------------------------------------------
-- 1. product_views append-only event log.
--    `uuid_generate_v4()` matches the existing convention (uuid-ossp from
--    20260501; cf. ANALYTICS_AUDIT.md §2.4). One row per detail-sheet open
--    that survives the owner-self-view filter in `track_product_view`.
-- -----------------------------------------------------------------------------
create table if not exists public.product_views (
  id                uuid        primary key default uuid_generate_v4(),
  product_id        uuid        not null
                                references public.products(id) on delete cascade,
  viewer_seller_id  uuid        references public.sellers(id) on delete set null,
  viewed_at         timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. Composite index for the hot read path.
--    The analytics RPC's three FILTERed count(*) aggregates all share the
--    same WHERE clause (`product_id = $1` + `viewed_at >= now() - interval`),
--    so a single seek on this index serves every query. DESC ordering
--    matches the natural query direction (recent rows first).
-- -----------------------------------------------------------------------------
create index if not exists product_views_product_id_viewed_at_idx
  on public.product_views (product_id, viewed_at desc);

-- -----------------------------------------------------------------------------
-- 3. RLS — enabled, no policies.
--    Effect: `authenticated` and `anon` cannot SELECT/INSERT/UPDATE/DELETE
--    rows through PostgREST. Only the service_role (Edge Functions, admin
--    web) and the SECURITY DEFINER RPCs below can touch this table. We
--    additionally revoke ALL on the table so even if a future migration
--    adds an open policy, the grant denies the operation first.
-- -----------------------------------------------------------------------------
alter table public.product_views enable row level security;

revoke all on public.product_views from public;
revoke all on public.product_views from anon;
revoke all on public.product_views from authenticated;

-- -----------------------------------------------------------------------------
-- 4. track_product_view RPC.
--    Anon-callable, owner-self-view excluded. The owner check resolves
--    the caller's seller_id via `sellers.user_id = auth.uid()` (NULL for
--    anon, since auth.uid() returns NULL for anon and the JOIN simply
--    misses). The product's seller_id is fetched in a separate query
--    rather than joined, so a missing product short-circuits to a no-op
--    return without an exception (deleted listings should not blow up
--    anonymous tracking calls).
-- -----------------------------------------------------------------------------
create or replace function public.track_product_view(
  p_product_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_seller_id uuid;
  v_owner_id  uuid;
begin
  -- Anon → v_seller_id stays NULL. That is fine; an anon caller cannot
  -- be the owner by definition, so the self-view filter trivially
  -- passes.
  select s.id
    into v_seller_id
  from public.sellers s
  where s.user_id = auth.uid();

  select p.seller_id
    into v_owner_id
  from public.products p
  where p.id = p_product_id;

  -- Product is missing or has been deleted: nothing to record. Silent
  -- no-op rather than RAISE so a stale client UI does not produce an
  -- error. The cascade FK on product_id makes this branch unreachable
  -- for a freshly-deleted product anyway (the row would already be
  -- gone), but the guard is defensive against the small window between
  -- "client opens detail" and "owner deletes listing".
  if v_owner_id is null then
    return;
  end if;

  -- Self-view exclusion. The seller cannot pad their own counts.
  if v_seller_id is not null and v_seller_id = v_owner_id then
    return;
  end if;

  insert into public.product_views (product_id, viewer_seller_id)
  values (p_product_id, v_seller_id);
end;
$$;

revoke all on function public.track_product_view(uuid) from public;
grant execute on function public.track_product_view(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. get_product_analytics RPC.
--    Authed-only. Ownership-gated server-side; Pro-gated client-side
--    (see ANALYTICS_AUDIT.md §2.8). Returns a single-row table with
--    integer columns so the JS layer reads `data[0].views_24h` etc.
--    The single-pass three-way `count(*) FILTER (...)` aggregate uses
--    the partial-window index above for an index-only seek.
-- -----------------------------------------------------------------------------
create or replace function public.get_product_analytics(
  p_product_id uuid
)
returns table (
  views_24h int,
  views_7d  int,
  views_30d int
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_seller_id uuid;
  v_owner_id  uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select s.id
    into v_seller_id
  from public.sellers s
  where s.user_id = auth.uid();

  select p.seller_id
    into v_owner_id
  from public.products p
  where p.id = p_product_id;

  if v_seller_id is null
     or v_owner_id is null
     or v_seller_id <> v_owner_id then
    raise exception 'not_authorized';
  end if;

  return query
  select
    count(*) filter (where pv.viewed_at >= now() - interval '24 hours')::int
      as views_24h,
    count(*) filter (where pv.viewed_at >= now() - interval '7 days')::int
      as views_7d,
    count(*) filter (where pv.viewed_at >= now() - interval '30 days')::int
      as views_30d
  from public.product_views pv
  where pv.product_id = p_product_id;
end;
$$;

revoke all on function public.get_product_analytics(uuid) from public;
grant execute on function public.get_product_analytics(uuid) to authenticated;

commit;
