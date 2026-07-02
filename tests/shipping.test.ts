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

test("flete FIJO $24.900 para cualquier ciudad", () => {
  for (const ciudad of ["Medellín", "Bogotá", "Morales", "Pueblito Lejano", "Cali, Valle"]) {
    const s = computeShipping({ ciudad, subtotalCop: 70000, unidades: 1, metodo: "contraentrega" });
    assert.equal(s.costo_envio, 24900, `flete de ${ciudad} debe ser 24900`);
    assert.equal(s.envio_gratis, false);
  }
});

test("flete FIJO no cambia por cantidad ni método (se cobra una vez)", () => {
  const uno = computeShipping({ ciudad: "Bogotá", subtotalCop: 70000, unidades: 1, metodo: "contraentrega" });
  const varios = computeShipping({ ciudad: "Bogotá", subtotalCop: 300000, unidades: 4, metodo: "anticipado" });
  assert.equal(uno.costo_envio, 24900);
  assert.equal(varios.costo_envio, 24900);
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
