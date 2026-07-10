/* ===========================================================================
   Corrige el pedido AD-H3GW (bug $385.000.000): la cantidad 5500 salió del
   NOMBRE del producto ("CyanoMax B12 5500"). La cantidad real es 1.

   - Pone cada línea en cantidad 1 (subtotal = precio_cop unitario ya guardado).
   - Recalcula subtotal/total del pedido (el flete NO entra en el total a recaudar).
   - Recalcula un flete estimado sensato (20.000 + 7% del producto).
   - Deja el pedido en estado "por_revisar" + nota, para que el asesor confirme
     con el cliente (Yerney, Bucaramanga) ANTES de despachar.

   Uso:
     node scripts/fix-ad-h3gw.mjs           # DRY-RUN: solo muestra el antes/después
     node scripts/fix-ad-h3gw.mjs --apply   # aplica los cambios en la base
   =========================================================================== */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(join(ROOT, f), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}
const URL = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!URL) { console.error("✗ Falta DATABASE_URL / DIRECT_DATABASE_URL"); process.exit(1); }

const REF = "AD-H3GW";
const APPLY = process.argv.includes("--apply");
const fmt = (n) => "$" + Number(n || 0).toLocaleString("es-CO");

const sql = postgres(URL, { prepare: false });

const [order] = await sql`select * from orders where ref = ${REF} limit 1`;
if (!order) { console.error(`✗ No encontré el pedido ${REF}`); await sql.end(); process.exit(1); }

const items = await sql`select * from order_items where order_id = ${order.id} order by id`;

// --- ANTES ---
console.log(`\n===== PEDIDO ${REF} · ANTES =====`);
console.log(`estado: ${order.estado} · cliente: ${order.nombre} · ${order.ciudad} · tel ${order.telefono}`);
console.log(`subtotal ${fmt(order.subtotal_cop)} · descuento ${fmt(order.descuento_cop)} · envio ${fmt(order.envio_cop)} · TOTAL ${fmt(order.total_cop)}`);
for (const it of items) console.log(`  - ${it.cantidad}× ${it.product_name} @ ${fmt(it.precio_cop)} = ${fmt(it.subtotal_cop)}`);

// --- CÁLCULO CORRECTO (cantidad → 1) ---
const fixedItems = items.map((it) => ({ id: it.id, cantidad: 1, subtotal_cop: Number(it.precio_cop || 0) }));
const nuevoSubtotal = fixedItems.reduce((s, it) => s + it.subtotal_cop, 0);
const nuevoDescuento = Math.min(Number(order.descuento_cop || 0), nuevoSubtotal);
const nuevoTotal = Math.max(0, nuevoSubtotal - nuevoDescuento);       // flete NO se suma al total
const nuevoEnvio = nuevoSubtotal > 0 ? 20000 + Math.round(nuevoSubtotal * 0.07) : 0; // estimado sensato
const nota = `[${new Date().toISOString().slice(0, 10)}] Corregido bug $385M: cantidad 5500→1 (salió del nombre "CyanoMax B12 5500"). POR REVISAR: el asesor debe confirmar cantidad con el cliente antes de despachar. ${order.notas || ""}`.trim();

// --- DESPUÉS (previsualización) ---
console.log(`\n===== ${REF} · DESPUÉS =====`);
console.log(`estado: por_revisar · subtotal ${fmt(nuevoSubtotal)} · descuento ${fmt(nuevoDescuento)} · envio(est) ${fmt(nuevoEnvio)} · TOTAL ${fmt(nuevoTotal)}`);
for (let i = 0; i < items.length; i++) console.log(`  - ${fixedItems[i].cantidad}× ${items[i].product_name} @ ${fmt(items[i].precio_cop)} = ${fmt(fixedItems[i].subtotal_cop)}`);

if (!APPLY) {
  console.log(`\n(DRY-RUN) No se escribió nada. Para aplicar:  node scripts/fix-ad-h3gw.mjs --apply\n`);
  await sql.end();
  process.exit(0);
}

// --- APLICAR (transacción) ---
await sql.begin(async (tx) => {
  for (const it of fixedItems) {
    await tx`update order_items set cantidad = ${it.cantidad}, subtotal_cop = ${it.subtotal_cop} where id = ${it.id}`;
  }
  await tx`
    update orders set
      estado = 'por_revisar',
      subtotal_cop = ${nuevoSubtotal},
      descuento_cop = ${nuevoDescuento},
      envio_cop = ${nuevoEnvio},
      total_cop = ${nuevoTotal},
      notas = ${nota},
      updated_at = now()
    where id = ${order.id}`;
});

console.log(`\n✓ ${REF} corregido y marcado "por_revisar". Falta: el asesor confirma con ${order.nombre} y ajusta/anula el espejo en Shopify (${order.shopify_order_name || "sin espejo"}).\n`);
await sql.end();
