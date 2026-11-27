/* Congela el catálogo REAL de rooster-deluxe como fixture de tests (ProductView[]).
   Así los tests del cerebro corren contra los mismos productos que ve el bot en prod.
   Uso:  node scripts/dump-rooster-catalog.mjs */
import postgres from "postgres";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  try { for (const l of readFileSync(join(ROOT, f), "utf8").split("\n")) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); } } catch {}
}
const URL = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
const OUT = join(ROOT, "tests", "fixtures", "rooster-catalog.json");

const sql = postgres(URL, { prepare: false, max: 1 });
const rows = await sql`
  select p.*, c.slug cat_slug, c.name cat_name
  from products p
  join tenants t on t.id = p.tenant_id
  left join categories c on c.id = p.category_id
  where t.slug = 'rooster-deluxe' and p.activo = true
  order by p.name`;

const view = rows.map((p) => ({
  id: p.id, slug: p.slug, name: p.name,
  categoryId: p.category_id || "", categorySlug: p.cat_slug || "", categoryName: p.cat_name || "",
  audience: p.audience || "", origin: p.origin || "co", priceCOP: p.price_cop || 0,
  presentations: p.presentations || [], image: p.image || "", imageUrl: p.image_url || "",
  badges: p.badges || [], tagline: p.tagline || "", shortDesc: p.short_desc || "",
  benefits: p.benefits || [], ingredients: p.ingredients || [], usage: p.usage || "",
  pitch: p.pitch || "", faq: p.faq || [], keywords: p.keywords || [],
  objeciones: p.objeciones || {}, adIds: p.ad_ids || [], disclaimer: p.disclaimer || "",
  stock: p.stock ?? 999, activo: true, envioGratis: p.envio_gratis ?? false,
  descripcion: p.descripcion || "", edadMinima: p.edad_minima || "",
  dosificacion: p.dosificacion || "", presentacion: p.presentacion || "", paraQue: p.para_que || "",
}));

writeFileSync(OUT, JSON.stringify(view, null, 2) + "\n");
console.log(`✓ ${view.length} productos → tests/fixtures/rooster-catalog.json`);
await sql.end();
