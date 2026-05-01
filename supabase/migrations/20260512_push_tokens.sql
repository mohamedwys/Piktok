create table public.push_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text check (platform in ('ios','android')),
  device_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "push_tokens select own" on public.push_tokens;
create policy "push_tokens select own" on public.push_tokens
  for select using (auth.uid() = user_id);

drop policy if exists "push_tokens insert own" on public.push_tokens;
create policy "push_tokens insert own" on public.push_tokens
  for insert with check (auth.uid() = user_id);

drop policy if exists "push_tokens delete own" on public.push_tokens;
create policy "push_tokens delete own" on public.push_tokens
  for delete using (auth.uid() = user_id);

drop policy if exists "push_tokens update own" on public.push_tokens;
create policy "push_tokens update own" on public.push_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
