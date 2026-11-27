/* Cerebro de identificación — corre contra el catálogo REAL de rooster-deluxe
   (tests/fixtures/rooster-catalog.json, congelado desde la DB de producción). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { identifyProduct, phonetic, similarity, normalizeQuery } from "@/lib/ai/brain";
import { ALIAS_CATALOG, NEED_RULES } from "@/lib/ai/aliases";
import type { ProductView } from "@/lib/ai/types";
import catalogJson from "@/tests/fixtures/rooster-catalog.json";

const cat = catalogJson as unknown as ProductView[];

/** slugs devueltos (producto + opciones). */
function slugs(q: string): string[] {
  const r = identifyProduct(q, cat);
  const list = r.options.length ? r.options : r.product ? [r.product] : [];
  return list.map((p) => p.slug);
}
function status(q: string) {
  return identifyProduct(q, cat).status;
}

/* ---------- integridad del catálogo de alias ---------- */

test("todos los slugs de ALIAS_CATALOG existen en el catálogo real", () => {
  const known = new Set(cat.map((p) => p.slug));
  const faltan: string[] = [];
  for (const e of ALIAS_CATALOG) for (const s of e.slugs) if (!known.has(s)) faltan.push(s);
  assert.deepEqual(faltan, [], `slugs inexistentes: ${faltan.join(", ")}`);
});

test("todos los slugs de NEED_RULES existen en el catálogo real", () => {
  const known = new Set(cat.map((p) => p.slug));
  const cats = new Set(cat.map((p) => p.categorySlug));
  const faltan: string[] = [];
  for (const r of NEED_RULES) {
    for (const s of r.slugs || []) if (!known.has(s)) faltan.push(s);
    if (r.categorySlug && !cats.has(r.categorySlug)) faltan.push(`cat:${r.categorySlug}`);
  }
  assert.deepEqual(faltan, [], `referencias inexistentes: ${faltan.join(", ")}`);
});

/* ---------- PASO 0: normalización y fonética ---------- */

test("fonética: colapsa v/b, z/s, ce/se, ll/y, mb/nb", () => {
  assert.equal(phonetic("vermicina"), phonetic("bermicina"));
  assert.equal(phonetic("cyano"), phonetic("siano"));
  assert.equal(phonetic("mamba"), phonetic("manba"));
  assert.equal(phonetic("gallo"), phonetic("gayo"));
});

test("similarity: 'cola' NO se parece a 'cobra' (sin padding)", () => {
  assert.ok(similarity("cola", "cobra") < 0.35, `fue ${similarity("cola", "cobra")}`);
  assert.ok(similarity("bermicina", "vermicina") > 0.8);
});

test("normalizeQuery quita muletillas pero conserva el query crudo", () => {
  const n = normalizeQuery("quiero foto de la mona por favor");
  assert.equal(n.stripped, "mona");
  assert.ok(n.q.includes("la mona"), "el crudo conserva el artículo (alias 'la mamba', 'la 77')");
});

/* ---------- TESTS OBLIGATORIOS del brief ---------- */

test("q='Rebamba' → Red Dopping Mamba", () => {
  assert.deepEqual(slugs("Rebamba"), ["red-dopping-mamba"]);
});

test("q='botas' → las 3 botas, ambiguous, misma categoría", () => {
  const r = identifyProduct("botas", cat);
  assert.equal(r.status, "ambiguous");
  assert.deepEqual(
    r.options.map((p) => p.slug).sort(),
    ["botas-canilleras", "botas-cuero", "botas-goma"],
  );
  assert.equal(new Set(r.options.map((p) => p.categorySlug)).size, 1);
});

test("q='muñeco de entrenamiento' → Mona (NO Comedero)", () => {
  assert.deepEqual(slugs("muñeco de entrenamiento"), ["mona"]);
});

test("q='plaquitas' → Placas Personalizadas", () => {
  assert.deepEqual(slugs("plaquitas"), ["placas-personalizadas"]);
});

test("q='bermicina' → Vermicina", () => {
  assert.deepEqual(slugs("bermicina"), ["vermicina-vermifugo"]);
});

test("q='siano max' → Cyano Max", () => {
  assert.deepEqual(slugs("siano max"), ["cyano-max"]);
});

test("q='la 77' → Super Energy 77", () => {
  assert.deepEqual(slugs("la 77"), ["super-energy-77"]);
});

test("q='furi' → Rooster Fury", () => {
  assert.deepEqual(slugs("furi"), ["rooster-fury"]);
});

test("q='que le crezca la cola' → Omega 3 (NO Rooster Smallpox)", () => {
  const r = identifyProduct("que le crezca la cola", cat);
  assert.equal(r.status, "category");
  assert.equal(r.options[0].slug, "omega-3");
  assert.ok(!r.options.some((p) => p.slug === "rooster-smallpox"));
});

test("q='pal moquillo' → Cure Chest / Clear Chicks / Septibron", () => {
  const r = identifyProduct("pal moquillo", cat);
  assert.equal(r.status, "category");
  const s = r.options.map((p) => p.slug);
  assert.ok(s.every((x) => /cure-chest|clear-chicks|septibron/.test(x)), `fue ${s.join(", ")}`);
});

test("q='parrillas de 90 grados' → Patapiojas con nota de 'solo normales'", () => {
  const r = identifyProduct("parrillas de 90 grados", cat);
  assert.equal(r.product?.slug, "patapiojas");
  assert.match(r.nota || "", /normales/i);
});

test("q='asdfxyz' → not_found", () => {
  assert.equal(status("asdfxyz"), "not_found");
});

test("q='quiero foto de la mona' → Mona", () => {
  assert.deepEqual(slugs("quiero foto de la mona"), ["mona"]);
});

test("q='comida para pollitos' → Master Pollito", () => {
  assert.deepEqual(slugs("comida para pollitos"), ["master-pollito"]);
});

/* ---------- no-regresión: los fallos reales reportados ---------- */

test("nunca devuelve Comedero por 'botas' ni por 'muñeco'", () => {
  for (const q of ["botas", "bota", "boticas", "muñeco de entrenamiento", "muñeco", "monas de cabo"]) {
    assert.ok(!slugs(q).some((s) => s.startsWith("comedero")), `'${q}' devolvió un comedero`);
  }
});

test("queries basura NUNCA devuelven producto", () => {
  for (const q of ["asdfxyz", "xkcd 123", "zzzzzz", "12345678"]) {
    assert.equal(status(q), "not_found", `'${q}' no debió matchear`);
  }
});

test("alias con artículo no se los come el filtro de muletillas", () => {
  assert.deepEqual(slugs("la mamba"), ["red-dopping-mamba"]);
  assert.deepEqual(slugs("la cobra"), ["energy-cobra"]);
  assert.deepEqual(slugs("el atp"), ["atp-fighter-rooster"]);
});

test("alias más largo gana sobre el corto", () => {
  assert.deepEqual(slugs("dragon mamba"), ["dopping-dragon-mamba"]);
  assert.deepEqual(slugs("atp gold"), ["atp-rooster-gold"]);
  assert.deepEqual(slugs("cobra 500"), ["super-cobra-500"]);
});

test("frases largas de WhatsApp igual identifican", () => {
  assert.deepEqual(slugs("buenas señor me puede mandar foto del purgueback porfa"), ["purgebeak"]);
  assert.deepEqual(slugs("hola cuanto vale la vitalmin"), ["vitalmin-rooster"]);
});

test("'pecho' → los 2 Cure Chest (ambiguous, misma categoría)", () => {
  const r = identifyProduct("algo pal pecho", cat);
  assert.equal(r.status, "ambiguous");
  assert.ok(r.options.every((p) => p.slug.startsWith("cure-chest")));
});

/* ---------- BUG 22-jul: fallback arbitrario + forma que secuestra necesidad ----------
   El comedero salía para TODO; y "pastillas para parásitos" caía en
   cure-chest-…-PASTILLAS (respiratorio) porque la FORMA "pastillas" hacía match
   ortográfico. Las palabras de forma / necesidad amplia NO deben identificar SKU. */

const VERMI = ["gallo-purga", "galliverm-super", "vermi-ultra", "vermicina-vermifugo"];

test("BUG: 'pastillas para parásitos' → desparasitantes (NUNCA comedero ni respiratorio)", () => {
  const r = identifyProduct("pastillas para parásitos", cat);
  assert.equal(r.status, "category");
  const s = r.options.map((p) => p.slug);
  assert.ok(s.length > 0 && s.every((x) => VERMI.includes(x)), `fue ${s.join(", ")}`);
  assert.ok(!s.some((x) => x.startsWith("comedero")), "devolvió un comedero");
  assert.ok(!s.some((x) => x.includes("cure-chest")), "cayó en respiratorio");
});

test("BUG (test del brief): 'pastillas para pulgas, para parásitos' → desparasitantes, jamás comedero", () => {
  const r = identifyProduct("pastillas para pulgas, para parásitos", cat);
  assert.equal(r.status, "category");
  const s = r.options.map((p) => p.slug);
  assert.ok(s.length > 0 && s.every((x) => VERMI.includes(x)), `fue ${s.join(", ")}`);
  assert.ok(!s.some((x) => x.startsWith("comedero")), "devolvió un comedero");
});

test("'para las pulgas' → Lice Free (pulgas ya mapeado)", () => {
  const r = identifyProduct("para las pulgas", cat);
  const s = (r.options.length ? r.options : r.product ? [r.product] : []).map((p) => p.slug);
  assert.ok(s.includes("lice-free"), `fue ${s.join(", ")}`);
  assert.ok(!s.some((x) => x.startsWith("comedero")));
});

test("necesidad amplia de vitaminas → CATEGORÍA vitaminas, no un inyectable suelto ni comedero", () => {
  for (const q of ["vitaminas y minerales", "la que trae vitaminas"]) {
    const r = identifyProduct(q, cat);
    assert.equal(r.status, "category", `'${q}' status ${r.status}`);
    const s = r.options.map((p) => p.slug);
    assert.ok(r.options.every((p) => p.categorySlug === "vitaminas-y-suplementos"), `'${q}' → ${s.join(", ")}`);
    assert.ok(!s.some((x) => x.startsWith("comedero")), `'${q}' devolvió comedero`);
  }
});

test("no-regresión: ninguna necesidad del reporte del 22-jul devuelve comedero", () => {
  const reportados = [
    "pastillas para parásitos", "botas", "muñeco de entrenamiento",
    "vitaminas y minerales", "la que trae vitaminas", "desparasitante",
    "para las pulgas", "pastillas para pulgas, para parásitos",
  ];
  for (const q of reportados) {
    const r = identifyProduct(q, cat);
    const s = (r.options.length ? r.options : r.product ? [r.product] : []).map((p) => p.slug);
    assert.ok(!s.some((x) => x.startsWith("comedero")), `'${q}' devolvió comedero: ${s.join(", ")}`);
  }
});
