-- =============================================================================
-- Migration: 20260521_increment_share_count_rpc
-- Purpose:   Phase E.2 — make `products.shares_count` writable from the JS
--            client via a SECURITY DEFINER RPC, bypassing the column-level
--            UPDATE grant set by D.1.5
--            (20260519_tighten_products_update_grants.sql), which deliberately
--            excludes `shares_count` from the user-controlled allowlist.
--
--            Per SHARE_AUDIT.md §8 recommendation S1: RPC-only, no new
--            `share_events` table. Each tap = +1 (T1: track on intent, no
--            deduplication — see SHARE_AUDIT.md §7). Future analytics surface
--            (S2 / S3) can be added additively without changing this RPC's
--            signature: a follow-on migration would INSERT into a
--            `share_events` table here and let an AFTER INSERT trigger drive
--            the counter, leaving the JS contract identical.
--
-- SECURITY DEFINER rationale:
--   D.1.5 narrowed `authenticated` UPDATE on public.products to the
--   user-controlled column allowlist. `shares_count` is system-managed and
--   not in that allowlist. SECURITY DEFINER runs the function as the
--   migration owner (typically `postgres`), bypassing the column-level
--   grant. `set search_path = public, pg_catalog` defeats the classic
--   SECURITY DEFINER hijack vector (a malicious user planting a
--   `public.products` shadow object in their own schema and tricking the
--   function into resolving it). Same shape as D.2's
--   `handle_comment_change()` (20260520_comments_schema.sql:190-215) and
--   C.2's `handle_follow_change()`
--   (20260518_follows_schema_and_counters.sql:158-184).
--
-- Auth gate:
--   `auth.uid() IS NULL` → RAISE EXCEPTION 'unauthenticated'. Belt and
--   suspenders alongside `revoke ... from public` + `grant ... to
--   authenticated` below: the role check excludes `anon`; the auth.uid()
--   check excludes any future role with EXECUTE that lacks an auth context.
--
-- Counter semantics:
--   `COALESCE(shares_count, 0) + 1` — defensive against any historical row
--   with a NULL shares_count. The column is `not null default 0` per
--   20260501_initial_marketplace_schema.sql:54, so COALESCE is currently a
--   no-op, but cheap insurance.
--
--   No row-count check. If `p_product_id` does not exist the UPDATE is a
--   no-op (zero rows affected, no error). Share intent does not need to
--   validate product existence at the DB layer — the JS layer never
--   constructs a product_id that isn't already on screen.
--
-- Idempotent:    CREATE OR REPLACE FUNCTION + REVOKE / GRANT — re-running
--                this migration against an applied database is a no-op.
-- Transactional: wrapped in BEGIN / COMMIT.
-- Reversibility: see ROLLBACK SQL block immediately below.
-- Type regen:    OPTIONAL. The JS service helper at
--                src/features/marketplace/services/products.ts uses a typed
--                cast to invoke supabase.rpc('increment_share_count', ...)
--                without requiring the function to appear in
--                Database['public']['Functions']. Run `npm run gen:types`
--                after applying this migration to register the function for
--                IDE autocompletion and remove the cast.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert this migration)
-- -----------------------------------------------------------------------------
-- begin;
--   revoke execute on function public.increment_share_count(uuid)
--     from authenticated;
--   drop function if exists public.increment_share_count(uuid);
-- commit;
-- -----------------------------------------------------------------------------

begin;

create or replace function public.increment_share_count(
  p_product_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  update public.products
    set shares_count = coalesce(shares_count, 0) + 1
    where id = p_product_id;
end;
$$;

-- Lock down execution: revoke the implicit `public` grant, then grant only
-- to `authenticated`. The auth.uid() guard above is the second line of
-- defense if a future role is ever added to the EXECUTE list without an
-- auth context.
revoke all on function public.increment_share_count(uuid) from public;
grant execute on function public.increment_share_count(uuid) to authenticated;

commit;
