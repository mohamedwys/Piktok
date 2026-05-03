-- =============================================================================
-- Migration: 20260516_create_avatars_bucket
-- Purpose:   Provision the `avatars` Supabase Storage bucket and per-user-folder
--            RLS policies so Step B.3 (avatar upload pipeline) can persist
--            uploaded profile photos. The bucket is public-read (avatars are
--            displayed across the marketplace alongside seller listings) and
--            write/update/delete-restricted to the owning user's folder.
--
-- Path convention:
--   avatars/<auth.uid()>/<filename>.jpg
--
-- Pattern follows the existing project convention established by
-- 20260503_sell_setup.sql (`product-media` bucket, lowercase
-- `drop policy if exists` + `create policy`, folder-based RLS via
-- `(storage.foldername(name))[1] = auth.uid()::text`).
--
-- File-size cap (1 MiB) and MIME allowlist (jpeg/png/webp) live on the bucket
-- itself, not in policy. The B.3 client pipeline resizes to 512x512 JPEG
-- @ quality 0.8 (typically <100 KiB) before upload so this cap is defensive
-- against accidental direct uploads.
--
-- Idempotent:    bucket INSERT uses ON CONFLICT DO NOTHING; policies use
--                DROP POLICY IF EXISTS + CREATE POLICY.
-- Transactional: wrapped in BEGIN / COMMIT.
-- Reversibility: see ROLLBACK SQL block immediately below.
-- Type regen:    NOT required. Storage policies and storage.buckets rows
--                do not surface in the generated public-schema Database type.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert this migration)
-- -----------------------------------------------------------------------------
-- begin;
--   drop policy if exists "avatars public read"   on storage.objects;
--   drop policy if exists "avatars user insert"   on storage.objects;
--   drop policy if exists "avatars user update"   on storage.objects;
--   drop policy if exists "avatars user delete"   on storage.objects;
--   delete from storage.buckets where id = 'avatars';
-- commit;
-- -----------------------------------------------------------------------------

begin;

-- 1. Bucket: public-read, 1 MiB cap, JPEG/PNG/WebP only.
insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'avatars',
  'avatars',
  true,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- 2. Public read.
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects
  for select
  using (bucket_id = 'avatars');

-- 3. Authenticated users may upload into their own folder only.
drop policy if exists "avatars user insert" on storage.objects;
create policy "avatars user insert" on storage.objects
  for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 4. Authenticated users may update files in their own folder only.
drop policy if exists "avatars user update" on storage.objects;
create policy "avatars user update" on storage.objects
  for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 5. Authenticated users may delete files in their own folder only.
drop policy if exists "avatars user delete" on storage.objects;
create policy "avatars user delete" on storage.objects
  for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

commit;
