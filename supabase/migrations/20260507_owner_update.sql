drop policy if exists "products update own" on public.products;
create policy "products update own" on public.products
  for update
  using (
    auth.uid() is not null
    and seller_id in (select id from public.sellers where user_id = auth.uid())
  )
  with check (
    seller_id in (select id from public.sellers where user_id = auth.uid())
  );
