/* Aplica data/verdad-dueno-animals.json a la DB (tenant animals-deluxe).
   Corrige lo que el dueño reportó por WhatsApp: forma (inyectable vs gotas),
   dosis, presentación, precio, mínimo de unidades y contenido de combos.

   Uso:
     node scripts/fix-catalogo-dueno.mjs          → DRY-RUN (muestra el diff, no escribe)
     node scripts/fix-catalogo-dueno.mjs --apply  → escribe en la DB
   Idempotente: correrlo dos veces no cambia nada la segunda vez. */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) { try { for (const l of readFileSync(join(ROOT, f), "utf8").split("\n")) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); } } catch {} }
const APPLY = process.argv.includes("--apply");
const V = JSON.parse(readFileSync(join(ROOT, "data", "verdad-dueno-animals.json"), "utf8"));
const sql = postgres(process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL, { prepare: false, max: 1 });

const dosis = (d) => (d === "@protocolo_doping_gotas" ? V.protocolo_doping_gotas : d);
/* El combo potenciador decía "MegaForce Power"; el dueño (1-jul) dice Dragón Mamba. */
const TEXTO = { "rooster-deluxe-chicks": [[/✅ Elige el tamaño según cuántas aves tengas/g, "📦 Contra entrega: bolsa de 400 gr. El de 1 kg y 3 kg va por Rooster Deluxe con pago anticipado."], [/💵 400 gr \$45\.000 · 1 kg \$80\.000 · 3 kg \$180\.000 · /g, "💵 400 gr $45.000 · "]], "combo-potenciador": [[/MegaForce Power 10ml/g, "Dragón Mamba 10ml (inyectable)"], [/MegaForce Power/g, "Dragón Mamba"], [/Potenciador de fuerza y energía \(Dragón Mamba\)/g, "Doping inyectable para el día de la pelea (Dragón Mamba)"]] };

/* Textos con datos viejos que el bot repetía tal cual (auditoría 25-nov). */
const COMBO_TEXTO = {
  "equipo-de-campeones": "🏆 EQUIPO DE CAMPEONES — El kit definitivo\nTrae 4 productos: Super Trainer (pre-entreno, gotas) + Energy Cobra (doping en gotas) + Ultra Gallo (vitamina inyectable) + American Rooster Fury (doping inyectable).\n✅ Energía para el careo\n✅ Fuerza y masa muscular\n✅ Resistencia el día de la pelea\n✅ Ahorro por combo (antes $350.000)\n💵 $300.000 + envío · Contra entrega, pagás al recibir.",
};
const CURE_CHEST = {
  usage: "Gotas. La dosis exacta te la confirma el asesor según el estado del gallo.",
  descripcion: "🫁 CURE CHEST GOTAS — Para problemas respiratorios\nAyuda a oxigenar y despejar el pecho de tu gallo cuando lo necesita.\n✅ Alivia problemas respiratorios\n✅ Mejora la oxigenación\n✅ Ayuda a la recuperación del ave\n📦 En este canal solo viene en GOTERO (gotas). Las cápsulas NO se venden contra entrega: esas las despacha Rooster Deluxe con pago anticipado.\n💵 $45.000 + envío · Contra entrega, pagás al recibir.",
};
const copFmt = (n) => "$" + Number(n).toLocaleString("es-CO").replace(/,/g, ".");

const rows = await sql`select p.* from products p join tenants t on t.id = p.tenant_id where t.slug = 'animals-deluxe'`;
const bySlug = new Map(rows.map((r) => [r.slug, r]));
let cambios = 0;
for (const [slug, v] of Object.entries(V.productos)) {
  const r = bySlug.get(slug);
  if (!r) { console.log(`⚠️  ${slug}: no existe en la DB`); continue; }
  const set = {};
  if (v.precio && r.price_cop !== v.precio) set.price_cop = v.precio;
  if (v.presentacion && r.presentacion !== v.presentacion) set.presentacion = v.presentacion;
  if (v.dosificacion && r.dosificacion !== dosis(v.dosificacion)) set.dosificacion = dosis(v.dosificacion);
  const minU = v.min_unidades ?? 1;
  if ((r.min_unidades ?? 1) !== minU) set.min_unidades = minU;
  if (typeof v.envio_gratis === "boolean" && !!r.envio_gratis !== v.envio_gratis) set.envio_gratis = v.envio_gratis;
  if (r.solo_anticipado) set.solo_anticipado = false; // todo lo de la tabla SÍ va contra entrega
  // Presentaciones: precio de la primera = precio real; etiqueta corregida; cure chest solo gotero.
  let pres = Array.isArray(r.presentations) ? r.presentations.map((x) => ({ ...x })) : [];
  if (v.solo_gotero) pres = pres.filter((x) => /gotero|gota/i.test(x.label));
  // Presentaciones EXACTAS del dueño para contra entrega ({"400 gr": 45000}): las demás
  // (1 kg / 3 kg de pago anticipado) se quitan para que el bot no las ofrezca ni invente precio.
  if (v.presentaciones) {
    const prev = new Map(pres.map((x) => [String(x.label).toLowerCase(), x]));
    pres = Object.entries(v.presentaciones).map(([label, priceCOP]) => ({ ...(prev.get(label.toLowerCase()) || {}), label, priceCOP }));
  }
  if (pres.length && v.precio && !v.combo && !v.presentaciones) {
    if (pres.length === 1 || v.solo_gotero) pres[0].priceCOP = v.precio;
    if (v.label) pres[0].label = v.label;
  }
  if (JSON.stringify(pres) !== JSON.stringify(r.presentations)) set.presentations = sql.json(pres);
  for (const campo of ["short_desc", "descripcion", "tagline"]) {
    let t = r[campo] || "";
    for (const [re, rep] of TEXTO[slug] || []) t = t.replace(re, rep);
    if (t !== (r[campo] || "")) set[campo] = t;
  }
  if (COMBO_TEXTO[slug] && r.descripcion !== COMBO_TEXTO[slug]) set.descripcion = COMBO_TEXTO[slug];
  if (slug === "cure-chest-rooster") {
    if (r.usage !== CURE_CHEST.usage) set.usage = CURE_CHEST.usage;
    if (r.descripcion !== CURE_CHEST.descripcion) set.descripcion = CURE_CHEST.descripcion;
    const faq = (r.faq || []).map((f) => (/c[oó]mo se da/i.test(f.q) ? { ...f, a: "En gotas; la dosis exacta te la confirma el asesor según cómo esté el gallo." } : f));
    if (JSON.stringify(faq) !== JSON.stringify(r.faq)) set.faq = sql.json(faq);
  }
  // Objeciones con precio VIEJO ("son $90.000" en un producto de $150.000): el bot las
  // repetía cuando el cliente decía "está caro". Se reescribe el monto al precio real.
  if (r.objeciones && typeof r.objeciones === "object" && v.precio && !v.combo) {
    const validos = new Set([v.precio, ...(pres || []).map((x) => x.priceCOP)]);
    const obj = {};
    for (const [k, txt] of Object.entries(r.objeciones)) {
      obj[k] = String(txt).replace(/\$\s?(\d{1,3}(?:[.,]\d{3})+)/g, (m, num) =>
        validos.has(Number(num.replace(/\D/g, ""))) ? m : copFmt(v.precio)).replace(/\((Gotero|Frasco)\)/g, "");
    }
    if (JSON.stringify(obj) !== JSON.stringify(r.objeciones)) set.objeciones = sql.json(obj);
  }
  const keys = Object.keys(set);
  if (!keys.length) continue;
  cambios++;
  console.log(`• ${slug}`);
  for (const k of keys) {
    const antes = k === "presentations" ? JSON.stringify(r.presentations) : String(r[k] ?? "").slice(0, 90);
    const despues = k === "presentations" ? JSON.stringify(pres) : String(set[k]).slice(0, 90);
    console.log(`    ${k}: ${antes}  →  ${despues}`);
  }
  if (APPLY) await sql`update products set ${sql(set, ...keys)}, updated_at = now() where id = ${r.id}`;
}
console.log(`\n${cambios} productos ${APPLY ? "ACTUALIZADOS" : "con cambios (dry-run; usa --apply)"}`);
await sql.end();
