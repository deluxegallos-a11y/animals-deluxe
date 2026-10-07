-- ===========================================================
-- LIVE CHAT · etapa de venta por conversación
-- ------------------------------------------------------------
-- La bandeja marca quién ya confirmó el pedido. Dos fuentes:
--   · pedidos reales de la plataforma (orders, por customer_id o por teléfono)
--   · etiquetas que el bot pone en UChat («5 Pedido creado», «4 Datos pedidos»,
--     «2 Vio producto», «ASESOR HUMANO»)
-- ADITIVA. Aplicar antes del código que la lee.
-- ===========================================================
alter table public.livechat_conversaciones add column if not exists etiquetas     jsonb not null default '[]'::jsonb;
alter table public.livechat_conversaciones add column if not exists pedido_id     uuid;
alter table public.livechat_conversaciones add column if not exists pedido_ref    text not null default '';
alter table public.livechat_conversaciones add column if not exists pedido_estado text not null default '';
alter table public.livechat_conversaciones add column if not exists pedido_total  integer not null default 0;
alter table public.livechat_conversaciones add column if not exists pedido_at     timestamptz;
alter table public.livechat_conversaciones add column if not exists pedidos_num   integer not null default 0;

create index if not exists livechat_conv_pedido_idx on public.livechat_conversaciones (tenant_id, espacio, pedido_at desc nulls last);
-- Búsqueda de pedidos por teléfono (últimos 10 dígitos) para enlazar chats sin cliente del CRM.
create index if not exists orders_tel10_idx on public.orders (tenant_id, right(regexp_replace(coalesce(telefono, ''), '[^0-9]', '', 'g'), 10));
