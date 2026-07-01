/* Migración aditiva y segura: columnas de despacho en `orders`.
   Idempotente (ADD COLUMN IF NOT EXISTS). No toca datos existentes. */
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
if (!URL) { console.error("✗ Falta DATABASE_URL"); process.exit(1); }
const sql = postgres(URL, { prepare: false });

await sql`alter table orders add column if not exists guia text default ''`;
await sql`alter table orders add column if not exists transportadora text default ''`;
await sql`alter table orders add column if not exists despachado_at timestamptz`;
await sql`alter table orders add column if not exists cliente_notificado_at timestamptz`;

const cols = await sql`
  select column_name from information_schema.columns
  where table_name = 'orders'
    and column_name in ('guia','transportadora','despachado_at','cliente_notificado_at')
  order by column_name`;
console.log("✓ Columnas de despacho en orders:", cols.map((c) => c.column_name).join(", "));
await sql.end();
