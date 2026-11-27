/* Bot fields del bot RANCHO DE LAS ESTRELLAS (UChat f276483): `catalogo_cod` y `reglas_cod`.
   Una sola fuente: data/verdad-dueno-rancho.json + bot_uchat/09_REGLAS_DURAS_RANCHO.md.
   Los precios van en palabras (el bot responde en AUDIO) y en cifras entre paréntesis. */
import { readFileSync } from "node:fs";
import path from "node:path";

export type VerdadRancho = {
  _actualizado: string;
  ejemplares: { id: string; nombre: string; precio: number; nota: string }[];
  promo: { nombre: string; precio: number; precio_normal: number; lote: number; vigencia: string; nota: string };
  promo_parejas: string;
  combos_2_meses: { estado: string; vuelven: string; se_separan: boolean; dar_precio: boolean };
  proceso_compra: { abono_minimo: number; pasos: string; fotos: string; color: string };
  envios: { medio: string; nacional_principales: string; nacional_trasbordo: string; uno_o_dos_igual: boolean; internacional_paises: string[]; internacional_costo: string | null };
  pagos: { titular: string; bancolombia_ahorros: string; nequi: string; ecuador: string; otros_medios: string | null };
  garantia: string;
  telegram: string;
  derivar: Record<string, string>;
  lineas: string[];
  pendientes: string[];
};

const RAIZ = process.cwd();
export const leerVerdad = (): VerdadRancho =>
  JSON.parse(readFileSync(path.join(RAIZ, "data/verdad-dueno-rancho.json"), "utf8")) as VerdadRancho;

/** 1000000 → "un millón" · 1500000 → "millón y medio" · 200000 → "doscientos mil". */
export function enPalabras(n: number): string {
  const M: Record<number, string> = { 1_000_000: "un millón", 1_500_000: "millón y medio", 2_000_000: "dos millones", 3_000_000: "tres millones" };
  if (M[n]) return M[n];
  if (n % 1000 === 0 && n < 1_000_000) {
    const C: Record<number, string> = { 50: "cincuenta", 80: "ochenta", 100: "cien", 150: "ciento cincuenta", 200: "doscientos", 300: "trescientos", 500: "quinientos" };
    if (C[n / 1000]) return `${C[n / 1000]} mil`;
  }
  return "$" + n.toLocaleString("es-CO").replace(/,/g, ".");
}
const cop = (n: number) => "$" + n.toLocaleString("es-CO").replace(/,/g, ".");

export function catalogoCod(v: VerdadRancho = leerVerdad()): string {
  const ej = v.ejemplares.map((e) => `• ${e.nombre}: ${enPalabras(e.precio)} (${cop(e.precio)}) — ${e.nota}`).join("\n");
  const p = v.promo;
  return [
    `CATÁLOGO OFICIAL RANCHO DE LAS ESTRELLAS (verdad del dueño, ${v._actualizado}). Manda sobre cualquier precio escrito en otra parte del prompt. Lo que no está aquí no se inventa: escalar_humano.`,
    `EJEMPLARES (precio por animal, envío aparte):\n${ej}`,
    `PROMO ACTIVA — ${p.nombre}: ${enPalabras(p.precio)} (${cop(p.precio)}); normalmente ${enPalabras(p.precio_normal)}; lote de ${p.lote}; ${p.vigencia}; ${p.nota}. Promo de parejas: ${v.promo_parejas}.`,
    `COMBOS DE 2 MESES: ${v.combos_2_meses.estado}, vuelven ${v.combos_2_meses.vuelven}. No se separan ni se reciben abonos. No se dan precios de combos.`,
    `CÓMO SE COMPRA: ${v.proceso_compra.pasos}. Abono mínimo ${enPalabras(v.proceso_compra.abono_minimo)}. Fotos: ${v.proceso_compra.fotos}. Color: ${v.proceso_compra.color}.`,
    `ENVÍOS: ${v.envios.medio}. Ciudades principales ${v.envios.nacional_principales}; con trasbordo ${v.envios.nacional_trasbordo}; ${v.envios.uno_o_dos_igual ? "vale lo mismo para uno o dos ejemplares" : ""}. Internacional: ${v.envios.internacional_paises.join(", ")} — ${v.envios.internacional_costo ?? "costo lo cotiza la encargada (escalar_humano, sin dar cifra)"}.`,
    `PAGOS: Bancolombia ahorros y Nequi a nombre de ${v.pagos.titular} (las cuentas las manda enviar_cuentas). Ecuador: ${v.pagos.ecuador}. Otros medios: ${v.pagos.otros_medios ?? "no confirmados → escalar_humano"}.`,
    `GARANTÍA: ${v.garantia}. Telegram (galería gratis): ${v.telegram}.`,
    `DERIVAR: productos/droga/vitaminas → ${v.derivar.productos_droga_vitaminas}; rifas/eventos → ${v.derivar.rifas_eventos}.`,
    `LÍNEAS QUE MANEJAMOS (${v.lineas.length}): ${v.lineas.join(", ")}.`,
  ].join("\n\n");
}

export function reglasCod(): string {
  const md = readFileSync(path.join(RAIZ, "bot_uchat/09_REGLAS_DURAS_RANCHO.md"), "utf8");
  const m = md.match(/```\n([\s\S]*?)```/);
  if (!m) throw new Error("09_REGLAS_DURAS_RANCHO.md sin bloque de reglas");
  return m[1].trim();
}
