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

/* Recargos. */
const CONTRAENTREGA_PCT = 0.05; // +5% sobre el valor del producto (pago en casa)
const SOBREFLETE_PCT = 0.02; // +2% sobre el valor declarado
const MIN_DECLARADO_HASTA_2KG = 45000;
const MIN_DECLARADO_2_A_5KG = 60000;
const PESO_POR_UNIDAD_KG = 1; // 1 producto liviano ≈ 1 kg
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

/** Calcula el flete con la tabla de zonas desde Medellín. Determinista. */
export function computeShipping(input: ShippingInput): ShippingResult {
  const zona = resolveZona(input.ciudad);
  const rate = ZONES[zona];

  const pesoKg =
    input.pesoKg != null
      ? input.pesoKg
      : Math.max(1, input.unidades ?? 1) * PESO_POR_UNIDAD_KG;
  const kilos = Math.max(1, Math.ceil(pesoKg));

  const base = rate.kiloInicial + Math.max(0, kilos - 1) * rate.kiloAdicional;

  const subtotal = Math.max(0, Math.round(input.subtotalCop || 0));
  const minDeclarado = kilos <= 2 ? MIN_DECLARADO_HASTA_2KG : MIN_DECLARADO_2_A_5KG;
  const declarado = Math.max(subtotal, minDeclarado);
  const sobreflete = Math.round(declarado * SOBREFLETE_PCT);

  const recargoContraentrega =
    (input.metodo ?? "contraentrega") === "contraentrega"
      ? Math.round(subtotal * CONTRAENTREGA_PCT)
      : 0;

  const envioGratis = !!input.envioGratis;
  const costo = envioGratis ? 0 : base + sobreflete + recargoContraentrega;

  return {
    zona,
    zona_label: rate.label,
    cubre: true, // cubrimos todo el país (incl. difícil acceso / veredas con su tarifa)
    envio_gratis: envioGratis,
    costo_envio: costo,
    tiempo: TIEMPO_ENTREGA,
    desglose: { kilos, base, sobreflete, recargo_contraentrega: recargoContraentrega },
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
