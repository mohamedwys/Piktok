-- =============================================================================
-- Migration: 20260613_feed_for_you
-- Purpose:   Phase 5 / Track A / Step A3 — the algorithmic For-You feed RPC.
--            Mixes four slices (follow / boost / trending / serendipity) at
--            a 40/30/20/10 weight, then deterministically interleaves them
--            into a single paged result.
--
-- Weight rationale (40/30/20/10):
--   - follow (40%) — strongest signal: the user explicitly subscribed to
--     these sellers. Drives retention because users want to see what their
--     follows are posting.
--   - boost (30%) — the Pro perk's monetisation surface. Featured listings
--     get prime placement alongside follow content. 30% is high enough to
--     make the perk valuable to Pro sellers but low enough that the feed
--     doesn't feel like an ad reel.
--   - trending (20%) — content in the user's top-3 viewed categories (or
--     stated interests as fallback). Steady-state discovery loop.
--   - serendipity (10%) — pure-random in radius. Prevents echo-chamber
--     lock-in and surfaces categories the user hasn't browsed yet.
--   These can be tuned later by adjusting the per-CTE LIMIT expressions;
--   the algorithm is structured so each slice is independent.
--
-- Security model — SECURITY DEFINER (deviation from Phase 5 spec):
--   The Phase 5 prompt called for SECURITY INVOKER, but that breaks at
--   runtime: 20260605_product_views.sql REVOKE ALL'd `public.product_views`
--   from `authenticated` and `anon` and enabled RLS with NO policies. The
--   table is reachable only by the service_role and by SECURITY DEFINER
--   RPCs that run as the migration owner. Since feed_for_you must JOIN
--   product_views to compute the top-3-categories signal, this function
--   MUST be DEFINER. Same shape and same rationale as
--   `get_product_analytics` (also in 20260605).
--
--   Safety properties that keep DEFINER tight here:
--     1. RAISE 'unauthenticated' when auth.uid() is null — anon callers
--        get no privileged access.
--     2. Every privileged read is self-scoped via auth.uid() or the
--        resolved v_caller_seller. There is NO "look at user X" parameter.
--     3. `set search_path = public, pg_catalog` defeats the classic
--        DEFINER hijack (shadow objects in caller's schema).
--     4. GRANT EXECUTE to `authenticated` only — anon cannot invoke at all.
--        Anon's For-You UX is handled client-side with a sign-in CTA
--        (B4's ForYouFeed screen).
--   Tables read by the function (all self-scoped):
--     - products            — global read, RLS already permits.
--     - sellers             — global read, RLS already permits.
--     - follows             — filtered to follower_id = v_caller_seller.
--     - product_views       — filtered to viewer_seller_id = v_caller_seller.
--     - product_hides       — filtered to user_id = auth.uid().
--
-- Cursor shape (jsonb, opaque to clients — pass back verbatim):
--   {
--     "f": <ISO timestamptz | null>,   // follow_slice    cursor (created_at)
--     "b": <ISO timestamptz | null>,   // boost_slice     cursor (featured_until)
--     "t": <ISO timestamptz | null>,   // trending_slice  cursor (created_at)
--     "s": null                         // reserved for future random-seed use
--   }
--   Each slice consumes only its own cursor field. A null field means "no
--   filter, take from the top of this slice". Clients must NOT parse the
--   contents — the JS service helper (B3) computes the next cursor from
--   the last row of each slice in the returned page.
--
-- Slice cursor predicates (DESC sort within each slice → row < cursor):
--   - follow:      p.created_at      < cur.f   (when cur.f is not null)
--   - boost:       p.featured_until  < cur.b   (when cur.b is not null)
--   - trending:    p.created_at      < cur.t   (when cur.t is not null)
--   - serendipity: NO cursor predicate (see v0 limitations below)
--
-- Known v0 limitations (deliberate — see Phase 5 spec):
--   1. Top-categories signal is a simple count over the last 30 days of
--      product_views, not a time-decayed weighted score.
--   2. Trending slice's cursor is keyed on created_at, not (likes_count,
--      created_at). Page boundaries may shuffle slightly across pages; id
--      uniqueness keeps the set well-defined. Strictly correct cursors for
--      trending are deferred.
--   3. Serendipity uses `order by random()` with no cursor field. Rows
--      may repeat across pages. Accepted because the serendipity slice is
--      10% of each page and the duplicate rate per session is low. The
--      alternative (TABLESAMPLE with a deterministic seed) is deferred.
--   4. Final interleaving is a fixed (row_number, slice_priority) ordering
--      — not truly random. Within each "ring" (row_number=k across slices),
--      boost rows surface first, then follow, then trending, then
--      serendipity. Stable / debuggable / monetisation-friendly.
--   5. When the caller has no seller row yet (rare — auth flow creates one
--      eagerly), the follow and trending slices return empty; boost and
--      serendipity still populate, so the feed degrades gracefully.
--
-- Output shape: same product columns as products_within_radius v2
-- (20260610) + distance_km + seller jsonb, PLUS:
--   slice text — 'follow' | 'boost' | 'trending' | 'serendipity'.
--   Surfaces in the client for telemetry and as a future UI affordance
--   hook (e.g., a "Featured" badge on the boost slice).
--
-- Idempotent:    CREATE OR REPLACE FUNCTION. First creation in this
--                migration; subsequent re-applies are no-ops.
-- Transactional: wrapped in begin / commit.
-- Reversibility: see ROLLBACK SQL block below.
-- Type regen:    REQUIRED. New `feed_for_you` Function entry appears in
--                `Database['public']`. Run `npm run gen:types` after
--                applying; Steps B3+B4 consume it.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert this migration)
-- -----------------------------------------------------------------------------
-- begin;
--   revoke execute on function public.feed_for_you(
--     double precision, double precision, double precision, jsonb, int
--   ) from authenticated;
--   drop function if exists public.feed_for_you(
--     double precision, double precision, double precision, jsonb, int
--   );
-- commit;
-- -----------------------------------------------------------------------------

begin;

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
  -- Per-slice budgets. greatest(_, 1) guards p_limit=0 / tiny p_limit.
  v_follow_limit   int := greatest(ceil(p_limit * 0.40)::int, 1);
  v_boost_limit    int := greatest(ceil(p_limit * 0.30)::int, 1);
  v_trending_limit int := greatest(ceil(p_limit * 0.20)::int, 1);
  v_serendip_limit int := greatest(ceil(p_limit * 0.10)::int, 1);
  -- Cursor extracts. NULL on the first page or when the cursor lacks the
  -- slice's field; predicates degrade to "no filter" in that case.
  v_cur_f          timestamptz;
  v_cur_b          timestamptz;
  v_cur_t          timestamptz;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  -- Resolve the caller's seller row. May be NULL (auth user without a
  -- seller row yet) — slices that need it degrade gracefully.
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
    -- -----------------------------------------------------------------
    -- Caller context shared across all four slices.
    -- -----------------------------------------------------------------
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
    -- Top-3 viewed categories in the last 30 days. Empty when the user
    -- has no view history yet; the interests fallback kicks in below.
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

    -- -----------------------------------------------------------------
    -- follow_slice (40%)
    -- -----------------------------------------------------------------
    follow_slice as (
      select sq.*, 'follow'::text as slice,
             row_number() over (order by sq.created_at desc, sq.id desc) as rn
        from (
          select p.*
            from public.products p
           where p.seller_id in (select seller_id from follow_targets)
             and (v_caller_seller is null or p.seller_id <> v_caller_seller)
             and not exists (select 1 from hidden h where h.product_id = p.id)
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

    -- -----------------------------------------------------------------
    -- boost_slice (30%)
    -- -----------------------------------------------------------------
    boost_slice as (
      select sq.*, 'boost'::text as slice,
             row_number() over (order by sq.featured_until desc, sq.id desc) as rn
        from (
          select p.*
            from public.products p
           where p.featured_until is not null
             and p.featured_until > v_now
             and (v_caller_seller is null or p.seller_id <> v_caller_seller)
             and not exists (select 1 from hidden h where h.product_id = p.id)
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

    -- -----------------------------------------------------------------
    -- trending_slice (20%)
    -- -----------------------------------------------------------------
    trending_slice as (
      select sq.*, 'trending'::text as slice,
             row_number() over (order by sq.likes_count desc nulls last,
                                          sq.created_at desc,
                                          sq.id desc) as rn
        from (
          select p.*
            from public.products p
           where p.category_id in (select category_id from effective_cats)
             and (v_caller_seller is null or p.seller_id <> v_caller_seller)
             and not exists (select 1 from hidden h where h.product_id = p.id)
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

    -- -----------------------------------------------------------------
    -- serendipity_slice (10%)
    -- v0: pure random, no cursor. Accepts cross-page duplicates per spec.
    -- The row_number is anchored on id so the interleave ranking has a
    -- stable per-row position once the random set has been materialised.
    -- -----------------------------------------------------------------
    serendipity_slice as (
      select sq.*, 'serendipity'::text as slice,
             row_number() over (order by sq.id) as rn
        from (
          select p.*
            from public.products p
           where (v_caller_seller is null or p.seller_id <> v_caller_seller)
             and not exists (select 1 from hidden h where h.product_id = p.id)
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

  -- Final projection + interleave.
  --   ORDER BY rn ASC interleaves slices: row 1 of every slice first
  --   (creates "ring 1"), then row 2 of every slice ("ring 2"), and so on.
  --   Within a ring, the slice-priority CASE puts boost first → follow →
  --   trending → serendipity. p_limit clips the result.
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

commit;
