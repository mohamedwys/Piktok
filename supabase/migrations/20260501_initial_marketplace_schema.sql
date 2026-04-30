-- =============================================================================
-- Migration: 20260501_initial_marketplace_schema
-- Purpose:   Initial marketplace schema for the Hubb app.
--            Creates `sellers`, `products`, `likes`, `bookmarks` with
--            Row-Level Security policies and seeds the 5 mock products
--            currently shipped in src/features/marketplace/data/products.json.
--
-- Notes:
--   * Localized text fields use JSONB shape { "fr": "...", "en": "..." }
--     for forward-compatibility with new languages.
--   * Engagement counts on `products` are materialized columns updated
--     explicitly by app mutations (no triggers in this migration).
--   * `auth.users` is Supabase's built-in auth table.
-- =============================================================================

create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- sellers
-- -----------------------------------------------------------------------------
create table public.sellers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  avatar_url text not null default '',
  verified boolean not null default false,
  is_pro boolean not null default false,
  rating numeric(3,2) not null default 0,
  sales_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- products
-- -----------------------------------------------------------------------------
create table public.products (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  title jsonb not null,
  description jsonb not null,
  category jsonb not null,
  attributes jsonb not null default '[]'::jsonb,
  dimensions text,
  price numeric(10,2) not null,
  currency text not null check (currency in ('EUR','USD','GBP')),
  media_type text not null check (media_type in ('image','video')),
  media_url text not null,
  thumbnail_url text,
  stock_available boolean not null default true,
  stock_label jsonb,
  shipping_free boolean not null default false,
  shipping_label jsonb,
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  shares_count integer not null default 0,
  bookmarks_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index products_seller_idx on public.products(seller_id);
create index products_created_idx on public.products(created_at desc);

-- -----------------------------------------------------------------------------
-- likes
-- -----------------------------------------------------------------------------
create table public.likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index likes_product_idx on public.likes(product_id);

-- -----------------------------------------------------------------------------
-- bookmarks
-- -----------------------------------------------------------------------------
create table public.bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index bookmarks_product_idx on public.bookmarks(product_id);

-- -----------------------------------------------------------------------------
-- Row-Level Security
-- -----------------------------------------------------------------------------
alter table public.sellers enable row level security;
alter table public.products enable row level security;
alter table public.likes enable row level security;
alter table public.bookmarks enable row level security;

create policy "sellers public read" on public.sellers for select using (true);
create policy "products public read" on public.products for select using (true);

create policy "likes select own" on public.likes for select using (auth.uid() = user_id);
create policy "likes insert own" on public.likes for insert with check (auth.uid() = user_id);
create policy "likes delete own" on public.likes for delete using (auth.uid() = user_id);

create policy "bookmarks select own" on public.bookmarks for select using (auth.uid() = user_id);
create policy "bookmarks insert own" on public.bookmarks for insert with check (auth.uid() = user_id);
create policy "bookmarks delete own" on public.bookmarks for delete using (auth.uid() = user_id);

-- =============================================================================
-- Seed data
-- -----------------------------------------------------------------------------
-- Mirrors src/features/marketplace/data/products.json byte-for-byte for the
-- French copy. English copy is best-effort.
--
-- TODO(content): proofread EN copy
-- =============================================================================

-- Sellers ---------------------------------------------------------------------
insert into public.sellers (id, name, avatar_url, verified, is_pro, rating, sales_count) values
  ('11111111-1111-1111-1111-000000000001', 'Maison Nova',
   'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
   true, true, 4.8, 1200),
  ('11111111-1111-1111-1111-000000000002', 'Atelier du Sud',
   'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80',
   true, false, 4.6, 312),
  ('11111111-1111-1111-1111-000000000003', 'Bois & Nature',
   'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
   true, true, 4.9, 845),
  ('11111111-1111-1111-1111-000000000004', 'Lila Paris',
   'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
   false, false, 4.4, 87),
  ('11111111-1111-1111-1111-000000000005', 'Maroquinerie de Loire',
   'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=200&q=80',
   true, true, 4.7, 564);

-- Products --------------------------------------------------------------------

-- prod_001 — Fauteuil Scandinave (Maison Nova)
insert into public.products (
  id, seller_id, title, description, category, attributes, dimensions,
  price, currency, media_type, media_url, thumbnail_url,
  stock_available, stock_label, shipping_free, shipping_label,
  likes_count, comments_count, shares_count, bookmarks_count, created_at
) values (
  '22222222-2222-2222-2222-000000000001',
  '11111111-1111-1111-1111-000000000001',
  '{"fr": "Fauteuil Scandinave", "en": "Scandinavian Armchair"}'::jsonb,
  '{"fr": "Fauteuil au design scandinave épuré, fabriqué à la main en France. Structure en bois massif et tissu bouclé d''une grande douceur, idéal pour apporter une touche chaleureuse à votre salon.", "en": "Armchair with a clean Scandinavian design, handcrafted in France. Solid wood frame and wonderfully soft bouclé fabric — perfect for adding a warm touch to your living room."}'::jsonb,
  '{"primary": {"fr": "Maison & Déco", "en": "Home & Decor"}, "secondary": {"fr": "Fauteuils", "en": "Armchairs"}}'::jsonb,
  '[
    {"id": "attr_material_wood",   "iconKey": "tree",    "label": {"fr": "Bois massif",   "en": "Solid wood"}},
    {"id": "attr_fabric_boucle",   "iconKey": "fabric",  "label": {"fr": "Tissu bouclé",  "en": "Bouclé fabric"}},
    {"id": "attr_color_beige",     "iconKey": "palette", "label": {"fr": "Beige",         "en": "Beige"}}
  ]'::jsonb,
  'L 68 x P 72 x H 78 cm',
  299.00, 'EUR',
  'image',
  'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=1080&q=80',
  'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=400&q=60',
  true,  '{"fr": "En stock", "en": "In stock"}'::jsonb,
  true,  '{"fr": "Livraison offerte", "en": "Free shipping"}'::jsonb,
  2453, 128, 64, 312,
  '2026-04-12T09:24:00.000Z'
);

-- prod_002 — Lampe de Table Lumina (Atelier du Sud)
insert into public.products (
  id, seller_id, title, description, category, attributes, dimensions,
  price, currency, media_type, media_url, thumbnail_url,
  stock_available, stock_label, shipping_free, shipping_label,
  likes_count, comments_count, shares_count, bookmarks_count, created_at
) values (
  '22222222-2222-2222-2222-000000000002',
  '11111111-1111-1111-1111-000000000002',
  '{"fr": "Lampe de Table Lumina", "en": "Lumina Table Lamp"}'::jsonb,
  '{"fr": "Lampe de table en céramique mate, abat-jour en lin naturel. Diffuse une lumière chaude et tamisée, parfaite pour une ambiance cosy en soirée.", "en": "Matte ceramic table lamp with a natural linen shade. Casts a warm, soft light — perfect for a cosy evening atmosphere."}'::jsonb,
  '{"primary": {"fr": "Maison & Déco", "en": "Home & Decor"}, "secondary": {"fr": "Luminaires", "en": "Lighting"}}'::jsonb,
  '[
    {"id": "attr_material_ceramic",    "iconKey": "vase",    "label": {"fr": "Céramique",    "en": "Ceramic"}},
    {"id": "attr_material_linen",      "iconKey": "fabric",  "label": {"fr": "Lin naturel",  "en": "Natural linen"}},
    {"id": "attr_color_terracotta",    "iconKey": "palette", "label": {"fr": "Terracotta",   "en": "Terracotta"}}
  ]'::jsonb,
  'Ø 22 x H 38 cm',
  89.50, 'EUR',
  'image',
  'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1080&q=80',
  'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=400&q=60',
  true,  '{"fr": "En stock", "en": "In stock"}'::jsonb,
  false, '{"fr": "Livraison 4,90 €", "en": "Shipping €4.90"}'::jsonb,
  487, 23, 11, 64,
  '2026-04-18T14:02:00.000Z'
);

-- prod_003 — Table Basse Onde (Bois & Nature)
insert into public.products (
  id, seller_id, title, description, category, attributes, dimensions,
  price, currency, media_type, media_url, thumbnail_url,
  stock_available, stock_label, shipping_free, shipping_label,
  likes_count, comments_count, shares_count, bookmarks_count, created_at
) values (
  '22222222-2222-2222-2222-000000000003',
  '11111111-1111-1111-1111-000000000003',
  '{"fr": "Table Basse Onde", "en": "Onde Coffee Table"}'::jsonb,
  '{"fr": "Table basse en chêne massif huilé aux courbes organiques. Plateau ovale traité contre les taches d''eau, piètement central sculpté à la main.", "en": "Coffee table in oiled solid oak with organic curves. Oval top treated against water stains, central base hand-carved."}'::jsonb,
  '{"primary": {"fr": "Maison & Déco", "en": "Home & Decor"}, "secondary": {"fr": "Tables", "en": "Tables"}}'::jsonb,
  '[
    {"id": "attr_material_oak",  "iconKey": "tree",  "label": {"fr": "Chêne massif",     "en": "Solid oak"}},
    {"id": "attr_finish_oiled",  "iconKey": "drop",  "label": {"fr": "Finition huilée",  "en": "Oiled finish"}},
    {"id": "attr_shape_oval",    "iconKey": "shape", "label": {"fr": "Plateau ovale",    "en": "Oval top"}}
  ]'::jsonb,
  'L 110 x P 60 x H 38 cm',
  549.00, 'EUR',
  'video',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=400&q=60',
  true,  '{"fr": "Plus que 2 disponibles", "en": "Only 2 left"}'::jsonb,
  true,  '{"fr": "Livraison offerte", "en": "Free shipping"}'::jsonb,
  1872, 96, 47, 220,
  '2026-04-22T11:45:00.000Z'
);

-- prod_004 — Manteau en Laine Camel (Lila Paris)
insert into public.products (
  id, seller_id, title, description, category, attributes, dimensions,
  price, currency, media_type, media_url, thumbnail_url,
  stock_available, stock_label, shipping_free, shipping_label,
  likes_count, comments_count, shares_count, bookmarks_count, created_at
) values (
  '22222222-2222-2222-2222-000000000004',
  '11111111-1111-1111-1111-000000000004',
  '{"fr": "Manteau en Laine Camel", "en": "Camel Wool Coat"}'::jsonb,
  '{"fr": "Manteau long coupe oversize en laine vierge mélangée. Coloris camel intemporel, doublure satinée et poches plaquées. Pièce signature pour la mi-saison.", "en": "Long oversized coat in blended virgin wool. Timeless camel colour, satin lining and patch pockets. A signature piece for mid-season."}'::jsonb,
  '{"primary": {"fr": "Mode", "en": "Fashion"}, "secondary": {"fr": "Manteaux", "en": "Coats"}}'::jsonb,
  '[
    {"id": "attr_material_wool", "iconKey": "fabric",  "label": {"fr": "Laine vierge",    "en": "Virgin wool"}},
    {"id": "attr_fit_oversize",  "iconKey": "ruler",   "label": {"fr": "Coupe oversize",  "en": "Oversized fit"}},
    {"id": "attr_color_camel",   "iconKey": "palette", "label": {"fr": "Camel",           "en": "Camel"}}
  ]'::jsonb,
  'Tailles disponibles : 36, 38, 40, 42',
  219.90, 'EUR',
  'image',
  'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1080&q=80',
  'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=400&q=60',
  true,  '{"fr": "En stock", "en": "In stock"}'::jsonb,
  false, '{"fr": "Livraison 5,90 €", "en": "Shipping €5.90"}'::jsonb,
  738, 42, 18, 95,
  '2026-04-25T08:18:00.000Z'
);

-- prod_005 — Sac à Main Cuir Camel (Maroquinerie de Loire)
insert into public.products (
  id, seller_id, title, description, category, attributes, dimensions,
  price, currency, media_type, media_url, thumbnail_url,
  stock_available, stock_label, shipping_free, shipping_label,
  likes_count, comments_count, shares_count, bookmarks_count, created_at
) values (
  '22222222-2222-2222-2222-000000000005',
  '11111111-1111-1111-1111-000000000005',
  '{"fr": "Sac à Main Cuir Camel", "en": "Camel Leather Handbag"}'::jsonb,
  '{"fr": "Sac à main artisanal en cuir pleine fleur tanné végétal. Anse renforcée, fermoir en laiton brossé, doublure coton bio. Vieillit avec élégance au fil des années.", "en": "Handcrafted handbag in vegetable-tanned full-grain leather. Reinforced strap, brushed brass clasp, organic cotton lining. Ages elegantly over the years."}'::jsonb,
  '{"primary": {"fr": "Accessoires", "en": "Accessories"}, "secondary": {"fr": "Sacs", "en": "Bags"}}'::jsonb,
  '[
    {"id": "attr_material_leather",  "iconKey": "leather", "label": {"fr": "Cuir pleine fleur", "en": "Full-grain leather"}},
    {"id": "attr_finish_brass",      "iconKey": "metal",   "label": {"fr": "Laiton brossé",     "en": "Brushed brass"}},
    {"id": "attr_origin_handmade",   "iconKey": "hand",    "label": {"fr": "Fait main",         "en": "Handmade"}}
  ]'::jsonb,
  'L 32 x P 12 x H 24 cm',
  159.00, 'EUR',
  'image',
  'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1080&q=80',
  'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=400&q=60',
  false, '{"fr": "Rupture de stock", "en": "Out of stock"}'::jsonb,
  true,  '{"fr": "Livraison offerte", "en": "Free shipping"}'::jsonb,
  1124, 58, 22, 178,
  '2026-04-28T16:33:00.000Z'
);
