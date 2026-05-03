-- =============================================================================
-- Migration: 20260520_comments_schema
-- Purpose:   Database foundation for product comments per S1 in
--            COMMENTS_AUDIT.md §10 (Phase D.2). Adds:
--              1. `public.comments` table — flat (no parent_id), hard-delete
--                 (no deleted_at), with body length CHECK (1..1000) and
--                 timestamps.
--              2. Composite index on (product_id, created_at DESC) — the
--                 only read pattern (paginated list of comments per product,
--                 newest- or oldest-first). Author-side index on author_id
--                 for "all comments by this user" lookups (D.3+ profile
--                 surfaces and account-deletion sweep).
--              3. SECURITY DEFINER trigger `handle_comment_change()` that
--                 maintains `products.comments_count` on INSERT/DELETE with
--                 a `greatest(x - 1, 0)` clamp. Mirrors C.2's
--                 `handle_follow_change()` ([20260518_follows_schema_and_counters.sql]
--                 lines 158-184) including the `set search_path = public,
--                 pg_catalog` hardening.
--              4. SECURITY INVOKER trigger `touch_comment_updated_at()` —
--                 BEFORE UPDATE OF body, fires only when body actually
--                 changes (`WHEN OLD.body IS DISTINCT FROM NEW.body`),
--                 sets NEW.updated_at = now(). The user holds UPDATE grant
--                 on `body` and `updated_at` (column-level grant below), so
--                 the trigger does not need DEFINER privileges.
--              5. RLS: SELECT to `authenticated` (`using (true)` — public-
--                 to-signed-in users; matches `follows`). INSERT/UPDATE/
--                 DELETE scoped to "your own seller row" via the
--                 `sellers.user_id` ↔ `auth.uid()` mapping.
--              6. Table-level GRANT (SELECT, INSERT, DELETE) to
--                 `authenticated`. Column-level GRANT UPDATE only on
--                 (body, updated_at). System-managed columns (id,
--                 product_id, author_id, created_at) are NOT user-writable
--                 on UPDATE — defense-in-depth pattern matching B.1.5 /
--                 D.1.5.
--              7. Realtime publication membership — `public.comments` is
--                 added to `supabase_realtime` so D.5's JS subscription is
--                 a pure client wiring task.
--
-- Counter-trigger SECURITY model — load-bearing post-D.1.5:
--   D.1.5 (20260519_tighten_products_update_grants.sql) revoked the table-
--   wide UPDATE grant on `products` and re-granted column-level UPDATE only
--   on the user-controlled allowlist. `comments_count` is deliberately NOT
--   in that allowlist. For this migration's trigger to UPDATE
--   `products.comments_count` on every comment INSERT/DELETE, the function
--   MUST be SECURITY DEFINER (runs as the migration owner) AND must pin
--   `search_path` to defeat the classic SECURITY DEFINER hijack vector
--   (a malicious user creating a `public.products` shadow function in
--   their own schema and tricking the trigger into resolving it). Same
--   pattern, same justification, as C.2's `handle_follow_change()`.
--
-- Account / product deletion composition:
--   * `comments.product_id REFERENCES public.products(id) ON DELETE CASCADE`
--     → deleting a listing wipes its comments. The trigger's DELETE branch
--     fires for each cascaded row and decrements `products.comments_count`
--     on the (already-deleting) product row, which is harmless — the row
--     is going away.
--   * `comments.author_id REFERENCES public.sellers(id) ON DELETE CASCADE`
--     → deleting a user's seller row (which itself cascades from
--     `auth.users` via `sellers.user_id` per B.4) wipes their comments.
--     The DELETE branch fires for each cascaded row and decrements the
--     comment's product's counter. The B.4 `delete_my_account` RPC
--     ([20260517_delete_my_account_rpc.sql]) needs no edit — the existing
--     `delete from auth.users` triggers the entire chain.
--
-- RLS — owner-scoped INSERT/UPDATE/DELETE walk-through (proof-by-cases):
--   `auth.uid()` returns an `auth.users.id`, not a `sellers.id`. The
--   policies translate via the `sellers.user_id` 1:1 mapping. Four
--   scenarios:
--     (a) User A (sellers.id = a, auth.uid = uA) inserts comment with
--         author_id = a, body = 'hello':
--           WITH CHECK subquery resolves a.user_id = uA → matches auth.uid.
--           Policy passes. Trigger increments
--           products[product_id].comments_count.
--     (b) User A tries to insert comment with author_id = b (someone
--         else's seller_id):
--           WITH CHECK subquery resolves b.user_id ≠ uA. Policy denies.
--           PostgREST returns 403; the row is never written; the trigger
--           never fires.
--     (c) User A updates body of own comment:
--           USING + WITH CHECK both resolve a.user_id = uA. Policy passes.
--           BEFORE UPDATE OF body trigger fires (WHEN body changes) and
--           sets updated_at = now(). Counter trigger does NOT fire (only
--           AFTER INSERT OR DELETE).
--     (d) User A tries to update created_at on own comment:
--           Column-level GRANT denies. Postgres returns
--           "permission denied for column created_at" — RLS never
--           evaluates because the grant check fires first.
--
-- Idempotent:    CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
--                CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS +
--                CREATE TRIGGER, DROP POLICY IF EXISTS + CREATE POLICY,
--                ALTER PUBLICATION ... ADD TABLE wrapped in a DO block
--                guarded by pg_publication_tables (this DDL has no
--                IF NOT EXISTS form on older Postgres versions). Re-running
--                this migration is a no-op against a database where it has
--                already been applied.
-- Transactional: wrapped in BEGIN / COMMIT.
-- Reversibility: see ROLLBACK SQL block immediately below.
-- Type regen:    REQUIRED. This migration adds a new public-schema table
--                (`comments`). The generated
--                `Database['public']['Tables']['comments']` keys appear
--                only after `npm run gen:types` runs against an
--                environment where this migration is applied. D.3 depends
--                on the regenerated types.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert this migration)
-- -----------------------------------------------------------------------------
-- begin;
--   alter publication supabase_realtime drop table public.comments;
--   drop trigger  if exists comments_touch_updated_at_trigger on public.comments;
--   drop function if exists public.touch_comment_updated_at();
--   drop trigger  if exists comments_change_trigger           on public.comments;
--   drop function if exists public.handle_comment_change();
--   drop policy   if exists "comments authenticated read"     on public.comments;
--   drop policy   if exists "comments self insert"            on public.comments;
--   drop policy   if exists "comments self update"            on public.comments;
--   drop policy   if exists "comments self delete"            on public.comments;
--   revoke update (body, updated_at) on public.comments from authenticated;
--   revoke select, insert, delete    on public.comments from authenticated;
--   drop index    if exists public.comments_author_id_idx;
--   drop index    if exists public.comments_product_id_created_at_idx;
--   drop table    if exists public.comments;
-- commit;
-- -----------------------------------------------------------------------------

begin;

-- -----------------------------------------------------------------------------
-- 1. comments table.
--    `uuid_generate_v4()` matches the existing convention across this
--    repo's migrations (sellers/products/conversations/messages/orders/
--    push_tokens all use it; uuid-ossp is enabled at
--    20260501_initial_marketplace_schema.sql:16). No need to enable
--    pgcrypto for gen_random_uuid().
--
--    `author_id` references `public.sellers(id)` (not `auth.users(id)`)
--    to match the C.2 follows convention: domain rows reference the
--    domain seller row, and account-deletion composes via the
--    sellers→auth.users cascade chain. The RLS subquery
--    `sellers.user_id = auth.uid()` then translates auth identity to
--    seller identity at policy evaluation time.
--
--    `updated_at` is nullable and unset on INSERT — a non-null value
--    indicates the comment has been edited. The BEFORE UPDATE trigger
--    populates it on body changes.
-- -----------------------------------------------------------------------------
create table if not exists public.comments (
  id          uuid        primary key default uuid_generate_v4(),
  product_id  uuid        not null
                          references public.products(id) on delete cascade,
  author_id   uuid        not null
                          references public.sellers(id)  on delete cascade,
  body        text        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz,
  constraint comments_body_length
    check (length(body) between 1 and 1000)
);

-- -----------------------------------------------------------------------------
-- 2. Indexes.
--    Composite (product_id, created_at desc) is the hot read path —
--    the comments-sheet query for a single product, ordered newest-first.
--    Author-side BTREE supports "comments by this user" lookups (profile
--    surfaces in D.3+ and the account-deletion CASCADE cleanup).
-- -----------------------------------------------------------------------------
create index if not exists comments_product_id_created_at_idx
  on public.comments (product_id, created_at desc);

create index if not exists comments_author_id_idx
  on public.comments (author_id);

-- -----------------------------------------------------------------------------
-- 3. Counter-maintenance trigger function.
--    SECURITY DEFINER runs as the migration owner (typically `postgres`),
--    bypassing the column-level UPDATE grant on products from D.1.5
--    (which deliberately excludes comments_count from the user-writable
--    allowlist). SET search_path locks resolution to public + pg_catalog
--    so a malicious user cannot create a `public.products` shadow object
--    in their own schema and trick the trigger into resolving it.
--    Mirrors C.2's `handle_follow_change()` exactly — same shape, same
--    clamp, same hardening.
--
--    greatest(x - 1, 0) clamps the counter at zero in case a delete ever
--    races ahead of an insert (e.g., a service_role bulk operation that
--    bypasses the trigger), preventing negative counter drift.
-- -----------------------------------------------------------------------------
create or replace function public.handle_comment_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if (TG_OP = 'INSERT') then
    update public.products
      set comments_count = comments_count + 1
      where id = NEW.product_id;
    return NEW;
  elsif (TG_OP = 'DELETE') then
    update public.products
      set comments_count = greatest(comments_count - 1, 0)
      where id = OLD.product_id;
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists comments_change_trigger on public.comments;
create trigger comments_change_trigger
  after insert or delete on public.comments
  for each row execute function public.handle_comment_change();

-- -----------------------------------------------------------------------------
-- 4. updated_at touch trigger.
--    BEFORE UPDATE OF body so the trigger only fires when an UPDATE
--    statement actually targets the body column (Postgres `BEFORE
--    UPDATE OF col` clause). The WHEN clause additionally guards
--    against no-op UPDATEs that re-set body to the same value.
--
--    SECURITY INVOKER (the default — no `security definer` clause)
--    is sufficient because the caller already has UPDATE grant on
--    `body` AND `updated_at` (column-level grant below), so the
--    trigger writing NEW.updated_at does not require elevated
--    privileges.
-- -----------------------------------------------------------------------------
create or replace function public.touch_comment_updated_at()
returns trigger
language plpgsql
as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists comments_touch_updated_at_trigger on public.comments;
create trigger comments_touch_updated_at_trigger
  before update of body on public.comments
  for each row
  when (OLD.body is distinct from NEW.body)
  execute function public.touch_comment_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Row-Level Security.
--    SELECT is open to any authenticated user — comments are part of
--    the public conversation on a listing and must be discoverable.
--    Anonymous (`anon`) users have no SELECT path here because no GRANT
--    to anon is added below; the policy itself is moot for anon.
--
--    INSERT / UPDATE / DELETE are scoped to "the seller row owned by
--    the calling user" via the `sellers.user_id IN (...)` subquery.
--    Single-row equality, planner-cached, negligible cost per mutation.
-- -----------------------------------------------------------------------------
alter table public.comments enable row level security;

drop policy if exists "comments authenticated read" on public.comments;
create policy "comments authenticated read"
  on public.comments
  for select
  to authenticated
  using (true);

drop policy if exists "comments self insert" on public.comments;
create policy "comments self insert"
  on public.comments
  for insert
  to authenticated
  with check (
    author_id in (
      select id from public.sellers where user_id = auth.uid()
    )
  );

drop policy if exists "comments self update" on public.comments;
create policy "comments self update"
  on public.comments
  for update
  to authenticated
  using (
    author_id in (
      select id from public.sellers where user_id = auth.uid()
    )
  )
  with check (
    author_id in (
      select id from public.sellers where user_id = auth.uid()
    )
  );

drop policy if exists "comments self delete" on public.comments;
create policy "comments self delete"
  on public.comments
  for delete
  to authenticated
  using (
    author_id in (
      select id from public.sellers where user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 6. Table-level + column-level grants.
--    SELECT/INSERT/DELETE are all-column actions. UPDATE is restricted
--    to (body, updated_at) — system-managed columns (id, product_id,
--    author_id, created_at) cannot be user-rewritten on edit. The
--    BEFORE UPDATE trigger needs `updated_at` in the grant because
--    its NEW.updated_at write is part of the resulting SQL UPDATE
--    (BEFORE triggers modify NEW; the storage manager then writes
--    every column whose value changed, which requires UPDATE grant
--    on each).
--
--    Defense-in-depth pattern matching D.1.5 — no anon, no UPDATE
--    on system columns regardless of RLS.
-- -----------------------------------------------------------------------------
grant select, insert, delete on public.comments to authenticated;
grant update (body, updated_at) on public.comments to authenticated;

-- -----------------------------------------------------------------------------
-- 7. Realtime publication membership.
--    Wrap in a DO block guarded by pg_publication_tables because
--    `ALTER PUBLICATION ... ADD TABLE` does NOT support `IF NOT
--    EXISTS` on Postgres versions ≤ 14, which would break re-runs.
--    The same safety guard would also no-op on 15+ where the syntax
--    is supported, so the DO block is forward-compatible.
--
--    Mirrors the precedent at 20260509_messaging.sql:133-134
--    (messages, conversations) — same publication name, same
--    `for all changes` default behavior (D.5 subscribes to INSERTs
--    via filter; the publication carries every event type).
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname    = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'comments'
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;
end
$$;

commit;
