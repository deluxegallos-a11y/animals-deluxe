/* NUNCA MEZCLAR ANIMALES.
   Bug real (WhatsApp, 1-ago): a un cliente de gallos el bot le ofreció
   "More Muscle en polvo (400 gr)" — que es el suplemento de PERROS — diciendo que
   servía "para subir de peso y masa muscular en gallos". Mismo agujero con
   Horse Deluxe (caballos) para consultas de proteína.
   Un producto de perro o de caballo SOLO puede salir si el cliente nombra ese animal. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { identifyProduct } from "@/lib/ai/brain";
import { ANIMALS_RULES } from "@/lib/ai/aliases";
import { searchProducts, speciesPool, detectAnimal, animalOf } from "@/lib/ai/search";
import type { ProductView } from "@/lib/ai/types";
import catalogJson from "@/tests/fixtures/animals-catalog.json";

const cat = catalogJson as unknown as ProductView[];

function slugs(q: string): string[] {
  const r = identifyProduct(q, cat, [], ANIMALS_RULES);
  const list = r.options.length ? r.options : r.product ? [r.product] : [];
  return list.map((p) => p.slug);
}
const PERRO_CABALLO = ["more-muscle-dogs", "more-muscle-dogs-3m", "horse-deluxe"];

/* ---------- detección de animal ---------- */

test("el animal NOMBRADO gana sobre la palabra de etapa", () => {
  // "engordar" mandaba a pollos aunque el cliente dijera "gallo".
  assert.equal(detectAnimal("quiero engordar mi gallo"), "gallos");
  assert.equal(detectAnimal("algo para engordar mis pollos"), "pollos");
  assert.equal(detectAnimal("músculo para mi perro"), "perros");
  assert.equal(detectAnimal("proteína para el caballo"), "caballos");
});

test("'engordar' a secas ya no clasifica como pollos", () => {
  assert.equal(detectAnimal("para engordar"), null);
});

/* ---------- el cerebro no cruza especies ---------- */

test("BUG: consulta de músculo/masa sin nombrar perro → NUNCA el producto de perros", () => {
  for (const q of ["musculo", "algo para el musculo", "more muscle", "proteina para subir masa", "para subir de peso y masa muscular"]) {
    const s = slugs(q);
    const cruce = s.filter((x) => PERRO_CABALLO.includes(x));
    assert.deepEqual(cruce, [], `"${q}" devolvió producto de otra especie: ${s.join(", ")}`);
  }
});

test("el cliente que SÍ nombra al perro sigue recibiendo More Muscle Dogs", () => {
  assert.ok(slugs("músculo para mi perro").includes("more-muscle-dogs"), slugs("músculo para mi perro").join(", "));
  assert.ok(slugs("more muscle dogs").includes("more-muscle-dogs"), slugs("more muscle dogs").join(", "));
  assert.ok(slugs("algo para mi perro flaco").includes("more-muscle-dogs"), slugs("algo para mi perro flaco").join(", "));
});

test("el cliente que nombra al caballo sigue recibiendo Horse Deluxe", () => {
  assert.ok(slugs("proteína para mi caballo").includes("horse-deluxe"), slugs("proteína para mi caballo").join(", "));
});

test("una consulta de gallo nunca devuelve opciones de dos especies", () => {
  for (const q of ["masa muscular", "para engordar", "polvo", "suplemento", "proteina", "vitaminas"]) {
    const r = identifyProduct(q, cat, [], ANIMALS_RULES);
    const list = r.options.length ? r.options : r.product ? [r.product] : [];
    const especies = new Set(list.map(animalOf));
    assert.ok(especies.size <= 1 || (!especies.has("perros") && !especies.has("caballos")),
      `"${q}" mezcló especies: ${list.map((p) => `${p.slug}[${animalOf(p)}]`).join(", ")}`);
  }
});

/* ---------- el pool y el ranking (sugerencias) ---------- */

test("speciesPool excluye perro/caballo cuando el cliente no los nombra", () => {
  const pool = speciesPool("algo para la masa muscular", cat).map((p) => p.slug);
  for (const s of PERRO_CABALLO) assert.ok(!pool.includes(s), `${s} no debía estar en el pool`);
  assert.ok(pool.includes("weight-muscle-protein"));
});

test("speciesPool deja SOLO perros cuando el cliente nombra al perro", () => {
  const pool = speciesPool("algo para mi perro", cat);
  assert.ok(pool.length > 0);
  assert.ok(pool.every((p) => animalOf(p) === "perros"), pool.map((p) => p.slug).join(", "));
});

test("el ranking de sugerencias tampoco cuela perro/caballo ('polvo')", () => {
  const r = searchProducts("polvo", speciesPool("polvo", cat));
  const top = r.ranked.slice(0, 5).map((x) => x.product.slug);
  for (const s of PERRO_CABALLO) assert.ok(!top.includes(s), `sugerencias colaron ${s}: ${top.join(", ")}`);
});

/* ---------- gallos y pollos SÍ comparten (el pollito es gallo joven) ---------- */

test("gallos y pollos comparten pool", () => {
  const pool = speciesPool("levante", cat).map(animalOf);
  assert.ok(pool.includes("gallos") && pool.includes("pollos"));
});
