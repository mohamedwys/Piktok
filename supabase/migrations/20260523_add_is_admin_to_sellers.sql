-- =============================================================================
-- Migration: 20260523_add_is_admin_to_sellers
-- Purpose:   Adds the `is_admin` boolean flag to `public.sellers` for the
--            Phase H.11 admin dashboard. The flag gates access to
--            `/admin/*` routes on the web codebase: the admin list page,
--            the subscription detail page, and the cancel / refund API
--            routes all check this column server-side via
--            `requireAdmin()` / `requireAdminApi()` helpers before
--            executing any privileged action.
--
--            v1 admin scope is subscription oversight only — list, view,
--            cancel, refund. No content moderation, listing removal, or
--            user-management features. The audit's PRO_AUDIT.md §10
--            open-question 15 defaulted to a separate `admins` table for
--            auditability; we land on a column on `sellers` instead for
--            v1 simplicity (one less join, one less RLS policy to
--            maintain). If multi-role admin (e.g., support vs ops vs
--            billing-only) becomes necessary, the upgrade path is to
--            either widen this to a role enum (`admin_role text`) or
--            introduce a separate `admins(user_id, role)` table — the
--            column add doesn't lock that decision in.
--
-- System-managed (B.1.5 lineage):
--   `is_admin` is NOT in the user-controlled column allowlist that
--   B.1.5 (20260515_tighten_sellers_update_grants.sql) re-granted to
--   `authenticated` (lines 53-64 of that file). The B.1.5 allowlist is
--   positive-list — only the columns explicitly listed are writable by
--   the authenticated role; everything else (including this new column)
--   stays system-managed by default. No grant changes needed in this
--   migration.
--
--   For v1 there is no UI to flip `is_admin`. Admins are designated
--   manually via Supabase SQL Editor:
--
--     update public.sellers
--        set is_admin = true
--      where user_id = '<auth_user_id>';
--
--   Look up the auth user id via:
--     select id, email from auth.users where email = '<admin@email>';
--
-- Index rationale:
--   The admin gate (`requireAdmin()`) reads `is_admin` once per request
--   on `/admin/*` routes — already covered by the existing seller-row
--   PK lookup (`sellers.user_id` is unique-indexed via the existing
--   schema). The new partial index `sellers_is_admin_idx WHERE
--   is_admin = true` is for the inverse query: "list all admins" — used
--   by future ops surfaces (audit log, "who can do what" debugging) and
--   for the H.11 admin dashboard if it ever needs to filter the seller
--   list to admin-only. Partial because the WHERE clause means the
--   index only stores the rows where the condition is true; for v1
--   that's a handful of rows total. Effectively free.
--
-- Idempotent:    ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS.
--                Re-running this migration is a no-op against a
--                database where it has already been applied.
-- Transactional: wrapped in BEGIN / COMMIT.
-- Reversibility: see ROLLBACK SQL block immediately below.
-- Type regen:    REQUIRED on mobile after apply (the column appears in
--                `Database['public']['Tables']['sellers']['Row']`).
--                Web-side gen:types not enforced yet (per H.10's local
--                SubRow note); web doesn't read `is_admin` from the
--                generated types — the admin auth helpers query
--                directly without strict typing.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert this migration)
-- -----------------------------------------------------------------------------
-- begin;
--   drop index if exists public.sellers_is_admin_idx;
--   alter table public.sellers drop column if exists is_admin;
-- commit;
--
-- After-rollback note:
--   Reverting this migration removes the column entirely. Any web-side
--   `is_admin` query will fail at runtime — revert H.11 source code in
--   lockstep (or before) to avoid a broken admin surface.
-- -----------------------------------------------------------------------------

begin;

-- 1. Add the flag.
--    NOT NULL DEFAULT false means existing rows backfill cleanly to
--    "not an admin" — the inert state. Granting admin is then an
--    explicit UPDATE per the SQL command in the header above.
alter table public.sellers
  add column if not exists is_admin boolean not null default false;

-- 2. Partial index for admin lookups.
--    `WHERE is_admin = true` keeps the index tiny — only rows where the
--    condition holds are stored. For a v1 admin count in single-digits,
--    this is effectively free.
create index if not exists sellers_is_admin_idx
  on public.sellers (is_admin)
  where is_admin = true;

commit;
