/* Reporte diario: la plantilla de WhatsApp (Meta) rechaza variables vacías, con
   saltos de línea/tabs o 4+ espacios. Si falla, el reporte no llega. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parametrosPlantilla, textoReporte, diaAnterior, type Reporte } from "@/lib/reporte/diario";

const base = (o: Partial<Reporte> = {}): Reporte => ({
  tenant: "animals-deluxe", dia: "2026-11-26", chats: 0, pedidos: 0, ventas_cop: 0, conversion: 0,
  chats_revisados: 0, chats_con_error: 0, errores: {}, motivos: {}, ejemplos_error: [],
  pedidos_no_creados: 0, generado_at: "", ...o,
} as Reporte);

function valida(p: string[]) {
  assert.equal(p.length, 8, "la plantilla tiene 8 variables");
  for (const [i, v] of p.entries()) {
    assert.ok(v.trim().length > 0, `variable ${i + 1} vacía`);
    assert.ok(!/[\n\r\t]/.test(v), `variable ${i + 1} con salto de línea: ${JSON.stringify(v)}`);
    assert.ok(!/ {4,}/.test(v), `variable ${i + 1} con 4+ espacios`);
    assert.ok(v.length <= 300, `variable ${i + 1} muy larga`);
  }
}

test("reporte: día sin chats ni día anterior → 8 variables válidas", () => {
  valida(parametrosPlantilla(base(), null));
});

test("reporte: error de OpenAI con saltos de línea no tumba la plantilla", () => {
  const hoy = base({ chats: 194, chats_sin_revisar: 107, error_revision: "OpenAI sin saldo\n\ncredit_balance_exhausted\t(429)" } as Partial<Reporte>);
  valida(parametrosPlantilla(hoy, null));
});

test("reporte: compara con ayer (▲▼) y limpia nombres raros", () => {
  const ayer = base({ dia: "2026-11-25", chats: 194, pedidos: 22, ventas_cop: 2045000, conversion: 22 / 194, chats_revisados: 87, errores: { precio: 5 } });
  const hoy = base({ chats: 150, pedidos: 25, ventas_cop: 2300000, conversion: 25 / 150, chats_revisados: 150, chats_con_error: 9,
    errores: { precio: 3, "raro\ncon salto": 2 }, motivos: { precio_alto: 4, compro: 25 } });
  const p = parametrosPlantilla(hoy, ayer);
  valida(p);
  assert.ok(!p[7].toLowerCase().includes("compr"), "'compró' no es motivo de no-compra");
  assert.ok(textoReporte(hoy, ayer).includes("Pedidos"));
});

test("reporte: diaAnterior cruza mes", () => {
  assert.equal(diaAnterior("2026-12-01"), "2026-11-30");
});
