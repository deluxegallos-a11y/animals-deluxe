-- ===========================================================
-- CEREBRO DE BÚSQUEDA — tablas de apoyo (idempotente)
--   product_aliases : apodos/typos por producto. Se siembra desde
--                     lib/ai/aliases.ts y se puede ampliar desde el panel
--                     sin deploy (se mezcla en runtime).
--   search_misses   : todo not_found + todo match flojo → de aquí salen
--                     los alias nuevos cada semana.
-- ===========================================================

create extension if not exists pg_trgm;

create table if not exists product_aliases (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  product_slug text not null,
  alias        text not null,
  nota         text not null default '',
  origen       text not null default 'seed',   -- seed | panel | logs
  created_at   timestamptz not null default now()
);

create unique index if not exists product_aliases_uniq
  on product_aliases (tenant_id, product_slug, alias);
create index if not exists product_aliases_tenant_idx
  on product_aliases (tenant_id);
-- fuzzy sobre el alias (para búsquedas desde el panel / análisis)
create index if not exists product_aliases_trgm_idx
  on product_aliases using gin (alias gin_trgm_ops);

create table if not exists search_misses (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid references tenants(id) on delete cascade,
  query             text not null default '',
  query_normalizado text not null default '',
  mejor_candidato   text not null default '',
  score             double precision not null default 0,
  status            text not null default '',
  created_at        timestamptz not null default now()
);

create index if not exists search_misses_tenant_fecha_idx
  on search_misses (tenant_id, created_at desc);
create index if not exists search_misses_query_idx
  on search_misses (query_normalizado);

-- Grants para el rol de la app (mismo patrón que 03-multitenant.sql).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'app_runtime') then
    grant select, insert, update, delete on product_aliases to app_runtime;
    grant select, insert, update, delete on search_misses to app_runtime;
  end if;
end $$;

-- RLS: mismo patrón que las tablas operativas (panel autenticado; el server
-- escribe con su propio rol).
do $$
declare t text;
begin
  foreach t in array array['product_aliases', 'search_misses'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %1$s_auth on %1$I;', t);
    execute format('create policy %1$s_auth on %1$I for all to authenticated using (true) with check (true);', t);
    -- El server corre como app_runtime: sin esta policy los INSERT del bot y el
    -- seed fallan por RLS (mismo patrón que events_app_runtime).
    if exists (select 1 from pg_roles where rolname = 'app_runtime') then
      execute format('drop policy if exists %1$s_app_runtime on %1$I;', t);
      execute format('create policy %1$s_app_runtime on %1$I for all to app_runtime using (true) with check (true);', t);
    end if;
  end loop;
end $$;
