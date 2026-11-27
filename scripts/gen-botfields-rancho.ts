/* Genera y (opcional) sube los bot fields del bot RANCHO DE LAS ESTRELLAS (UChat f276483).
   Uso:  npx tsx scripts/gen-botfields-rancho.ts            → solo muestra tamaños
         npx tsx scripts/gen-botfields-rancho.ts --subir    → PUT /flow/set-bot-field (RANCHO_UCHAT_API_TOKEN)
   Fuente única: data/verdad-dueno-rancho.json + bot_uchat/09_REGLAS_DURAS_RANCHO.md. */
import { readFileSync } from "node:fs";
import { catalogoCod, reglasCod } from "@/lib/rancho/botfields";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("="))
  .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]));
const token = process.env.RANCHO_UCHAT_API_TOKEN || env.RANCHO_UCHAT_API_TOKEN || "";
const B = "https://www.uchat.com.au/api";
const H = { Authorization: `Bearer ${token}`, "User-Agent": "Mozilla/5.0 (bots-venta)", Accept: "application/json", "Content-Type": "application/json" };

const campos = { catalogo_cod: catalogoCod(), reglas_cod: reglasCod() };
for (const [k, v] of Object.entries(campos)) console.log(`${k}: ${v.length} caracteres`);
if (Object.values(campos).some((v) => v.length > 19500)) { console.error("⚠️ pasa el tope de UChat"); process.exit(1); }

async function subir() {
  if (!token) { console.error("falta RANCHO_UCHAT_API_TOKEN"); process.exit(1); }
  const lista = await (await fetch(`${B}/flow/bot-fields?limit=100`, { headers: H })).json() as { data?: { name: string; var_ns: string }[] };
  for (const [name, value] of Object.entries(campos)) {
    let ns = lista.data?.find((x) => x.name === name)?.var_ns;
    if (!ns) {
      const c = await (await fetch(`${B}/flow/create-bot-field`, { method: "POST", headers: H, body: JSON.stringify({ name, var_type: "text", value, description: "Bots Venta 2.0 — generado desde data/verdad-dueno-rancho.json" }) })).json() as { data?: { var_ns?: string } };
      ns = c.data?.var_ns;
      console.log(`creado ${name}: ${ns}`);
    }
    const r = await fetch(`${B}/flow/set-bot-field`, { method: "PUT", headers: H, body: JSON.stringify({ var_ns: ns, value }) });
    console.log(`${name} (${ns}) → ${r.status}`);
  }
}
if (process.argv.includes("--subir")) subir();
