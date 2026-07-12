/* ===========================================================
   ROOSTER DELUXE · Seed de catálogo (101 productos + imágenes reales)
   - Sube cada Fotos/<archivo> al Storage (bucket product-images, carpeta rooster-deluxe/)
   - Crea las categorías del tenant (por su nombre real)
   - Upsert de los 101 productos scoped al tenant rooster-deluxe (idempotente)
   Emparejado imagen↔descripción: viene resuelto en productos.json (ruta_local_imagen).
   Uso:  node scripts/seed-rooster.mjs
   Requiere en env: DIRECT_DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
   =========================================================== */
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
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

const DB_URL = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "product-images";
const TENANT_SLUG = "rooster-deluxe";
const FOTOS_DIR = process.env.FOTOS_DIR || "/Users/fily/Desktop/Productos-WhatsApp/Fotos";

if (!DB_URL || !SB_URL || !SB_KEY) { console.error("✗ Falta DIRECT_DATABASE_URL / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
if (!existsSync(FOTOS_DIR)) { console.error(`✗ No existe la carpeta de fotos: ${FOTOS_DIR} (pásala en FOTOS_DIR=...)`); process.exit(1); }

const catalogo = JSON.parse(readFileSync(join(ROOT, "data", "rooster-deluxe-productos.json"), "utf8"));
const sql = postgres(DB_URL, { prepare: false, max: 1 });
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const slugify = (s) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "cat";

async function main() {
  const [t] = await sql`select id from tenants where slug = ${TENANT_SLUG} limit 1`;
  if (!t) { console.error(`✗ No existe el tenant ${TENANT_SLUG}. Corre primero migrate-multitenant.mjs`); process.exit(1); }
  const tenantId = t.id;
  console.log(`→ Tenant ${TENANT_SLUG}: ${tenantId}\n`);

  // 1) Categorías (nombre real → slug scoped). Upsert idempotente.
  const catNames = [...new Set(catalogo.map((p) => p.categoria).filter(Boolean))];
  const catMap = {}; // nombre → id
  let orden = 0;
  for (const name of catNames) {
    const slug = slugify(name);
    const [c] = await sql`
      insert into categories (tenant_id, slug, name, sort_order)
      values (${tenantId}, ${slug}, ${name}, ${orden++})
      on conflict (tenant_id, slug) do update set name = excluded.name
      returning id`;
    catMap[name] = c.id;
  }
  console.log(`✓ ${catNames.length} categorías`);

  // 2) Productos + imágenes. Slugs duplicados → sufijo -num (para no colapsar filas).
  const seen = new Set();
  let ok = 0, imgOk = 0, err = 0;
  const revisar = [];
  for (const p of catalogo) {
    try {
      let slug = p.slug || slugify(p.nombre);
      if (seen.has(slug)) slug = `${slug}-${p.num}`;
      seen.add(slug);

      // 2a) subir imagen real → Storage (upsert)
      let imageUrl = "";
      const fotoPath = join(FOTOS_DIR, p.nombre_archivo);
      if (existsSync(fotoPath)) {
        const bytes = readFileSync(fotoPath);
        const dest = `${TENANT_SLUG}/${p.nombre_archivo}`;
        const up = await sb.storage.from(BUCKET).upload(dest, bytes, { contentType: "image/jpeg", upsert: true });
        if (up.error) throw new Error(`storage: ${up.error.message}`);
        imageUrl = sb.storage.from(BUCKET).getPublicUrl(dest).data.publicUrl;
        imgOk++;
      } else {
        revisar.push(`${p.num} ${p.nombre}: falta imagen ${p.nombre_archivo}`);
      }

      // 2b) presentaciones jsonb {label, priceCOP}
      const presentations = (p.presentaciones || []).map((x) => ({ label: x.detalle, priceCOP: x.precio_cop }));
      const keywords = Array.isArray(p.keywords) ? p.keywords : [];

      // 2c) upsert producto (idempotente por tenant_id, slug)
      await sql`
        insert into products (
          tenant_id, slug, name, category_id, audience, origin, price_cop,
          presentations, image, image_url, keywords, short_desc, benefits,
          descripcion, usage, para_que, presentacion, activo
        ) values (
          ${tenantId}, ${slug}, ${p.nombre}, ${catMap[p.categoria] || null}, ${p.audiencia || ""}, 'co', ${p.precio_cop || 0},
          ${sql.json(presentations)}, ${p.nombre_archivo || ""}, ${imageUrl}, ${sql.json(keywords)}, ${p.beneficios || ""}, ${sql.json([])},
          ${p.descripcion || ""}, ${p.especificaciones || ""}, ${p.beneficios || ""}, ${(p.presentaciones?.[0]?.detalle) || ""}, ${p.activo !== false}
        )
        on conflict (tenant_id, slug) do update set
          name = excluded.name, category_id = excluded.category_id, audience = excluded.audience,
          price_cop = excluded.price_cop, presentations = excluded.presentations, image = excluded.image,
          image_url = excluded.image_url, keywords = excluded.keywords, short_desc = excluded.short_desc,
          descripcion = excluded.descripcion, usage = excluded.usage, para_que = excluded.para_que,
          presentacion = excluded.presentacion, activo = excluded.activo, updated_at = now()`;
      ok++;
      if (ok % 20 === 0) console.log(`  ...${ok}/${catalogo.length}`);
    } catch (e) {
      err++;
      revisar.push(`${p.num} ${p.nombre}: ERROR ${e.message}`);
    }
  }

  console.log(`\n✓ productos upsert: ${ok} | imágenes subidas: ${imgOk} | errores: ${err}`);
  const [cnt] = await sql`select count(*)::int n from products where tenant_id = ${tenantId}`;
  const [sinImg] = await sql`select count(*)::int n from products where tenant_id = ${tenantId} and coalesce(image_url,'') = ''`;
  console.log(`Total productos del tenant: ${cnt.n} | sin image_url: ${sinImg.n}`);
  if (revisar.length) { console.log("\n⚠️ Revisar:"); revisar.forEach((r) => console.log("  - " + r)); }
}

main().then(() => sql.end()).catch(async (e) => { console.error("\n✗ ERROR:", e.message); await sql.end(); process.exit(1); });
