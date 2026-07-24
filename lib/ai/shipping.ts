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

/* FLETE + TIEMPOS POR ZONA (Interrapidísimo). El flete y los días hábiles VARÍAN por
   zona: apartadas (San Andrés, Amazonas, Chocó…) cuestan más y tardan más.
   flete = base_zona + pct_zona * valor_productos, redondeado a la centena.
   ⚠️ VALORES PLANTILLA: reemplazar por el tarifario real negociado / cotización por guía. */
export interface ZoneFlete { base: number; pct: number; diasMin: number; diasMax: number; confirmar: boolean }
export const ZONE_RATE: Record<Zona, ZoneFlete> = {
  local:              { base: 12000, pct: 0.05, diasMin: 1, diasMax: 2, confirmar: false },
  regional:           { base: 15000, pct: 0.06, diasMin: 2, diasMax: 3, confirmar: false },
  nacional_metro:     { base: 20000, pct: 0.07, diasMin: 2, diasMax: 4, confirmar: false },
  nacional_municipal: { base: 22000, pct: 0.07, diasMin: 3, diasMax: 5, confirmar: false },
  dificil:            { base: 32000, pct: 0.10, diasMin: 5, diasMax: 8, confirmar: true },
  vereda:             { base: 40000, pct: 0.12, diasMin: 6, diasMax: 10, confirmar: true },
};

/** Flete de la zona: base + pct * valor de los productos, redondeado a la centena. */
export function calcularFlete(totalProductos: number, zona: Zona = "nacional_municipal"): number {
  const r = ZONE_RATE[zona];
  return Math.round((r.base + Math.max(0, totalProductos || 0) * r.pct) / 100) * 100;
}
export function tiempoZona(zona: Zona): string {
  const r = ZONE_RATE[zona];
  return `${r.diasMin} a ${r.diasMax} días hábiles`;
}
const PESO_POR_UNIDAD_KG = 1; // 1 producto liviano ≈ 1 kg (solo informativo)
export const TIEMPO_ENTREGA = "2 a 5 días hábiles"; // fallback genérico (zona por defecto)

/* Envío gratis SOLO para More Muscle Dogs y Horse Deluxe (regla del dueño, 24-jul).
   OJO: Weight Muscle Protein NO es gratis — se confundía por el nombre "muscle" y el
   bot lo ofrecía gratis (bug M6.1). El flag `envioGratis` de la DB (panel) también
   activa gratis por producto, así el dueño lo controla sin tocar código. Estos dos
   slugs son de Animals Deluxe; Rooster (anticipado) no los tiene → no se mezcla. */
export const FREE_SHIPPING_SLUGS = new Set<string>([
  "horse-deluxe",
  "more-muscle-dogs",
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
    "soacha", "soledad", "dosquebradas", "floridablanca",
    "giron", "piedecuesta", "palmira", "buenaventura", "tulua",
  ],
  nacional_municipal: [],
  // Zonas apartadas: flete alto, tiempos largos, requiere confirmar (a veces recogida en oficina).
  dificil: [
    "san andres", "providencia", "leticia", "mitu", "inirida", "puerto inirida",
    "puerto carreno", "bahia solano", "nuqui", "acandi", "capurgana", "unguia",
    "jurado", "bajo baudo", "pizarro", "timbiqui", "guapi", "bojaya", "murindo",
  ],
  vereda: [],
};

const CITY_ZONE_INDEX: Map<string, Zona> = (() => {
  const m = new Map<string, Zona>();
  (Object.keys(CITY_ZONES_RAW) as Zona[]).forEach((z) => {
    for (const c of CITY_ZONES_RAW[z]) m.set(normalize(c), z);
  });
  return m;
})();

/** Resuelve la zona + si la ciudad se ENCONTRÓ en la tabla (para pedir confirmación
 *  de cobertura cuando es desconocida). Default: nacional_municipal, encontrada=false. */
export function resolveZonaInfo(ciudad: string): { zona: Zona; encontrada: boolean } {
  const norm = normalize(ciudad || "");
  if (!norm) return { zona: "nacional_municipal", encontrada: false };
  if (CITY_ZONE_INDEX.has(norm)) return { zona: CITY_ZONE_INDEX.get(norm)!, encontrada: true };
  // match parcial (la ciudad puede venir con departamento, p.ej. "cali, valle")
  for (const [city, zona] of CITY_ZONE_INDEX) {
    if (city.length >= 4 && (norm.includes(city) || city.includes(norm))) return { zona, encontrada: true };
  }
  return { zona: "nacional_municipal", encontrada: false };
}

/** Resuelve la zona de una ciudad. Default: nacional_municipal. */
export function resolveZona(ciudad: string): Zona {
  return resolveZonaInfo(ciudad).zona;
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
  dias_min: number;
  dias_max: number;
  /** Zona apartada o ciudad desconocida → confirmar cobertura/tiempos con el cliente. */
  requiere_confirmar: boolean;
  ciudad_encontrada: boolean;
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
  const { zona, encontrada } = resolveZonaInfo(input.ciudad);
  const rate = ZONE_RATE[zona];
  const pesoKg = input.pesoKg != null ? input.pesoKg : Math.max(1, input.unidades ?? 1) * PESO_POR_UNIDAD_KG;
  const kilos = Math.max(1, Math.ceil(pesoKg));

  // subtotalCop = valor de los productos que SÍ pagan envío (los de envío-incluido
  // se excluyen; en mezcla, el % aplica solo sobre esta base). envioGratis = todo incluido.
  const envioGratis = !!input.envioGratis;
  const base = Math.max(0, input.subtotalCop || 0);
  const costo = envioGratis ? 0 : calcularFlete(base, zona);

  return {
    zona,
    zona_label: ZONES[zona].label,
    cubre: true, // cubrimos todo el país
    envio_gratis: costo === 0,
    costo_envio: costo,
    tiempo: tiempoZona(zona),
    dias_min: rate.diasMin,
    dias_max: rate.diasMax,
    // Apartada (San Andrés/Amazonas/Chocó…) o ciudad desconocida → confirmar con el cliente.
    requiere_confirmar: rate.confirmar || !encontrada,
    ciudad_encontrada: encontrada,
    desglose: { kilos, base: rate.base, sobreflete: costo ? costo - rate.base : 0, recargo_contraentrega: 0 },
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
