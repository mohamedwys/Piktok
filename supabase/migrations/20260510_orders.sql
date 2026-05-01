create table public.orders (
  id uuid primary key default uuid_generate_v4(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  seller_id uuid not null references public.sellers(id) on delete restrict,
  amount numeric(10,2) not null,
  currency text not null check (currency in ('EUR','USD','GBP')),
  status text not null default 'pending' check (status in ('pending','paid','failed','cancelled','refunded')),
  stripe_session_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  application_fee_amount numeric(10,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_buyer_idx on public.orders(buyer_id, created_at desc);
create index orders_seller_idx on public.orders(seller_id, created_at desc);
create index orders_product_idx on public.orders(product_id);
create unique index orders_stripe_session_uidx on public.orders(stripe_session_id) where stripe_session_id is not null;

alter table public.orders enable row level security;

create policy "orders select buyer" on public.orders
  for select using (auth.uid() = buyer_id);
create policy "orders select seller" on public.orders
  for select using (
    seller_id in (select id from public.sellers where user_id = auth.uid())
  );
-- Inserts and updates happen via the Edge Function with service role; no client-side write policies.
