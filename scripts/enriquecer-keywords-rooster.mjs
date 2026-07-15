/* Enriquece keywords de IMPLEMENTOS del tenant rooster-deluxe (búsqueda gallera real).
   Fusiona con los keywords existentes (dedupe). Solo DML (app_runtime OK).
   Uso:  node scripts/enriquecer-keywords-rooster.mjs */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  try { for (const l of readFileSync(join(ROOT, f), "utf8").split("\n")) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); } } catch {}
}
const URL = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// match sobre el nombre normalizado → keywords a agregar.
const RULES = [
  { re: /\bbotas?\b/,            add: ["botas", "bota", "boticas", "botas de entrenar", "botas para gallos", "juego de botas"] },
  { re: /\bmona\b/,              add: ["mona", "monas", "monas de cabo", "mona para entrenar", "corretear"] },
  { re: /\btijera/,              add: ["tijeras", "tijera", "motilar", "motilada"] },
  { re: /esp(a|)dadrapo|esparadrapo/, add: ["esparadrapo", "espadrapo", "espadadrapo", "cinta"] },
  { re: /patapiojas|pata\s*piojas/, add: ["pata piojas", "patapiojas", "patas piojas"] },
  { re: /piquera/,              add: ["piqueras", "piquera", "vinchas", "pico"] },
  { re: /placas/,               add: ["placas", "placa", "plaquitas", "vinchas para marcar", "marcar pollos", "personalizadas"] },
  { re: /percloruro/,           add: ["parar la sangre", "percloruro", "espantar sangre", "coagulante"] },
  { re: /\bcera\b/,             add: ["cera", "ceras", "cera dominicana", "cera nacional"] },
  { re: /comedero/,             add: ["comedero", "comederos", "coquitas", "coquita"] },
];

async function main() {
  const sql = postgres(URL, { prepare: false, max: 1 });
  const [t] = await sql`select id from tenants where slug = ${"rooster-deluxe"}`;
  if (!t) { console.error("✗ tenant rooster-deluxe no existe"); process.exit(1); }
  const prods = await sql`select id, name, keywords from products where tenant_id = ${t.id}`;
  let updated = 0;
  for (const p of prods) {
    const nm = norm(p.name);
    const rule = RULES.find((r) => r.re.test(nm));
    if (!rule) continue;
    const cur = Array.isArray(p.keywords) ? p.keywords.map(String) : [];
    const merged = Array.from(new Set([...cur, ...rule.add].map((s) => s.toLowerCase().trim()).filter(Boolean)));
    await sql`update products set keywords = ${sql.json(merged)}, updated_at = now() where id = ${p.id}`;
    updated++;
    console.log(`  ✓ ${p.name} → +${rule.add.length} kw (total ${merged.length})`);
  }
  console.log(`\n✓ implementos enriquecidos: ${updated}`);
  await sql.end();
}
main().catch((e) => { console.error("✗", e.message); process.exit(1); });
