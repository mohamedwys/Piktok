-- 1. user_id link on sellers
alter table public.sellers
  add column if not exists user_id uuid references auth.users(id) on delete cascade unique;
create index if not exists sellers_user_idx on public.sellers(user_id);

-- 2. RPC: get-or-create seller for the authenticated user
create or replace function public.get_or_create_seller_for_current_user(
  p_username text,
  p_avatar_url text default ''
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_seller_id uuid;
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_seller_id from public.sellers where user_id = v_user_id;

  if v_seller_id is null then
    insert into public.sellers (name, avatar_url, user_id)
    values (coalesce(nullif(p_username, ''), 'User'), p_avatar_url, v_user_id)
    returning id into v_seller_id;
  end if;

  return v_seller_id;
end;
$$;

grant execute on function public.get_or_create_seller_for_current_user(text, text) to authenticated;

-- 3. RLS: allow authenticated users to insert products with their own seller_id
drop policy if exists "products insert own" on public.products;
create policy "products insert own" on public.products
  for insert
  with check (
    auth.uid() is not null
    and seller_id in (select id from public.sellers where user_id = auth.uid())
  );

-- 4. RLS: allow users to read their own seller row (for editing later)
drop policy if exists "sellers user read own" on public.sellers;
create policy "sellers user read own" on public.sellers
  for select
  using (auth.uid() = user_id);

-- 5. Storage bucket
insert into storage.buckets (id, name, public)
values ('product-media', 'product-media', true)
on conflict (id) do nothing;

-- 6. Storage policies
drop policy if exists "product-media public read" on storage.objects;
create policy "product-media public read" on storage.objects
  for select
  using (bucket_id = 'product-media');

drop policy if exists "product-media authenticated upload" on storage.objects;
create policy "product-media authenticated upload" on storage.objects
  for insert
  with check (
    bucket_id = 'product-media'
    and auth.role() = 'authenticated'
  );
