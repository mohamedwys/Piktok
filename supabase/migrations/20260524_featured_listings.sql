-- =============================================================================
-- Migration: 20260524_featured_listings
-- Purpose:   Phase H.12 — "Featured Listing Boost" Pro perk. A Pro seller may
--            feature ONE of their listings per 7-day window. Featured
--            listings render with a visible "À la une" badge and surface in
--            a dedicated discovery rail on the Categories page.
--
--            Adds:
--              1. `public.products.featured_until` (timestamptz, nullable) —
--                 the boost expiration. Anything where
--                 `featured_until > now()` is currently featured.
--              2. `public.sellers.last_boost_at` (timestamptz, nullable) —
--                 the START timestamp of the seller's most recent boost.
--                 Cooldown is computed FROM THIS TIMESTAMP (last_boost_at +
--                 7 days), NOT from `featured_until`. Boost duration and
--                 cooldown are both 7 days, so the next available boost is
--                 always the moment the previous boost expires.
--              3. `products_featured_until_idx` partial BTREE index — hot
--                 path is "list currently featured products newest-first";
--                 partial WHERE clause keeps the index small (only featured
--                 rows are indexed).
--              4. `public.feature_product(p_product_id uuid)` RPC —
--                 SECURITY DEFINER. Verifies Pro state + listing ownership
--                 + cooldown atomically, then sets `products.featured_until
--                 = now() + 7 days` and `sellers.last_boost_at = now()`.
--                 Returns a JSON payload with the new featured_until and the
--                 cooldown expiration so the JS layer can update its UI.
--
-- SECURITY DEFINER rationale (cite B.1.5 + C.2 + D.1.5 + E.2):
--   D.1.5 (20260519_tighten_products_update_grants.sql) revoked the
--   table-wide UPDATE grant on `public.products` and re-granted column-level
--   UPDATE only on the user-controlled allowlist. `featured_until` is a NEW
--   system-managed column and is NOT in that allowlist. Likewise B.1.5
--   (20260515_tighten_sellers_update_grants.sql) restricted UPDATE on
--   `public.sellers` to user-controlled columns; `last_boost_at` is NOT in
--   that allowlist either. For the boost RPC to write either column, it
--   MUST run as the migration owner — same shape and same justification as
--   E.2's `increment_share_count`, D.2's `handle_comment_change`, and C.2's
--   `handle_follow_change`. `set search_path = public, pg_catalog` defeats
--   the classic SECURITY DEFINER hijack vector (a malicious user planting
--   a `public.products` shadow object in their own schema).
--
-- Cooldown model — 7 days from boost START, not boost expiration:
--   Boost duration = 7 days. Cooldown = 7 days. So `last_boost_at +
--   cooldown == featured_until`. The seller's "next available boost"
--   timestamp is always the moment their current boost expires; there is
--   no dead time between boosts. The model is deliberately simple: a Pro
--   seller gets one perk per week, period. If product owners want to
--   re-boost mid-cycle they cannot — by design.
--
-- Pro gate (defense in depth):
--   The mobile UI hides / disables the Boost button for non-Pro sellers
--   (H.4 affordances + this step's BoostButton) and for sellers in
--   cooldown. The RPC re-checks both conditions independently. A
--   compromised mobile build that bypassed the UI gate would still hit
--   `RAISE EXCEPTION 'not_pro'` or `'cooldown_active'` from the function
--   body. Same belt-and-suspenders pattern as E.2.
--
-- Ownership check:
--   The RPC joins `sellers` ↔ `products` on `seller_id` and filters
--   `sellers.user_id = auth.uid()`. If the JOIN returns zero rows the
--   product either does not exist OR belongs to another user — the
--   function does not distinguish (RAISE EXCEPTION
--   'not_owner_or_product_missing') so we don't leak ownership info to
--   non-owners.
--
-- Idempotent:    ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
--                CREATE OR REPLACE FUNCTION + GRANT EXECUTE — re-running
--                this migration against an applied database is a no-op.
-- Transactional: wrapped in BEGIN / COMMIT.
-- Reversibility: see ROLLBACK SQL block immediately below.
-- Type regen:    REQUIRED. New columns on products + sellers, new
--                Function entry. Run `npm run gen:types` after applying
--                so `Database['public']['Tables']['products']['Row']`
--                gains `featured_until` and
--                `Database['public']['Functions']['feature_product']`
--                appears. The JS service helper at
--                src/features/marketplace/services/products.ts uses a
--                documented `as any` cast on the RPC return until then.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert this migration)
-- -----------------------------------------------------------------------------
-- begin;
--   revoke execute on function public.feature_product(uuid) from authenticated;
--   drop function if exists public.feature_product(uuid);
--   drop index    if exists public.products_featured_until_idx;
--   alter table   public.sellers  drop column if exists last_boost_at;
--   alter table   public.products drop column if exists featured_until;
-- commit;
-- -----------------------------------------------------------------------------

begin;

-- -----------------------------------------------------------------------------
-- 1. Featured-state columns.
--    Both nullable because the absence of a value is meaningful:
--      * products.featured_until IS NULL → never been featured (or rolled
--        back). Any non-null value in the past is also "not currently
--        featured" — the canonical liveness predicate is
--        `featured_until > now()`.
--      * sellers.last_boost_at  IS NULL → seller has never boosted. The
--        cooldown predicate
--        `now() < last_boost_at + interval '7 days'` short-circuits to
--        false on NULL, which is the correct behavior (no cooldown for a
--        seller who has not boosted yet).
-- -----------------------------------------------------------------------------
alter table public.products
  add column if not exists featured_until timestamptz;

alter table public.sellers
  add column if not exists last_boost_at timestamptz;

-- -----------------------------------------------------------------------------
-- 2. Partial BTREE index on featured_until.
--    Hot read path: "list all currently featured products, newest boost
--    first" — used by the Categories-page Featured rail. Ordering DESC on
--    featured_until naturally surfaces the most-recently boosted listings
--    first, which is the intended discovery experience.
--
--    Partial WHERE clause keeps the index sparse: only featured rows are
--    indexed. The vast majority of the catalog has featured_until IS NULL
--    and contributes nothing to index size. Same shape as the
--    `products_featured_until_idx` design rationale in earlier audit
--    notes.
-- -----------------------------------------------------------------------------
create index if not exists products_featured_until_idx
  on public.products (featured_until desc)
  where featured_until is not null;

-- -----------------------------------------------------------------------------
-- 3. feature_product RPC.
--    Verifies Pro + ownership + cooldown in a single atomic call, then
--    applies the boost. SECURITY DEFINER lets the function bypass the
--    column-level UPDATE allowlists from B.1.5 and D.1.5 (see header
--    rationale). RETURNS jsonb so the client can read both the new
--    featured_until and the next-available-boost timestamp in one round
--    trip — the latter feeds the BoostButton's cooldown countdown UI
--    without a second seller fetch.
-- -----------------------------------------------------------------------------
create or replace function public.feature_product(
  p_product_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id        uuid;
  v_seller_id      uuid;
  v_is_pro         boolean;
  v_last_boost     timestamptz;
  v_cooldown       interval := interval '7 days';
  v_duration       interval := interval '7 days';
  v_now            timestamptz := now();
  v_featured_until timestamptz;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  -- Ownership + Pro state in one query. Joining sellers ↔ products on
  -- seller_id and filtering sellers.user_id = auth.uid() is the
  -- canonical "is the calling user the owner of this product" pattern
  -- used elsewhere in this codebase (cf. comments RLS in D.2,
  -- delete-my-account in B.4).
  select s.id, s.is_pro, s.last_boost_at
    into v_seller_id, v_is_pro, v_last_boost
  from public.sellers s
  join public.products p on p.seller_id = s.id
  where p.id = p_product_id
    and s.user_id = v_user_id;

  if v_seller_id is null then
    raise exception 'not_owner_or_product_missing';
  end if;

  if not v_is_pro then
    raise exception 'not_pro';
  end if;

  -- Cooldown: 7 days from the LAST boost START, not from expiration.
  -- See header rationale.
  if v_last_boost is not null
     and v_now < v_last_boost + v_cooldown then
    raise exception 'cooldown_active: next available at %',
      v_last_boost + v_cooldown
      using hint = 'wait until cooldown expires';
  end if;

  v_featured_until := v_now + v_duration;

  update public.products
    set featured_until = v_featured_until
    where id = p_product_id;

  update public.sellers
    set last_boost_at = v_now
    where id = v_seller_id;

  return jsonb_build_object(
    'product_id',        p_product_id,
    'featured_until',    v_featured_until,
    'next_available_at', v_now + v_cooldown
  );
end;
$$;

-- Lock down execution: revoke the implicit `public` grant so anon cannot
-- call the function, then grant only to `authenticated`. The auth.uid()
-- guard above is the second line of defense.
revoke all on function public.feature_product(uuid) from public;
grant execute on function public.feature_product(uuid) to authenticated;

commit;
