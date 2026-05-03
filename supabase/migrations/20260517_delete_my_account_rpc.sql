-- =============================================================================
-- Migration: 20260517_delete_my_account_rpc
-- Purpose:   Provide a SECURITY DEFINER RPC that lets the JS client delete the
--            currently signed-in user's account end-to-end. Required by Step
--            B.4 (Account section -> "Supprimer le compte") because Supabase
--            does not expose a client-callable `auth.deleteUser` for the
--            authenticated user themselves; only the service role may delete
--            from `auth.users`. SECURITY DEFINER lets us scope a narrow,
--            single-row delete down to the JS client safely.
--
-- Cascade map (verified against existing migrations):
--   * CASCADE direct from auth.users(id):
--       sellers.user_id, bookmarks.user_id, likes.user_id,
--       conversations.buyer_id, conversations.seller_user_id,
--       messages.sender_id, push_tokens.user_id, orders.buyer_id
--   * CASCADE transitive (via sellers / products / conversations):
--       products.seller_id, bookmarks.product_id, likes.product_id,
--       conversations.product_id, messages.conversation_id
--   * RESTRICT (would BLOCK the cascade chain — handled explicitly below):
--       orders.seller_id  -> sellers(id)
--       orders.product_id -> products(id)
--
--   The orders.seller_id RESTRICT will block `DELETE FROM auth.users` whenever
--   the user has any orders pointing at one of their seller rows (i.e. anyone
--   has ever bought from them). orders.product_id RESTRICT covers the same
--   row set because every order's product belongs to that order's seller.
--   We therefore pre-DELETE orders where seller_id IN (the user's seller
--   row(s)) to free the cascade chain.
--
--   This is a deliberate v1 trade-off: deleting the account also wipes the
--   user's sales history. A future privacy-friendly variant would anonymize
--   the seller row and keep paid-order audit data — flagged as a follow-up
--   in the changelog.
--
-- Security model:
--   * SECURITY DEFINER — the function runs with the migration owner's rights
--     so the JS client (which has no access to auth.users or to RESTRICTed
--     orders) can still execute the chain.
--   * SET search_path = pg_catalog, public, auth — pinned to defeat the classic
--     SECURITY DEFINER search-path hijack vector.
--   * EXECUTE granted only to `authenticated`; PUBLIC and `anon` cannot call.
--   * Body re-checks `auth.uid()`; an anonymous JWT with no user id (rare but
--     possible) raises 'unauthenticated' instead of falling through.
--
-- Idempotent:    CREATE OR REPLACE + DROP POLICY-style GRANTs are naturally
--                idempotent.
-- Transactional: wrapped in BEGIN / COMMIT.
-- Reversibility: see ROLLBACK SQL block immediately below.
-- Type regen:    This migration adds a new function to the public schema. The
--                generated `Database['public']['Functions']` will gain a
--                `delete_my_account` entry on next regen. No existing call
--                site references it, so the regen is a pure additive type
--                change. The B.4 client code calls it via
--                `supabase.rpc('delete_my_account')`, which is callable on
--                stale types via the `Functions` literal. Regen is OPTIONAL
--                but recommended for type-safe `.rpc()` autocomplete.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert this migration)
-- -----------------------------------------------------------------------------
-- begin;
--   revoke execute on function public.delete_my_account() from authenticated;
--   drop function if exists public.delete_my_account();
-- commit;
-- -----------------------------------------------------------------------------

begin;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  -- Free the orders.seller_id / orders.product_id RESTRICT chain.
  -- orders.buyer_id is CASCADE direct, so buyer-side rows are auto-handled
  -- by the auth.users delete below.
  delete from public.orders
   where seller_id in (
     select id from public.sellers where user_id = v_user_id
   );

  -- Trigger the cascade. This removes:
  --   * sellers (and via that, products, and via that, anything pointing
  --     at products with CASCADE)
  --   * bookmarks, likes, push_tokens, messages where the user is involved
  --   * conversations where the user is buyer or seller_user
  --   * orders where the user is buyer
  delete from auth.users where id = v_user_id;
end;
$$;

-- Lock down access. PUBLIC has EXECUTE on functions by default in Postgres;
-- revoke first, then grant to the only role that should be able to call this.
revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

commit;
