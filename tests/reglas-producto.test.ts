/* Reglas de negocio por producto: M4 (control_stock), M6.3 (min_unidades)
   y M7 (forma de administración). Todas nacen de bugs reales de producción. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveItems } from "@/lib/ai/orders";
import { formaDe } from "@/lib/ai/search";
import { publicProduct } from "@/lib/ai/present";
import { demoProducts } from "@/lib/demo-data";
import type { ProductView } from "@/lib/ai/types";

const base = demoProducts[0];
const conProd = (over: Partial<ProductView>): ProductView[] => [{ ...base, ...over }];

/* ---------- M4 · el stock NO tumba ventas ---------- */

test("M4: stock 0 sin control_stock NO bloquea (bug: tumbó la venta de CyanoMax)", () => {
  const cat = conProd({ slug: "x", stock: 0, controlStock: false });
  const r = resolveItems([{ slug: "x", cantidad: 1 }], cat);
  assert.equal(r.length, 1);
  assert.equal(r[0].cantidad, 1);
});

test("M4: stock ausente (null/undefined) tampoco bloquea", () => {
  const cat = conProd({ slug: "x", stock: undefined as unknown as number, controlStock: false });
  assert.equal(resolveItems([{ slug: "x", cantidad: 1 }], cat).length, 1);
});

test("M4: solo con control_stock=true un stock 0 bloquea", () => {
  const cat = conProd({ slug: "x", stock: 0, controlStock: true });
  assert.throws(() => resolveItems([{ slug: "x", cantidad: 1 }], cat));
});

test("M4: control_stock=true con stock disponible sí vende", () => {
  const cat = conProd({ slug: "x", stock: 5, controlStock: true });
  assert.equal(resolveItems([{ slug: "x", cantidad: 1 }], cat).length, 1);
});

/* ---------- M6.3 · mínimo de unidades por envío ---------- */

test("M6.3: pedir 1 de un gotero de mínimo 2 sube la cantidad a 2", () => {
  const cat = conProd({ slug: "x", minUnidades: 2, priceCOP: 30000, presentations: [{ label: "Unidad", priceCOP: 30000 }] });
  const r = resolveItems([{ slug: "x", cantidad: 1 }], cat);
  assert.equal(r[0].cantidad, 2);
  assert.equal(r[0].subtotalCop, 60000, "el total se recalcula con la cantidad ajustada");
});

test("M6.3: si ya pide más del mínimo, se respeta su cantidad", () => {
  const cat = conProd({ slug: "x", minUnidades: 2 });
  assert.equal(resolveItems([{ slug: "x", cantidad: 5 }], cat)[0].cantidad, 5);
});

test("M6.3: min_unidades=1 (default) no altera nada", () => {
  const cat = conProd({ slug: "x", minUnidades: 1 });
  assert.equal(resolveItems([{ slug: "x", cantidad: 1 }], cat)[0].cantidad, 1);
});

/* ---------- M7 · forma de administración (nunca adivinar) ---------- */

test("M7: 'inyectable' en la presentación gana sobre el nombre", () => {
  const p = { ...base, name: "Gotas de Campeón", presentacion: "Frasco inyectable", descripcion: "", usage: "", dosificacion: "" };
  assert.equal(formaDe(p), "inyectable");
});

test("M7: el emoji 💉 y la dosis en pechuga marcan inyectable (caso CyanoMax B12 5500)", () => {
  const p = {
    ...base, name: "CyanoMax B12 5500", presentacion: "", usage: "", dosificacion: "", tagline: "", shortDesc: "",
    descripcion: "💉 CYANOMAX B12 5500 — Vitamina B12\n🥄 Modo de uso: mayores de 4 meses, 0.5 ml en la pechuga cada 15 días.",
  };
  assert.equal(formaDe(p), "inyectable", "es inyectable: el bot lo mandaba dar en gotas");
});

test("M7: sin evidencia de forma devuelve '' (el bot NO debe adivinar)", () => {
  const p = { ...base, name: "Candados Cobre", presentacion: "", usage: "", dosificacion: "", descripcion: "Accesorio de cobre.", tagline: "", shortDesc: "", presentations: [] };
  assert.equal(formaDe(p), "");
});

test("M7: el contrato del bot expone forma/uso y las reglas de negocio", () => {
  const p = { ...base, presentacion: "Gotero 30 ml", dosificacion: "4 gotas antes del juego", soloAnticipado: true, minUnidades: 2 };
  const pub = publicProduct(p);
  assert.equal(pub.forma, "gotas");
  assert.equal(pub.uso, "4 gotas antes del juego", "la dosis concreta manda sobre el usage genérico");
  assert.equal(pub.solo_anticipado, true);
  assert.equal(pub.min_unidades, 2);
});

test("M7: sin forma, el contexto del LLM le prohíbe afirmar la vía", () => {
  const p = { ...base, name: "Candados", presentacion: "", usage: "", dosificacion: "", descripcion: "Accesorio.", tagline: "", shortDesc: "", presentations: [] };
  assert.match(publicProduct(p).producto_contexto, /FORMA: no registrada/);
});
