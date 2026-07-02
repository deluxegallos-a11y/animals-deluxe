import { test } from "node:test";
import assert from "node:assert/strict";
import { searchProducts, detectAnimal, animalOf, needScore, looksMedical, detectForma, productMatchesForma } from "@/lib/ai/search";
import { demoProducts } from "@/lib/demo-data";

const cat = demoProducts;

test("no fabricar: 'pelota en el ojo' NO puntúa como necesidad en un suplemento muscular", () => {
  const dog = cat.find((p) => p.slug === "more-muscle-dogs");
  if (dog) assert.ok(needScore("perro con pelota en el ojo", dog) < 2.5, "no debe aplicar a salud ocular");
});

test("needScore: query sin necesidad concreta ('algo para mi perro') devuelve -1 (no bloquear)", () => {
  const dog = cat.find((p) => p.slug === "more-muscle-dogs");
  if (dog) assert.equal(needScore("algo para mi perro", dog), -1);
});

test("presentación: 'inyectable' filtra a inyectables; NO devuelve gotas", () => {
  assert.equal(detectForma("algo inyectable para el gallo"), "inyectable");
  const arf = cat.find((p) => p.slug === "american-rooster-fury");
  if (arf) assert.equal(productMatchesForma(arf, "inyectable"), true, "American Rooster Fury es inyectable");
  // un producto de gotas NO debe pasar el filtro inyectable
  const cobra = cat.find((p) => p.slug === "energy-cobra");
  if (cobra) assert.equal(productMatchesForma(cobra, "inyectable"), false);
  // el resultado de búsqueda de 'inyectable' solo trae inyectables
  const r = searchProducts("doping inyectable", cat);
  for (const x of r.ranked) assert.equal(productMatchesForma(x.product, "inyectable"), true);
});

test("looksMedical: síntomas sí, necesidades comerciales no", () => {
  assert.equal(looksMedical("mi perro tiene una pelota en el ojo"), true);
  assert.equal(looksMedical("herida en la pata"), true);
  assert.equal(looksMedical("crecimiento de potro"), false);
  assert.equal(looksMedical("energia para la pelea"), false);
  assert.equal(looksMedical("musculo para mi perro"), false);
});

test("detectAnimal: potro→caballos, perro→perros, pollo→pollos, gallo→gallos", () => {
  assert.equal(detectAnimal("crecimiento de potro"), "caballos");
  assert.equal(detectAnimal("vitaminas para mi perro"), "perros");
  assert.equal(detectAnimal("levante de pollos"), "pollos");
  assert.equal(detectAnimal("energia para el gallo"), "gallos");
  assert.equal(detectAnimal("algo para energia"), null);
});

test("no mezclar animales: 'crecimiento de potro' NO trae productos de gallos", () => {
  const r = searchProducts("crecimiento de potro", cat);
  // todos los resultados rankeados deben ser de caballos
  for (const x of r.ranked) assert.equal(animalOf(x.product), "caballos", `${x.product.slug} no es de caballos`);
  if (r.product) assert.equal(animalOf(r.product), "caballos");
});

test("no mezclar animales: 'músculo para mi perro' solo trae productos de perros", () => {
  const r = searchProducts("musculo para mi perro", cat);
  for (const x of r.ranked) assert.equal(animalOf(x.product), "perros");
});

test("typos: 'enrgy kobra' → energy-cobra", () => {
  const r = searchProducts("enrgy kobra", cat);
  assert.equal(r.product?.slug, "energy-cobra");
});

test("natural + b12: 'vitamina b12' → producto con B12 (categoría vitaminas)", () => {
  const r = searchProducts("vitamina b12", cat);
  assert.ok(r.product, "debe haber match");
  assert.ok(
    ["cyanomax-b12-5500", "rooscer-b12-complete"].includes(r.product!.slug),
    `esperaba un B12, llegó ${r.product!.slug}`,
  );
});

test("lenguaje natural: 'comida para caballo' → horse-deluxe", () => {
  const r = searchProducts("comida para caballo", cat);
  assert.equal(r.product?.slug, "horse-deluxe");
});

test("intent respiratorio: 'algo pa los mocos' → categoría respiratorio", () => {
  const r = searchProducts("algo pa los mocos", cat);
  assert.ok(r.product, "debe recomendar algo");
  assert.equal(r.product!.categorySlug, "respiratorio");
});

test("intent energía: 'energia para la pelea' → categoría energia", () => {
  const r = searchProducts("energia para la pelea", cat);
  assert.ok(r.product, "debe haber match");
  assert.equal(r.product!.categorySlug, "energia");
});

test("query vacío → empty_query con sugerencias", () => {
  const r = searchProducts("", cat);
  assert.equal(r.status, "empty_query");
  assert.equal(r.product, null);
  assert.ok(r.ranked.length > 0);
});

test("nunca explota con basura", () => {
  const r = searchProducts("xyzqwk 123 ###", cat);
  assert.ok(["not_found", "found", "ambiguous"].includes(r.status));
});
