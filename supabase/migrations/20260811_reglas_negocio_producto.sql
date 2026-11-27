-- ===========================================================================
-- Reglas de negocio por producto (misiones M4 · M6.2 · M6.3).
-- Las 3 columnas nacen con el default INOFENSIVO: ningún producto cambia de
-- comportamiento hasta que el dueño marque los valores desde el panel.
--
--   control_stock    (M4)   false → el stock NUNCA bloquea la venta. Solo los
--                           productos con control_stock=true respetan `stock`.
--                           Bug: "no tengo stock suficiente de CyanoMax" tumbó
--                           una venta cerrada con stock disponible.
--   solo_anticipado  (M6.2) true  → NO se vende contra entrega en este bot;
--                           se remite al canal de pago anticipado.
--   min_unidades     (M6.3) mínimo de unidades por envío (goteros que solo se
--                           despachan de a 2+). Default 1 = sin mínimo.
-- ===========================================================================

alter table products add column if not exists control_stock   boolean not null default false;
alter table products add column if not exists solo_anticipado boolean not null default false;
alter table products add column if not exists min_unidades    integer not null default 1;

-- min_unidades siempre ≥ 1 (un 0 dejaría pedidos en cero unidades).
alter table products drop constraint if exists products_min_unidades_check;
alter table products add constraint products_min_unidades_check check (min_unidades >= 1);

-- Índice parcial: el catálogo COD filtra por solo_anticipado en cada búsqueda.
create index if not exists idx_products_solo_anticipado
  on products (tenant_id) where solo_anticipado = true;

comment on column products.control_stock   is 'M4: si es true se respeta `stock`; si es false (default) el stock nunca bloquea la venta.';
comment on column products.solo_anticipado is 'M6.2: true = no se vende contra entrega en este bot (se remite al canal de pago anticipado).';
comment on column products.min_unidades    is 'M6.3: mínimo de unidades por envío (goteros de a 2+). Default 1 = sin mínimo.';
