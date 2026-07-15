/* Agrega 3 productos de Alimentos/cuido al tenant rooster-deluxe (idempotente).
   image_url = "" (string vacío) hasta que Edwin pase las fotos. Solo DML (app_runtime OK).
   Uso:  node scripts/add-alimentos-rooster.mjs */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  try { for (const l of readFileSync(join(ROOT, f), "utf8").split("\n")) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); } } catch {}
}
const URL = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

const CAT = { slug: "alimentos-y-cuido", name: "Alimentos y cuido" };
const PRODS = [
  {
    slug: "avena", name: "Avena", audience: "general", price: 5000,
    presentations: [{ label: "1 kilo", priceCOP: 5000 }, { label: "Bulto 25 kilos", priceCOP: 100000 }],
    descripcion: "Avena preparada para el cuido de tus ejemplares. Se puede revolver con la Cinta Azul.",
    keywords: ["avena", "cuido", "comida", "alimento", "preparado", "bulto", "avena para gallos", "revolver con cinta azul"],
  },
  {
    slug: "cinta-azul", name: "Cinta Azul", audience: "general", price: 3500,
    presentations: [{ label: "1 kilo", priceCOP: 3500 }, { label: "Bulto 40 kilos", priceCOP: 130000 }],
    descripcion: "Cuido para revolver con la avena. Nutrición diaria para tus ejemplares.",
    keywords: ["cinta azul", "cinta", "cuido", "comida", "alimento", "concentrado", "revolver con avena"],
  },
  {
    slug: "master-pollito", name: "Master Pollito", audience: "pollitos", price: 4500,
    presentations: [{ label: "1 kilo", priceCOP: 4500 }, { label: "Bulto 40 kilos", priceCOP: 160000 }],
    descripcion: "Cuido para la etapa inicial de los pollitos. Arranque fuerte desde el primer día.",
    keywords: ["master pollito", "master", "cuido pollitos", "comida pollitos", "comida para pollitos", "alimento etapa inicial", "pollitos", "levante", "bulto"],
  },
];

async function main() {
  const sql = postgres(URL, { prepare: false, max: 1 });
  const [t] = await sql`select id from tenants where slug = ${"rooster-deluxe"}`;
  if (!t) { console.error("✗ tenant rooster-deluxe no existe"); process.exit(1); }

  // Categoría (idempotente por tenant, slug)
  const [c] = await sql`
    insert into categories (tenant_id, slug, name, sort_order)
    values (${t.id}, ${CAT.slug}, ${CAT.name}, 99)
    on conflict (tenant_id, slug) do update set name = excluded.name
    returning id`;
  console.log(`✓ categoría ${CAT.name}: ${c.id}`);

  for (const p of PRODS) {
    await sql`
      insert into products (
        tenant_id, slug, name, category_id, audience, origin, price_cop,
        presentations, image, image_url, keywords, short_desc, descripcion,
        tagline, pitch, activo
      ) values (
        ${t.id}, ${p.slug}, ${p.name}, ${c.id}, ${p.audience}, 'co', ${p.price},
        ${sql.json(p.presentations)}, '', '', ${sql.json(p.keywords)}, ${p.descripcion}, ${p.descripcion},
        '🥣 Alimento y cuido diario', '🥣 Alimento y cuido diario', true
      )
      on conflict (tenant_id, slug) do update set
        name = excluded.name, category_id = excluded.category_id, audience = excluded.audience,
        price_cop = excluded.price_cop, presentations = excluded.presentations,
        keywords = excluded.keywords, short_desc = excluded.short_desc, descripcion = excluded.descripcion,
        tagline = excluded.tagline, pitch = excluded.pitch, activo = true, updated_at = now()`;
    console.log(`  ✓ ${p.name} (${p.slug}) · ${p.presentations.length} presentaciones`);
  }

  const [cnt] = await sql`select count(*)::int n from products where tenant_id = ${t.id}`;
  console.log(`\n✓ total productos rooster-deluxe: ${cnt.n}`);
  await sql.end();
}
main().catch((e) => { console.error("✗", e.message); process.exit(1); });
