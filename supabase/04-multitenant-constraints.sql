-- ===========================================================
--  MULTITENANT · Parte 2/2 (CONSTRAINTS + NOT NULL)
--  Se ejecuta SOLO después del backfill (cuando toda fila ya tiene tenant_id).
--  El orquestador scripts/migrate-multitenant.mjs corre: 03 → backfill → 04.
--
--  - Cambia los UNIQUE globales por UNIQUE POR TENANT (slug, codigo, uchat_sub_id).
--  - Cambia la PK de ad_map a (tenant_id, ad_id, product_slug).
--  - Pone NOT NULL en tenant_id de las tablas core (cero filas huérfanas).
--
--  Los DROP de constraints se hacen por descubrimiento (pg_constraint), así funciona
--  sin depender del nombre exacto del constraint. Idempotente.
-- ===========================================================

-- Helper: elimina TODOS los unique constraints de una tabla sobre EXACTAMENTE una
-- columna dada (para reemplazarlos por el compuesto con tenant_id).
create or replace function _drop_unique_on(p_table regclass, p_col text) returns void as $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = p_table
      and con.contype = 'u'
      and array_length(con.conkey, 1) = 1
      and (select attname from pg_attribute where attrelid = p_table and attnum = con.conkey[1]) = p_col
  loop
    execute format('alter table %s drop constraint %I', p_table::text, c.conname);
  end loop;
end $$ language plpgsql;

-- 1) products.slug  →  unique (tenant_id, slug) ------------------------
select _drop_unique_on('products', 'slug');
create unique index if not exists products_tenant_slug_uniq on products(tenant_id, slug);

-- 2) categories.slug → unique (tenant_id, slug) ------------------------
select _drop_unique_on('categories', 'slug');
create unique index if not exists categories_tenant_slug_uniq on categories(tenant_id, slug);

-- 3) coupons.codigo → unique (tenant_id, codigo) -----------------------
select _drop_unique_on('coupons', 'codigo');
create unique index if not exists coupons_tenant_codigo_uniq on coupons(tenant_id, codigo);

-- 4) customers.uchat_sub_id → unique (tenant_id, uchat_sub_id) ---------
select _drop_unique_on('customers', 'uchat_sub_id');
create unique index if not exists customers_tenant_subid_uniq on customers(tenant_id, uchat_sub_id);

-- 5) ad_map PK → (tenant_id, ad_id, product_slug) ----------------------
do $$
declare pkname text;
begin
  select conname into pkname from pg_constraint
   where conrelid = 'ad_map'::regclass and contype = 'p';
  if pkname is not null then execute format('alter table ad_map drop constraint %I', pkname); end if;
  -- requiere tenant_id NOT NULL (se pone abajo, antes de crear la PK)
  alter table ad_map alter column tenant_id set not null;
  alter table ad_map add primary key (tenant_id, ad_id, product_slug);
exception when others then
  raise notice 'ad_map PK ya estaba en su lugar o no aplicable: %', sqlerrm;
end $$;

-- 6) NOT NULL en tenant_id de las tablas core (cero filas sin tenant) --
--    order_attempts se deja NULLABLE a propósito: un intento con token
--    inválido no tiene tenant.
alter table products    alter column tenant_id set not null;
alter table categories  alter column tenant_id set not null;
alter table orders      alter column tenant_id set not null;
alter table order_items alter column tenant_id set not null;
alter table customers   alter column tenant_id set not null;
alter table coupons     alter column tenant_id set not null;
alter table promotions  alter column tenant_id set not null;
alter table advisors    alter column tenant_id set not null;
alter table reviews     alter column tenant_id set not null;

drop function if exists _drop_unique_on(regclass, text);
