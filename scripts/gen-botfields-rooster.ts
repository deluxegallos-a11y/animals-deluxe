/* Genera los bot fields `catalogo_cod` y `reglas_cod` del bot ROOSTER DELUXE (UChat f287229).
   Una sola fuente de verdad: el catálogo de la base (tests/fixtures/rooster-catalog.json,
   refrescado con `node scripts/dump-rooster-catalog.mjs`) + la verdad del dueño
   (data/verdad-dueno-rooster.json) + las reglas duras (bot_uchat/08_REGLAS_DURAS_ANTICIPADO.md).
   Uso:  npx tsx scripts/gen-botfields-rooster.ts <salida.json>
   Después se suben con PUT /api/flow/set-bot-field (ver bot_uchat/ROOSTER_PROCESO.md). */
import { readFileSync, writeFileSync } from "node:fs";
import type { ProductView } from "@/lib/ai/types";
import { formaDe } from "@/lib/ai/search";
import { usoLimpio } from "@/lib/ai/present";

const out = process.argv[2] || "rooster-botfields.json";
const cat = JSON.parse(readFileSync("tests/fixtures/rooster-catalog.json", "utf8")) as ProductView[];
const V = JSON.parse(readFileSync("data/verdad-dueno-rooster.json", "utf8")) as {
  _actualizado: string; productos: Record<string, { dosificacion?: string; nota?: string }>;
};
const cop = (n: number) => "$" + n.toLocaleString("es-CO").replace(/,/g, ".");
const corto = (s: string, n: number) => { const t = (s || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n).replace(/\s\S*$/, "") + "…" : t; };

// Productos repetidos en la base (2× Mona, 2× Tijera Roja…): una sola línea con TODAS sus
// presentaciones. Si el mismo tamaño tiene dos precios, se avisa (pendiente con el dueño).
const porNombre = new Map<string, ProductView[]>();
for (const p of cat) {
  const k = p.name.toLowerCase().trim();
  porNombre.set(k, [...(porNombre.get(k) || []), p]);
}

const lineas: { grupo: string; texto: string }[] = [];
for (const grupo of porNombre.values()) {
  const p = grupo[0];
  const pres = new Map<string, Set<number>>();
  for (const g of grupo) {
    const lista = g.presentations?.length ? g.presentations : [{ label: g.presentacion || "Unidad", priceCOP: g.priceCOP }];
    for (const x of lista) pres.set(x.label, new Set([...(pres.get(x.label) || []), x.priceCOP]));
  }
  const dudoso = [...pres.values()].some((s) => s.size > 1);
  const precio = [...pres.entries()].map(([l, s]) => `${l} ${[...s].map(cop).join(" o ")}`).join(" / ");
  const v = V.productos[p.slug] || {};
  const forma = formaDe(p);
  const dosis = v.dosificacion || grupo.map((g) => usoLimpio(g.usage).dosis).find(Boolean) || "";
  const texto = [
    `• ${p.name}`,
    forma ? forma.toUpperCase() : "",
    `${precio} + envío`,
    dudoso ? "⚠️precio por confirmar con asesor" : "",
    p.shortDesc ? corto(p.shortDesc, 70) : "",
    dosis ? `Dosis: ${corto(dosis, 130)}${v.dosificacion ? "" : " (ficha)"}` : "",
  ].filter(Boolean).join(" | ");
  lineas.push({ grupo: p.categoryName.toUpperCase(), texto });
}

const grupos = new Map<string, string[]>();
for (const l of lineas.sort((a, b) => a.grupo.localeCompare(b.grupo) || a.texto.localeCompare(b.texto))) {
  grupos.set(l.grupo, [...(grupos.get(l.grupo) || []), l.texto]);
}
const cuerpo = [...grupos.entries()].map(([g, ls]) => `== ${g} ==\n${ls.join("\n")}`).join("\n\n");
const catalogo =
  `CATÁLOGO OFICIAL ROOSTER DELUXE — PAGO ANTICIPADO (sale de la plataforma, ${V._actualizado}). ` +
  `Esta lista MANDA sobre cualquier precio escrito en otra parte del prompt. Todo es "+ envío" (el envío se paga al recibir). ` +
  `Si un producto NO está aquí, no lo manejamos. "(ficha)" = dosis de la ficha, aún sin confirmar por el dueño.\n\n` + cuerpo;
const reglas = readFileSync("bot_uchat/08_REGLAS_DURAS_ANTICIPADO.md", "utf8").match(/```\n([\s\S]*?)```/)![1].trim();

writeFileSync(out, JSON.stringify({ catalogo, reglas }));
console.log(`catálogo ${catalogo.length} chars (tope 20.000) · reglas ${reglas.length} chars · ${porNombre.size} productos`);
if (catalogo.length > 19500) { console.error("⚠️ El catálogo pasa el tope de UChat: acorta descripciones."); process.exit(1); }
