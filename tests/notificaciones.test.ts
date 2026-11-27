import { test } from "node:test";
import assert from "node:assert/strict";
import { mensajeDespacho } from "@/lib/ai/notificaciones";

test("mensaje de despacho incluye ref, guía y transportadora", () => {
  const m = mensajeDespacho({
    ref: "AD-7F3A",
    nombre: "Juan Pérez",
    guia: "240012345678",
    transportadora: "Interrapidísimo",
    items: [{ name: "American Rooster Fury", cantidad: 2 }],
  });
  assert.match(m, /AD-7F3A/);
  assert.match(m, /240012345678/);
  assert.match(m, /Interrapidísimo/);
  assert.match(m, /despachado/i);
  assert.match(m, /2× American Rooster Fury/);
  assert.match(m, /Juan/); // saludo con primer nombre
});

test("mensaje de despacho omite transportadora si no viene", () => {
  const m = mensajeDespacho({ ref: "AD-1", guia: "999" });
  assert.match(m, /AD-1/);
  assert.match(m, /999/);
  assert.doesNotMatch(m, /Transportadora:/);
});
