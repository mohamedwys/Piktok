-- =============================================================================
-- Migration: 20260624_rate_limits
-- Purpose:   Phase 6 / Track A3 -- per-user rate limiting on the hot
--            write paths. Audit finding S4: the API lets a single
--            authenticated user mass-create likes, bookmarks, comments,
--            messages, conversations, and listings with no server-side
--            throttle. A trivial script can saturate the database,
--            spam other users, or inflate engagement counters before
--            anyone notices.
--
--            This migration adds:
--              1. `public.rate_limits` -- minute-bucketed counter table,
--                 keyed by (user_id, bucket, window_start). One row per
--                 user per bucket per minute. RLS enabled but NO policies
--                 -- only SECURITY DEFINER functions can read/write.
--              2. `public.check_rate_limit(bucket, limit, window)` --
--                 SECURITY DEFINER. Atomically upserts the counter and
--                 raises 'rate_limit_exceeded' (sqlstate 42501) once the
--                 bucket overflows.
--              3. BEFORE INSERT triggers on likes / bookmarks / comments
--                 / messages / conversations / products. Each trigger
--                 calls check_rate_limit with a bucket-specific limit:
--                   - like:         60 / minute
--                   - bookmark:     60 / minute
--                   - comment:      20 / minute
--                   - message:      30 / minute
--                   - conversation: 10 / hour
--                   - listing:       5 / hour
--                 The like/bookmark caps are loose enough that a power
--                 user double-tapping a feed never trips them; the
--                 listing cap is tight because a real seller shouldn't
--                 list more than five products per hour.
--
-- Why BEFORE INSERT, not AFTER INSERT:
--   FOR EACH ROW BEFORE INSERT so the counter increments per row, and
--   the trigger runs INSIDE the same transaction as the INSERT. If the
--   subsequent RLS check rejects the row, the transaction rolls back
--   and the counter increment rolls back with it. Net effect: only
--   successful inserts count against the bucket. Failed attempts (RLS
--   denials, check constraint violations) don't penalize legitimate
--   retries.
--
-- Why minute-bucket primary key (not sliding window):
--   The (user_id, bucket, window_start) composite naturally ages out:
--   old minute buckets stop receiving writes the moment the next minute
--   ticks over. The hits counter for an old minute is frozen and never
--   read again. Periodic cleanup
--   (`delete from rate_limits where window_start < now() - interval
--    '1 day'`) can run as a scheduled job; not added in this migration
--   to keep scope tight. Follow-up.
--
-- Why no RLS policies on rate_limits:
--   The table is internal infrastructure -- users have no business
--   reading or writing it. SECURITY DEFINER functions are the only
--   entry point. Leaving RLS enabled with zero policies is the
--   recommended pattern for "definer-only" tables (defense in depth
--   against an accidental grant).
--
-- Idempotent:    CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
--                CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS +
--                CREATE TRIGGER.
-- Transactional: wrapped in begin / commit.
-- Reversibility: see ROLLBACK SQL block below.
-- Type regen:    NOT strictly required for client code (the table is
--                definer-only; the client never references it). But
--                `npm run gen:types` will pick up the new table + the
--                check_rate_limit function entry. Harmless either way.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert this migration)
-- -----------------------------------------------------------------------------
-- begin;
--   drop trigger if exists rate_limit_like_trg         on public.likes;
--   drop trigger if exists rate_limit_bookmark_trg     on public.bookmarks;
--   drop trigger if exists rate_limit_comment_trg      on public.comments;
--   drop trigger if exists rate_limit_message_trg      on public.messages;
--   drop trigger if exists rate_limit_conversation_trg on public.conversations;
--   drop trigger if exists rate_limit_listing_trg      on public.products;
--   drop function if exists public.rate_limit_like();
--   drop function if exists public.rate_limit_bookmark();
--   drop function if exists public.rate_limit_comment();
--   drop function if exists public.rate_limit_message();
--   drop function if exists public.rate_limit_conversation();
--   drop function if exists public.rate_limit_listing();
--   revoke execute on function public.check_rate_limit(text, int, interval)
--     from authenticated;
--   drop function if exists public.check_rate_limit(text, int, interval);
--   drop index    if exists public.rate_limits_cleanup_idx;
--   drop table    if exists public.rate_limits;
-- commit;
-- -----------------------------------------------------------------------------

begin;

-- -----------------------------------------------------------------------------
-- 1. rate_limits table
--    Composite PK so each (user, bucket, minute) hits a single row that
--    UPSERT can target.
-- -----------------------------------------------------------------------------
create table if not exists public.rate_limits (
  user_id      uuid        not null references auth.users(id) on delete cascade,
  bucket       text        not null,
  window_start timestamptz not null,
  hits         int         not null default 0,
  primary key (user_id, bucket, window_start)
);

-- Cleanup-side scan: a future scheduled DELETE walks oldest windows
-- first. Sparse BTREE on window_start makes that scan fast.
create index if not exists rate_limits_cleanup_idx
  on public.rate_limits (window_start);

-- Definer-only table. Enable RLS with zero policies -- DEFINER functions
-- bypass RLS, regular roles get nothing.
alter table public.rate_limits enable row level security;

-- -----------------------------------------------------------------------------
-- 2. check_rate_limit -- the atomic upsert + bound check.
--    p_window defaults to 1 minute; the per-hour buckets pass '1 hour'.
--    date_trunc snaps `now()` to the start of the window so concurrent
--    callers within the same window contend on the same row.
-- -----------------------------------------------------------------------------
create or replace function public.check_rate_limit(
  p_bucket text,
  p_limit  int,
  p_window interval default interval '1 minute'
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_window  timestamptz;
  v_hits    int;
begin
  -- Anon callers can't trip the limit (and won't have an auth.uid()
  -- to key on). Server-side RPCs invoked without a JWT skip likewise.
  if v_user_id is null then
    return;
  end if;

  -- Snap to the START of the window. For 1-minute buckets this is
  -- date_trunc('minute', now()); for 1-hour buckets it's
  -- date_trunc('hour', now()). The choice is driven by p_window so
  -- the two flavors share one code path.
  if p_window = interval '1 hour' then
    v_window := date_trunc('hour', now());
  else
    v_window := date_trunc('minute', now());
  end if;

  insert into public.rate_limits (user_id, bucket, window_start, hits)
  values (v_user_id, p_bucket, v_window, 1)
  on conflict (user_id, bucket, window_start)
    do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;

  if v_hits > p_limit then
    raise exception 'rate_limit_exceeded'
      using errcode = '42501',
            hint    = p_bucket;
  end if;
end;
$$;

revoke all   on function public.check_rate_limit(text, int, interval) from public;
grant execute on function public.check_rate_limit(text, int, interval)
  to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Per-table trigger wrappers + BEFORE INSERT triggers.
--    Each wrapper is a no-arg SECURITY DEFINER function that calls
--    check_rate_limit with the bucket-specific limit and window. Triggers
--    fire BEFORE the row insert so RLS denials don't double-count.
-- -----------------------------------------------------------------------------

-- like: 60 / minute
create or replace function public.rate_limit_like()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public.check_rate_limit('like', 60, interval '1 minute');
  return new;
end;
$$;
drop trigger if exists rate_limit_like_trg on public.likes;
create trigger rate_limit_like_trg
  before insert on public.likes
  for each row execute function public.rate_limit_like();

-- bookmark: 60 / minute
create or replace function public.rate_limit_bookmark()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public.check_rate_limit('bookmark', 60, interval '1 minute');
  return new;
end;
$$;
drop trigger if exists rate_limit_bookmark_trg on public.bookmarks;
create trigger rate_limit_bookmark_trg
  before insert on public.bookmarks
  for each row execute function public.rate_limit_bookmark();

-- comment: 20 / minute
create or replace function public.rate_limit_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public.check_rate_limit('comment', 20, interval '1 minute');
  return new;
end;
$$;
drop trigger if exists rate_limit_comment_trg on public.comments;
create trigger rate_limit_comment_trg
  before insert on public.comments
  for each row execute function public.rate_limit_comment();

-- message: 30 / minute
create or replace function public.rate_limit_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public.check_rate_limit('message', 30, interval '1 minute');
  return new;
end;
$$;
drop trigger if exists rate_limit_message_trg on public.messages;
create trigger rate_limit_message_trg
  before insert on public.messages
  for each row execute function public.rate_limit_message();

-- conversation: 10 / hour
create or replace function public.rate_limit_conversation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public.check_rate_limit('conversation', 10, interval '1 hour');
  return new;
end;
$$;
drop trigger if exists rate_limit_conversation_trg on public.conversations;
create trigger rate_limit_conversation_trg
  before insert on public.conversations
  for each row execute function public.rate_limit_conversation();

-- listing: 5 / hour
create or replace function public.rate_limit_listing()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public.check_rate_limit('listing', 5, interval '1 hour');
  return new;
end;
$$;
drop trigger if exists rate_limit_listing_trg on public.products;
create trigger rate_limit_listing_trg
  before insert on public.products
  for each row execute function public.rate_limit_listing();

commit;
