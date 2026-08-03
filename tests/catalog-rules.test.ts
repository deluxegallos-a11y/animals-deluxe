/* Reglas de filtro de catálogo por tenant.
   Animals Deluxe (contra entrega) NO puede ofrecer productos que son solo de
   Rooster Deluxe (anticipado). Bug real: el bot los mandó por WhatsApp con el
   cierre "contra entrega, pagás al recibir" y esos pedidos no se pueden despachar. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { bloqueadosDe, esBloqueado, filtrarCatalogo } from "@/lib/ai/catalog-rules";
import { ALIAS_CATALOG_ANIMALS, NEED_RULES_ANIMALS } from "@/lib/ai/aliases";

/** Los 5 confirmados contra las conversaciones de WhatsApp. */
const SOLO_ROOSTER = [
  "red-rooster",
  "vitapower",
  "plume-king-shampoo",
  "gallo-purga-plus",
  "rooster-xt-impulsor",
];

test("animals-deluxe bloquea exactamente los productos solo-anticipado", () => {
  assert.deepEqual([...bloqueadosDe("animals-deluxe")].sort(), [...SOLO_ROOSTER].sort());
});

test("filtrarCatalogo saca los bloqueados y deja intacto el resto", () => {
  const catalogo = [
    ...SOLO_ROOSTER.map((slug) => ({ slug })),
    { slug: "rooster-deluxe-max" },
    { slug: "weight-muscle-protein" },
    { slug: "gallo-post-recovery" },
    { slug: "energy-cobra" },
  ];
  const out = filtrarCatalogo("animals-deluxe", catalogo).map((p) => p.slug);
  assert.deepEqual(out, ["rooster-deluxe-max", "weight-muscle-protein", "gallo-post-recovery", "energy-cobra"]);
});

test("Rooster Deluxe Max / Weight Muscle / Post Recovery SÍ son de contra entrega", () => {
  for (const slug of ["rooster-deluxe-max", "weight-muscle-protein", "gallo-post-recovery"]) {
    assert.equal(esBloqueado("animals-deluxe", slug), false, `${slug} no debe estar bloqueado`);
  }
});

test("rooster-deluxe no tiene bloqueos (es el dueño de esos productos)", () => {
  assert.equal(bloqueadosDe("rooster-deluxe").size, 0);
  for (const slug of SOLO_ROOSTER) assert.equal(esBloqueado("rooster-deluxe", slug), false);
});

/* --- integridad: que nadie los vuelva a meter por la puerta de atrás --- */

test("ningún ALIAS de animals apunta a un producto bloqueado", () => {
  const malos: string[] = [];
  for (const e of ALIAS_CATALOG_ANIMALS) {
    for (const s of e.slugs) if (esBloqueado("animals-deluxe", s)) malos.push(`${e.aliases[0]} → ${s}`);
  }
  assert.deepEqual(malos, [], `alias que resucitan un bloqueado: ${malos.join(", ")}`);
});

test("ninguna NEED_RULE de animals apunta a un producto bloqueado", () => {
  const malos: string[] = [];
  for (const r of NEED_RULES_ANIMALS) {
    for (const s of r.slugs || []) if (esBloqueado("animals-deluxe", s)) malos.push(`${r.id} → ${s}`);
  }
  assert.deepEqual(malos, [], `reglas que resucitan un bloqueado: ${malos.join(", ")}`);
});

test("ninguna NEED_RULE de animals se queda sin productos tras el bloqueo", () => {
  const vacias = NEED_RULES_ANIMALS
    .filter((r) => r.slugs && !r.categorySlug)
    .filter((r) => !r.slugs!.some((s) => !esBloqueado("animals-deluxe", s)))
    .map((r) => r.id);
  assert.deepEqual(vacias, [], `reglas sin ningún producto vendible: ${vacias.join(", ")}`);
});
