/* ===========================================================
   SEPARACIÓN DE MARCAS · redirección cruzada entre los dos negocios
   ------------------------------------------------------------
   La plataforma sirve a DOS negocios distintos, ya separados en la DB por
   `tenant_id` (no hay columna `marca`: el tenant ES la marca):

     · animals-deluxe → CONTRA ENTREGA (paga al recibir)  · 48 productos
     · rooster-deluxe → ANTICIPADO (paga por adelantado)  · 104 productos

   El aislamiento del catálogo ya lo hace `data.ts` (todo filtra por tenant) más
   los bloqueos de `catalog-rules.ts`. Lo que este módulo agrega es lo que FALTABA:
   cuando el cliente del bot de contra entrega pide algo que solo existe en el otro
   negocio (botas, canilleras, comederos, antibióticos…), el bot respondía
   `not_found` con mensaje vacío y la venta se perdía en silencio.

   Aquí se detecta ese caso y se devuelve `status:"otra_marca"` con el mensaje de
   redirección al WhatsApp del otro canal. El número NO se hardcodea: sale de
   `tenants.asesor_wa` del tenant dueño.

   REGLA CLAVE — "exclusivo", no "solapado":
   Los dos catálogos comparten ~31 productos (Rooster vende un superset). Un
   producto que existe ACTIVO en ambos SÍ se vende contra entrega y NO se redirige.
   Solo se redirige lo que existe únicamente en el otro tenant (comparando por
   slug y por nombre normalizado, ya después de aplicar catalog-rules).
   =========================================================== */
import type { ProductView } from "@/lib/ai/types";
import { normalize } from "@/lib/ai/format";
import { identifyProduct, stripFillers, singular, type BrainResult } from "@/lib/ai/brain";
import { type Ruleset } from "@/lib/ai/aliases";
import { getProducts, getProductsDeTenant } from "@/lib/ai/data";
import { currentTenant, getTenantBySlug, type Tenant } from "@/lib/ai/tenant";

/** Qué tenant es la "contraparte" comercial de cada uno. */
const CONTRAPARTE: Record<string, string> = {
  "animals-deluxe": "rooster-deluxe",
  "rooster-deluxe": "animals-deluxe",
};

export type RedireccionMarca = {
  status: "otra_marca";
  /** slug del tenant dueño del producto. */
  marca: string;
  marca_nombre: string;
  politica_pago: PoliticaPago;
  /** Número del asesor de esa marca, tal como está en `tenants.asesor_wa`. */
  whatsapp: string;
  /** Enlace wa.me listo para pegar en el bot. */
  whatsapp_link: string;
  producto_nombre: string;
  producto_slug: string;
  mensaje: string;
};

export type PoliticaPago = "contra_entrega" | "anticipado";

/* ---------------- política de pago ---------------- */

/** Política de pago de un tenant (la del request si no se pasa ninguno). */
export function politicaDe(tenant?: Tenant | null): PoliticaPago {
  return tenant?.paymentMode === "anticipado" ? "anticipado" : "contra_entrega";
}

/** Texto corto de la política, para que el bot NUNCA la adivine. */
export function politicaTexto(p: PoliticaPago): string {
  return p === "anticipado"
    ? "Pago por adelantado: se despacha apenas confirmes el pago."
    : "Contra entrega: pagás al recibir el pedido.";
}

/* ---------------- formato del número ---------------- */

/** 57312… → "312 291 1088" (legible en WhatsApp). Deja intacto lo que no reconozca. */
export function telLegible(raw: string): string {
  const d = String(raw || "").replace(/\D/g, "");
  const cel = d.length === 12 && d.startsWith("57") ? d.slice(2) : d;
  if (cel.length !== 10) return String(raw || "").trim();
  return `${cel.slice(0, 3)} ${cel.slice(3, 6)} ${cel.slice(6)}`;
}

/** Enlace wa.me (siempre con indicativo 57 si el número es colombiano de 10 díg). */
export function waLink(raw: string): string {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10 && d.startsWith("3")) d = "57" + d;
  return `https://wa.me/${d}`;
}

/* ---------------- catálogo exclusivo del otro tenant ---------------- */

/** Clave de identidad de un producto para comparar entre catálogos. */
function claveNombre(p: ProductView): string {
  return normalize(p.name).replace(/\s+/g, " ").trim();
}

/**
 * Productos que SOLO vende `otros` — los que no tienen equivalente en `propios`.
 * `propios` ya viene filtrado por catalog-rules, así que un producto bloqueado
 * para el tenant actual (ej. gallo-purga-plus) cuenta como exclusivo del otro y
 * también se redirige: eso es exactamente lo que se quiere.
 */
export function exclusivosDelOtro(otros: ProductView[], propios: ProductView[]): ProductView[] {
  const slugs = new Set(propios.map((p) => p.slug));
  const nombres = new Set(propios.map(claveNombre));
  return otros.filter((p) => !slugs.has(p.slug) && !nombres.has(claveNombre(p)));
}

/**
 * Reglas con las que se interroga al catálogo del OTRO tenant: NINGUNA.
 *
 * Es deliberado. Las tablas de alias/necesidad de cada tenant están escritas
 * contra su catálogo COMPLETO; al correrlas sobre el subconjunto exclusivo, los
 * alias se recuelgan de otro producto y mienten con toda confianza:
 *   "dragon rooster" → alias 1.00 → dopping-dragon-mamba
 *   "rooster booster" → fuzzy 0.75 → beak-boost
 *   "la cobra"        → fuzzy 0.67 → candados-cobre
 * Mandar a esos clientes al otro canal es peor que no encontrar nada: son
 * productos que este bot SÍ vende. Para redirigir basta —y sobra— el nombre
 * literal o las keywords del producto ("botas", "canilleras", "comedero").
 */
const SIN_REGLAS: Ruleset = { aliases: [], needs: [] };

/** Fuzzy mínimo para redirigir. Alto a propósito: un falso positivo aquí no es
 *  "no encontré", es despedir a un cliente propio hacia el otro canal. */
const FUZZY_MIN_REDIRECCION = 0.75;

/**
 * ¿El match en el otro catálogo es lo bastante firme para redirigir?
 * Solo identidad LITERAL (nombre o keyword del producto) o un fuzzy muy alto.
 * Un match por "necesidad" ("algo para vitaminas") jamás redirige.
 */
export function matchConfiable(r: BrainResult): boolean {
  if (!r.product) return false;
  if (r.status !== "found" && r.status !== "ambiguous") return false;
  if (r.matchedBy === "name" || r.matchedBy === "keyword") return true;
  return r.matchedBy === "fuzzy" && r.score >= FUZZY_MIN_REDIRECCION;
}

/* ---------------- contención literal (segundo candado) ----------------
   El score NO alcanza para separar el acierto del disparate: "botas" acierta con
   fuzzy 1.00 y "dragon rooster" se equivoca TAMBIÉN con 1.00 (le basta la mitad
   del query). La diferencia real es la contención: en el acierto, TODO lo que el
   cliente escribió está en el nombre o las keywords del producto; en el error,
   "rooster" no aparece por ningún lado de "Dopping Dragón Mamba". */

/** Palabras que no identifican nada: están en las keywords de casi todo el
 *  catálogo (especie, categoría genérica). Un query hecho solo de estas no puede
 *  mandar a nadie al otro canal. */
const GENERICAS = new Set([
  "gallo", "gallito", "pollo", "pollito", "ave", "ejemplar", "animal", "fino",
  "producto", "implemento", "accesorio", "herramienta", "medicina", "remedio",
  "vitamina", "suplemento", "cosa", "algo", "cria", "levante",
]);

/** Tokens con carga identificatoria del query (≥3 letras, sin muletillas). */
function tokensQuery(q: string): string[] {
  return normalize(stripFillers(q)).split(/\s+/).filter((w) => w.length >= 3);
}

/** Dónde se busca la contención: nombre + keywords del producto. */
function pajar(p: ProductView): string {
  return normalize([p.name, ...(p.keywords || [])].join(" "));
}

/**
 * Candado final de la redirección: además de un match firme, TODO token
 * identificatorio del query tiene que estar en el producto, y al menos uno no
 * puede ser genérico ("gallos" solo no manda a nadie al otro canal).
 */
export function redireccionValida(query: string, r: BrainResult): boolean {
  if (!matchConfiable(r)) return false;
  const toks = tokensQuery(query);
  if (!toks.length) return false;
  if (!toks.some((t) => !GENERICAS.has(singular(t)))) return false;
  const heno = pajar(r.product!);
  // Sin espacios: el cliente escribe "vitapower" y el producto se llama "Vita Power".
  // Solo para tokens largos (≥5): con tokens cortos, pegar las palabras inventa
  // coincidencias ("eras" dentro de "canilleras").
  const pegado = heno.replace(/\s+/g, "");
  const dentro = (t: string) => heno.includes(t) || (t.length >= 5 && pegado.includes(t));
  return toks.every((t) => dentro(t) || dentro(singular(t)));
}

/* ---------------- detección ---------------- */

/** Arma el mensaje de redirección en la voz del bot. */
export function mensajeRedireccion(nombre: string, marcaNombre: string, tel: string, anticipado: boolean): string {
  const num = telLegible(tel);
  const comoPaga = anticipado ? "con *pago por adelantado*" : "*contra entrega*";
  return [
    `👉 *${nombre}* no lo manejamos en este canal.`,
    `Ese lo despacha *${marcaNombre}* ${comoPaga} 📲`,
    num ? `Escribile al *${num}* y te lo despachan de una 🐓` : `Te paso con un asesor pa coordinarlo 🐓`,
  ].filter(Boolean).join("\n");
}

/**
 * ¿Este texto corresponde a un producto del OTRO negocio?
 * Devuelve la redirección lista, o null si no aplica (lo normal).
 *
 * Se llama SOLO cuando el catálogo propio ya no encontró nada, así que el costo
 * (una query cacheada 5 min) no toca la ruta feliz.
 */
export async function detectarOtraMarca(query: string): Promise<RedireccionMarca | null> {
  const q = (query || "").trim();
  if (!q) return null;

  const propio = await currentTenant();
  const otroSlug = CONTRAPARTE[propio.slug];
  if (!otroSlug) return null;

  const otro = await getTenantBySlug(otroSlug);
  if (!otro || !otro.activo) return null;

  const [propios, otros] = await Promise.all([getProducts(), getProductsDeTenant(otroSlug)]);
  const exclusivos = exclusivosDelOtro(otros, propios);
  if (!exclusivos.length) return null;

  const r = identifyProduct(q, exclusivos, [], SIN_REGLAS);
  if (!redireccionValida(q, r)) return null;

  const p = r.product!;
  const politica = politicaDe(otro);
  return {
    status: "otra_marca",
    marca: otro.slug,
    marca_nombre: otro.nombre || otro.slug,
    politica_pago: politica,
    whatsapp: otro.asesorWa || "",
    whatsapp_link: waLink(otro.asesorWa || ""),
    producto_nombre: p.name,
    producto_slug: p.slug,
    mensaje: mensajeRedireccion(p.name, otro.nombre || otro.slug, otro.asesorWa || "", politica === "anticipado"),
  };
}

/**
 * Igual que `detectarOtraMarca` pero para varios nombres de ítems de un pedido.
 * Devuelve solo los que resultaron ser del otro negocio.
 */
export async function detectarOtraMarcaEnItems(nombres: string[]): Promise<RedireccionMarca[]> {
  const out: RedireccionMarca[] = [];
  for (const n of nombres) {
    const r = await detectarOtraMarca(n);
    if (r) out.push(r);
  }
  return out;
}
