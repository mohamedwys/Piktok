-- =============================================================================
-- Migration: 20260518_follows_schema_and_counters
-- Purpose:   Database foundation for following/followers (Phase C.2 per
--            FOLLOWING_AUDIT.md §9 / S1 — recommended). Adds:
--              1. `followers_count` and `following_count` integer columns on
--                 `public.sellers` (counter-only — never user-edited).
--              2. `public.follows` table with composite PK and CASCADE on both
--                 FKs to `public.sellers(id)`. CHECK guard against self-follow.
--              3. Supplementary BTREE index on `follows(following_id)` so the
--                 "who follows X" lookup is O(log n). The PK already indexes
--                 (follower_id, following_id) so "who am I following" is fast.
--              4. SECURITY DEFINER trigger function `handle_follow_change()`
--                 that maintains both counter columns on INSERT/DELETE with
--                 a `greatest(x - 1, 0)` clamp.
--              5. RLS: SELECT to `authenticated` (public-to-signed-in users —
--                 deviates from `likes` which is private-SELECT, because
--                 follower lists must be discoverable). INSERT/DELETE scoped
--                 to "your own seller row" via the `sellers.user_id` ↔
--                 `auth.uid()` mapping. No UPDATE policy — follow rows are
--                 immutable; toggling = INSERT/DELETE.
--              6. Table-level GRANT (SELECT, INSERT, DELETE) to `authenticated`.
--
-- Trigger SECURITY model — non-negotiable:
--   B.1.5 (20260515_tighten_sellers_update_grants.sql) revoked the table-wide
--   UPDATE grant on `sellers` and re-granted column-level UPDATE only on the
--   user-controlled allowlist:
--     name, avatar_url, bio, website, phone_public, email_public,
--     latitude, longitude, location_text, location_updated_at
--   `followers_count` / `following_count` are deliberately NOT added to that
--   allowlist. They must be maintained exclusively by the trigger below. For
--   the trigger to UPDATE columns the calling user has no grant on, the
--   function MUST be SECURITY DEFINER (runs as the migration owner) AND must
--   pin `search_path` to defeat the classic SECURITY DEFINER hijack vector
--   (a malicious user creating a `public.sellers` shadow function in their
--   own schema and tricking the trigger into resolving it).
--
-- Account deletion composition (B.4 / 20260517_delete_my_account_rpc.sql):
--   The cascade chain is now:
--     auth.users → sellers (CASCADE on user_id)
--                 → follows.follower_id  (CASCADE on follower_id)  -- new
--                 → follows.following_id (CASCADE on following_id) -- new
--   Both new CASCADE-direct paths are handled automatically. As the cascade
--   unwinds, the trigger's DELETE branch decrements counter columns on the
--   surviving sellers (e.g., user A deletes account → A's seller row goes →
--   each follow row pointing at A is removed → followers_count on each of
--   A's followers decrements). The B.4 RPC requires no edit to accommodate
--   this; the existing `delete from auth.users` line at line 98 of
--   20260517_delete_my_account_rpc.sql triggers the entire chain.
--
-- RLS — owner-scoped INSERT/DELETE walk-through:
--   `auth.uid()` returns an `auth.users.id`, not a `sellers.id`. The policy
--   translates via the `sellers.user_id` 1:1 mapping. Three scenarios that
--   the policies cover (proof-by-cases):
--     (a) User A (sellers.id = a, auth.uid = uA) inserts (a, b):
--           WITH CHECK subquery resolves a.user_id = uA → matches auth.uid().
--           Policy passes. Trigger increments sellers[b].followers_count and
--           sellers[a].following_count.
--     (b) User A tries to insert (b, c) where b is some other seller:
--           WITH CHECK subquery resolves b.user_id ≠ uA. Policy denies.
--           PostgREST returns 403; the row is never written; the trigger
--           never fires.
--     (c) User A deletes their own (a, b) row:
--           USING subquery resolves a.user_id = uA. Policy passes. Trigger's
--           DELETE branch decrements both counters with greatest(x - 1, 0)
--           clamp.
--
-- Idempotent:    ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS,
--                CREATE INDEX IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
--                DROP TRIGGER IF EXISTS + CREATE TRIGGER, DROP POLICY IF
--                EXISTS + CREATE POLICY. Re-running this migration is a
--                no-op against a database where it has already been applied.
-- Transactional: wrapped in BEGIN / COMMIT.
-- Reversibility: see ROLLBACK SQL block immediately below.
-- Type regen:    REQUIRED. This migration adds a new public-schema table
--                (`follows`) and two new columns on `sellers`. The generated
--                `Database['public']['Tables']['follows']` and the new keys
--                under `Database['public']['Tables']['sellers']['Row']`
--                (`followers_count`, `following_count`) appear only after
--                `npm run gen:types` runs against an environment where this
--                migration is applied. C.3 depends on the regenerated types.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert this migration)
-- -----------------------------------------------------------------------------
-- begin;
--   revoke select, insert, delete on public.follows from authenticated;
--   drop policy if exists "follows authenticated read" on public.follows;
--   drop policy if exists "follows self insert"        on public.follows;
--   drop policy if exists "follows self delete"        on public.follows;
--   drop trigger  if exists follows_change_trigger     on public.follows;
--   drop function if exists public.handle_follow_change();
--   drop index    if exists public.follows_following_id_idx;
--   drop table    if exists public.follows;
--   alter table   public.sellers drop column if exists followers_count;
--   alter table   public.sellers drop column if exists following_count;
-- commit;
-- -----------------------------------------------------------------------------

begin;

-- -----------------------------------------------------------------------------
-- 1. Counter columns on sellers.
--    NOT in the B.1.5 user-editable allowlist. Maintained exclusively by the
--    trigger function defined below. NOT NULL DEFAULT 0 means existing rows
--    backfill to zero, which is correct (no follow rows exist yet).
-- -----------------------------------------------------------------------------
alter table public.sellers
  add column if not exists followers_count integer not null default 0,
  add column if not exists following_count integer not null default 0;

-- -----------------------------------------------------------------------------
-- 2. follows table.
--    Composite PK doubles as the anti-duplicate constraint and the leading-
--    column index on follower_id. CASCADE on both FKs cleans up automatically
--    when a seller row is removed (which itself cascades from auth.users via
--    sellers.user_id; see B.4's delete_my_account RPC for the full chain).
--    The CHECK guards against self-follow at the DB layer; the JS client
--    should also gate this in UI but the DB is the source of truth.
-- -----------------------------------------------------------------------------
create table if not exists public.follows (
  follower_id  uuid not null
               references public.sellers(id) on delete cascade,
  following_id uuid not null
               references public.sellers(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self_follow
    check (follower_id <> following_id)
);

-- -----------------------------------------------------------------------------
-- 3. Supplementary index for "who follows X" queries.
--    The PK already indexes (follower_id, following_id), so any query
--    filtering by follower_id alone (or by both) hits the PK. The reverse
--    direction (filter by following_id alone) needs its own index.
-- -----------------------------------------------------------------------------
create index if not exists follows_following_id_idx
  on public.follows (following_id);

-- -----------------------------------------------------------------------------
-- 4. Counter-maintenance trigger function.
--    SECURITY DEFINER runs as the migration owner (typically `postgres`),
--    bypassing the column-level UPDATE grant on sellers from B.1.5 so the
--    trigger can write to columns that `authenticated` has no grant on.
--    SET search_path locks resolution to public + pg_catalog so a malicious
--    user cannot create a `public.sellers` shadow object in their own schema
--    and trick the trigger into resolving it. Mirrors the convention from
--    20260502_engagement_triggers.sql (on_like_change / on_bookmark_change),
--    with the addition of the explicit search_path SET (the older triggers
--    pre-date B.1.5 and rely on the default search_path; for a new trigger
--    landing post-B.1.5 we lock it down explicitly).
--
--    greatest(x - 1, 0) clamps the counter at zero in case a delete ever
--    races ahead of an insert (e.g., a service_role bulk operation that
--    bypasses the trigger), preventing negative counter drift.
-- -----------------------------------------------------------------------------
create or replace function public.handle_follow_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if (TG_OP = 'INSERT') then
    update public.sellers
      set followers_count = followers_count + 1
      where id = NEW.following_id;
    update public.sellers
      set following_count = following_count + 1
      where id = NEW.follower_id;
    return NEW;
  elsif (TG_OP = 'DELETE') then
    update public.sellers
      set followers_count = greatest(followers_count - 1, 0)
      where id = OLD.following_id;
    update public.sellers
      set following_count = greatest(following_count - 1, 0)
      where id = OLD.follower_id;
    return OLD;
  end if;
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Wire the trigger.
--    AFTER INSERT OR DELETE — fires only after the row mutation commits.
--    No UPDATE branch — follow rows are immutable; re-following is INSERT,
--    un-following is DELETE.
-- -----------------------------------------------------------------------------
drop trigger if exists follows_change_trigger on public.follows;
create trigger follows_change_trigger
  after insert or delete on public.follows
  for each row execute function public.handle_follow_change();

-- -----------------------------------------------------------------------------
-- 6. Row-Level Security.
--    SELECT is open to any authenticated user — follower lists must be
--    discoverable. Deliberately deviates from `likes` (which is private-
--    SELECT) for that reason. Anonymous (`anon`) users have no SELECT path
--    here because no GRANT to anon is added below; the policy itself is
--    moot for anon.
--
--    INSERT / DELETE are scoped to "the seller row owned by the calling
--    user". The `sellers.user_id IN (...)` subquery is single-row equality
--    and is trivially planner-cached; cost is negligible per mutation.
-- -----------------------------------------------------------------------------
alter table public.follows enable row level security;

drop policy if exists "follows authenticated read" on public.follows;
create policy "follows authenticated read"
  on public.follows
  for select
  to authenticated
  using (true);

drop policy if exists "follows self insert" on public.follows;
create policy "follows self insert"
  on public.follows
  for insert
  to authenticated
  with check (
    follower_id in (
      select id from public.sellers where user_id = auth.uid()
    )
  );

drop policy if exists "follows self delete" on public.follows;
create policy "follows self delete"
  on public.follows
  for delete
  to authenticated
  using (
    follower_id in (
      select id from public.sellers where user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 7. Table-level grants.
--    RLS gates which rows; grants gate which actions are even attempted.
--    Without this, the policies are unreachable from the JS client. No
--    GRANT to anon and no UPDATE to anyone (follow rows are immutable;
--    update is not a valid operation).
-- -----------------------------------------------------------------------------
grant select, insert, delete on public.follows to authenticated;

commit;
