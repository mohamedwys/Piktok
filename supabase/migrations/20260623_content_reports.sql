-- =============================================================================
-- Migration: 20260623_content_reports
-- Purpose:   Phase 6 / Track A5 -- ship the user-generated-content reporting
--            pipeline required by App Store Review Guideline 1.2 ("Apps with
--            user-generated content must provide ... a method for filtering
--            objectionable material, a mechanism to report offensive content
--            and timely responses to concerns"). Without this, the next
--            production submission risks an automatic rejection.
--
--            This migration creates the COLLECTION half of the pipeline:
--              1. `public.content_reports` table -- immutable from the
--                 client; one row per submitted report.
--              2. RLS policies: reporter can INSERT + SELECT their own
--                 rows. No UPDATE / DELETE policy -- reports are
--                 tamper-evident from the user's seat.
--              3. `public.report_content(...)` SECURITY INVOKER RPC --
--                 thin wrapper that enforces the notes length bound +
--                 auth.uid() presence in one call.
--
--            The TRIAGE half (admin dashboard, status transitions,
--            notifications to reporter) is Phase 8 territory and runs
--            against this table via service_role from a privileged
--            admin UI. resolved_at / resolved_by / resolution columns
--            are reserved for that flow.
--
-- Schema choices:
--   target_type CHECK list      -- closed set: product | comment | message
--                                  | seller. Adding a new reportable type
--                                  is a future migration.
--   reason      CHECK list      -- closed set; aligned with industry-
--                                  standard report taxonomies (Meta /
--                                  Apple). 'other' allows free-form via
--                                  notes when the predefined buckets
--                                  don't fit.
--   notes       text, <= 500    -- soft cap enforced in the RPC. Useful
--                                  when reason = 'other'.
--   target_id   uuid            -- no FK because target_type discriminates
--                                  which table the id refers to. The
--                                  admin UI joins to the appropriate
--                                  table at triage time.
--   resolved_*  nullable        -- Phase 8 admin pipeline.
--
-- Index:
--   `content_reports_open_idx` -- partial BTREE on (created_at desc)
--   WHERE resolved_at is null. The admin queue's hot read is "newest
--   unresolved reports first"; the partial WHERE keeps the index tiny
--   (resolved rows drop out automatically).
--
-- Idempotent:    CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS
--                + DROP POLICY IF EXISTS pattern + CREATE OR REPLACE
--                FUNCTION.
-- Transactional: wrapped in begin / commit.
-- Reversibility: see ROLLBACK SQL block below.
-- Type regen:    REQUIRED. Adds `content_reports` to
--                `Database['public']['Tables']` and `report_content` to
--                `Database['public']['Functions']`. Run
--                `npm run gen:types` after applying; Phase 8 admin UI
--                consumes both.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert this migration)
-- -----------------------------------------------------------------------------
-- begin;
--   revoke execute on function public.report_content(text, uuid, text, text)
--     from authenticated;
--   drop function if exists public.report_content(text, uuid, text, text);
--   drop policy   if exists "content_reports insert own"  on public.content_reports;
--   drop policy   if exists "content_reports select own"  on public.content_reports;
--   drop index    if exists public.content_reports_open_idx;
--   drop table    if exists public.content_reports;
-- commit;
-- -----------------------------------------------------------------------------

begin;

-- -----------------------------------------------------------------------------
-- 1. content_reports table
-- -----------------------------------------------------------------------------
create table if not exists public.content_reports (
  id          uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('product','comment','message','seller')),
  target_id   uuid not null,
  reason      text not null check (reason in (
    'spam','inappropriate','harassment','scam','fake_listing','other'
  )),
  notes       text,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  resolution  text check (resolution in ('dismissed','action_taken') or resolution is null)
);

-- Admin-queue hot read: newest unresolved reports first. Partial index
-- so size scales with backlog, not catalog.
create index if not exists content_reports_open_idx
  on public.content_reports (created_at desc)
  where resolved_at is null;

-- -----------------------------------------------------------------------------
-- 2. RLS
-- -----------------------------------------------------------------------------
alter table public.content_reports enable row level security;

-- INSERT: any authenticated user, only as themselves.
drop policy if exists "content_reports insert own" on public.content_reports;
create policy "content_reports insert own" on public.content_reports
  for insert
  with check (auth.uid() is not null and reporter_id = auth.uid());

-- SELECT: reporters can re-read their own reports (status visibility for
-- a future "my reports" UI). Admin triage uses service_role and bypasses
-- RLS entirely.
drop policy if exists "content_reports select own" on public.content_reports;
create policy "content_reports select own" on public.content_reports
  for select
  using (reporter_id = auth.uid());

-- No UPDATE / DELETE policies -- intentional. The reporter cannot mutate
-- a submitted report; admin transitions resolved_* via service_role from
-- the Phase 8 dashboard.

-- -----------------------------------------------------------------------------
-- 3. report_content RPC
--    Thin wrapper around the INSERT so the client gets a single
--    documented entry point. SECURITY INVOKER so RLS still applies --
--    the reporter_id = auth.uid() WITH CHECK belt-and-suspenders with
--    the explicit insert.
-- -----------------------------------------------------------------------------
create or replace function public.report_content(
  p_target_type text,
  p_target_id   uuid,
  p_reason      text,
  p_notes       text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  if p_notes is not null and length(p_notes) > 500 then
    raise exception 'notes_too_long';
  end if;

  insert into public.content_reports (reporter_id, target_type, target_id, reason, notes)
  values (auth.uid(), p_target_type, p_target_id, p_reason, p_notes)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all   on function public.report_content(text, uuid, text, text) from public;
grant execute on function public.report_content(text, uuid, text, text) to authenticated;

commit;
