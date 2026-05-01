alter table public.products
  add column if not exists category_id text,
  add column if not exists subcategory_id text;
create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_subcategory_idx on public.products(subcategory_id);
