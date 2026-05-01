alter table public.sellers
  add column if not exists bio text,
  add column if not exists website text,
  add column if not exists phone_public text,
  add column if not exists email_public text;

drop policy if exists "sellers update own" on public.sellers;
create policy "sellers update own" on public.sellers
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
