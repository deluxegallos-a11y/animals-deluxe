/* ===========================================================
   Flete por zonas — despacho desde MEDELLÍN (mensajería expresa).
   Lógica pura y testeable. La usan /api/ai/cobertura y crear-pedido
   (misma fórmula, sin duplicar). Tarifas en COP.
   =========================================================== */
import { normalize } from "@/lib/ai/format";

export type Zona =
  | "local"
  | "regional"
  | "nacional_metro"
  | "nacional_municipal"
  | "dificil"
  | "vereda";

interface ZoneRate {
  kiloInicial: number;
  kiloAdicional: number;
  label: string;
}

/* Tabla de mensajería expresa (kilo inicial + kilo adicional) desde Medellín.
   Para el kilo adicional, cuando la fuente da un rango, tomamos el valor base. */
export const ZONES: Record<Zona, ZoneRate> = {
  local: { kiloInicial: 7900, kiloAdicional: 3800, label: "Local (Medellín y área metropolitana)" },
  regional: { kiloInicial: 11600, kiloAdicional: 4400, label: "Regional (Antioquia y cercanías)" },
  nacional_metro: { kiloInicial: 17600, kiloAdicional: 4900, label: "Nacional metropolitano (capitales y grandes ciudades)" },
  nacional_municipal: { kiloInicial: 20000, kiloAdicional: 4900, label: "Nacional municipal" },
  dificil: { kiloInicial: 31000, kiloAdicional: 13500, label: "Difícil acceso" },
  vereda: { kiloInicial: 88000, kiloAdicional: 15200, label: "Veredas" },
};

/* FLETE POR VALOR (contraentrega Interrapidísimo): $20.000 + 7% del valor total
   de los productos (recaudo COD). Una sola vez por pedido, sobre el TOTAL (no por ítem).
   Ej.: 70.000→24.900 · 150.000→30.500 · 180.000→32.600. Excepción: envío incluido → $0. */
export function calcularFlete(totalProductos: number): number {
  return Math.round(20000 + Math.max(0, totalProductos || 0) * 0.07);
}
const PESO_POR_UNIDAD_KG = 1; // 1 producto liviano ≈ 1 kg (solo informativo)
export const TIEMPO_ENTREGA = "24 a 72 horas";

/* Productos con envío gratis. Slugs reales del catálogo. Además, cualquier
   producto con el flag `envioGratis` activo en el panel también cuenta como
   gratis (ver pedidoEnvioGratis), así el dueño lo controla sin tocar código. */
export const FREE_SHIPPING_SLUGS = new Set<string>([
  "horse-deluxe",
  "more-muscle-dogs",
  "weight-muscle-protein",
]);

/* Mapa ciudad → zona. Default = nacional_municipal. Claves normalizadas
   (sin acentos, minúsculas) por `normalize`. */
const CITY_ZONES_RAW: Record<Zona, string[]> = {
  local: [
    "medellin", "bello", "itagui", "envigado", "sabaneta", "la estrella",
    "caldas", "copacabana", "girardota", "barbosa",
  ],
  regional: [
    "rionegro", "marinilla", "la ceja", "guarne", "el carmen de viboral",
    "santa rosa de osos", "yarumal", "apartado", "turbo", "caucasia",
    "andes", "jerico", "santuario", "el retiro", "carmen de viboral",
  ],
  nacional_metro: [
    "bogota", "cali", "barranquilla", "cartagena", "bucaramanga", "cucuta",
    "pereira", "manizales", "armenia", "ibague", "villavicencio",
    "santa marta", "pasto", "monteria", "valledupar", "neiva", "popayan",
    "sincelejo", "riohacha", "tunja", "florencia", "yopal", "quibdo",
    "san andres", "soacha", "soledad", "dosquebradas", "floridablanca",
    "giron", "piedecuesta", "palmira", "buenaventura", "tulua",
  ],
  nacional_municipal: [],
  dificil: [],
  vereda: [],
};

const CITY_ZONE_INDEX: Map<string, Zona> = (() => {
  const m = new Map<string, Zona>();
  (Object.keys(CITY_ZONES_RAW) as Zona[]).forEach((z) => {
    for (const c of CITY_ZONES_RAW[z]) m.set(normalize(c), z);
  });
  return m;
})();

/** Resuelve la zona de una ciudad. Default: nacional_municipal. */
export function resolveZona(ciudad: string): Zona {
  const norm = normalize(ciudad || "");
  if (!norm) return "nacional_municipal";
  if (CITY_ZONE_INDEX.has(norm)) return CITY_ZONE_INDEX.get(norm)!;
  // match parcial (la ciudad puede venir con departamento, p.ej. "cali, valle")
  for (const [city, zona] of CITY_ZONE_INDEX) {
    if (norm.includes(city) || city.includes(norm)) return zona;
  }
  return "nacional_municipal";
}

export interface ShippingInput {
  ciudad: string;
  /** Valor de los productos (subtotal en COP, antes de descuentos). */
  subtotalCop: number;
  /** Total de unidades del pedido (≈1 kg c/u). Alternativa a pesoKg. */
  unidades?: number;
  /** Peso explícito en kg (tiene prioridad sobre `unidades`). */
  pesoKg?: number;
  metodo?: "contraentrega" | "anticipado";
  /** El pedido completo califica a envío gratis (todos los ítems gratis). */
  envioGratis?: boolean;
}

export interface ShippingResult {
  zona: Zona;
  zona_label: string;
  cubre: boolean;
  envio_gratis: boolean;
  costo_envio: number;
  tiempo: string;
  desglose: {
    kilos: number;
    base: number;
    sobreflete: number;
    recargo_contraentrega: number;
  };
}

/** Flete = $20.000 + 7% del valor de los productos que pagan envío (calcularFlete).
 *  $0 si todo el pedido es envío-incluido. Determinista: mismo valor → misma cifra. */
export function computeShipping(input: ShippingInput): ShippingResult {
  const zona = resolveZona(input.ciudad); // solo informativo (cobertura nacional)
  const pesoKg = input.pesoKg != null ? input.pesoKg : Math.max(1, input.unidades ?? 1) * PESO_POR_UNIDAD_KG;
  const kilos = Math.max(1, Math.ceil(pesoKg));

  // subtotalCop = valor de los productos que SÍ pagan envío (los de envío-incluido
  // se excluyen; en mezcla, el 7% aplica solo sobre esta base). envioGratis = todo incluido.
  const envioGratis = !!input.envioGratis;
  const base = Math.max(0, input.subtotalCop || 0);
  const costo = envioGratis ? 0 : calcularFlete(base);

  return {
    zona,
    zona_label: ZONES[zona].label,
    cubre: true, // cubrimos todo el país
    envio_gratis: costo === 0,
    costo_envio: costo,
    tiempo: TIEMPO_ENTREGA,
    desglose: { kilos, base: 20000, sobreflete: costo ? costo - 20000 : 0, recargo_contraentrega: 0 },
  };
}

/** ¿El pedido completo califica a envío gratis? Solo si TODOS los ítems
    son de la lista gratis (o tienen la bandera envioGratis del producto). */
export function pedidoEnvioGratis(
  items: Array<{ slug: string; envioGratis?: boolean }>,
): boolean {
  if (!items.length) return false;
  return items.every((it) => FREE_SHIPPING_SLUGS.has(it.slug) || !!it.envioGratis);
}
