-- ===========================================================
-- ANIMALS DELUXE · Migración completa
-- Pegar en Supabase → SQL Editor → Run.
-- Crea tablas, búsqueda fuzzy (pg_trgm + unaccent), RLS y bucket de imágenes.
-- Idempotente: se puede correr varias veces.
-- ===========================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "unaccent";

-- unaccent inmutable (para poder usarla en columnas generadas / índices)
create or replace function f_unaccent(text) returns text
  language sql immutable strict parallel safe as
$$ select public.unaccent('public.unaccent', $1) $$;

-- 1. categories
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  color text default '#FF4D2E',
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 2. products
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category_id uuid references categories(id) on delete set null,
  audience text default '',
  origin text default 'co',
  price_cop int not null default 0,
  presentations jsonb default '[]'::jsonb,
  image text default '',
  image_url text default '',
  badges jsonb default '[]'::jsonb,
  tagline text default '',
  short_desc text default '',
  benefits jsonb default '[]'::jsonb,
  ingredients jsonb default '[]'::jsonb,
  usage text default '',
  pitch text default '',
  faq jsonb default '[]'::jsonb,
  disclaimer text default '',
  stock int default 999,
  activo boolean default true,
  search_text text generated always as (
    f_unaccent(lower(
      coalesce(name,'') || ' ' || coalesce(audience,'') || ' ' ||
      coalesce(short_desc,'') || ' ' || coalesce(tagline,'') || ' ' || coalesce(pitch,'')
    ))
  ) stored,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_products_category on products (category_id);
create index if not exists idx_products_search_trgm on products using gin (search_text gin_trgm_ops);

-- 3. customers (leads)
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  uchat_sub_id text unique,
  nombre text default '', telefono text default '', ciudad text default '', direccion text default '',
  canal_origen text default 'whatsapp',
  estado text default 'nuevo',
  notas text default '',
  ultimo_contacto timestamptz default now(),
  created_at timestamptz default now()
);

-- 4. advisors
create table if not exists advisors (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  whatsapp text default '',
  activo boolean default true,
  pedidos_asignados int default 0,
  created_at timestamptz default now()
);

-- 5. coupons
create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  tipo text default 'porcentaje',
  valor int not null default 0,
  activo boolean default true,
  usos_max int, usos int default 0,
  vence timestamptz,
  created_at timestamptz default now()
);

-- 6. orders
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  customer_id uuid references customers(id) on delete set null,
  estado text default 'pendiente_confirmacion',
  metodo_pago text default 'contraentrega',
  subtotal_cop int default 0, descuento_cop int default 0,
  envio_cop int default 0, total_cop int default 0,
  ciudad text default '', direccion text default '', telefono text default '', nombre text default '',
  coupon_id uuid references coupons(id) on delete set null,
  advisor_id uuid references advisors(id) on delete set null,
  notas text default '',
  idempotency_key text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_orders_customer on orders (customer_id);
create index if not exists idx_orders_idem on orders (idempotency_key);

-- 7. order_items
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_slug text default '', product_name text default '',
  presentacion_label text default '', precio_cop int default 0,
  cantidad int default 1, subtotal_cop int default 0
);

-- 8. promotions
create table if not exists promotions (
  id uuid primary key default gen_random_uuid(),
  titulo text not null, descripcion text default '',
  product_id uuid references products(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  precio_promo_cop int, precio_antes_cop int,
  imagen_url text default '', activa boolean default true,
  desde timestamptz, hasta timestamptz, orden int default 0,
  created_at timestamptz default now()
);

-- 9. store_config
create table if not exists store_config (
  id uuid primary key default gen_random_uuid(),
  nombre text default 'Animals Deluxe',
  whatsapp text default '', ciudad_base text default '',
  envio_default_cop int default 0,
  ciudades_cobertura jsonb default '[]'::jsonb,
  mensaje_bienvenida text default '',
  branding jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- 10. conversations
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  estado text default 'activa',
  asignada_a uuid references advisors(id) on delete set null,
  ultimo_mensaje_at timestamptz default now(),
  created_at timestamptz default now()
);

-- 11. messages
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  rol text default 'cliente', texto text default '', meta jsonb,
  created_at timestamptz default now()
);

-- 12. integrations
create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  proveedor text not null, config_enc text, activo boolean default true,
  created_at timestamptz default now()
);

-- 13. audit_log
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  accion text not null, entidad text, antes jsonb, despues jsonb,
  created_at timestamptz default now()
);

-- 14. events
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  tipo text not null, payload jsonb, created_at timestamptz default now()
);

-- ===========================================================
-- ESPEJO SHOPIFY (la plataforma es la fuente de verdad).
-- Columnas idempotentes: seguras de re-correr.
-- ===========================================================
alter table products add column if not exists shopify_product_id text;
alter table products add column if not exists shopify_sync text default 'pending';
alter table products add column if not exists shopify_sync_error text default '';
alter table products add column if not exists shopify_synced_at timestamptz;
create index if not exists idx_products_shopify_sync on products (shopify_sync);

alter table orders add column if not exists shopify_order_id text;
alter table orders add column if not exists shopify_order_name text default '';

-- Cuentas bancarias para pago anticipado (las lee el bot en asignar-asesor).
alter table store_config add column if not exists cuentas_bancarias jsonb default '[]'::jsonb;

-- trigger updated_at
create or replace function set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_products_updated on products;
create trigger trg_products_updated before update on products
  for each row execute function set_updated_at();
drop trigger if exists trg_orders_updated on orders;
create trigger trg_orders_updated before update on orders
  for each row execute function set_updated_at();

-- ===========================================================
-- RPC de búsqueda fuzzy (opcional; el endpoint usa además un
-- scorer en JS que cubre sinónimos y typos del lenguaje gallero).
-- ===========================================================
create or replace function search_products(q text, lim int default 8)
returns setof products language sql stable as $$
  select * from products
  where activo = true
    and (q = '' or search_text % f_unaccent(lower(q)) or search_text ilike '%' || f_unaccent(lower(q)) || '%')
  order by similarity(search_text, f_unaccent(lower(q))) desc nulls last
  limit lim
$$;

-- ===========================================================
-- ROW LEVEL SECURITY
-- Single-tenant: lectura pública de products/categories/promotions ACTIVOS.
-- Escrituras: solo el server (service_role bypassea RLS) y usuarios autenticados (panel).
-- ===========================================================

-- Lectura pública del catálogo
alter table products enable row level security;
drop policy if exists products_public_read on products;
create policy products_public_read on products for select using (activo = true);
drop policy if exists products_auth_write on products;
create policy products_auth_write on products for all to authenticated using (true) with check (true);

alter table categories enable row level security;
drop policy if exists categories_public_read on categories;
create policy categories_public_read on categories for select using (true);
drop policy if exists categories_auth_write on categories;
create policy categories_auth_write on categories for all to authenticated using (true) with check (true);

alter table promotions enable row level security;
drop policy if exists promotions_public_read on promotions;
create policy promotions_public_read on promotions for select using (activa = true);
drop policy if exists promotions_auth_write on promotions;
create policy promotions_auth_write on promotions for all to authenticated using (true) with check (true);

-- Tablas operativas: solo usuarios autenticados (panel). El server usa service_role.
do $$
declare t text;
begin
  foreach t in array array[
    'customers','advisors','coupons','orders','order_items','store_config',
    'conversations','messages','integrations','audit_log','events'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %1$s_auth on %1$I;', t);
    execute format('create policy %1$s_auth on %1$I for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- ===========================================================
-- STORAGE · bucket público de imágenes de producto
-- ===========================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "product_images_auth_write" on storage.objects;
create policy "product_images_auth_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images');

-- Listo. Ahora corre el seed (npm run seed) y crea tu cuenta admin en /signup.
