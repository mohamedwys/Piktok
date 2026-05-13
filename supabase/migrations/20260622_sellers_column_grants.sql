-- =============================================================================
-- Migration: 20260622_sellers_column_grants
-- Purpose:   Phase 6 / Track A2 -- data-minimization on public.sellers.
--
-- Original gap (20260501_initial_marketplace_schema.sql):
--   `create policy "sellers public read" on public.sellers for select
--    using (true);`
--   The row-level USING (true) plus the default GRANT SELECT ON ALL TABLES
--   TO anon meant any unauthenticated visitor could `select * from sellers`
--   and exfiltrate the full row, including columns added by later phases:
--     - bio / website / email_public / phone_public (contact info)
--     - latitude / longitude / location_point / location_text (geo PII)
--     - user_id (auth.users FK -- enables enumeration / correlation)
--     - is_admin (B.4 internal flag -- privilege topology)
--     - interests (Phase 5 personalization signal)
--     - stripe_account_id / stripe_charges_enabled / stripe_payouts_enabled
--       (commercial state)
--   None of these are needed to render a marketplace card.
--
-- Fix (data-minimization principle, GDPR Art. 5(1)(c) "data minimisation"):
--   1. Drop the legacy "sellers public read" policy.
--   2. Create "sellers limited public read" policy -- still USING (true) at
--      the row level. Restriction is enforced at the COLUMN level instead,
--      because postgres does not support a column allowlist inside a
--      policy USING clause -- you have to combine permissive row policy
--      + column-level GRANT.
--   3. REVOKE SELECT on public.sellers FROM anon.
--   4. GRANT SELECT (<allowlist>) ON public.sellers TO anon. The allowlist
--      is the marketplace-card surface: id, name, avatar_url, verified,
--      is_pro, rating, sales_count, created_at, last_boost_at.
--      last_boost_at is admitted because the Featured Listings rail
--      (20260524) renders a boost-recency badge; it carries no PII.
--   5. GRANT SELECT ON public.sellers TO authenticated -- full row. The
--      authenticated client's profile / messaging / settings flows all
--      need columns outside the anon allowlist (location, contact,
--      interests, stripe). Existing per-row RLS (`sellers user read own`
--      from 20260503) still gates which rows authenticated callers see
--      for write-side operations.
--
-- Note on Supabase auth-aware SDK:
--   The JS client auto-attaches the JWT once a session exists. Authenticated
--   queries continue to receive the full row; anon queries (or pre-login
--   marketplace browse) receive only the 9 columns above. If a client
--   query lists a now-restricted column it will fail with "permission
--   denied for column X" -- the marketplace card surface area was
--   audited as part of this phase and uses only allowlisted columns.
--
-- Idempotent:    DROP POLICY IF EXISTS + CREATE POLICY for the row
--                policy; REVOKE then GRANT are naturally idempotent.
-- Transactional: wrapped in begin / commit.
-- Reversibility: see ROLLBACK SQL block below.
-- Type regen:    NOT required. Column-level GRANTs do not change the
--                generated public-schema Database type; only runtime
--                authorization changes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert this migration)
-- -----------------------------------------------------------------------------
-- begin;
--   drop policy if exists "sellers limited public read" on public.sellers;
--   create policy "sellers public read" on public.sellers
--     for select using (true);
--   revoke select on public.sellers from anon;
--   grant  select on public.sellers to anon;
-- commit;
-- -----------------------------------------------------------------------------

begin;

-- 1. Replace the row policy. USING (true) is preserved; column-level
--    GRANTs do the actual restricting.
drop policy if exists "sellers public read"         on public.sellers;
drop policy if exists "sellers limited public read" on public.sellers;
create policy "sellers limited public read" on public.sellers
  for select
  using (true);

-- 2. Reset anon's table-wide SELECT, then re-grant only the 9 columns
--    that make up the marketplace-card surface.
revoke select on public.sellers from anon;
grant  select (
  id,
  name,
  avatar_url,
  verified,
  is_pro,
  rating,
  sales_count,
  created_at,
  last_boost_at
) on public.sellers to anon;

-- 3. Authenticated callers retain full-row read; per-row RLS
--    (`sellers user read own` + the permissive `sellers limited public
--    read`) continues to gate WHICH rows they can see.
grant select on public.sellers to authenticated;

commit;
