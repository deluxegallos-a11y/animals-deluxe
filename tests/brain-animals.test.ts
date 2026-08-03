/* Cerebro de identificación — tenant ANIMALS DELUXE (catálogo y reglas propias).
   Corre contra tests/fixtures/animals-catalog.json (congelado desde prod). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { identifyProduct } from "@/lib/ai/brain";
import { ALIAS_CATALOG_ANIMALS, NEED_RULES_ANIMALS, ANIMALS_RULES } from "@/lib/ai/aliases";
import type { ProductView } from "@/lib/ai/types";
import catalogJson from "@/tests/fixtures/animals-catalog.json";

const cat = catalogJson as unknown as ProductView[];

function id(q: string) {
  return identifyProduct(q, cat, [], ANIMALS_RULES);
}
function slugs(q: string): string[] {
  const r = id(q);
  const list = r.options.length ? r.options : r.product ? [r.product] : [];
  return list.map((p) => p.slug);
}

/* ---------- integridad ---------- */

test("ANIMALS: todos los slugs de alias existen en el catálogo real", () => {
  const known = new Set(cat.map((p) => p.slug));
  const faltan: string[] = [];
  for (const e of ALIAS_CATALOG_ANIMALS) for (const s of e.slugs) if (!known.has(s)) faltan.push(s);
  assert.deepEqual(faltan, [], `slugs inexistentes: ${faltan.join(", ")}`);
});

test("ANIMALS: todos los slugs/categorías de NEED_RULES existen", () => {
  const known = new Set(cat.map((p) => p.slug));
  const cats = new Set(cat.map((p) => p.categorySlug));
  const faltan: string[] = [];
  for (const r of NEED_RULES_ANIMALS) {
    for (const s of r.slugs || []) if (!known.has(s)) faltan.push(s);
    if (r.categorySlug && !cats.has(r.categorySlug)) faltan.push(`cat:${r.categorySlug}`);
  }
  assert.deepEqual(faltan, [], `referencias inexistentes: ${faltan.join(", ")}`);
});

/* ---------- apodos → slug de animals ---------- */

test("ANIMALS apodos: rebamba/la 77/furi/siano max resuelven al slug de animals", () => {
  assert.deepEqual(slugs("Rebamba"), ["red-copping-mamba"]);
  assert.deepEqual(slugs("la 77"), ["super-energy-77"]);
  assert.deepEqual(slugs("furi"), ["american-rooster-fury"]);
  assert.deepEqual(slugs("siano max"), ["cyanomax-b12-5500"]);
  assert.deepEqual(slugs("la cobra"), ["energy-cobra"]);
});

/* ---------- BUG del 22-jul, mismo blindaje en animals ---------- */

const DESP = ["gallo-purga-plus", "purge-beach", "rooster-and-worm", "super-cobra-500"];

test("ANIMALS BUG: 'pastillas para parásitos' → desparasitantes (categoría animals)", () => {
  const r = id("pastillas para parásitos");
  assert.equal(r.status, "category");
  const s = r.options.map((p) => p.slug);
  assert.ok(s.length > 0 && s.every((x) => DESP.includes(x)), `fue ${s.join(", ")}`);
  assert.ok(!s.some((x) => x.includes("cure-chest")), "cayó en respiratorio");
});

test("ANIMALS BUG: 'pastillas para pulgas, para parásitos' → desparasitantes", () => {
  const r = id("pastillas para pulgas, para parásitos");
  assert.equal(r.status, "category");
  assert.ok(r.options.map((p) => p.slug).every((x) => DESP.includes(x)));
});

test("ANIMALS: necesidad amplia de vitaminas → CATEGORÍA vitaminas, no un producto suelto", () => {
  for (const q of ["vitaminas y minerales", "la que trae vitaminas"]) {
    const r = id(q);
    assert.equal(r.status, "category", `'${q}' status ${r.status}`);
    assert.ok(r.options.every((p) => p.categorySlug === "vitaminas"), `'${q}' → ${r.options.map((p) => p.slug).join(", ")}`);
  }
});

test("ANIMALS: 'para la pelea' / 'energía' → categoría energia", () => {
  for (const q of ["algo para la pelea", "necesito energía pal gallo"]) {
    const r = id(q);
    assert.equal(r.status, "category", `'${q}' status ${r.status}`);
    assert.ok(r.options.every((p) => p.categorySlug === "energia"), `'${q}' → ${r.options.map((p) => p.slug).join(", ")}`);
  }
});

test("ANIMALS: 'para las pulgas' → shampoo/omega (no lice-free, que no existe aquí)", () => {
  const s = slugs("para las pulgas");
  // Plume King es solo de Rooster Deluxe: el shampoo de contra entrega es el Deluxe.
  assert.ok(s.includes("rooster-deluxe-shampoo"), `fue ${s.join(", ")}`);
});

/* ---------- productos exclusivos de animals ---------- */

test("ANIMALS: 'músculo para perro' → More Muscle Dogs", () => {
  assert.ok(slugs("músculo para mi perro").includes("more-muscle-dogs"), slugs("músculo para mi perro").join(","));
});

test("ANIMALS: 'algo para el caballo' → Horse Deluxe", () => {
  assert.ok(slugs("algo para el caballo").includes("horse-deluxe"));
});

test("ANIMALS: Red Rooster es solo de Rooster Deluxe → NO se ofrece aquí", () => {
  for (const q of ["enrojecedor", "red rooster", "quiero el red rooster"]) {
    const r = id(q);
    assert.ok(!slugs(q).includes("red-rooster"), `'${q}' ofreció red-rooster`);
    // y no debe sustituirlo por otro producto al azar
    assert.ok(r.status === "not_found" || r.matchedBy === "alias" || r.matchedBy === "need", `'${q}' → ${r.status}/${r.matchedBy}/${r.product?.slug}`);
  }
});

/* ---------- basura ---------- */

test("ANIMALS: queries basura NUNCA devuelven producto", () => {
  for (const q of ["asdfxyz", "xkcd 123", "zzzzzz"]) {
    assert.equal(id(q).status, "not_found", `'${q}' no debió matchear`);
  }
});
