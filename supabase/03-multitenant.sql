-- ===========================================================
--  MULTITENANT · Parte 1/2 (ADITIVA, segura, idempotente)
--  Crea la tabla `tenants` y añade `tenant_id` a las tablas de dominio,
--  índices por tenant y el delta de pago anticipado en `orders`.
--
--  NO cambia constraints únicos ni pone NOT NULL: eso va en la parte 2
--  (04-multitenant-constraints.sql) y SOLO después del backfill, para no
--  romper filas existentes. El orquestador scripts/migrate-multitenant.mjs
--  ejecuta: 03 → seed tenant animals-deluxe → backfill → 04.
--
--  Sin secretos: los bridge_token de cada tenant se insertan desde el
--  script (leídos de env), nunca aquí.
-- ===========================================================

create extension if not exists pgcrypto;

-- 1) Tabla tenants ------------------------------------------------------
create table if not exists tenants (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  nombre       text not null default '',
  bridge_token text not null unique,
  payment_mode text not null default 'contra_entrega'
               check (payment_mode in ('anticipado','contra_entrega')),
  cuentas_pago text not null default '',
  asesor_wa    text not null default '',
  flete_modo   text not null default 'incluido'
               check (flete_modo in ('incluido','fijo','por_ciudad')),
  flete_valor  integer not null default 0,
  activo       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- 1b) tenant_users — usuario del panel → tenant (por email) -------------
create table if not exists tenant_users (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id),
  email      text not null unique,
  rol        text not null default 'admin',
  created_at timestamptz not null default now()
);
create index if not exists idx_tenant_users_tenant on tenant_users(tenant_id);

-- Grants: el rol de la app (app_runtime) debe poder leer/escribir las tablas nuevas.
-- (Las tablas de dominio ya tenían sus grants; las nuevas necesitan estos.)
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'app_runtime') then
    grant select, insert, update, delete on tenants to app_runtime;
    grant select, insert, update, delete on tenant_users to app_runtime;
  end if;
end $$;

-- 2) Columna tenant_id (nullable por ahora) en cada tabla de dominio -----
alter table products       add column if not exists tenant_id uuid references tenants(id);
alter table categories     add column if not exists tenant_id uuid references tenants(id);
alter table orders         add column if not exists tenant_id uuid references tenants(id);
alter table order_items    add column if not exists tenant_id uuid references tenants(id);
alter table order_attempts add column if not exists tenant_id uuid references tenants(id);
alter table customers      add column if not exists tenant_id uuid references tenants(id);
alter table coupons        add column if not exists tenant_id uuid references tenants(id);
alter table promotions     add column if not exists tenant_id uuid references tenants(id);
alter table advisors       add column if not exists tenant_id uuid references tenants(id);
alter table reviews        add column if not exists tenant_id uuid references tenants(id);
alter table ad_map         add column if not exists tenant_id uuid references tenants(id);

-- 3) Índices por tenant --------------------------------------------------
create index if not exists idx_products_tenant       on products(tenant_id);
create index if not exists idx_categories_tenant     on categories(tenant_id);
create index if not exists idx_orders_tenant         on orders(tenant_id);
create index if not exists idx_order_items_tenant    on order_items(tenant_id);
create index if not exists idx_order_attempts_tenant on order_attempts(tenant_id);
create index if not exists idx_customers_tenant      on customers(tenant_id);
create index if not exists idx_coupons_tenant        on coupons(tenant_id);
create index if not exists idx_promotions_tenant     on promotions(tenant_id);
create index if not exists idx_advisors_tenant       on advisors(tenant_id);
create index if not exists idx_reviews_tenant        on reviews(tenant_id);
create index if not exists idx_ad_map_tenant         on ad_map(tenant_id);

-- 4) Delta pago anticipado en orders ------------------------------------
--    payment_type: 'contra_entrega' (default) | 'anticipado'
--    comprobante_url: URL del comprobante de pago que sube el cliente.
--    El estado 'por_verificar_pago' se maneja en la columna text `estado`
--    (no hay enum) → no requiere DDL. Ciclo anticipado:
--      por_verificar_pago → pagado → despachado → entregado | cancelado
alter table orders add column if not exists payment_type    text not null default 'contra_entrega';
alter table orders add column if not exists comprobante_url text not null default '';
