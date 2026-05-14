-- =============================================================================
-- Migration: 20260710_seller_tos_acceptance
-- Purpose:   Phase 8 / Track C5 -- Terms of Service acceptance tracking.
--
--            Adds a nullable timestamptz to track Terms of Service
--            acceptance. Adds a SECURITY DEFINER RPC the client calls to
--            stamp acceptance after the user checks the EULA box on the
--            register screen (or on first sell as a fallback once the
--            email-confirmed user lands).
--
-- Semantics:
--   NULL = not accepted. Existing rows default NULL; the RPC writes
--   now() on first call and never overwrites a non-null value (so
--   re-acceptance after a TOS update is a separate concern handled by
--   an `accepted_version` extension in v2).
--
--   If the seller row does not exist yet (the user signed up but has
--   not created a listing -- our schema lazily materializes sellers on
--   first product or first marketplace action), the RPC inserts a row
--   with a sensible name fallback so the acceptance timestamp can land
--   immediately. Pulls `username` from auth.users.raw_user_meta_data
--   when present, defaults to 'User' otherwise.
--
-- Security:
--   SECURITY DEFINER + revoke public + grant execute to authenticated.
--   The function reads auth.uid() and writes only the calling user's
--   row (or inserts a new row keyed to auth.uid()), so privilege
--   escalation is not possible. Function explicitly raises on
--   unauthenticated callers.
--
-- Idempotent:    ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE FUNCTION.
-- Transactional: wrapped in begin / commit.
-- Reversibility: see ROLLBACK SQL block below.
-- Type regen:    REQUIRED. Adds `tos_accepted_at` column to sellers and a
--                new `set_my_tos_accepted` function entry. Run
--                `npm run gen:types`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert)
-- -----------------------------------------------------------------------------
-- begin;
--   revoke execute on function public.set_my_tos_accepted() from authenticated;
--   drop function if exists public.set_my_tos_accepted();
--   alter table public.sellers drop column if exists tos_accepted_at;
-- commit;
-- -----------------------------------------------------------------------------

begin;

-- =============================================================================
-- 1. tos_accepted_at column on sellers
-- =============================================================================
alter table public.sellers
  add column if not exists tos_accepted_at timestamptz;

-- =============================================================================
-- 2. set_my_tos_accepted RPC
--    SECURITY DEFINER -- writes the calling user's seller row only.
--    Never overwrites a non-null timestamp (COALESCE guard).
--    Creates the seller row if it does not exist yet so the timestamp
--    can land on accounts that have signed up but not yet listed.
-- =============================================================================
create or replace function public.set_my_tos_accepted()
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  update public.sellers
    set tos_accepted_at = coalesce(tos_accepted_at, now())
    where user_id = auth.uid();

  -- If the seller row doesn't exist yet (user signed up but hasn't
  -- created a listing), create it with default fields so the timestamp
  -- can land.
  if not found then
    insert into public.sellers (user_id, name, tos_accepted_at)
    values (
      auth.uid(),
      coalesce(
        (select raw_user_meta_data->>'username' from auth.users where id = auth.uid()),
        'User'
      ),
      now()
    );
  end if;
end;
$$;

revoke all   on function public.set_my_tos_accepted() from public;
grant execute on function public.set_my_tos_accepted() to authenticated;

commit;
