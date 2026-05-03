-- =============================================================================
-- Migration: 20260519_tighten_products_update_grants
-- Purpose:   Close the self-elevation gap surfaced in COMMENTS_AUDIT.md §2.
--            The `products update own` RLS policy
--            (20260507_owner_update.sql) authorizes any authenticated user
--            to UPDATE their own product row across every column. With the
--            broad table-level UPDATE grant in place, that means a seller
--            can self-set `comments_count`, `likes_count`, `shares_count`,
--            `bookmarks_count`, `created_at`, `seller_id`, and any other
--            system-managed column on their own listings via a normal
--            `from('products').update({...})` call from the JS client.
--
--            This migration narrows authenticated UPDATE access on
--            public.products to the user-controlled columns only via
--            column-level GRANT. The RLS policy is unchanged — it still
--            controls which row a user may touch; the column grant restricts
--            which columns the policy can be exercised against.
--
--            Mirrors B.1.5 (20260515_tighten_sellers_update_grants.sql)
--            mechanically. service_role bypasses grants by design, so any
--            server-side counter writes (likes/comments/follows triggers,
--            Stripe webhooks, admin scripts) keep working unchanged.
--
--            D.2 (next migration — comments schema + counter trigger) ships
--            a SECURITY DEFINER `handle_comment_change()` that writes to
--            `products.comments_count`. SECURITY DEFINER bypasses these
--            grants by running as the migration owner — same pattern as
--            C.2's `handle_follow_change()` writing to
--            `sellers.followers_count` / `sellers.following_count`.
--
-- Allowlist (kept writable for `authenticated`) — alphabetical:
--   attributes, category, category_id, currency, description, dimensions,
--   latitude, location, location_updated_at, longitude, media_type,
--   media_url, pickup_available, price, shipping_free, shipping_label,
--   stock_available, stock_label, subcategory_id, thumbnail_url, title
--
-- Disallowed (no longer writable by the JS client, only by service_role):
--   id, seller_id, created_at,
--   likes_count, comments_count, shares_count, bookmarks_count
--
-- Generated / not writable regardless of grant:
--   location_point  (geography(Point, 4326), generated always as ... stored
--                    per 20260513_geo_columns.sql:69-77)
--
-- Idempotent: REVOKE / GRANT statements are naturally idempotent for the
--             same target and column set.
-- Transactional: wrapped in BEGIN / COMMIT.
-- Reversibility: see ROLLBACK SQL block immediately below.
-- Type regen:    NOT REQUIRED. Column-level grants do not surface in the
--                generated `Database['public']['Tables']['products']` type.
--                Runtime impact: any UPDATE that includes a disallowed
--                column throws Postgres "permission denied for column X"
--                at query time — the desired security posture.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually if you need to restore the prior broad grant)
-- -----------------------------------------------------------------------------
-- begin;
--   revoke update on public.products from authenticated;
--   grant  update on public.products to   authenticated;
-- commit;
-- -----------------------------------------------------------------------------

begin;

-- Drop the table-wide UPDATE grant first so the column-level grant we add
-- next becomes the only path. (REVOKE is idempotent.)
revoke update on public.products from authenticated;

-- Re-grant UPDATE only on the user-controlled columns. Order is alphabetical
-- to keep diffs reviewable; verified against the only JS UPDATE call site
-- at src/features/marketplace/services/sell.ts:155-183 (updateProduct), whose
-- patch object touches only columns from this list.
grant update (
  attributes,
  category,
  category_id,
  currency,
  description,
  dimensions,
  latitude,
  location,
  location_updated_at,
  longitude,
  media_type,
  media_url,
  pickup_available,
  price,
  shipping_free,
  shipping_label,
  stock_available,
  stock_label,
  subcategory_id,
  thumbnail_url,
  title
) on public.products to authenticated;

commit;
