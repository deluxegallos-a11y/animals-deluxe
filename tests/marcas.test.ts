/* SEPARACIÓN DE MARCAS (M-CERO) — redirección cruzada entre los dos negocios.

   Bug real que arregla: el bot de Animals Deluxe (contra entrega) recibía "botas"
   o "canilleras" —que solo vende Rooster Deluxe (anticipado)— y respondía
   not_found con mensaje vacío. La venta se perdía en silencio en vez de mandar al
   cliente al canal que sí despacha eso.

   Estos tests corren contra los catálogos REALES congelados de los dos tenants,
   sin DB: se prueba la lógica pura (exclusividad + confianza del match). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { identifyProduct } from "@/lib/ai/brain";
import { ANIMALS_RULES } from "@/lib/ai/aliases";
import {
  exclusivosDelOtro, matchConfiable, redireccionValida, telLegible, waLink,
  mensajeRedireccion, politicaDe, politicaTexto,
} from "@/lib/ai/marcas";
import type { ProductView } from "@/lib/ai/types";
import animalsJson from "@/tests/fixtures/animals-catalog.json";
import roosterJson from "@/tests/fixtures/rooster-catalog.json";

const ANIMALS = animalsJson as unknown as ProductView[];
const ROOSTER = roosterJson as unknown as ProductView[];
const EXCLUSIVOS = exclusivosDelOtro(ROOSTER, ANIMALS);

/** Reglas con las que marcas.ts interroga al catálogo ajeno: ninguna (a propósito). */
const SIN_REGLAS = { aliases: [], needs: [] };

/** Simula el flujo REAL del endpoint: primero el catálogo propio; solo si ahí no
 *  hay nada se mira el del otro negocio. */
function redirige(q: string): ProductView | null {
  const propio = identifyProduct(q, ANIMALS, [], ANIMALS_RULES);
  if (propio.product) return null; // este bot sí lo atiende
  return soloOtroCatalogo(q);
}

/** Solo la mitad "otro catálogo", sin el guardia del catálogo propio. */
function soloOtroCatalogo(q: string): ProductView | null {
  const r = identifyProduct(q, EXCLUSIVOS, [], SIN_REGLAS);
  return redireccionValida(q, r) ? r.product : null;
}

/* ---------- exclusividad ---------- */

test("los productos que Animals TAMBIÉN vende no quedan como exclusivos de Rooster", () => {
  const slugs = new Set(EXCLUSIVOS.map((p) => p.slug));
  // Estos existen activos en los dos catálogos: son venta legítima contra entrega.
  for (const s of ["energy-cobra", "dragon-rooster", "rooster-booster", "super-b12-max"]) {
    assert.equal(slugs.has(s), false, `${s} se vende en ambas marcas: NO debe redirigir`);
  }
});

test("los implementos son exclusivos de Rooster Deluxe", () => {
  const slugs = new Set(EXCLUSIVOS.map((p) => p.slug));
  for (const s of ["botas-canilleras", "botas-cuero", "comedero-profundo", "tijera-truper"]) {
    assert.equal(slugs.has(s), true, `${s} solo lo vende Rooster: debe redirigir`);
  }
});

test("exclusivosDelOtro compara por slug Y por nombre normalizado", () => {
  const propios = [{ slug: "omega-3", name: "Omega-3 for Rooster" }] as ProductView[];
  const otros = [
    { slug: "omega-3", name: "Omega 3" },            // mismo slug
    { slug: "omega-3-rooster", name: "OMEGA-3  FOR ROOSTER" }, // mismo nombre, otro slug
    { slug: "botas-goma", name: "Botas Goma" },      // exclusivo de verdad
  ] as ProductView[];
  assert.deepEqual(exclusivosDelOtro(otros, propios).map((p) => p.slug), ["botas-goma"]);
});

/* ---------- redirección ---------- */

test("«botas» y «canilleras» redirigen al canal anticipado", () => {
  for (const q of ["botas", "canilleras", "botas canilleras", "botas de goma"]) {
    const p = redirige(q);
    assert.ok(p, `"${q}" debería redirigir a la otra marca`);
    assert.match(p!.name.toLowerCase(), /bota|canillera/);
  }
});

test("«comedero» redirige (era el bug «comedero para todo»)", () => {
  const p = redirige("comedero");
  assert.ok(p, "comedero debería redirigir a Rooster Deluxe");
  assert.match(p!.name.toLowerCase(), /comedero/);
});

test("un producto que Animals SÍ vende nunca redirige", () => {
  for (const q of ["energy cobra", "la cobra", "dragon rooster", "rooster booster", "more muscle dogs"]) {
    assert.equal(redirige(q), null, `"${q}" es de Animals: no debe mandar al otro canal`);
  }
});

test("el catálogo ajeno no produce falsos positivos ni sin el guardia propio", () => {
  // Estos resolvían con score altísimo contra productos que no tienen nada que ver:
  //   "dragon rooster" → Dopping Dragón Mamba (1.00) · "la cobra" → Candados Cobre
  //   "rooster booster" → Beak Boost (0.75)
  // Son productos que Animals SÍ vende: redirigirlos sería despedir a un cliente propio.
  for (const q of ["dragon rooster", "la cobra", "rooster booster"]) {
    assert.equal(soloOtroCatalogo(q), null, `"${q}" no puede resolver en el catálogo ajeno`);
  }
});

test("un query solo de palabras genéricas nunca redirige", () => {
  // "gallos", "ejemplar", "implemento" están en las keywords de casi todo el
  // catálogo ajeno: solas no identifican nada y mandarían a cualquiera al otro canal.
  for (const q of ["gallos", "para gallos", "ejemplar", "implemento", "algo pa los gallos"]) {
    assert.equal(soloOtroCatalogo(q), null, `"${q}" es genérico: no debe redirigir`);
  }
});

test("un nombre pegado encuentra el producto separado (vitapower → Vita Power)", () => {
  // vitapower está bloqueado en Animals; en Rooster se llama "Vita Power".
  const p = soloOtroCatalogo("vitapower");
  assert.ok(p, "vitapower debería redirigir al canal anticipado");
  assert.match(p!.name.toLowerCase().replace(/\s+/g, ""), /vitapower/);
});

test("redireccionValida exige que TODO el query esté en el producto", () => {
  const botas = EXCLUSIVOS.find((p) => p.slug === "botas-canilleras")!;
  const ok = { status: "found", product: botas, matchedBy: "name", score: 1, options: [], ranked: [], norm: {} } as never;
  assert.equal(redireccionValida("botas canilleras", ok), true);
  // "rooster" no aparece ni en el nombre ni en las keywords de Botas Canilleras.
  assert.equal(redireccionValida("botas rooster", ok), false);
});

test("una NECESIDAD vaga nunca redirige (mandaría al otro canal a un cliente propio)", () => {
  for (const q of ["algo para vitaminas", "necesito vitaminas", "para engordar", "algo pa la energia"]) {
    assert.equal(redirige(q), null, `"${q}" es una necesidad, no un producto de la otra marca`);
  }
});

test("basura y query vacío no redirigen", () => {
  for (const q of ["", "   ", "https://cdn.uchat.com/audio/abc.mp3", "??", "ok"]) {
    assert.equal(redirige(q), null, `"${q}" no debe redirigir`);
  }
});

test("un producto bloqueado por catalog-rules cuenta como de la otra marca", () => {
  // gallo-purga-plus está bloqueado en Animals → el catálogo propio ya no lo trae,
  // así que "Gallo Purga" de Rooster queda exclusivo y el cliente sí es redirigido.
  const propios = ANIMALS.filter((p) => p.slug !== "gallo-purga-plus");
  const ex = exclusivosDelOtro(ROOSTER, propios);
  const r = identifyProduct("gallo purga", ex, [], SIN_REGLAS);
  assert.ok(redireccionValida("gallo purga", r), "gallo purga debería redirigir al canal anticipado");
});

/* ---------- confianza del match ---------- */

test("matchConfiable rechaza need, alias, vacío y fuzzy flojo", () => {
  const base = { product: EXCLUSIVOS[0], options: [], ranked: [], norm: {} } as never;
  const mk = (o: object) => ({ ...(base as object), ...o }) as never;
  assert.equal(matchConfiable(mk({ status: "category", matchedBy: "need", score: 0 })), false);
  assert.equal(matchConfiable(mk({ status: "not_found", matchedBy: "", score: 0 })), false);
  assert.equal(matchConfiable(mk({ status: "found", matchedBy: "fuzzy", score: 0.4 })), false);
  assert.equal(matchConfiable(mk({ status: "found", matchedBy: "fuzzy", score: 0.8 })), true);
  // "alias" NO basta: las tablas de alias del otro tenant apuntan a su catálogo
  // completo y se recuelgan del producto equivocado sobre el subconjunto exclusivo.
  assert.equal(matchConfiable(mk({ status: "found", matchedBy: "alias", score: 0 })), false);
  assert.equal(matchConfiable(mk({ status: "ambiguous", matchedBy: "name", score: 0 })), true);
});

/* ---------- mensaje y contacto ---------- */

test("telLegible normaliza el número del asesor", () => {
  assert.equal(telLegible("+573122911088"), "312 291 1088");
  assert.equal(telLegible("573122911088"), "312 291 1088");
  assert.equal(telLegible("3122911088"), "312 291 1088");
  assert.equal(telLegible(""), "");
});

test("waLink antepone el indicativo 57", () => {
  assert.equal(waLink("3122911088"), "https://wa.me/573122911088");
  assert.equal(waLink("+573122911088"), "https://wa.me/573122911088");
  assert.equal(waLink(""), "");
});

test("el mensaje de redirección nombra el producto, la marca y el número", () => {
  const m = mensajeRedireccion("Botas Canilleras", "Rooster Deluxe", "+573122911088", true);
  assert.match(m, /Botas Canilleras/);
  assert.match(m, /Rooster Deluxe/);
  assert.match(m, /312 291 1088/);
  assert.match(m, /adelantado/);
  assert.doesNotMatch(m, /contra entrega/i, "no puede prometer contra entrega algo del canal anticipado");
});

test("sin número el mensaje remite al asesor, no queda cojo", () => {
  const m = mensajeRedireccion("Botas Goma", "Rooster Deluxe", "", true);
  assert.match(m, /asesor/);
  assert.doesNotMatch(m, /Escribile al \*\*/);
});

/* ---------- política de pago ---------- */

test("politicaDe sale del tenant, no del producto", () => {
  assert.equal(politicaDe({ paymentMode: "anticipado" } as never), "anticipado");
  assert.equal(politicaDe({ paymentMode: "contra_entrega" } as never), "contra_entrega");
  assert.equal(politicaDe(null), "contra_entrega", "sin tenant (web pública) → contra entrega");
  assert.equal(politicaDe(undefined), "contra_entrega");
});

test("politicaTexto nunca mezcla las dos formas de pago", () => {
  assert.match(politicaTexto("anticipado"), /adelantado/);
  assert.doesNotMatch(politicaTexto("anticipado"), /contra entrega/i);
  assert.match(politicaTexto("contra_entrega"), /al recibir/);
});
