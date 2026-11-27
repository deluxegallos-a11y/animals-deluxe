-- ===========================================================
-- LIVE CHAT · bandeja propia sobre la API de UChat (línea IA + línea asesores)
-- ------------------------------------------------------------
-- Receta: skill livechat-uchat-ia-y-asesores, adaptada a esta plataforma
-- (multitenant por tenant_id, panel con Drizzle/app_runtime).
--
-- · tenants.livechat  → config por marca: espacios (workspaces de UChat).
--   Solo guarda el NOMBRE de la variable de entorno con el token, nunca el token.
-- · advisors.email    → enlaza el login del panel con el asesor (rol 'asesor'
--   en tenant_users ve solo sus chats de la línea de asesores).
-- · livechat_*        → espejo local de conversaciones y mensajes de UChat.
--
-- ADITIVA y reversible (drop de las tablas/columnas nuevas). Aplicar ANTES de
-- desplegar el código del Live Chat:  node scripts/apply-sql-mgmt.mjs supabase/06-livechat.sql
-- ===========================================================

-- 1. Config por tenant --------------------------------------------------------
alter table public.tenants  add column if not exists livechat jsonb not null default '{}'::jsonb;
alter table public.advisors add column if not exists email text not null default '';
alter table public.advisors add column if not exists recibe_chats boolean not null default true;

-- Animals Deluxe: la línea del bot (workspace «animals deluxe», flow f280503).
update public.tenants
   set livechat = jsonb_build_object(
         'activo', true,
         'espacios', jsonb_build_array(
           jsonb_build_object('codigo','bot','nombre','Live Chat IA','flow_ns','f280503',
                              'uchat_token_env','UCHAT_API_TOKEN','con_ia',true,'reparto',false)
         ))
 where slug = 'animals-deluxe'
   and (livechat = '{}'::jsonb or livechat is null);

-- 2. Conversaciones -----------------------------------------------------------
create table if not exists public.livechat_conversaciones (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  espacio            text not null default 'bot',
  user_ns            text not null,
  nombre             text not null default '',
  telefono           text not null default '',
  canal              text not null default 'whatsapp',
  ultimo_texto       text not null default '',
  ultimo_emisor      text not null default '',
  ultimo_at          timestamptz,
  ultimo_cliente_at  timestamptz,
  sin_leer           integer not null default 0,
  owner              text not null default 'bot' check (owner in ('bot','humano')),
  asesor_id          uuid references public.advisors(id) on delete set null,
  asignado_en        timestamptz,
  bot_pausado_hasta  timestamptz,
  customer_id        uuid,
  ventana_abierta    boolean,
  mensajes_sync_at   timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (tenant_id, user_ns)
);
create index if not exists livechat_conv_bandeja_idx on public.livechat_conversaciones (tenant_id, espacio, ultimo_at desc nulls last);
create index if not exists livechat_conv_asesor_idx  on public.livechat_conversaciones (tenant_id, asesor_id);
create index if not exists livechat_conv_tel_idx     on public.livechat_conversaciones (tenant_id, telefono);

-- 3. Mensajes -----------------------------------------------------------------
-- provider_msg_id: id de UChat; ids propios con prefijo panel: (enviado desde la
-- plataforma, esperando eco), nota: (nota interna), evento: (sistema).
create table if not exists public.livechat_mensajes (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  conversacion_id  uuid not null references public.livechat_conversaciones(id) on delete cascade,
  provider_msg_id  text not null,
  direccion        text not null check (direccion in ('in','out','event')),
  emisor           text not null check (emisor in ('cliente','ia','asesor_uchat','asesor_panel','sistema','nota')),
  tipo             text not null default 'text',
  texto            text not null default '',
  media_url        text not null default '',
  autor            text not null default '',
  provider_ts      timestamptz not null default now(),
  raw              jsonb,
  created_at       timestamptz not null default now(),
  unique (tenant_id, provider_msg_id)
);
create index if not exists livechat_msg_hilo_idx on public.livechat_mensajes (conversacion_id, provider_ts);

-- 4. Estado de sincronización por (tenant, espacio) ----------------------------
create table if not exists public.livechat_sync (
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  espacio         text not null,
  ultimo_sync_at  timestamptz,
  ultimo_error    text not null default '',
  primary key (tenant_id, espacio)
);

-- 5. Respuestas rápidas («/atajo» en el composer) ------------------------------
create table if not exists public.livechat_respuestas_rapidas (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  atajo       text not null,
  texto       text not null,
  created_at  timestamptz not null default now(),
  unique (tenant_id, atajo)
);

insert into public.livechat_respuestas_rapidas (tenant_id, atajo, texto)
select t.id, r.atajo, r.texto
  from public.tenants t
  cross join (values
    ('saludo',   'Hola {nombre}, te habla {asesor} de Animals Deluxe 🐓 ¿En qué te puedo ayudar?'),
    ('datos',    'Para despacharte el pedido contra entrega me regalas: nombre completo, cédula, celular, departamento, ciudad y dirección exacta 🙌'),
    ('gracias',  '¡Gracias por tu compra {nombre}! Apenas despachemos te mando la guía para que hagas el seguimiento 📦')
  ) as r(atajo, texto)
 where t.slug = 'animals-deluxe'
on conflict (tenant_id, atajo) do nothing;

-- 6. Seguridad ----------------------------------------------------------------
-- El panel escribe con app_runtime (Drizzle; NO tiene bypassrls → necesita su
-- política, igual que orders_app_runtime). La anon key no ve nada.
do $$
declare t text;
begin
  foreach t in array array['livechat_conversaciones','livechat_mensajes','livechat_sync','livechat_respuestas_rapidas'] loop
    execute format('alter table public.%I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'app_runtime') then
      execute format('grant select, insert, update, delete on public.%I to app_runtime', t);
      execute format('drop policy if exists %I on public.%I', t || '_app_runtime', t);
      execute format('create policy %I on public.%I for all to app_runtime using (true) with check (true)', t || '_app_runtime', t);
    end if;
  end loop;
end $$;
