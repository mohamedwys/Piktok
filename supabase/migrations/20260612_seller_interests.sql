-- =============================================================================
-- Migration: 20260612_seller_interests
-- Purpose:   Phase 5 / Track A / Step A4 — capture each seller's chosen
--            interest categories (3-5 picked during onboarding, plus
--            "Edit interests" from the profile screen). The For-You feed
--            (A3, next migration) uses this list as a fallback signal when
--            the user has no view-history yet, and as a tie-breaker when
--            ranking trending content.
--
-- What this migration adds:
--   1. `public.sellers.interests` jsonb column, NOT NULL DEFAULT '[]'.
--      Empty array means "no preferences set" — the For-You algorithm
--      treats that as "fall back to global trending only".
--   2. CHECK constraint `sellers_interests_is_array` ensuring the column
--      always stores a jsonb array (defense-in-depth at the storage layer).
--   3. `public.set_my_interests(p_interests jsonb)` SECURITY DEFINER RPC.
--      Used by Step B7's onboarding screen + edit-interests path.
--
-- Why SECURITY DEFINER on set_my_interests:
--   B.1.5 (20260515_tighten_sellers_update_grants.sql) revoked the
--   table-wide UPDATE grant on `public.sellers` and re-granted column-level
--   UPDATE only on the user-controlled allowlist. `interests` is a NEW
--   column added by THIS migration and is NOT in that allowlist. For the
--   RPC to write the column, it MUST run as the migration owner — same
--   shape and same rationale as `feature_product` (20260524) and
--   `handle_follow_change` / `handle_comment_change` (C.2 / D.2).
--   `set search_path = public, pg_catalog` defeats the classic
--   SECURITY DEFINER hijack vector (shadow `public` objects in the
--   caller's own schema).
--
-- Validation contract (all "shape wrong" errors share 'invalid_interests'
-- as the sqlerrm so the client can pattern-match one substring; the HINT
-- differentiates for logs / postgres-error inspection):
--   - auth.uid() not null              → 'unauthenticated'
--   - p_interests jsonb_typeof='array' → 'invalid_interests' (hint: shape)
--   - length(p_interests) <= 10        → 'invalid_interests' (hint: bound)
--   - every element jsonb_typeof='string'
--                                       → 'invalid_interests' (hint: elem)
--   The UI caps at 5 selections; the server allows 10 as defense in depth
--   (cheap headroom against UI bugs; the For-You algorithm uses only the
--   first few entries anyway).
--
-- Seller-row bootstrap:
--   The onboarding flow MAY fire before the user has a seller row (the
--   register flow creates one eagerly, but an old account that pre-dates
--   that change might not). The RPC therefore calls
--   `public.get_or_create_seller_for_current_user('User', '')` first; that
--   helper short-circuits via its internal SELECT when a row already
--   exists, so the call is idempotent. Display-name 'User' is a placeholder
--   — profile settings can rename later.
--
-- CHECK constraint with NOT VALID:
--   The constraint enforces shape on new INSERT/UPDATE immediately. NOT
--   VALID skips the full-table validation scan — safe here because the
--   column's DEFAULT '[]'::jsonb makes every existing row trivially
--   conformant. Use `alter table ... validate constraint
--   sellers_interests_is_array` in a future cleanup migration if a
--   guaranteed-clean catalog state is needed.
--
-- Idempotent:    ADD COLUMN IF NOT EXISTS; DROP CONSTRAINT IF EXISTS then
--                ADD CONSTRAINT (so re-runs don't error on the existing
--                constraint); CREATE OR REPLACE FUNCTION + GRANT.
-- Transactional: wrapped in begin / commit.
-- Reversibility: see ROLLBACK SQL block below.
-- Type regen:    REQUIRED. `Database['public']['Tables']['sellers']['Row']`
--                gains `interests: Json`, and
--                `Database['public']['Functions']['set_my_interests']`
--                appears. Run `npm run gen:types` after applying; Step B7
--                consumes both.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert this migration)
-- -----------------------------------------------------------------------------
-- begin;
--   revoke execute on function public.set_my_interests(jsonb) from authenticated;
--   drop function if exists public.set_my_interests(jsonb);
--   alter table public.sellers
--     drop constraint if exists sellers_interests_is_array;
--   alter table public.sellers
--     drop column if exists interests;
-- commit;
-- -----------------------------------------------------------------------------

begin;

-- -----------------------------------------------------------------------------
-- 1. interests column
--    NOT NULL with DEFAULT '[]'::jsonb. PG 11+ records the default at the
--    catalog level so existing rows materialize the value without a table
--    rewrite — this is the safe "add a non-null column to a big table"
--    pattern.
-- -----------------------------------------------------------------------------
alter table public.sellers
  add column if not exists interests jsonb not null default '[]'::jsonb;

-- Storage-layer guard: the column must always be a jsonb array. Defense in
-- depth in case a future migration ever adds `interests` to the column-level
-- UPDATE allowlist on sellers and bypasses the RPC. NOT VALID because the
-- default '[]' guarantees every existing row passes — see header note.
alter table public.sellers
  drop constraint if exists sellers_interests_is_array;
alter table public.sellers
  add constraint sellers_interests_is_array
    check (jsonb_typeof(interests) = 'array')
    not valid;

-- -----------------------------------------------------------------------------
-- 2. set_my_interests RPC
-- -----------------------------------------------------------------------------
create or replace function public.set_my_interests(
  p_interests jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id      uuid;
  v_seller_id    uuid;
  v_len          int;
  v_has_non_text boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  -- Shape: must be a jsonb array (null counts as wrong shape).
  if p_interests is null or jsonb_typeof(p_interests) <> 'array' then
    raise exception 'invalid_interests' using hint = 'expected jsonb array';
  end if;

  -- Length cap: UI caps at 5; server allows 10 as defense.
  v_len := jsonb_array_length(p_interests);
  if v_len > 10 then
    raise exception 'invalid_interests' using hint = 'max 10 elements';
  end if;

  -- Every element must be a JSON string. An empty array trivially passes
  -- (jsonb_array_elements returns zero rows, bool_or returns null,
  -- coalesce maps it to false).
  select bool_or(jsonb_typeof(elem) <> 'string')
    into v_has_non_text
  from jsonb_array_elements(p_interests) elem;

  if coalesce(v_has_non_text, false) then
    raise exception 'invalid_interests'
      using hint = 'all elements must be strings';
  end if;

  -- Ensure a seller row exists. The helper is idempotent: when a row is
  -- already present its internal SELECT short-circuits and the supplied
  -- placeholder values are ignored. Calling through `public.` keeps the
  -- DEFINER search_path explicit.
  v_seller_id := public.get_or_create_seller_for_current_user('User', '');

  update public.sellers
     set interests = p_interests
   where id = v_seller_id;
end;
$$;

revoke all   on function public.set_my_interests(jsonb) from public;
grant execute on function public.set_my_interests(jsonb) to authenticated;

commit;
