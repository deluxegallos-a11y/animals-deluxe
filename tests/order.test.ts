import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTotals, idempotencyKey, parsePlainItems, resolveItems, type ResolvedItem } from "@/lib/ai/orders";
import { demoProducts } from "@/lib/demo-data";

const items: ResolvedItem[] = [
  { productId: "p1", slug: "a", name: "A", presentacionLabel: "u", precioCop: 70000, cantidad: 2, subtotalCop: 140000 },
  { productId: "p2", slug: "b", name: "B", presentacionLabel: "u", precioCop: 30000, cantidad: 1, subtotalCop: 30000 },
];

test("total a recaudar = SOLO producto − descuento (el flete NO se suma; se cobra aparte)", () => {
  const t = computeTotals(items, 12000, null);
  assert.equal(t.subtotal, 170000);
  assert.equal(t.descuento, 0);
  assert.equal(t.envio, 12000);      // el flete se reporta aparte…
  assert.equal(t.total, 170000);     // …pero NO entra en el total a recaudar
});

test("cupón porcentaje aplica sobre subtotal (flete fuera del total)", () => {
  const t = computeTotals(items, 12000, { tipo: "porcentaje", valor: 10 });
  assert.equal(t.descuento, 17000);
  assert.equal(t.total, 170000 - 17000); // sin sumar el flete
});

test("cupón fijo se topa al subtotal", () => {
  const t = computeTotals(items, 0, { tipo: "fijo", valor: 999999 });
  assert.equal(t.descuento, 170000);
  assert.equal(t.total, 0);
});

test("idempotencia: misma compra → misma key; método distinto → key distinta", () => {
  const k1 = idempotencyKey("sub1", "contraentrega", items);
  const k2 = idempotencyKey("sub1", "contraentrega", [...items].reverse());
  const k3 = idempotencyKey("sub1", "anticipado", items);
  assert.equal(k1, k2, "el orden de items no debe cambiar la key");
  assert.notEqual(k1, k3, "cambiar el método debe cambiar la key (lección checkout)");
});

test("resolveItems resuelve por slug del catálogo real", () => {
  const r = resolveItems([{ slug: "energy-cobra", cantidad: 1 }], demoProducts);
  assert.equal(r.length, 1);
  assert.equal(r[0].slug, "energy-cobra");
  assert.ok(r[0].precioCop > 0);
});

test("resolveItems lanza si el producto no existe", () => {
  assert.throws(() => resolveItems([{ slug: "no-existe", cantidad: 1 }], demoProducts), /DOMAIN:/);
});

/* --- parsePlainItems: la cantidad NUNCA sale del número dentro del nombre (bug $385M) --- */
// resolver de prueba: "resuelve" cualquier texto que contenga un nombre de producto real.
const resolvesTest = (n: string) =>
  /cyanomax|super energy|hunk|energy cobra|dragon mamba|american rooster/i.test(n);

test("parsePlainItems: dígitos DENTRO del nombre NO son cantidad → cantidad 1", () => {
  // Este es EXACTAMENTE el caso del pedido AD-H3GW.
  assert.deepEqual(parsePlainItems("CyanoMax B12 5500", resolvesTest), [{ name: "CyanoMax B12 5500", cantidad: 1 }]);
  assert.deepEqual(parsePlainItems("Super Energy 77", resolvesTest), [{ name: "Super Energy 77", cantidad: 1 }]);
  assert.deepEqual(parsePlainItems("Hunk 160", resolvesTest), [{ name: "Hunk 160", cantidad: 1 }]);
});

test("parsePlainItems: multiplicador explícito (xN / N unidades) SÍ es cantidad", () => {
  assert.deepEqual(parsePlainItems("American Rooster Fury x2", resolvesTest), [{ name: "American Rooster Fury", cantidad: 2 }]);
  // El número del nombre se conserva y el multiplicador explícito aplica.
  assert.deepEqual(parsePlainItems("CyanoMax B12 5500 x3", resolvesTest), [{ name: "CyanoMax B12 5500", cantidad: 3 }]);
  assert.deepEqual(parsePlainItems("2 Energy Cobra", resolvesTest), [{ name: "Energy Cobra", cantidad: 2 }]);
});

test("parsePlainItems: número al inicio con resto NO-producto → se conserva como nombre, cantidad 1", () => {
  assert.deepEqual(parsePlainItems("777 abcdef ghi", () => false), [{ name: "777 abcdef ghi", cantidad: 1 }]);
});
