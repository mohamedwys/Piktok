-- =============================================================================
-- Migration: 20260820_seller_stripe_connect_columns
-- Purpose:   Track F.C.1 -- activate the dormant Stripe Connect columns on
--            public.sellers by adding the three remaining state mirrors needed
--            by Express onboarding and destination-charge marketplace
--            settlement. Together with the existing 20260511 columns
--            (stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled)
--            these are the full set of Connect account properties the platform
--            persists per seller.
--
--            Adds:
--              1. `public.sellers.stripe_country` (text, nullable) -- the
--                 ISO-3166-1 alpha-2 country code the Express account was
--                 created under. Needed at account creation time (Stripe
--                 requires it on accounts.create) and surfaced read-only on
--                 the payouts dashboard once onboarding completes. Nullable
--                 because pre-Connect sellers and freshly-created rows have
--                 no account yet.
--              2. `public.sellers.stripe_details_submitted` (boolean,
--                 not null default false) -- mirrors `Account.details_submitted`
--                 from Stripe. DISTINCT from `stripe_charges_enabled`:
--                   * details_submitted true / charges_enabled false:
--                     onboarding form completed but Stripe is still
--                     verifying KYC / risk -- show "verification pending"
--                     state.
--                   * details_submitted false / charges_enabled false:
--                     seller has not finished onboarding -- show
--                     "Resume onboarding" CTA.
--                   * details_submitted true / charges_enabled true:
--                     fully active -- show payout dashboard.
--                 Default false matches the never-onboarded shape.
--              3. `public.sellers.stripe_onboarded_at` (timestamptz, nullable)
--                 -- first-time-completed telemetry. Set once, when
--                 `details_submitted` transitions from false to true. Used
--                 for funnel analysis and not re-set on re-onboarding.
--
-- Write authorization (defense in depth):
--   20260515 (tighten_sellers_update_grants) revoked the broad UPDATE grant
--   on public.sellers and re-granted UPDATE on a USER-CONTROLLED column
--   allowlist (name, avatar_url, bio, website, phone_public, email_public,
--   latitude, longitude, location_text, location_updated_at). The three new
--   columns here are NOT in that allowlist and therefore inherit the
--   service_role-only write posture by default -- `authenticated` and `anon`
--   cannot UPDATE them through PostgREST. The Stripe webhook
--   (stripe-webhook edge function) and the create-account-link edge function
--   both use service_role and write these columns directly. No REVOKE
--   statement is required because the new columns were never granted in
--   the first place.
--
-- Read authorization:
--   20260622 (sellers_column_grants) granted full-row SELECT to
--   `authenticated` and a narrow 9-column SELECT to `anon`. The three new
--   columns are NOT in the anon allowlist; they are commercial state that
--   has no place on a marketplace card. `authenticated` retains full-row
--   read (gated per-row by the existing "sellers user read own" /
--   "sellers limited public read" policies), which lets the seller's own
--   Pro dashboard show their onboarding status.
--
-- RLS policy changes:    NONE. The existing row policies apply unchanged.
-- Idempotent:    ADD COLUMN IF NOT EXISTS for each -- re-running this
--                migration against an applied database is a no-op.
-- Transactional: wrapped in BEGIN / COMMIT.
-- Reversibility: see ROLLBACK SQL block immediately below.
-- Type regen:    REQUIRED. New columns land on
--                `Database['public']['Tables']['sellers']['Row']`. Run
--                `npm run gen:types` from the repo root after applying so
--                the mobile and edge function code can reference the
--                fields without `as any` casts. Web has no committed types
--                file (it imports from the mobile-side generated file
--                via a path alias), so a single gen:types run covers both
--                surfaces.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert this migration)
-- -----------------------------------------------------------------------------
-- begin;
--   alter table public.sellers drop column if exists stripe_onboarded_at;
--   alter table public.sellers drop column if exists stripe_details_submitted;
--   alter table public.sellers drop column if exists stripe_country;
-- commit;
-- -----------------------------------------------------------------------------

begin;

alter table public.sellers
  add column if not exists stripe_country text,
  add column if not exists stripe_details_submitted boolean not null default false,
  add column if not exists stripe_onboarded_at timestamptz;

commit;
