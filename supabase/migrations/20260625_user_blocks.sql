-- =============================================================================
-- Migration: 20260625_user_blocks
-- Purpose:   Phase 6 / Track A4 -- user-level blocking.
--
--            Adds the `public.user_blocks` table + RLS, two RPCs
--            (`block_user` / `unblock_user`), and SPLICES the block filter
--            into three existing RPCs so blocked-seller content disappears
--            from the marketplace and a blocked user cannot start a
--            conversation with the blocker.
--
-- RPCs being mutated (signatures + return tables PRESERVED VERBATIM --
-- only function bodies change):
--   1. public.start_or_get_conversation(p_product_id uuid) returns uuid
--      [from 20260509_messaging.sql]
--   2. public.feed_for_you(
--        p_lat        double precision,
--        p_lng        double precision,
--        p_radius_km  double precision,
--        p_cursor     jsonb,
--        p_limit      int
--      ) returns table (... 32 columns ..., slice text)
--      [from 20260613_feed_for_you.sql]
--   3. public.products_within_radius(
--        p_latitude       double precision,
--        p_longitude      double precision,
--        p_radius_km      double precision,
--        p_category_id    text,
--        p_subcategory_id text,
--        p_min_price      numeric,
--        p_max_price      numeric,
--        p_search_query   text,
--        p_pickup_only    boolean,
--        p_sort           text,
--        p_limit          int,
--        p_cursor         jsonb
--      ) returns table (... 32 columns ..., distance_km double precision, seller jsonb)
--      [from 20260610_products_within_radius_v2.sql]
--
-- Block semantics:
--   `user_blocks (blocker_id, blocked_id)` -- a directed edge. Blocks are
--   silent: the blocked user is NOT notified, and from THEIR seat the
--   blocker still appears normal (this is the industry-standard pattern,
--   cf. Twitter / Instagram). The downstream filters apply the block
--   bidirectionally on the BLOCKER's view: the blocker stops seeing the
--   blocked user's listings AND the blocked user stops being able to
--   message the blocker (since the conversation-start RPC checks BOTH
--   directions).
--
--   Why bidirectional in start_or_get_conversation specifically:
--     - If only "blocker blocked blocked_id" was checked, a blocked user
--       could still open a conversation with the blocker.
--     - If only "blocked_id blocked blocker" was checked, the blocker's
--       own block would be ignored when THEY tried to talk to the
--       blocked user.
--     - Checking both keeps the rule symmetric: a block edge in EITHER
--       direction shuts the conversation off.
--
--   Why one-direction in feed filters (blocker sees less, blocked sees same):
--     - The blocked user shouldn't realize they're blocked. They keep
--       seeing the blocker's catalog as normal. The block filter only
--       fires when the blocker is the caller (auth.uid() = blocker_id)
--       AND the listing's seller is the blocked user. The OR clause in
--       the predicate ALSO hides the blocked user's listings from a
--       second user who blocked the seller -- one-direction in spirit,
--       symmetric in form so the same predicate covers both ways the
--       caller might be on either side of a block.
--
-- RLS posture:
--   blocker_id (auth.uid()) controls ALL operations on their own rows.
--   blocked_id has NO read access to user_blocks -- blocks must remain
--   silent. Service_role bypasses RLS for admin auditing.
--
-- Idempotent:    CREATE TABLE / INDEX IF NOT EXISTS, DROP POLICY IF EXISTS
--                + CREATE POLICY, CREATE OR REPLACE FUNCTION.
-- Transactional: wrapped in begin / commit.
-- Reversibility: see ROLLBACK SQL block below. NOTE: the rollback DOES
--                NOT restore the un-filtered RPC bodies; if a true revert
--                is needed, re-apply the original migration files
--                (20260509 / 20260610 / 20260613) by hand after dropping
--                this one's objects.
-- Type regen:    REQUIRED. Adds `user_blocks` table + `block_user` /
--                `unblock_user` function entries. The three replaced
--                RPCs keep identical signatures so their type entries
--                are unchanged. Run `npm run gen:types`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert the user_blocks ADDITIONS)
-- -----------------------------------------------------------------------------
-- begin;
--   revoke execute on function public.block_user(uuid)   from authenticated;
--   revoke execute on function public.unblock_user(uuid) from authenticated;
--   drop function if exists public.block_user(uuid);
--   drop function if exists public.unblock_user(uuid);
--   drop policy   if exists "user_blocks select own" on public.user_blocks;
--   drop policy   if exists "user_blocks insert own" on public.user_blocks;
--   drop policy   if exists "user_blocks delete own" on public.user_blocks;
--   drop index    if exists public.user_blocks_blocker_idx;
--   drop index    if exists public.user_blocks_blocked_idx;
--   drop table    if exists public.user_blocks;
--   -- The block filters in the three RPCs are NOT reverted by this rollback.
--   -- To restore the pre-Phase-6 bodies, re-run 20260509, 20260610, 20260613
--   -- against the database after dropping the table above (the predicates
--   -- reference public.user_blocks; removing the table without restoring
--   -- the older bodies would leave the function in an unloadable state).
-- commit;
-- -----------------------------------------------------------------------------

begin;

-- =============================================================================
-- 1. user_blocks table
-- =============================================================================
create table if not exists public.user_blocks (
  blocker_id uuid        not null references auth.users(id) on delete cascade,
  blocked_id uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- Two single-column indexes. blocker_idx covers "what have I blocked?"
-- (settings UI + the block filter's "blocker_id = me" branch). blocked_idx
-- covers the "who blocked me?" branch of the bidirectional check used by
-- start_or_get_conversation.
create index if not exists user_blocks_blocker_idx on public.user_blocks (blocker_id);
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;

-- The blocker controls every operation on their own rows. The blocked
-- user gets nothing -- blocks must be silent.
drop policy if exists "user_blocks select own" on public.user_blocks;
create policy "user_blocks select own" on public.user_blocks
  for select using (blocker_id = auth.uid());

drop policy if exists "user_blocks insert own" on public.user_blocks;
create policy "user_blocks insert own" on public.user_blocks
  for insert with check (blocker_id = auth.uid());

drop policy if exists "user_blocks delete own" on public.user_blocks;
create policy "user_blocks delete own" on public.user_blocks
  for delete using (blocker_id = auth.uid());

-- =============================================================================
-- 2. block_user / unblock_user RPCs
--    SECURITY INVOKER -- the WITH CHECK / USING clauses on the RLS
--    policies above already restrict to the calling user's rows.
-- =============================================================================
create or replace function public.block_user(p_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot_block_self';
  end if;
  insert into public.user_blocks (blocker_id, blocked_id)
  values (auth.uid(), p_user_id)
  on conflict (blocker_id, blocked_id) do nothing;
end;
$$;

create or replace function public.unblock_user(p_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;
  delete from public.user_blocks
   where blocker_id = auth.uid()
     and blocked_id = p_user_id;
end;
$$;

revoke all   on function public.block_user(uuid)   from public;
revoke all   on function public.unblock_user(uuid) from public;
grant execute on function public.block_user(uuid)   to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;

-- =============================================================================
-- 3. start_or_get_conversation -- bidirectional block check.
--    Signature: (p_product_id uuid) returns uuid. UNCHANGED from
--    20260509_messaging.sql.
-- =============================================================================
create or replace function public.start_or_get_conversation(p_product_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_buyer_id uuid;
  v_seller_user_id uuid;
  v_conversation_id uuid;
begin
  v_buyer_id := auth.uid();
  if v_buyer_id is null then
    raise exception 'Not authenticated';
  end if;

  select s.user_id into v_seller_user_id
  from public.products p
  join public.sellers s on s.id = p.seller_id
  where p.id = p_product_id;

  if v_seller_user_id is null then
    raise exception 'Product or seller has no linked user account';
  end if;

  if v_seller_user_id = v_buyer_id then
    raise exception 'Cannot start a conversation with yourself';
  end if;

  -- Phase 6 / A4: bidirectional block check. If either party has blocked
  -- the other, the conversation cannot be opened. Raise BEFORE the
  -- existing-conversation lookup so a previously-opened conversation is
  -- still unreachable from the start endpoint once a block lands.
  if exists (
    select 1 from public.user_blocks
     where (blocker_id = v_buyer_id       and blocked_id = v_seller_user_id)
        or (blocker_id = v_seller_user_id and blocked_id = v_buyer_id)
  ) then
    raise exception 'user_blocked';
  end if;

  select id into v_conversation_id
  from public.conversations
  where product_id = p_product_id and buyer_id = v_buyer_id;

  if v_conversation_id is null then
    insert into public.conversations (product_id, buyer_id, seller_user_id)
    values (p_product_id, v_buyer_id, v_seller_user_id)
    returning id into v_conversation_id;
  end if;

  return v_conversation_id;
end;
$$;

grant execute on function public.start_or_get_conversation(uuid) to authenticated;

-- =============================================================================
-- 4. feed_for_you -- block filter spliced into all four slice CTEs.
--    Signature: (double precision, double precision, double precision,
--                jsonb, int) returns table (...32 cols..., slice text).
--    UNCHANGED from 20260613_feed_for_you.sql. Return-table identical.
--    Body change: each slice's inner SELECT joins public.sellers (so
--    `s.user_id` is in scope) and adds the bidirectional NOT EXISTS
--    filter. The outer projection at the end of the function still
--    LEFT JOIN sellers separately -- that join is for the marketing
--    payload, not the filter.
-- =============================================================================
create or replace function public.feed_for_you(
  p_lat        double precision default null,
  p_lng        double precision default null,
  p_radius_km  double precision default null,
  p_cursor     jsonb            default null,
  p_limit      int              default 30
)
returns table (
  id                  uuid,
  seller_id           uuid,
  title               jsonb,
  description         jsonb,
  category            jsonb,
  attributes          jsonb,
  dimensions          text,
  price               numeric,
  currency            text,
  media_type          text,
  media_url           text,
  thumbnail_url       text,
  stock_available     boolean,
  stock_label         jsonb,
  shipping_free       boolean,
  shipping_label      jsonb,
  likes_count         integer,
  comments_count      integer,
  shares_count        integer,
  bookmarks_count     integer,
  created_at          timestamptz,
  pickup_available    boolean,
  location            text,
  category_id         text,
  subcategory_id      text,
  latitude            double precision,
  longitude           double precision,
  location_updated_at timestamptz,
  location_point      geography(Point, 4326),
  featured_until      timestamptz,
  distance_km         double precision,
  seller              jsonb,
  slice               text
)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id        uuid;
  v_caller_seller  uuid;
  v_now            timestamptz := now();
  user_point       geography;
  v_follow_limit   int := greatest(ceil(p_limit * 0.40)::int, 1);
  v_boost_limit    int := greatest(ceil(p_limit * 0.30)::int, 1);
  v_trending_limit int := greatest(ceil(p_limit * 0.20)::int, 1);
  v_serendip_limit int := greatest(ceil(p_limit * 0.10)::int, 1);
  v_cur_f          timestamptz;
  v_cur_b          timestamptz;
  v_cur_t          timestamptz;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  select id into v_caller_seller
    from public.sellers
   where user_id = v_user_id
   limit 1;

  if p_lat is not null and p_lng is not null then
    user_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  end if;

  if p_cursor is not null then
    v_cur_f := nullif(p_cursor->>'f', '')::timestamptz;
    v_cur_b := nullif(p_cursor->>'b', '')::timestamptz;
    v_cur_t := nullif(p_cursor->>'t', '')::timestamptz;
  end if;

  return query
  with
    caller_interests as (
      select coalesce(
        (select s.interests
           from public.sellers s
          where s.id = v_caller_seller),
        '[]'::jsonb
      ) as interests
    ),
    hidden as (
      select product_id
        from public.product_hides
       where user_id = v_user_id
    ),
    follow_targets as (
      select following_id as seller_id
        from public.follows
       where follower_id = v_caller_seller
    ),
    top_cats_raw as (
      select p.category_id
        from public.product_views pv
        join public.products      p on p.id = pv.product_id
       where pv.viewer_seller_id = v_caller_seller
         and pv.viewed_at > v_now - interval '30 days'
         and p.category_id is not null
       group by p.category_id
       order by count(*) desc
       limit 3
    ),
    interests_cats as (
      select jsonb_array_elements_text(ci.interests) as category_id
        from caller_interests ci
       where not exists (select 1 from top_cats_raw)
    ),
    effective_cats as (
      select category_id from top_cats_raw
      union
      select category_id from interests_cats
    ),

    follow_slice as (
      select sq.*, 'follow'::text as slice,
             row_number() over (order by sq.created_at desc, sq.id desc) as rn
        from (
          select p.*
            from public.products p
            join public.sellers  s on s.id = p.seller_id
           where p.seller_id in (select seller_id from follow_targets)
             and (v_caller_seller is null or p.seller_id <> v_caller_seller)
             and not exists (select 1 from hidden h where h.product_id = p.id)
             and not exists (
               select 1 from public.user_blocks ub
                where (ub.blocker_id = v_user_id and ub.blocked_id = s.user_id)
                   or (ub.blocker_id = s.user_id   and ub.blocked_id = v_user_id)
             )
             and (
               user_point is null
               or p_radius_km is null
               or (p.location_point is not null
                   and ST_DWithin(p.location_point, user_point, p_radius_km * 1000.0))
             )
             and (v_cur_f is null or p.created_at < v_cur_f)
           order by p.created_at desc, p.id desc
           limit v_follow_limit
        ) sq
    ),

    boost_slice as (
      select sq.*, 'boost'::text as slice,
             row_number() over (order by sq.featured_until desc, sq.id desc) as rn
        from (
          select p.*
            from public.products p
            join public.sellers  s on s.id = p.seller_id
           where p.featured_until is not null
             and p.featured_until > v_now
             and (v_caller_seller is null or p.seller_id <> v_caller_seller)
             and not exists (select 1 from hidden h where h.product_id = p.id)
             and not exists (
               select 1 from public.user_blocks ub
                where (ub.blocker_id = v_user_id and ub.blocked_id = s.user_id)
                   or (ub.blocker_id = s.user_id   and ub.blocked_id = v_user_id)
             )
             and (
               user_point is null
               or p_radius_km is null
               or (p.location_point is not null
                   and ST_DWithin(p.location_point, user_point, p_radius_km * 1000.0))
             )
             and (v_cur_b is null or p.featured_until < v_cur_b)
           order by p.featured_until desc, p.id desc
           limit v_boost_limit
        ) sq
    ),

    trending_slice as (
      select sq.*, 'trending'::text as slice,
             row_number() over (order by sq.likes_count desc nulls last,
                                          sq.created_at desc,
                                          sq.id desc) as rn
        from (
          select p.*
            from public.products p
            join public.sellers  s on s.id = p.seller_id
           where p.category_id in (select category_id from effective_cats)
             and (v_caller_seller is null or p.seller_id <> v_caller_seller)
             and not exists (select 1 from hidden h where h.product_id = p.id)
             and not exists (
               select 1 from public.user_blocks ub
                where (ub.blocker_id = v_user_id and ub.blocked_id = s.user_id)
                   or (ub.blocker_id = s.user_id   and ub.blocked_id = v_user_id)
             )
             and (
               user_point is null
               or p_radius_km is null
               or (p.location_point is not null
                   and ST_DWithin(p.location_point, user_point, p_radius_km * 1000.0))
             )
             and (v_cur_t is null or p.created_at < v_cur_t)
           order by p.likes_count desc nulls last,
                    p.created_at desc,
                    p.id desc
           limit v_trending_limit
        ) sq
    ),

    serendipity_slice as (
      select sq.*, 'serendipity'::text as slice,
             row_number() over (order by sq.id) as rn
        from (
          select p.*
            from public.products p
            join public.sellers  s on s.id = p.seller_id
           where (v_caller_seller is null or p.seller_id <> v_caller_seller)
             and not exists (select 1 from hidden h where h.product_id = p.id)
             and not exists (
               select 1 from public.user_blocks ub
                where (ub.blocker_id = v_user_id and ub.blocked_id = s.user_id)
                   or (ub.blocker_id = s.user_id   and ub.blocked_id = v_user_id)
             )
             and (
               user_point is null
               or p_radius_km is null
               or (p.location_point is not null
                   and ST_DWithin(p.location_point, user_point, p_radius_km * 1000.0))
             )
           order by random()
           limit v_serendip_limit
        ) sq
    ),

    combined as (
      select * from follow_slice
      union all
      select * from boost_slice
      union all
      select * from trending_slice
      union all
      select * from serendipity_slice
    )

  select
    c.id,
    c.seller_id,
    c.title,
    c.description,
    c.category,
    c.attributes,
    c.dimensions,
    c.price,
    c.currency,
    c.media_type,
    c.media_url,
    c.thumbnail_url,
    c.stock_available,
    c.stock_label,
    c.shipping_free,
    c.shipping_label,
    c.likes_count,
    c.comments_count,
    c.shares_count,
    c.bookmarks_count,
    c.created_at,
    c.pickup_available,
    c.location,
    c.category_id,
    c.subcategory_id,
    c.latitude,
    c.longitude,
    c.location_updated_at,
    c.location_point,
    c.featured_until,
    case
      when user_point is not null and c.location_point is not null
        then ST_Distance(c.location_point, user_point) / 1000.0
      else null
    end as distance_km,
    case
      when s.id is not null then jsonb_build_object(
        'id',          s.id,
        'name',        s.name,
        'avatar_url',  s.avatar_url,
        'verified',    s.verified,
        'is_pro',      s.is_pro,
        'rating',      s.rating,
        'sales_count', s.sales_count
      )
      else null
    end as seller,
    c.slice
  from combined c
  left join public.sellers s on s.id = c.seller_id
  order by
    c.rn asc,
    case c.slice
      when 'boost'       then 0
      when 'follow'      then 1
      when 'trending'    then 2
      when 'serendipity' then 3
      else 4
    end asc
  limit greatest(p_limit, 0);
end;
$$;

revoke all   on function public.feed_for_you(
  double precision, double precision, double precision, jsonb, int
) from public;
grant execute on function public.feed_for_you(
  double precision, double precision, double precision, jsonb, int
) to authenticated;

-- =============================================================================
-- 5. products_within_radius v2 -- conditional block filter for anon callers.
--    Signature: (double precision, double precision, double precision, text,
--                text, numeric, numeric, text, boolean, text, int, jsonb)
--    returns table (...32 cols..., distance_km double precision, seller jsonb).
--    UNCHANGED from 20260610_products_within_radius_v2.sql.
--    Body change: the existing LEFT JOIN sellers `s` is already in scope;
--    the block filter is gated on `auth.uid() IS NULL OR NOT EXISTS (...)`
--    so anon callers (this RPC is anon-accessible) bypass the check.
-- =============================================================================
create or replace function public.products_within_radius(
  p_latitude       double precision default null,
  p_longitude      double precision default null,
  p_radius_km      double precision default null,
  p_category_id    text             default null,
  p_subcategory_id text             default null,
  p_min_price      numeric          default null,
  p_max_price      numeric          default null,
  p_search_query   text             default null,
  p_pickup_only    boolean          default null,
  p_sort           text             default 'distance',
  p_limit          int              default 50,
  p_cursor         jsonb            default null
)
returns table (
  id                  uuid,
  seller_id           uuid,
  title               jsonb,
  description         jsonb,
  category            jsonb,
  attributes          jsonb,
  dimensions          text,
  price               numeric,
  currency            text,
  media_type          text,
  media_url           text,
  thumbnail_url       text,
  stock_available     boolean,
  stock_label         jsonb,
  shipping_free       boolean,
  shipping_label      jsonb,
  likes_count         integer,
  comments_count      integer,
  shares_count        integer,
  bookmarks_count     integer,
  created_at          timestamptz,
  pickup_available    boolean,
  location            text,
  category_id         text,
  subcategory_id      text,
  latitude            double precision,
  longitude           double precision,
  location_updated_at timestamptz,
  location_point      geography(Point, 4326),
  featured_until      timestamptz,
  distance_km         double precision,
  seller              jsonb
)
language plpgsql
stable
security invoker
set search_path = public, pg_catalog
as $$
declare
  user_point  geography;
  search_term text;
  v_now       timestamptz := now();
  v_cur_featured_until timestamptz;
  v_cur_created_at     timestamptz;
  v_cur_id             uuid;
  v_cur_distance_km    double precision;
  v_cur_is_featured    boolean := false;
begin
  if p_latitude is not null and p_longitude is not null then
    user_point := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography;
  end if;

  if p_search_query is not null and length(trim(p_search_query)) > 0 then
    search_term := replace(replace(trim(p_search_query), '%', ''), '_', '');
    if length(search_term) = 0 then
      search_term := null;
    end if;
  end if;

  if p_cursor is not null then
    v_cur_featured_until := nullif(p_cursor->>'featured_until', '')::timestamptz;
    v_cur_created_at     := nullif(p_cursor->>'created_at',     '')::timestamptz;
    v_cur_id             := nullif(p_cursor->>'id',             '')::uuid;
    v_cur_distance_km    := nullif(p_cursor->>'distance_km',    '')::double precision;
    v_cur_is_featured    := v_cur_featured_until is not null
                             and v_cur_featured_until > v_now;
  end if;

  return query
  select
    p.id,
    p.seller_id,
    p.title,
    p.description,
    p.category,
    p.attributes,
    p.dimensions,
    p.price,
    p.currency,
    p.media_type,
    p.media_url,
    p.thumbnail_url,
    p.stock_available,
    p.stock_label,
    p.shipping_free,
    p.shipping_label,
    p.likes_count,
    p.comments_count,
    p.shares_count,
    p.bookmarks_count,
    p.created_at,
    p.pickup_available,
    p.location,
    p.category_id,
    p.subcategory_id,
    p.latitude,
    p.longitude,
    p.location_updated_at,
    p.location_point,
    p.featured_until,
    case
      when user_point is not null and p.location_point is not null
        then ST_Distance(p.location_point, user_point) / 1000.0
      else null
    end as distance_km,
    case
      when s.id is not null then jsonb_build_object(
        'id',          s.id,
        'name',        s.name,
        'avatar_url',  s.avatar_url,
        'verified',    s.verified,
        'is_pro',      s.is_pro,
        'rating',      s.rating,
        'sales_count', s.sales_count
      )
      else null
    end as seller
  from public.products p
  left join public.sellers s on s.id = p.seller_id
  where
    (p_category_id    is null or p.category_id    = p_category_id)
    and (p_subcategory_id is null or p.subcategory_id = p_subcategory_id)
    and (p_min_price is null or p.price >= p_min_price)
    and (p_max_price is null or p.price <= p_max_price)
    and (p_pickup_only is null or p_pickup_only = false or p.pickup_available = true)
    and (
      search_term is null
      or (p.title       ->> 'fr') ilike '%' || search_term || '%'
      or (p.title       ->> 'en') ilike '%' || search_term || '%'
      or (p.description ->> 'fr') ilike '%' || search_term || '%'
      or (p.description ->> 'en') ilike '%' || search_term || '%'
    )
    and (
      user_point is null
      or p_radius_km is null
      or (
        p.location_point is not null
        and ST_DWithin(p.location_point, user_point, p_radius_km * 1000.0)
      )
    )
    -- Phase 6 / A4: bidirectional block filter. Anon callers bypass
    -- (no auth.uid() means no blocks to apply).
    and (
      auth.uid() is null
      or not exists (
        select 1 from public.user_blocks ub
         where (ub.blocker_id = auth.uid() and ub.blocked_id = s.user_id)
            or (ub.blocker_id = s.user_id   and ub.blocked_id = auth.uid())
      )
    )
    and (
      p_cursor is null
      or (
        ((case when p.featured_until is not null and p.featured_until > v_now
               then 1 else 0 end)
          < (case when v_cur_is_featured then 1 else 0 end))
        or (
          ((case when p.featured_until is not null and p.featured_until > v_now
                 then 1 else 0 end)
            = (case when v_cur_is_featured then 1 else 0 end))
          and (
            (v_cur_featured_until is not null
              and (p.featured_until is null
                   or p.featured_until < v_cur_featured_until))
            or (
              ((p.featured_until is null and v_cur_featured_until is null)
                or (p.featured_until is not null
                    and v_cur_featured_until is not null
                    and p.featured_until = v_cur_featured_until))
              and (
                (p_sort = 'distance'
                  and user_point is not null
                  and v_cur_distance_km is not null
                  and (
                    (case
                       when p.location_point is not null
                         then ST_Distance(p.location_point, user_point) / 1000.0
                       else null
                     end) is null
                    or (case
                          when p.location_point is not null
                            then ST_Distance(p.location_point, user_point) / 1000.0
                          else null
                        end) > v_cur_distance_km
                  ))
                or (
                  (
                    p_sort <> 'distance'
                    or user_point is null
                    or v_cur_distance_km is null
                    or (case
                          when p.location_point is not null
                            then ST_Distance(p.location_point, user_point) / 1000.0
                          else null
                        end) = v_cur_distance_km
                  )
                  and (
                    p.created_at < v_cur_created_at
                    or (
                      p.created_at = v_cur_created_at and p.id < v_cur_id
                    )
                  )
                )
              )
            )
          )
        )
      )
    )
  order by
    (case when p.featured_until is not null and p.featured_until > v_now
          then 1 else 0 end) desc,
    p.featured_until desc nulls last,
    case when p_sort = 'distance' and user_point is not null and p.location_point is not null
         then ST_Distance(p.location_point, user_point) end asc nulls last,
    case when p_sort = 'price_asc'  then p.price       end asc  nulls last,
    case when p_sort = 'price_desc' then p.price       end desc nulls last,
    case when p_sort = 'most_liked' then p.likes_count end desc nulls last,
    p.created_at desc,
    p.id desc
  limit greatest(p_limit, 0);
end;
$$;

grant execute on function public.products_within_radius(
  double precision, double precision, double precision,
  text, text, numeric, numeric, text, boolean, text, int, jsonb
) to authenticated, anon;

commit;
