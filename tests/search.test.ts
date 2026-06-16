import { test } from "node:test";
import assert from "node:assert/strict";
import { searchProducts } from "@/lib/ai/search";
import { demoProducts } from "@/lib/demo-data";

const cat = demoProducts;

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
