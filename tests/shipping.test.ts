import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeShipping,
  calcularFlete,
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

test("calcularFlete = 20.000 + 7% (tabla del dueño)", () => {
  assert.equal(calcularFlete(50000), 23500);
  assert.equal(calcularFlete(70000), 24900);
  assert.equal(calcularFlete(150000), 30500);
  assert.equal(calcularFlete(180000), 32600);
});

test("flete por valor: mismo para cualquier ciudad (depende del producto, no de la zona)", () => {
  for (const ciudad of ["Medellín", "Bogotá", "Morales", "Pueblito Lejano"]) {
    const s = computeShipping({ ciudad, subtotalCop: 70000, unidades: 1 });
    assert.equal(s.costo_envio, 24900, `${ciudad} con $70.000 debe dar 24900`);
  }
  const alto = computeShipping({ ciudad: "Bogotá", subtotalCop: 180000, unidades: 2 });
  assert.equal(alto.costo_envio, 32600);
});

test("envío incluido fuerza costo 0", () => {
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
