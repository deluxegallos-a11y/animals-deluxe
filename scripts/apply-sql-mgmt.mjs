/* Aplica un archivo SQL vía Supabase Management API (corre como superusuario).
   Uso:  node scripts/apply-sql-mgmt.mjs /ruta/al/archivo.sql
   Env:  SUPABASE_ACCESS_TOKEN (sbp_...), SUPABASE_PROJECT_REF   */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  try { for (const l of readFileSync(join(ROOT, f), "utf8").split("\n")) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); } } catch {}
}
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;
const file = process.argv[2];
if (!TOKEN || !REF) { console.error("✗ Falta SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF"); process.exit(1); }
if (!file) { console.error("✗ Uso: node scripts/apply-sql-mgmt.mjs <archivo.sql>"); process.exit(1); }

const query = readFileSync(file, "utf8");
const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query }),
});
const text = await res.text();
console.log("HTTP", res.status);
try { console.log(JSON.stringify(JSON.parse(text), null, 1).slice(0, 4000)); }
catch { console.log(text.slice(0, 4000)); }
if (!res.ok) process.exit(1);
