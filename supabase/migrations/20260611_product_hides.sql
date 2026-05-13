-- =============================================================================
-- Migration: 20260611_product_hides
-- Purpose:   Phase 5 / Track A / Step A2 — per-user "Not interested" surface.
--            Adds `public.product_hides` (user_id, product_id, reason,
--            created_at) and two RPCs (`hide_product`, `unhide_product`) so
--            the mobile client can mark a product hidden from its own feed.
--
-- How this integrates with the rest of Phase 5:
--   * `products_within_radius` (A1) is NOT modified — keeping its signature
--     stable. Marketplace hide-filtering is done client-side via the
--     optimistic cache eviction in Step B6. The marketplace feed is also
--     anon-accessible; there is no auth.uid() to filter on for those callers
--     so a server-side filter would be a no-op anyway.
--   * `feed_for_you` (A3, later migration) WILL join `product_hides`
--     server-side. The authenticated-only For-You feed is opinionated about
--     ranking and benefits from excluding hidden rows before scoring.
--   * Deliberately NO "list my hides" RPC — no client surface needs it. The
--     For-You feed already excludes hidden products. If a future "Manage
--     hidden" settings screen is added, surface it then.
--
-- RLS shape:
--   * Three self-scoped policies (select / insert / delete) keyed by
--     `user_id = auth.uid()`. No UPDATE policy — a hide row is immutable;
--     callers either have it or don't.
--   * Both RPCs are `SECURITY INVOKER`. The table's RLS does all the access
--     control; there is no privileged column to write that would need a
--     DEFINER body (contrast `feature_product` in 20260524 which writes to
--     `products.featured_until`, a column outside the user-allowlist).
--
-- Reason enum:
--   The `reason` column is nullable text, constrained to one of four free-
--   form strings: 'not_interested' (default for the mobile "Not interested"
--   tap), 'inappropriate', 'spam', 'other'. Future moderation workflows can
--   branch on `reason`; the v0 client wires only 'not_interested'.
--
-- Indexes:
--   * Primary key (user_id, product_id) is the natural lookup index for
--     "does the caller hide this product?".
--   * Secondary btree on (user_id, created_at DESC) for "list my recent
--     hides" / future server-side joins from the For-You feed. Cheap; the
--     hide row is small (3 indexed columns + a tag).
--
-- Idempotent:    create table if not exists, create index if not exists,
--                drop policy if exists / create policy, create or replace
--                function — re-runnable.
-- Transactional: wrapped in begin / commit.
-- Reversibility: see ROLLBACK SQL block below.
-- Type regen:    REQUIRED. New table `product_hides` Row/Insert/Update +
--                two new Function entries (`hide_product`, `unhide_product`)
--                appear in `Database['public']`. Run `npm run gen:types`
--                after applying; Step B6 will consume them.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert this migration)
-- -----------------------------------------------------------------------------
-- begin;
--   revoke execute on function public.unhide_product(uuid)       from authenticated;
--   revoke execute on function public.hide_product(uuid, text)   from authenticated;
--   drop function if exists public.unhide_product(uuid);
--   drop function if exists public.hide_product(uuid, text);
--   drop policy   if exists product_hides_delete_self on public.product_hides;
--   drop policy   if exists product_hides_insert_self on public.product_hides;
--   drop policy   if exists product_hides_select_self on public.product_hides;
--   drop index    if exists public.product_hides_user_created_idx;
--   drop table    if exists public.product_hides;
-- commit;
-- -----------------------------------------------------------------------------

begin;

-- -----------------------------------------------------------------------------
-- 1. Table
-- -----------------------------------------------------------------------------
create table if not exists public.product_hides (
  user_id    uuid        not null references auth.users(id)      on delete cascade,
  product_id uuid        not null references public.products(id) on delete cascade,
  reason     text,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id),
  constraint product_hides_reason_check
    check (reason is null
           or reason in ('not_interested','inappropriate','spam','other'))
);

create index if not exists product_hides_user_created_idx
  on public.product_hides (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 2. RLS
-- -----------------------------------------------------------------------------
alter table public.product_hides enable row level security;

drop policy if exists product_hides_select_self on public.product_hides;
create policy product_hides_select_self
  on public.product_hides for select to authenticated
  using (user_id = auth.uid());

drop policy if exists product_hides_insert_self on public.product_hides;
create policy product_hides_insert_self
  on public.product_hides for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists product_hides_delete_self on public.product_hides;
create policy product_hides_delete_self
  on public.product_hides for delete to authenticated
  using (user_id = auth.uid());

-- No UPDATE policy on purpose. See header rationale.

-- -----------------------------------------------------------------------------
-- 3. hide_product RPC
--    SECURITY INVOKER — INSERT runs under the caller's RLS. ON CONFLICT DO
--    NOTHING because the mobile client's optimistic update + retry-on-error
--    path can replay the mutation; we want re-hides to be silent no-ops.
-- -----------------------------------------------------------------------------
create or replace function public.hide_product(
  p_product_id uuid,
  p_reason     text default 'not_interested'
)
returns void
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  insert into public.product_hides (user_id, product_id, reason)
  values (v_user_id, p_product_id, p_reason)
  on conflict (user_id, product_id) do nothing;
end;
$$;

revoke all on function public.hide_product(uuid, text) from public;
grant execute on function public.hide_product(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. unhide_product RPC
--    SECURITY INVOKER — DELETE runs under the caller's RLS. Silent no-op
--    when the row is already absent (same idempotence contract as
--    hide_product).
-- -----------------------------------------------------------------------------
create or replace function public.unhide_product(
  p_product_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  delete from public.product_hides
   where user_id    = v_user_id
     and product_id = p_product_id;
end;
$$;

revoke all on function public.unhide_product(uuid) from public;
grant execute on function public.unhide_product(uuid) to authenticated;

commit;
