/* Genera el SQL COMPLETO de migración multitenant, listo para correr como superusuario
   (Supabase SQL Editor o Management API). Inyecta los bridge_token desde env → el
   archivo de salida NO debe commitearse (va al scratchpad). Idempotente.
   Uso:  node scripts/gen-migration-sql.mjs > /ruta/segura/multitenant-full.sql   */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  try { for (const l of readFileSync(join(ROOT, f), "utf8").split("\n")) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); } } catch {}
}
const AD = process.env.BRIDGE_TOKEN || "";
const RO = process.env.ROOSTER_BRIDGE_TOKEN || "";
const ASESOR = process.env.ROOSTER_ASESOR_WA || "+573122911088";
const WA = process.env.NEXT_PUBLIC_WHATSAPP || "";
const EMAIL = process.env.ROOSTER_PANEL_EMAIL || "deluxerooster3@gmail.com";
if (!AD || !RO) { console.error("Falta BRIDGE_TOKEN o ROOSTER_BRIDGE_TOKEN en env"); process.exit(1); }
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

const ddl03 = readFileSync(join(ROOT, "supabase", "03-multitenant.sql"), "utf8");
const ddl04 = readFileSync(join(ROOT, "supabase", "04-multitenant-constraints.sql"), "utf8");

const seedAndBackfill = `
-- ========== SEED TENANTS + BACKFILL (entre 03 y 04) ==========
insert into tenants (slug, nombre, bridge_token, payment_mode, cuentas_pago, asesor_wa, flete_modo, flete_valor)
values ('animals-deluxe', 'Animals Deluxe', ${q(AD)}, 'contra_entrega', '', ${q(WA)}, 'por_ciudad', 0)
on conflict (slug) do update set bridge_token = excluded.bridge_token;

insert into tenants (slug, nombre, bridge_token, payment_mode, cuentas_pago, asesor_wa, flete_modo, flete_valor)
values ('rooster-deluxe', 'Rooster Deluxe', ${q(RO)}, 'anticipado',
        ${q("✔️ Bancolombia · Cuenta de Ahorros 23601895048\n✔️ Nequi 3157652850")}, ${q(ASESOR)}, 'por_ciudad', 0)
on conflict (slug) do update set
  bridge_token = excluded.bridge_token, payment_mode = excluded.payment_mode,
  cuentas_pago = excluded.cuentas_pago, asesor_wa = excluded.asesor_wa;

-- Backfill: TODO lo existente es Animals Deluxe.
do $$
declare adid uuid;
begin
  select id into adid from tenants where slug = 'animals-deluxe';
  update products       set tenant_id = adid where tenant_id is null;
  update categories     set tenant_id = adid where tenant_id is null;
  update orders         set tenant_id = adid where tenant_id is null;
  update order_items    set tenant_id = adid where tenant_id is null;
  update order_attempts set tenant_id = adid where tenant_id is null;
  update customers      set tenant_id = adid where tenant_id is null;
  update coupons        set tenant_id = adid where tenant_id is null;
  update promotions     set tenant_id = adid where tenant_id is null;
  update advisors       set tenant_id = adid where tenant_id is null;
  update reviews        set tenant_id = adid where tenant_id is null;
  update ad_map         set tenant_id = adid where tenant_id is null;
end $$;

-- Usuario del panel de rooster ve SOLO su tenant.
insert into tenant_users (tenant_id, email, rol)
values ((select id from tenants where slug = 'rooster-deluxe'), ${q(EMAIL)}, 'admin')
on conflict (email) do update set tenant_id = excluded.tenant_id;
`;

const verify = `
-- ========== VERIFICACIÓN ==========
select slug, payment_mode, activo from tenants order by created_at;
select t.slug, count(p.id) as productos from tenants t left join products p on p.tenant_id = t.id group by t.slug order by t.slug;
select count(*) as productos_sin_tenant from products where tenant_id is null;
`;

process.stdout.write(
  "-- ================================================================\n" +
  "-- MIGRACIÓN MULTITENANT · COMPLETA (correr como superusuario)\n" +
  "-- Supabase → SQL Editor, o Management API. Idempotente.\n" +
  "-- NO COMMITEAR: contiene los bridge_token.\n" +
  "-- ================================================================\n\n" +
  ddl03 + "\n" + seedAndBackfill + "\n" + ddl04 + "\n" + verify,
);
