/* ===========================================================
   MULTITENANT · Orquestador de migración (idempotente, reversible)
   Secuencia:
     1) 03-multitenant.sql   (aditiva: tenants, tenant_users, tenant_id, índices, delta anticipado)
     2) upsert tenant animals-deluxe  (token de env BRIDGE_TOKEN)
     3) BACKFILL tenant_id = animals-deluxe en TODAS las filas existentes
     4) upsert tenant rooster-deluxe  (token de env ROOSTER_BRIDGE_TOKEN, pago anticipado)
     5) 04-multitenant-constraints.sql (unique por tenant + NOT NULL en core)
     6) tenant_users: mapea deluxerooster3@gmail.com → rooster-deluxe
   Secretos (bridge_token) SOLO desde env, nunca hardcodeados aquí.
   Uso:  node --import tsx scripts/migrate-multitenant.mjs   (o: node scripts/migrate-multitenant.mjs)
   =========================================================== */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    try {
      const txt = readFileSync(join(ROOT, f), "utf8");
      for (const line of txt.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch { /* ok */ }
  }
}
loadEnv();

const URL = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!URL) { console.error("✗ Falta DIRECT_DATABASE_URL/DATABASE_URL en .env.local"); process.exit(1); }

const AD_TOKEN = process.env.BRIDGE_TOKEN || "";
const ROOSTER_TOKEN = process.env.ROOSTER_BRIDGE_TOKEN || "";
if (!AD_TOKEN)      { console.error("✗ Falta BRIDGE_TOKEN (token actual de Animals Deluxe)"); process.exit(1); }
if (!ROOSTER_TOKEN) { console.error("✗ Falta ROOSTER_BRIDGE_TOKEN (token del tenant nuevo)"); process.exit(1); }

// Datos de negocio del tenant nuevo (NO secretos). Cuentas/asesor los ve el cliente.
const ROOSTER = {
  slug: "rooster-deluxe",
  nombre: "Rooster Deluxe",
  payment_mode: "anticipado",
  cuentas_pago: "✔️ Bancolombia · Cuenta de Ahorros 23601895048\n✔️ Nequi 3157652850",
  asesor_wa: process.env.ROOSTER_ASESOR_WA || "+573122911088",
  flete_modo: "por_ciudad",
  flete_valor: 0,
};
const ROOSTER_PANEL_EMAIL = process.env.ROOSTER_PANEL_EMAIL || "deluxerooster3@gmail.com";
const DEFAULT_SLUG = "animals-deluxe";

// Todas las tablas de dominio a backfillar (todo lo existente es Animals Deluxe).
const DOMAIN_TABLES = [
  "products", "categories", "orders", "order_items", "order_attempts",
  "customers", "coupons", "promotions", "advisors", "reviews", "ad_map",
];

const sql = postgres(URL, { prepare: false, max: 1 });

async function runFile(name) {
  const content = readFileSync(join(ROOT, "supabase", name), "utf8");
  await sql.unsafe(content);
  console.log(`✓ aplicado ${name}`);
}

async function main() {
  console.log("→ MIGRACIÓN MULTITENANT\n");

  // 1) DDL aditiva
  await runFile("03-multitenant.sql");

  // 2) tenant animals-deluxe (token actual). Idempotente por slug.
  const [ad] = await sql`
    insert into tenants (slug, nombre, bridge_token, payment_mode, cuentas_pago, asesor_wa, flete_modo, flete_valor)
    values (${DEFAULT_SLUG}, 'Animals Deluxe', ${AD_TOKEN}, 'contra_entrega', '', ${process.env.NEXT_PUBLIC_WHATSAPP || ""}, 'por_ciudad', 0)
    on conflict (slug) do update set bridge_token = excluded.bridge_token, nombre = excluded.nombre
    returning id`;
  const adId = ad.id;
  console.log(`✓ tenant animals-deluxe: ${adId}`);

  // 3) BACKFILL: toda fila existente pertenece a Animals Deluxe.
  for (const t of DOMAIN_TABLES) {
    const res = await sql.unsafe(`update ${t} set tenant_id = $1 where tenant_id is null`, [adId]);
    console.log(`  backfill ${t}: ${res.count} filas`);
  }

  // 4) tenant rooster-deluxe (pago anticipado). Idempotente por slug.
  const [ro] = await sql`
    insert into tenants (slug, nombre, bridge_token, payment_mode, cuentas_pago, asesor_wa, flete_modo, flete_valor)
    values (${ROOSTER.slug}, ${ROOSTER.nombre}, ${ROOSTER_TOKEN}, ${ROOSTER.payment_mode}, ${ROOSTER.cuentas_pago}, ${ROOSTER.asesor_wa}, ${ROOSTER.flete_modo}, ${ROOSTER.flete_valor})
    on conflict (slug) do update set
      bridge_token = excluded.bridge_token, nombre = excluded.nombre,
      payment_mode = excluded.payment_mode, cuentas_pago = excluded.cuentas_pago,
      asesor_wa = excluded.asesor_wa, flete_modo = excluded.flete_modo, flete_valor = excluded.flete_valor
    returning id`;
  const rooId = ro.id;
  console.log(`✓ tenant rooster-deluxe: ${rooId}`);

  // 5) Constraints + NOT NULL (ya no quedan filas sin tenant_id).
  await runFile("04-multitenant-constraints.sql");

  // 6) tenant_users: el usuario del panel de rooster ve SOLO su tenant.
  await sql`
    insert into tenant_users (tenant_id, email, rol)
    values (${rooId}, ${ROOSTER_PANEL_EMAIL}, 'admin')
    on conflict (email) do update set tenant_id = excluded.tenant_id`;
  console.log(`✓ tenant_user: ${ROOSTER_PANEL_EMAIL} → rooster-deluxe`);

  // Resumen
  const tenantsRows = await sql`select slug, payment_mode, activo from tenants order by created_at`;
  console.log("\n=== TENANTS ===");
  for (const t of tenantsRows) console.log(`  ${t.slug}  [${t.payment_mode}]  activo=${t.activo}`);
  const counts = await sql`
    select t.slug, count(p.id)::int n
    from tenants t left join products p on p.tenant_id = t.id
    group by t.slug order by t.slug`;
  console.log("\n=== PRODUCTOS POR TENANT ===");
  for (const c of counts) console.log(`  ${c.slug}: ${c.n}`);
  const huerfanos = await sql`select count(*)::int n from products where tenant_id is null`;
  console.log(`\nProductos sin tenant_id: ${huerfanos[0].n} (debe ser 0)`);
  console.log("\n✓ MIGRACIÓN COMPLETA");
}

main().then(() => sql.end()).catch(async (e) => { console.error("\n✗ ERROR:", e.message); await sql.end(); process.exit(1); });
