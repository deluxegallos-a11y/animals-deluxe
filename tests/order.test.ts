import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTotals, idempotencyKey, resolveItems, type ResolvedItem } from "@/lib/ai/orders";
import { demoProducts } from "@/lib/demo-data";

const items: ResolvedItem[] = [
  { productId: "p1", slug: "a", name: "A", presentacionLabel: "u", precioCop: 70000, cantidad: 2, subtotalCop: 140000 },
  { productId: "p2", slug: "b", name: "B", presentacionLabel: "u", precioCop: 30000, cantidad: 1, subtotalCop: 30000 },
];

test("total = subtotal + envío − descuento (sin cupón)", () => {
  const t = computeTotals(items, 12000, null);
  assert.equal(t.subtotal, 170000);
  assert.equal(t.descuento, 0);
  assert.equal(t.total, 182000);
});

test("cupón porcentaje aplica sobre subtotal", () => {
  const t = computeTotals(items, 12000, { tipo: "porcentaje", valor: 10 });
  assert.equal(t.descuento, 17000);
  assert.equal(t.total, 170000 - 17000 + 12000);
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
