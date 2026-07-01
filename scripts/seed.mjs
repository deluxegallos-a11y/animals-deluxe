/* ===========================================================
   ANIMALS DELUXE · Seed idempotente
   Siembra: 10 categorías + 41 productos (desde data/catalogo-productos.json)
   + 2 asesores + 1 promo + 1 cupón + store_config.
   Uso:  npm run seed   (requiere DATABASE_URL en .env.local o el entorno)
   =========================================================== */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

/* --- cargar .env.local (sin dependencias) --- */
function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    try {
      const txt = readFileSync(join(ROOT, f), "utf8");
      for (const line of txt.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch { /* no existe, ok */ }
  }
}
loadEnv();

const URL = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!URL) {
  console.error("✗ Falta DATABASE_URL (o DIRECT_DATABASE_URL) en .env.local. No puedo sembrar.");
  process.exit(1);
}

const catalogo = JSON.parse(readFileSync(join(ROOT, "data", "catalogo-productos.json"), "utf8"));
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://animalsdeluxe.com";
const sql = postgres(URL, { prepare: false });

async function main() {
  console.log(`→ Sembrando ${catalogo.categories.length} categorías y ${catalogo.products.length} productos…`);

  // 1) categorías
  for (let i = 0; i < catalogo.categories.length; i++) {
    const c = catalogo.categories[i];
    await sql`
      insert into categories (slug, name, color, sort_order)
      values (${c.id}, ${c.name}, ${c.color || "#FF4D2E"}, ${i})
      on conflict (slug) do update set name = excluded.name, color = excluded.color, sort_order = excluded.sort_order
    `;
  }
  const cats = await sql`select id, slug from categories`;
  const catId = Object.fromEntries(cats.map((c) => [c.slug, c.id]));

  // 2) productos
  let n = 0;
  for (const p of catalogo.products) {
    const presentations = (p.presentations && p.presentations.length)
      ? p.presentations
      : [{ label: "Unidad", priceCOP: p.priceCOP || 0 }];
    const imageUrl = p.image ? `${SITE}/products/${p.image}` : "";
    await sql`
      insert into products (
        slug, name, category_id, audience, origin, price_cop, presentations, image, image_url,
        badges, tagline, short_desc, benefits, usage, pitch, disclaimer, stock, activo
      ) values (
        ${p.slug}, ${p.name}, ${catId[p.category] || null}, ${p.audience || ""}, ${p.origin || "co"},
        ${p.priceCOP || 0}, ${sql.json(presentations)}, ${p.image || ""}, ${imageUrl},
        ${sql.json(p.badges || [])}, ${p.tagline || ""}, ${p.shortDesc || ""}, ${sql.json(p.benefits || [])},
        ${p.usage || ""}, ${p.pitch || ""},
        ${"Producto de bienestar y rendimiento. No cura enfermedades."}, 999, true
      )
      on conflict (slug) do update set
        name = excluded.name, category_id = excluded.category_id, audience = excluded.audience,
        origin = excluded.origin, price_cop = excluded.price_cop, presentations = excluded.presentations,
        image = excluded.image, image_url = excluded.image_url, badges = excluded.badges,
        tagline = excluded.tagline, short_desc = excluded.short_desc, benefits = excluded.benefits,
        usage = excluded.usage, pitch = excluded.pitch, updated_at = now()
    `;
    n++;
  }
  console.log(`✓ ${n} productos sembrados.`);

  // 3) asesores (round-robin)
  for (const a of [
    { nombre: "Andrés (Ventas)", whatsapp: process.env.NEXT_PUBLIC_WHATSAPP || "573000000001" },
    { nombre: "Laura (Ventas)", whatsapp: "573000000002" },
  ]) {
    const exists = await sql`select id from advisors where nombre = ${a.nombre} limit 1`;
    if (exists.length === 0) await sql`insert into advisors (nombre, whatsapp, activo) values (${a.nombre}, ${a.whatsapp}, true)`;
  }

  // 4) promo de ejemplo (sobre el primer energizante)
  const energy = await sql`select id, price_cop from products where slug = 'energy-cobra' limit 1`;
  if (energy.length) {
    const exists = await sql`select id from promotions where titulo = ${"Combo Pelea 🔥"} limit 1`;
    if (exists.length === 0) {
      await sql`
        insert into promotions (titulo, descripcion, product_id, precio_promo_cop, precio_antes_cop, activa, orden)
        values (${"Combo Pelea 🔥"}, ${"Energy Cobra a precio de combate por tiempo limitado."}, ${energy[0].id},
          ${Math.round(energy[0].price_cop * 0.85)}, ${energy[0].price_cop}, true, 0)
      `;
    }
  }

  // 5) cupón de ejemplo
  await sql`
    insert into coupons (codigo, tipo, valor, activo)
    values ('GALLO10', 'porcentaje', 10, true)
    on conflict (codigo) do nothing
  `;

  // 6) store_config (1 fila)
  const cfg = await sql`select id from store_config limit 1`;
  const ciudades = [
    { ciudad: "Medellín", costo_envio: 0, contraentrega: true },
    { ciudad: "Bogotá", costo_envio: 12000, contraentrega: true },
    { ciudad: "Cali", costo_envio: 12000, contraentrega: true },
  ];
  const bienvenida = "¡Bienvenido a Animals Deluxe! 🐓 Suplementos premium para tus campeones, contraentrega en toda Colombia.";
  if (cfg.length === 0) {
    await sql`
      insert into store_config (nombre, whatsapp, ciudad_base, envio_default_cop, ciudades_cobertura, mensaje_bienvenida, branding)
      values ('Animals Deluxe', ${process.env.NEXT_PUBLIC_WHATSAPP || ""}, 'Medellín', 12000,
        ${sql.json(ciudades)}, ${bienvenida}, ${sql.json({ colorPrimario: "#FF4D2E", colorAcento: "#FFB02E" })})
    `;
  }

  console.log("✓ Asesores, promo, cupón GALLO10 y store_config listos.");
  console.log("✅ Seed completo.");
  await sql.end();
}

main().catch(async (e) => {
  console.error("✗ Error en seed:", e.message);
  try { await sql.end(); } catch {}
  process.exit(1);
});
