-- =============================================================================
-- Migration: 20260621_set_my_interests_length_cap
-- Purpose:   Phase 6 / Track A6 — close the per-element length gap in the
--            `public.set_my_interests` RPC introduced by
--            20260612_seller_interests.sql (Phase 5).
--
--            Pre-fix, the RPC validated the array shape, the element count
--            (<= 10), and the element type (must be jsonb string), BUT did
--            NOT cap the LENGTH of each string. An authenticated attacker
--            could store interests of arbitrary length -- up to ~256 MB per
--            jsonb value before postgres itself complains -- which lets them
--            (a) inflate seller-row size to degrade marketplace queries,
--            (b) burn database storage quota, and (c) pollute any UI that
--            renders interest strings (no XSS today thanks to React's text
--            escaping, but a denial-of-rendering hazard if a future view
--            naively truncates by character index).
--
--            This migration:
--              1. CREATE OR REPLACE the RPC with the same signature
--                 (single jsonb param, returns void).
--              2. Preserves the existing validations:
--                   - auth.uid() not null
--                   - jsonb_typeof(p_interests) = 'array'
--                   - length <= 10
--                   - every element jsonb_typeof = 'string'
--              3. Adds: every element's text length <= 64 chars. Violation
--                 raises 'invalid_interests' with hint 'element too long'.
--              4. Preserves SECURITY DEFINER, search_path hardening, and
--                 the get_or_create_seller_for_current_user fallback.
--
-- Sixty-four chars is a comfortable cap for human-readable category labels
-- ("vintage-clothing", "video-game-consoles", "luxury-watches") with
-- headroom for localized variants and emoji clusters. Anything longer is
-- almost certainly abuse.
--
-- Idempotent:    CREATE OR REPLACE FUNCTION. The grant block re-asserts the
--                lockdown shape (revoke all from public, grant to
--                authenticated) so re-running is a no-op.
-- Transactional: wrapped in begin / commit.
-- Reversibility: see ROLLBACK SQL block below -- restore the Phase 5 body
--                verbatim.
-- Type regen:    NOT required. The function signature is unchanged; only
--                the body changes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert this migration)
-- -----------------------------------------------------------------------------
-- begin;
--   create or replace function public.set_my_interests(
--     p_interests jsonb
--   )
--   returns void
--   language plpgsql
--   security definer
--   set search_path = public, pg_catalog
--   as $$
--   declare
--     v_user_id      uuid;
--     v_seller_id    uuid;
--     v_len          int;
--     v_has_non_text boolean;
--   begin
--     v_user_id := auth.uid();
--     if v_user_id is null then
--       raise exception 'unauthenticated';
--     end if;
--     if p_interests is null or jsonb_typeof(p_interests) <> 'array' then
--       raise exception 'invalid_interests' using hint = 'expected jsonb array';
--     end if;
--     v_len := jsonb_array_length(p_interests);
--     if v_len > 10 then
--       raise exception 'invalid_interests' using hint = 'max 10 elements';
--     end if;
--     select bool_or(jsonb_typeof(elem) <> 'string')
--       into v_has_non_text
--     from jsonb_array_elements(p_interests) elem;
--     if coalesce(v_has_non_text, false) then
--       raise exception 'invalid_interests'
--         using hint = 'all elements must be strings';
--     end if;
--     v_seller_id := public.get_or_create_seller_for_current_user('User', '');
--     update public.sellers
--        set interests = p_interests
--      where id = v_seller_id;
--   end;
--   $$;
-- commit;
-- -----------------------------------------------------------------------------

begin;

create or replace function public.set_my_interests(
  p_interests jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id        uuid;
  v_seller_id      uuid;
  v_len            int;
  v_has_non_text   boolean;
  v_has_too_long   boolean;
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

  -- Every element must be a JSON string. An empty array trivially passes.
  select bool_or(jsonb_typeof(elem) <> 'string')
    into v_has_non_text
  from jsonb_array_elements(p_interests) elem;

  if coalesce(v_has_non_text, false) then
    raise exception 'invalid_interests'
      using hint = 'all elements must be strings';
  end if;

  -- Phase 6 / A6: per-element length cap. char_length() on the
  -- jsonb-string value (extracted via jsonb_array_elements_text) counts
  -- characters, not bytes, so multi-byte UTF-8 sequences (accents, emoji)
  -- are billed fairly. Empty array short-circuits because
  -- jsonb_array_elements_text returns zero rows.
  select bool_or(char_length(elem) > 64)
    into v_has_too_long
  from jsonb_array_elements_text(p_interests) elem;

  if coalesce(v_has_too_long, false) then
    raise exception 'invalid_interests'
      using hint = 'element too long (max 64 chars)';
  end if;

  -- Ensure a seller row exists. Idempotent -- see Phase 5 header for
  -- rationale.
  v_seller_id := public.get_or_create_seller_for_current_user('User', '');

  update public.sellers
     set interests = p_interests
   where id = v_seller_id;
end;
$$;

revoke all   on function public.set_my_interests(jsonb) from public;
grant execute on function public.set_my_interests(jsonb) to authenticated;

commit;
