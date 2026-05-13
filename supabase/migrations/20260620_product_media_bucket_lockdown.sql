-- =============================================================================
-- Migration: 20260620_product_media_bucket_lockdown
-- Purpose:   Phase 6 / Track A1 — close the product-media storage gap. The
--            original bucket setup in 20260503_sell_setup.sql provisioned
--            `product-media` as public-read with a single INSERT policy that
--            only checked `auth.role() = 'authenticated'`. Pre-fix, any
--            authenticated user could upload to any other user's folder and
--            upload any file type at any size — a CVE-class lapse that lets
--            attackers (a) overwrite or pollute peer namespaces, (b) burn
--            project storage quota with arbitrarily large payloads, and
--            (c) host arbitrary content (HTML, executables, ...) on a domain
--            associated with the marketplace.
--
--            This migration:
--              1. Updates `storage.buckets` for `product-media` to enforce a
--                 100 MiB file-size cap and an explicit MIME allowlist
--                 (JPEG / PNG / WebP + MP4 / QuickTime / WebM). The cap is
--                 generous because the bucket holds product VIDEOS in
--                 addition to images; client-side compression keeps real
--                 uploads well under it.
--              2. Drops the legacy "product-media authenticated upload"
--                 policy.
--              3. Adds per-user-folder INSERT / UPDATE / DELETE policies that
--                 require `auth.uid()::text = (storage.foldername(name))[1]`.
--                 The client already writes to `<auth.uid()>/<timestamp>.<ext>`
--                 (see src/features/marketplace/services/sell.ts), so this is
--                 a zero-impact tightening for the happy path.
--              4. Leaves "product-media public read" untouched — product
--                 media is intentionally world-readable so unauthenticated
--                 visitors can see marketplace cards.
--
-- Path convention (unchanged from existing client code):
--   product-media/<auth.uid()>/<filename>.<ext>
--
-- Pattern mirrors 20260516_create_avatars_bucket.sql (the `avatars` bucket
-- already uses this exact folder-based RLS shape).
--
-- Idempotent:    UPDATE on storage.buckets is naturally idempotent; policies
--                use DROP POLICY IF EXISTS + CREATE POLICY.
-- Transactional: wrapped in BEGIN / COMMIT.
-- Reversibility: see ROLLBACK SQL block immediately below.
-- Type regen:    NOT required. Storage policies and storage.buckets rows do
--                not surface in the generated public-schema Database type.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert this migration)
-- -----------------------------------------------------------------------------
-- begin;
--   drop policy if exists "product-media user insert" on storage.objects;
--   drop policy if exists "product-media user update" on storage.objects;
--   drop policy if exists "product-media user delete" on storage.objects;
--   -- Restore the legacy permissive INSERT policy:
--   create policy "product-media authenticated upload" on storage.objects
--     for insert
--     with check (
--       bucket_id = 'product-media'
--       and auth.role() = 'authenticated'
--     );
--   update storage.buckets
--     set file_size_limit = null,
--         allowed_mime_types = null
--     where id = 'product-media';
-- commit;
-- -----------------------------------------------------------------------------

begin;

-- 1. Bucket-level enforcement: 100 MiB cap + MIME allowlist.
--    file_size_limit is in BYTES. 104857600 = 100 * 1024 * 1024.
--    MIME list covers the content types resolved by
--    `resolveContentType` in src/features/marketplace/services/sell.ts:
--      images: jpeg, png, webp
--      videos: mp4, quicktime (.mov), webm, x-m4v
update storage.buckets
   set file_size_limit    = 104857600,
       allowed_mime_types = array[
         'image/jpeg',
         'image/png',
         'image/webp',
         'video/mp4',
         'video/quicktime',
         'video/webm',
         'video/x-m4v'
       ]
 where id = 'product-media';

-- 2. Drop the legacy permissive INSERT policy. Any authenticated user
--    could previously upload to any folder under the bucket.
drop policy if exists "product-media authenticated upload" on storage.objects;

-- 3. INSERT: only into the caller's own folder.
drop policy if exists "product-media user insert" on storage.objects;
create policy "product-media user insert" on storage.objects
  for insert
  with check (
    bucket_id = 'product-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 4. UPDATE: only files in the caller's own folder. Required because the
--    client may overwrite or rename within its own namespace.
drop policy if exists "product-media user update" on storage.objects;
create policy "product-media user update" on storage.objects
  for update
  using (
    bucket_id = 'product-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 5. DELETE: only files in the caller's own folder. The product-delete
--    flow in src/features/marketplace/services/products.ts removes media
--    objects after deleting the row.
drop policy if exists "product-media user delete" on storage.objects;
create policy "product-media user delete" on storage.objects
  for delete
  using (
    bucket_id = 'product-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 6. "product-media public read" is intentionally left in place. Public
--    read is required for unauthenticated marketplace browsing.

commit;
