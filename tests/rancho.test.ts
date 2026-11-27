/* Bot RANCHO DE LAS ESTRELLAS: la verdad del dueño y las reglas que van a los bot fields.
   Cada test es un error real de los chats del 25-26 nov 2026. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogoCod, reglasCod, leerVerdad, enPalabras } from "@/lib/rancho/botfields";
import { parametrosPlantilla, JUEZ_RANCHO, type Reporte } from "@/lib/reporte/diario";

const v = leerVerdad();
const cat = catalogoCod();
const reglas = reglasCod();

test("precios del dueño: crestón 1M, listo 2M, padrón 3M, gallina 3M, promo en cuido 1,5M (normal 2M, lote 30)", () => {
  const p = Object.fromEntries(v.ejemplares.map((e) => [e.id, e.precio]));
  assert.deepEqual(p, { creston: 1_000_000, listo: 2_000_000, padron: 3_000_000, gallina: 3_000_000 });
  assert.equal(v.promo.precio, 1_500_000);
  assert.equal(v.promo.precio_normal, 2_000_000);
  assert.equal(v.promo.lote, 30);
  assert.match(cat, /Crestón 6 meses: un millón \(\$1\.000\.000\)/);
  assert.match(cat, /millón y medio \(\$1\.500\.000\)/);
});

test("precios en palabras para el audio", () => {
  assert.equal(enPalabras(1_000_000), "un millón");
  assert.equal(enPalabras(1_500_000), "millón y medio");
  assert.equal(enPalabras(200_000), "doscientos mil");
});

test("combos agotados: el catálogo nunca da precio de combos", () => {
  assert.equal(v.combos_2_meses.dar_precio, false);
  const combos = cat.split("\n\n").find((b) => b.startsWith("COMBOS"))!;
  assert.doesNotMatch(combos, /\$\d/);
  assert.match(combos, /agotados/);
});

test("envío internacional: sin cifra inventada (Angel Portugal: '500 a 700 dólares' a Perú)", () => {
  assert.equal(v.envios.internacional_costo, null);
  assert.doesNotMatch(cat, /\d[\d.]*\s*d[óo]lares|USD|US\$/i); // "Dolar" es una línea, no plata
  assert.match(cat, /escalar_humano, sin dar cifra/);
  assert.match(reglas, /Peru.*escalar_humano, sin dar cifra/);
});

test("reglas de los errores reales: una respuesta, cuentas con precio+proceso, seguir tras cuentas, fotos sin repetir", () => {
  assert.match(reglas, /UNA respuesta por turno/);
  assert.match(reglas, /CUENTAS: solo cuando el cliente ya sabe el precio/);
  assert.match(reglas, /Despues de las cuentas seguis atendiendo/);
  assert.match(reglas, /Zelle/);
  assert.match(reglas, /Telegram una vez/);
  assert.match(reglas, /Si pregunta por gallinas, hablas de gallinas/);
});

test("bot fields bajo el tope de UChat y todas las líneas en el catálogo", () => {
  assert.ok(cat.length < 19500 && reglas.length < 19500);
  assert.equal(v.lineas.length, 37);
  for (const l of ["Tony Montana", "Angel Martinez", "Fundador", "Hacienda Gissel"]) assert.ok(cat.includes(l), l);
});

test("reporte: el Rancho sale con su nombre y su juez no castiga el abono para ver la galería", () => {
  const r: Reporte = { tenant: "rancho-estrellas", dia: "2026-11-26", chats: 111, pedidos: 15, ventas_cop: 0, conversion: 15 / 111, chats_revisados: 0, chats_con_error: 0, errores: {}, motivos: {}, ejemplos_error: [], pedidos_no_creados: 0, generado_at: "" };
  assert.match(parametrosPlantilla(r, null)[0], /^RANCHO DE LAS ESTRELLAS \(pedidos = cuentas enviadas\) · /);
  assert.match(JUEZ_RANCHO, /abono desde doscientos mil para ver la galería/);
  assert.match(JUEZ_RANCHO, /fotos_mal_o_telegram_repetido/);
});
