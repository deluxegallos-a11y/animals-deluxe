/* ===========================================================================
   M7 · Rellena `products.dosificacion` con la DOSIS EXACTA que ya está escrita
   dentro de `descripcion` (línea "🥄 Modo de uso: …" / "*Cómo se usa:* …").

   Por qué: el bot le dijo a clientes que el CyanoMax B12 5500 se da "en gotas"
   cuando es INYECTABLE (0.5 ml en la pechuga). La dosis correcta SÍ estaba en la
   descripción larga, pero el campo estructurado `dosificacion` estaba vacío y el
   `usage` decía solo "Aplica la dosis recomendada de B12" — así que el bot
   improvisaba la vía de administración.

   NO inventa nada: solo copia el texto que ya existe en la descripción. Si un
   producto no tiene esa línea, lo deja intacto.

   Uso:
     node scripts/backfill-dosificacion.mjs           # DRY-RUN (no escribe)
     node scripts/backfill-dosificacion.mjs --apply   # aplica
   =========================================================================== */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  try {
    for (const l of readFileSync(join(ROOT, f), "utf8").split("\n")) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}
const URL = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!URL) { console.error("✗ Falta DATABASE_URL / DIRECT_DATABASE_URL"); process.exit(1); }
const APPLY = process.argv.includes("--apply");

/* Extrae la dosis de la descripción. Acepta las dos plantillas que hay en la DB:
   "🥄 Modo de uso: …"  y  "📋 *Cómo se usa:* …".

   OJO: el label tiene que ser el INICIO de la línea. Buscar "dosis" en cualquier
   parte del texto agarraba viñetas de marketing —Energy Cobra devolvía
   "~40 dosis por frasco (30 ml): rinde muchísimo" en vez de la dosis real— y eso
   habría quedado publicado como "🥄 Dosis:" en el WhatsApp del cliente. */
const LABEL = /^\s*(?:[^\p{L}\p{N}\s]*\s*)*\*?\s*(?:modo de uso|c[óo]mo se usa|modo de empleo|dosis|dosificaci[óo]n)\s*\*?\s*:\s*\*?\s*(.+)$/iu;

function extraerDosis(desc) {
  if (!desc) return "";
  for (const linea of String(desc).split(/\r?\n/)) {
    const m = linea.match(LABEL);
    if (!m) continue;
    const s = m[1].replace(/^\**\s*/, "").replace(/\s*\**$/, "").trim();
    if (s.length >= 8) return s;
  }
  return "";
}

const sql = postgres(URL, { prepare: false });
const rows = await sql`
  select p.id, p.slug, p.name, p.dosificacion, p.usage, p.descripcion, t.slug tenant
  from products p left join tenants t on t.id = p.tenant_id
  where p.activo and coalesce(p.dosificacion,'') = ''`;

const cambios = [];
for (const r of rows) {
  const dosis = extraerDosis(r.descripcion);
  if (dosis && dosis !== (r.usage || "").trim()) cambios.push({ ...r, dosis });
}

console.log(`Productos activos sin dosificación: ${rows.length}`);
console.log(`Con dosis recuperable de la descripción: ${cambios.length}\n`);
for (const c of cambios.slice(0, 60)) {
  console.log(`· [${c.tenant}] ${c.name}`);
  console.log(`    → ${c.dosis}`);
}
if (cambios.length > 60) console.log(`  … y ${cambios.length - 60} más`);

if (!APPLY) {
  console.log("\nDRY-RUN. Nada se escribió. Corré con --apply para aplicar.");
  await sql.end();
  process.exit(0);
}

let n = 0;
for (const c of cambios) {
  await sql`update products set dosificacion = ${c.dosis}, updated_at = now() where id = ${c.id}`;
  n++;
}
console.log(`\n✅ Actualizados ${n} productos.`);
await sql.end();
