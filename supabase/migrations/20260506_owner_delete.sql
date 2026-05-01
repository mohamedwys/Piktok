-- Allow users to delete their own products
drop policy if exists "products delete own" on public.products;
create policy "products delete own" on public.products
  for delete
  using (
    auth.uid() is not null
    and seller_id in (select id from public.sellers where user_id = auth.uid())
  );

-- Allow users to delete files in their own folder (path = '<user_id>/...')
drop policy if exists "product-media delete own" on storage.objects;
create policy "product-media delete own" on storage.objects
  for delete
  using (
    bucket_id = 'product-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
