alter table public.products
  add column if not exists pickup_available boolean not null default false,
  add column if not exists location text;
