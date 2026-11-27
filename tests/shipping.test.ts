import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeShipping,
  resolveZona,
  pedidoEnvioGratis,
} from "@/lib/ai/shipping";

test("resolveZona: Medellín y metro → local; Bogotá → nacional_metro; desconocida → municipal", () => {
  assert.equal(resolveZona("Medellín"), "local");
  assert.equal(resolveZona("itagui"), "local");
  assert.equal(resolveZona("Bogotá"), "nacional_metro");
  assert.equal(resolveZona("Rionegro"), "regional");
  assert.equal(resolveZona("Pueblito Lejano"), "nacional_municipal");
});

test("resolveZona tolera ciudad con departamento", () => {
  assert.equal(resolveZona("Cali, Valle"), "nacional_metro");
});

test("flete local contraentrega: base + sobreflete(2%) + recargo(5%)", () => {
  // Medellín (local 7900), 1 unidad, producto $70.000, contraentrega
  const s = computeShipping({ ciudad: "Medellín", subtotalCop: 70000, unidades: 1, metodo: "contraentrega" });
  assert.equal(s.zona, "local");
  // base 7900 + sobreflete 2%*70000=1400 + recargo 5%*70000=3500 = 12800
  assert.equal(s.costo_envio, 12800);
  assert.equal(s.envio_gratis, false);
  assert.equal(s.tiempo, "24 a 72 horas");
});

test("flete nacional metro cobra kilo inicial mayor", () => {
  const s = computeShipping({ ciudad: "Bogotá", subtotalCop: 70000, unidades: 1, metodo: "contraentrega" });
  assert.equal(s.zona, "nacional_metro");
  // 17600 + 1400 + 3500 = 22500
  assert.equal(s.costo_envio, 22500);
});

test("anticipado no cobra el recargo del 5%", () => {
  const s = computeShipping({ ciudad: "Medellín", subtotalCop: 70000, unidades: 1, metodo: "anticipado" });
  // 7900 + 1400 (sin recargo contraentrega) = 9300
  assert.equal(s.costo_envio, 9300);
});

test("kilo adicional se suma por unidad extra", () => {
  const s = computeShipping({ ciudad: "Medellín", subtotalCop: 140000, unidades: 2, metodo: "anticipado" });
  // base 7900 + 1*3800 = 11700 ; sobreflete 2%*140000 = 2800 → 14500
  assert.equal(s.desglose.kilos, 2);
  assert.equal(s.costo_envio, 14500);
});

test("declarado mínimo aplica cuando el subtotal es bajo", () => {
  const s = computeShipping({ ciudad: "Medellín", subtotalCop: 10000, unidades: 1, metodo: "anticipado" });
  // declarado = max(10000, 45000) = 45000 → sobreflete 900 ; base 7900 → 8800
  assert.equal(s.costo_envio, 8800);
});

test("envío gratis fuerza costo 0", () => {
  const s = computeShipping({ ciudad: "Bogotá", subtotalCop: 200000, unidades: 1, envioGratis: true });
  assert.equal(s.costo_envio, 0);
  assert.equal(s.envio_gratis, true);
});

test("pedidoEnvioGratis: solo si TODOS los ítems son gratis", () => {
  assert.equal(pedidoEnvioGratis([{ slug: "horse-deluxe" }]), true);
  assert.equal(pedidoEnvioGratis([{ slug: "more-muscle-dogs" }, { slug: "horse-deluxe" }]), true);
  assert.equal(pedidoEnvioGratis([{ slug: "horse-deluxe" }, { slug: "energy-cobra" }]), false);
  assert.equal(pedidoEnvioGratis([{ slug: "energy-cobra", envioGratis: true }]), true);
  assert.equal(pedidoEnvioGratis([]), false);
});
