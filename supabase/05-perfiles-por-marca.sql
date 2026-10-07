-- ===========================================================
-- M-CERO · SEPARAR LOS PERFILES DE LAS DOS MARCAS
-- ------------------------------------------------------------
-- El catálogo, los pedidos y los clientes ya estaban separados por tenant_id.
-- Lo que seguía REVUELTO era el PERFIL de cada negocio: `store_config` y
-- `config_empresa` eran UNA SOLA FILA compartida por las dos marcas. Efectos
-- reales de eso:
--   · El bot de Rooster Deluxe se presentaba como "Animals Deluxe".
--   · Daba el WhatsApp de Animals (573026333595) a clientes de Rooster.
--   · Mandaba el saludo de contra entrega a un canal de pago anticipado.
--   · Las guías y facturas de Rooster salían con el NIT, la razón social y el
--     CONSECUTIVO DE FACTURA de Animals Deluxe (prefijo "AD").
--
-- Migración ADITIVA: solo agrega columnas e inserta la fila de Rooster.
-- No borra ni modifica la fila existente de Animals Deluxe más allá de
-- estamparle su tenant_id. Es reversible dropeando las columnas nuevas.
-- ===========================================================

-- 1. tenant_id en las dos tablas de perfil ------------------------------------
alter table public.store_config   add column if not exists tenant_id uuid;
alter table public.config_empresa add column if not exists tenant_id uuid;

-- 2. Backfill: lo que existe hoy es de Animals Deluxe -------------------------
update public.store_config
   set tenant_id = (select id from public.tenants where slug = 'animals-deluxe')
 where tenant_id is null;

update public.config_empresa
   set tenant_id = (select id from public.tenants where slug = 'animals-deluxe')
 where tenant_id is null;

-- 3. Perfil propio de Rooster Deluxe (pago anticipado) ------------------------
-- Los datos salen del tenant (nombre, asesor_wa, cuentas_pago): son la fuente de
-- verdad de la marca. La ciudad base y la cobertura se copian de Animals porque
-- despachan desde la misma bodega de Medellín; se editan en el panel si cambia.
insert into public.store_config (
  tenant_id, nombre, whatsapp, ciudad_base, envio_default_cop,
  ciudades_cobertura, mensaje_bienvenida, branding, cuentas_bancarias, cod_form
)
select
  t.id,
  t.nombre,
  regexp_replace(coalesce(t.asesor_wa, ''), '\D', '', 'g'),
  coalesce(sc.ciudad_base, 'Medellín'),
  coalesce(sc.envio_default_cop, 0),
  coalesce(sc.ciudades_cobertura, '[]'::jsonb),
  '¡Bienvenido a Rooster Deluxe! 🐓 Suplementos e implementos para tus campeones. Pago anticipado y despacho a todo el país.',
  '{}'::jsonb,
  '[]'::jsonb,   -- las cuentas de Rooster viven en tenants.cuentas_pago (texto libre)
  '{}'::jsonb    -- cod_form es de contra entrega: no aplica en esta marca
from public.tenants t
left join public.store_config sc
       on sc.tenant_id = (select id from public.tenants where slug = 'animals-deluxe')
where t.slug = 'rooster-deluxe'
  and not exists (select 1 from public.store_config x where x.tenant_id = t.id);

-- 4. Datos de empresa/facturación propios de Rooster --------------------------
-- OJO: `config_empresa.id` es text y es la PK, así que la fila nueva necesita su
-- propio id. El consecutivo de factura arranca en 1 y con prefijo RD: NUNCA debe
-- compartir numeración con Animals Deluxe.
insert into public.config_empresa (
  id, tenant_id, nombre_marca, whatsapp, prefijo_factura, siguiente_factura,
  logo_url, nit, razon_social, direccion_fiscal, ciudad_fiscal, telefono, email, sitio_web, pie_factura
)
select
  'rooster-deluxe',
  t.id,
  t.nombre,
  regexp_replace(coalesce(t.asesor_wa, ''), '\D', '', 'g'),
  'RD',
  1,
  '', '', '', '', '', '', '', '', ''   -- NIT/razón social los llena el dueño en el panel
from public.tenants t
where t.slug = 'rooster-deluxe'
  and not exists (select 1 from public.config_empresa x where x.tenant_id = t.id);

-- 5. Un perfil por marca, garantizado -----------------------------------------
create unique index if not exists store_config_tenant_uniq
  on public.store_config (tenant_id);
create unique index if not exists config_empresa_tenant_uniq
  on public.config_empresa (tenant_id);

-- 6. Verificación --------------------------------------------------------------
select 'store_config' tabla, t.slug, sc.nombre, sc.whatsapp, left(sc.mensaje_bienvenida, 45) saludo
  from public.store_config sc join public.tenants t on t.id = sc.tenant_id
union all
select 'config_empresa', t.slug, ce.nombre_marca, ce.whatsapp, ce.prefijo_factura || '-' || ce.siguiente_factura
  from public.config_empresa ce join public.tenants t on t.id = ce.tenant_id
order by 1, 2;
