-- ===========================================================
-- ANIMALS DELUXE · Delta: espejo Shopify + cuentas bancarias
-- Pegar en Supabase → SQL Editor → Run. Idempotente.
-- (Solo agrega columnas/índices nuevos; no toca datos existentes.)
-- ===========================================================

-- Espejo Shopify en productos (la plataforma es la fuente de verdad)
alter table products add column if not exists shopify_product_id text;
alter table products add column if not exists shopify_sync text default 'pending';
alter table products add column if not exists shopify_sync_error text default '';
alter table products add column if not exists shopify_synced_at timestamptz;
create index if not exists idx_products_shopify_sync on products (shopify_sync);

-- Espejo Shopify en pedidos (libro de pedidos / registro)
alter table orders add column if not exists shopify_order_id text;
alter table orders add column if not exists shopify_order_name text default '';

-- Cuentas bancarias para pago anticipado (las lee el bot en asignar-asesor)
alter table store_config add column if not exists cuentas_bancarias jsonb default '[]'::jsonb;
