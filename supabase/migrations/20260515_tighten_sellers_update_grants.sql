-- =============================================================================
-- Migration: 20260515_tighten_sellers_update_grants
-- Purpose:   Close the self-elevation gap surfaced in PROFILE_AUDIT.md §3.3.
--            The `sellers update own` RLS policy authorizes any authenticated
--            user to UPDATE their own row across every column. With the broad
--            table-level UPDATE grant in place, that means a user can self-set
--            `verified`, `is_pro`, `rating`, `sales_count`, and `stripe_*`.
--
--            This migration narrows authenticated UPDATE access on
--            public.sellers to the user-controlled columns only via
--            column-level GRANT. The RLS policy is unchanged — it still
--            controls which row a user may touch; the column grant restricts
--            which columns the policy can be exercised against.
--
--            service_role bypasses grants by design, so Stripe webhooks and
--            admin paths (which write `verified`, `is_pro`, `stripe_*`,
--            `rating`, `sales_count`) keep working unchanged.
--
-- Allowlist (kept writable for `authenticated`):
--   name, avatar_url, bio, website, phone_public, email_public,
--   latitude, longitude, location_text, location_updated_at
--
-- Disallowed (no longer writable by the JS client, only by service_role):
--   id, user_id, created_at, verified, is_pro, rating, sales_count,
--   stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled
--
-- Generated / not writable regardless of grant:
--   location_point  (geography(Point, 4326), generated always as ... stored)
--
-- Idempotent: REVOKE / GRANT statements are naturally idempotent for the
--             same target and column set.
-- Transactional: wrapped in BEGIN / COMMIT.
-- Reversibility: see ROLLBACK SQL block immediately below.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually if you need to restore the prior broad grant)
-- -----------------------------------------------------------------------------
-- begin;
--   revoke update on public.sellers from authenticated;
--   grant  update on public.sellers to   authenticated;
-- commit;
-- -----------------------------------------------------------------------------

begin;

-- Drop the table-wide UPDATE grant first so the column-level grant we add
-- next becomes the only path. (REVOKE is idempotent.)
revoke update on public.sellers from authenticated;

-- Re-grant UPDATE only on the user-controlled columns. Order mirrors the
-- categorization in the migration header for review-time clarity.
grant update (
  name,
  avatar_url,
  bio,
  website,
  phone_public,
  email_public,
  latitude,
  longitude,
  location_text,
  location_updated_at
) on public.sellers to authenticated;

commit;
