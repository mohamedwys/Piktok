-- =============================================================================
-- Migration: 20260730_admin_moderation
-- Purpose:   Phase 8 / Track E -- the TRIAGE half of the content-reports
--            pipeline. Phase 6 / Track A5 (20260623_content_reports.sql)
--            shipped the COLLECTION half: the `content_reports` table, RLS
--            for self-insert / self-select, and the thin `report_content`
--            RPC. The triage path was deferred ("Phase 8 territory and
--            runs against this table via service_role from a privileged
--            admin UI"). This migration ships it.
--
--            Two additions:
--              1. `public.sellers.suspended_at timestamptz` -- the soft-
--                 suspend marker applied when an admin resolves a report
--                 against a seller with the `suspend_seller` action.
--              2. `public.admin_resolve_report(uuid, text, text)` RPC --
--                 the single privileged entry point the web admin
--                 dashboard calls to (a) mark a report resolved AND
--                 (b) optionally apply a content side-effect in the same
--                 transaction.
--
-- Why suspended_at (timestamptz nullable) and not a `suspended` boolean:
--   A nullable timestamp is strictly more information than a boolean and
--   only one extra column-byte against the live row's overhead. Admins
--   can answer "when did this user get suspended?" without an additional
--   audit table -- enough for v1. NULL is the inert state; non-null is
--   "suspended at this moment". Reactivation is a manual UPDATE back to
--   NULL via SQL Editor (the dashboard doesn't expose un-suspend in v1).
--
-- Why SECURITY DEFINER on admin_resolve_report:
--   - `content_reports` deliberately has NO UPDATE policy
--     (20260623_content_reports.sql lines 120-122: "intentional. The
--     reporter cannot mutate a submitted report"). The whole table is
--     write-only from the user seat. Resolving a report therefore has
--     to run with elevated rights.
--   - The admin gate is the `sellers.is_admin` column added by
--     20260523_add_is_admin_to_sellers.sql. We read that flag at the
--     top of the function body and raise `not_admin` otherwise -- so
--     the privilege is gated by application logic, not by RLS.
--   - search_path is pinned to `public, pg_catalog` so a hostile
--     mutable-search-path session cannot redirect the table reads.
--
-- Atomicity / failure ordering:
--   The function updates `content_reports.resolved_at / resolved_by /
--   resolution` BEFORE applying the requested content side-effect
--   (delete_product / suspend_seller / delete_comment / delete_message).
--   Both statements run in the same implicit transaction, so a side-
--   effect failure rolls back the resolution update too -- the report
--   stays in the open queue and the admin can retry. If the side-effect
--   was already applied out-of-band (e.g., the product was deleted
--   manually before the admin clicked the button), the admin can resolve
--   the report with p_action = null and the function will just mark it
--   resolved without trying to re-delete a row that no longer exists.
--   The `already_resolved` guard prevents double-resolution races where
--   two admins click "resolve" on the same report simultaneously.
--
-- Action -> target_type compatibility matrix (enforced in the RPC):
--   delete_product   -> target_type = 'product'
--   suspend_seller   -> target_type = 'seller'
--   delete_comment   -> target_type = 'comment'
--   delete_message   -> target_type = 'message'
--   null             -> any target_type (resolution-only, no side-effect)
--   Any other combination raises `invalid_action_for_target` and the
--   transaction rolls back (so the resolution update is undone too).
--
-- Idempotent:    ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS
--                + CREATE OR REPLACE FUNCTION. Re-running this migration
--                is a no-op against a database where it has already been
--                applied.
-- Transactional: wrapped in begin / commit.
-- Reversibility: see ROLLBACK SQL block below.
-- Type regen:    REQUIRED on BOTH the mobile project AND the web
--                companion. The new column appears in
--                `Database['public']['Tables']['sellers']['Row']` and
--                the new function appears in
--                `Database['public']['Functions']`. Run
--                `npm run gen:types` from the repo root for mobile, and
--                `cd web && npm run gen:types && cd ..` for web.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert this migration)
-- -----------------------------------------------------------------------------
-- begin;
--   revoke execute on function public.admin_resolve_report(uuid, text, text)
--     from authenticated;
--   drop function if exists public.admin_resolve_report(uuid, text, text);
--   drop index    if exists public.sellers_suspended_idx;
--   alter table   public.sellers drop column if exists suspended_at;
-- commit;
--
-- After-rollback note:
--   Reverting this migration removes the suspend marker entirely. Any
--   sellers row that was suspended via the admin dashboard loses its
--   suspended_at value with no way to recover it. Snapshot the column
--   first if the suspension history matters.
-- -----------------------------------------------------------------------------

begin;

-- -----------------------------------------------------------------------------
-- 1. sellers.suspended_at
-- -----------------------------------------------------------------------------
alter table public.sellers
  add column if not exists suspended_at timestamptz;

-- Partial index: admin queue / reporting queries filter on "currently
-- suspended" which is a tiny subset of sellers. Partial WHERE keeps the
-- index size proportional to the suspension backlog, not the catalog.
create index if not exists sellers_suspended_idx
  on public.sellers (suspended_at)
  where suspended_at is not null;

-- -----------------------------------------------------------------------------
-- 2. admin_resolve_report RPC
--    SECURITY DEFINER -- see header for the rationale. The admin gate is
--    `sellers.is_admin` checked inside the function body.
-- -----------------------------------------------------------------------------
create or replace function public.admin_resolve_report(
  p_report_id  uuid,
  p_resolution text,
  p_action     text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_admin  boolean;
  v_report record;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  -- Admin gate. coalesce so a missing sellers row reads as "not admin"
  -- instead of NULL (which would short-circuit the `not v_admin` test
  -- below to UNKNOWN and skip the raise).
  select coalesce(is_admin, false) into v_admin
    from public.sellers
   where user_id = auth.uid();
  if not coalesce(v_admin, false) then
    raise exception 'not_admin';
  end if;

  -- Input validation: closed set of resolutions (mirrors the CHECK
  -- constraint on content_reports.resolution).
  if p_resolution not in ('dismissed', 'action_taken') then
    raise exception 'invalid_resolution';
  end if;

  -- Load the report. Lock it FOR UPDATE so two admins clicking resolve
  -- on the same row serialize -- the second one will see resolved_at
  -- non-null after the first commits and raise `already_resolved`.
  select * into v_report
    from public.content_reports
   where id = p_report_id
   for update;
  if v_report.id is null then
    raise exception 'report_not_found';
  end if;
  if v_report.resolved_at is not null then
    raise exception 'already_resolved';
  end if;

  -- Mark resolved. We do this BEFORE the side-effect so that if the
  -- side-effect raises (e.g., invalid_action_for_target), the whole
  -- transaction -- including this update -- rolls back and the admin
  -- sees a clean failure with the report still in the queue.
  update public.content_reports
     set resolved_at = now(),
         resolved_by = auth.uid(),
         resolution  = p_resolution
   where id = p_report_id;

  -- Side-effect: only fires when the admin chose "action_taken" AND
  -- supplied a non-null action. "dismissed" with an action is a UI bug;
  -- we ignore the action silently in that case (the resolution itself
  -- is still recorded).
  if p_action is not null and p_resolution = 'action_taken' then
    if p_action = 'delete_product'
       and v_report.target_type = 'product' then
      delete from public.products where id = v_report.target_id;
    elsif p_action = 'suspend_seller'
          and v_report.target_type = 'seller' then
      update public.sellers
         set suspended_at = now()
       where id = v_report.target_id;
    elsif p_action = 'delete_comment'
          and v_report.target_type = 'comment' then
      delete from public.comments where id = v_report.target_id;
    elsif p_action = 'delete_message'
          and v_report.target_type = 'message' then
      delete from public.messages where id = v_report.target_id;
    else
      raise exception 'invalid_action_for_target';
    end if;
  end if;
end;
$$;

revoke all   on function public.admin_resolve_report(uuid, text, text) from public;
grant execute on function public.admin_resolve_report(uuid, text, text) to authenticated;

commit;
