/* Siembra product_aliases (tenant rooster-deluxe) desde lib/ai/aliases.ts.
   Idempotente. Solo DML → app_runtime puede.
   Uso:  npx tsx scripts/seed-aliases.mjs */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ALIAS_CATALOG } from "../lib/ai/aliases.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  try { for (const l of readFileSync(join(ROOT, f), "utf8").split("\n")) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); } } catch {}
}
const TENANT = process.argv[2] || "rooster-deluxe";
const sql = postgres(process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL, { prepare: false, max: 1 });

const [t] = await sql`select id from tenants where slug = ${TENANT}`;
if (!t) { console.error(`✗ tenant ${TENANT} no existe`); process.exit(1); }

const slugsOk = new Set((await sql`select slug from products where tenant_id = ${t.id}`).map((r) => r.slug));

let ins = 0, skip = 0;
for (const e of ALIAS_CATALOG) {
  for (const slug of e.slugs) {
    if (!slugsOk.has(slug)) { console.warn(`  ⚠ slug inexistente, se omite: ${slug}`); skip++; continue; }
    for (const alias of e.aliases) {
      const a = alias.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
      if (!a) continue;
      await sql`
        insert into product_aliases (tenant_id, product_slug, alias, nota, origen)
        values (${t.id}, ${slug}, ${a}, ${e.nota || ""}, 'seed')
        on conflict (tenant_id, product_slug, alias) do update set nota = excluded.nota`;
      ins++;
    }
  }
}

const [n] = await sql`select count(*)::int c from product_aliases where tenant_id = ${t.id}`;
console.log(`✓ ${ins} alias sembrados (${skip} slugs omitidos) · total en DB: ${n.c}`);
await sql.end();
