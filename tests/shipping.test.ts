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

/* Los 3 casos REALES que el bot cotizó mal (M3). Una versión "por zona" del flete
   cobraba $3.500 (solo el 7%, sin la base de $20.000) o $25.600 donde iban $21.750,
   y el asesor corregía a mano. El flete NO depende de la zona: solo del valor. */
test("regresión M3: los 3 casos reales que el bot cotizó mal", () => {
  // Red Dopping Mamba $50.000 a Suárez, Cauca → el bot dijo total $53.500 (flete $3.500).
  assert.equal(computeShipping({ ciudad: "Suárez, Cauca", subtotalCop: 50000, unidades: 1 }).costo_envio, 23500);
  // Purge Beach $25.000 a Cali → el bot dijo $25.600.
  assert.equal(computeShipping({ ciudad: "Cali", subtotalCop: 25000, unidades: 1 }).costo_envio, 21800);
  // American Rooster Fury $150.000 → este sí cuadraba; no debe cambiar.
  assert.equal(computeShipping({ ciudad: "Bogotá", subtotalCop: 150000, unidades: 1 }).costo_envio, 30500);
});

test("la zona cambia TIEMPOS y confirmación, nunca el precio del flete", () => {
  const sanAndres = computeShipping({ ciudad: "San Andrés", subtotalCop: 70000, unidades: 1 });
  const medellin = computeShipping({ ciudad: "Medellín", subtotalCop: 70000, unidades: 1 });
  assert.equal(sanAndres.costo_envio, medellin.costo_envio, "mismo valor de producto → mismo flete");
  assert.equal(sanAndres.requiere_confirmar, true, "zona apartada debe pedir confirmación");
  assert.equal(medellin.requiere_confirmar, false);
  assert.ok(sanAndres.dias_max > medellin.dias_max, "apartada tarda más");
  // Ciudad desconocida → zona por defecto, pero pidiendo confirmar cobertura.
  const desconocida = computeShipping({ ciudad: "Pueblito Lejano", subtotalCop: 70000, unidades: 1 });
  assert.equal(desconocida.requiere_confirmar, true);
  assert.equal(desconocida.costo_envio, medellin.costo_envio);
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
