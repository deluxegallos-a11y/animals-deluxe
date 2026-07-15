/* ===========================================================
   Búsqueda fuzzy de productos (lenguaje gallero + typos).
   Determinística y sin dependencias → corre igual en demo, en
   prod y en los tests. Combina:
     - intents/sinónimos (mapea "mocos" → respiratorio, etc.)
     - match exacto de tokens contra slug/name/audience/desc/pitch
     - similitud por trigramas (Dice) para tolerar errores de tipeo
   =========================================================== */
import type { ProductView } from "@/lib/ai/types";
import { normalize } from "@/lib/ai/format";
import { deriveKeywords } from "@/lib/ai/keywords";

const STOP = new Set([
  "de", "la", "el", "los", "las", "un", "una", "para", "por", "con", "que", "del", "al",
  "y", "o", "mi", "me", "le", "se", "su", "lo", "en", "a", "algo", "pa", "tengo", "quiero",
  "necesito", "busco", "dame", "hay", "tienes", "tiene", "es", "como", "cosa", "producto",
  "gallo", "gallos", "ave", "aves",
  // Muletillas de consulta (así "foto de cada una de las botas" → solo "botas").
  "foto", "fotos", "imagen", "imagenes", "video", "cada", "ver", "muestrame", "muestra",
  "mandar", "manda", "mande", "mandas", "enviar", "envia", "enviame", "puede", "puedes",
  "podria", "cuanto", "cuanta", "cuantos", "cuesta", "cuestan", "vale", "valen", "precio",
  "precios", "cual", "cuales", "esa", "ese", "esas", "esos", "esta", "este", "estos", "estas",
  "sobre", "acerca", "info", "informacion", "porfa", "porfavor", "favor", "gracias", "hola",
]);

/* intents: término del cliente → categoría objetivo (+ keywords de refuerzo) */
const INTENTS: { match: RegExp; category: string; kw: string[] }[] = [
  { match: /\b(energ|doping|fuerza|fiera|pelea|careo|chispa|potenc|fortale|vuelo|aguante|resisten)\w*/i, category: "energia", kw: ["energia", "doping"] },
  { match: /\b(vitamin|multivit|b12|cianocobal|cobalam|hierro|complejo)\w*/i, category: "vitaminas", kw: ["vitamina"] },
  { match: /\b(parasit|lombri|purg|desparasit|gusano|verme)\w*/i, category: "desparasitantes", kw: ["desparasitante", "purga"] },
  { match: /\b(moco|respir|gripa|estornud|tos|pecho|pulmon|ronqu|tupid|congestion)\w*/i, category: "respiratorio", kw: ["respiratorio", "pecho"] },
  { match: /\b(pluma|piel|plumaj|brillo|muda|emplum|cuidado|hongo|escama)\w*/i, category: "cuidado", kw: ["pluma", "piel"] },
  { match: /\b(polvo|suplement|mezcla|formula)\w*/i, category: "suplementos", kw: ["suplemento", "polvo"] },
  { match: /\b(entren|musculo|musculatura|masa|recuper|fuerza|trainer|gym|peso)\w*/i, category: "entrenamiento", kw: ["entrenamiento", "musculo", "recuperacion"] },
  { match: /\b(pollo|levante|polluel|pollito|cria|engord)\w*/i, category: "pollos", kw: ["pollo", "levante"] },
  { match: /\b(perro|canino|cachorro|dog|mascota)\w*/i, category: "perros", kw: ["perro"] },
  { match: /\b(caballo|equino|yegua|potro|horse)\w*/i, category: "caballos", kw: ["caballo"] },
];

/* ---- Animal / audiencia (para NUNCA mezclar animales) ----
   El animal del producto se deduce de su categoría; el resto del catálogo
   (energia, vitaminas, respiratorio, etc.) son productos de gallos. */
export type Animal = "perros" | "caballos" | "pollos" | "gallos";

export function animalOf(p: ProductView): Animal {
  const c = p.categorySlug;
  if (c === "perros") return "perros";
  if (c === "caballos") return "caballos";
  if (c === "pollos") return "pollos";
  return "gallos";
}

/* Detecta el animal mencionado en el query. null si no es claro. */
const ANIMAL_Q: { animal: Animal; re: RegExp }[] = [
  { animal: "caballos", re: /\b(caball|equin|yegua|potr|horse)\w*/ },
  { animal: "perros", re: /\b(perr|canin|cachorr|dog|mascota)\w*/ },
  { animal: "pollos", re: /\b(pollo|polluel|pollit|levante|engord)\w*/ },
  { animal: "gallos", re: /\b(gallo|gallin|rooster)\w*/ },
];
export function detectAnimal(query: string): Animal | null {
  const q = normalize(query);
  for (const a of ANIMAL_Q) if (a.re.test(q)) return a.animal;
  return null;
}

/* Palabras de animal (para medir si el match es por la NECESIDAD y no solo por el animal). */
const ANIMAL_WORDS = new Set([
  "caballo", "caballos", "equino", "equinos", "yegua", "potro", "potra", "horse",
  "perro", "perros", "perra", "canino", "cachorro", "dog", "mascota",
  "pollo", "pollos", "polluelo", "pollito", "levante", "engorde", "engordar", "cria",
  "gallo", "gallos", "gallina", "rooster", "ave", "aves",
]);

/* ---- Presentación / forma (§4.5b): si piden "inyectable", NO ofrecer gotas ---- */
const FORMAS: { forma: string; q: RegExp; prod: RegExp }[] = [
  { forma: "inyectable", q: /\b(inyect|ampoll|jeringa|intramuscular)\w*/, prod: /\b(inyect|ampoll|intramuscular)\w*/ },
  { forma: "gotas", q: /\b(gota|gotero|goteo)\w*/, prod: /\b(gota|gotero)\w*/ },
  { forma: "polvo", q: /\b(polvo|polvos)\w*/, prod: /\b(polvo)\w*/ },
  { forma: "pastillas", q: /\b(pastilla|tableta|capsul|caps|comprimid|pildora)\w*/, prod: /\b(pastilla|tableta|capsul|caps|comprimid)\w*/ },
  { forma: "shampoo", q: /\b(shampoo|champu)\w*/, prod: /\b(shampoo|champu)\w*/ },
  { forma: "topico", q: /\b(ungu|unguent|pomada|crema|roll|topic|frota)\w*/, prod: /\b(ungu|unguent|pomada|crema|roll|topic|frota)\w*/ },
];
export function detectForma(query: string): string | null {
  const q = normalize(query);
  for (const f of FORMAS) if (f.q.test(q)) return f.forma;
  return null;
}
function formaText(p: ProductView): string {
  return normalize([
    p.presentacion,
    (p.presentations || []).map((x) => x.label).join(" "),
    p.tagline, p.shortDesc, p.name, p.descripcion || "",
  ].filter(Boolean).join(" "));
}
/** ¿El producto es de esa presentación? (según su texto: presentación, tagline, nombre…). */
export function productMatchesForma(p: ProductView, forma: string): boolean {
  const f = FORMAS.find((x) => x.forma === forma);
  return f ? f.prod.test(formaText(p)) : true;
}

/* ¿El query describe un problema médico/síntoma/lesión? (no lo tratan los
   suplementos → mejor pasar a un asesor que fabricar una recomendación). */
const MEDICAL_RE = /\b(ojo|ojos|vista|ceguer|herida|herid|fractur|hueso|quebr|cojea|cojer|renqu|sangr|infecci|infectad|tumor|cancer|bulto|pelota|masa|quiste|hinchad|inflamad|absces|vomit|diarre|moquillo|parvo|garrapat|sarna|hongo|fiebre|dolor|convuls|paraliz|picadur|mordedur|quemadur|ampoll|ulcer|desnutr|anemi)\w*/;
export function looksMedical(query: string): boolean {
  return MEDICAL_RE.test(normalize(query));
}

/**
 * Puntaje de RELEVANCIA por la necesidad (ignora el impulso de animal/categoría).
 * Sirve para NO fabricar recomendaciones: si el query pide algo que el producto
 * no trata (ej. "perro con pelota en el ojo" vs suplemento muscular), da ~0.
 */
/* Palabras de presentación/forma (se excluyen del needScore: "gotas" no es la necesidad). */
const FORM_WORDS = new Set([
  "inyectable", "inyectado", "inyeccion", "ampolla", "jeringa", "intramuscular",
  "gotas", "gota", "gotero", "polvo", "polvos", "pastilla", "pastillas", "tableta",
  "tabletas", "capsula", "capsulas", "caps", "comprimido", "shampoo", "champu",
  "unguento", "pomada", "crema", "roll", "topico", "frota", "liquido", "jarabe",
]);

export function needScore(query: string, p: ProductView): number {
  const qNorm = normalize(query);
  const qTokens = qNorm
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2 && !STOP.has(w) && !ANIMAL_WORDS.has(w) && !FORM_WORDS.has(w));
  if (!qTokens.length) return -1; // query sin necesidad concreta (ej. "algo para mi perro") → no bloquear
  return scoreProduct(qTokens, qNorm, p, new Set<string>(), []);
}

function trigrams(s: string): Set<string> {
  const t = `  ${s} `;
  const out = new Set<string>();
  const n = s.length < 3 ? 2 : 3;
  for (let i = 0; i <= t.length - n; i++) out.add(t.slice(i, i + n));
  return out;
}

function dice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const A = trigrams(a), B = trigrams(b);
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return (2 * inter) / (A.size + B.size);
}

/* Stem singular/plural es (botas→bota, monas→mona, comederos→comedero, tijeras→tijera). */
function stem(w: string): string {
  if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s")) return w.slice(0, -1);
  return w;
}
function toks(text: string): string[] {
  return normalize(text).split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !STOP.has(w)).map(stem);
}

/* Buckets de tokens por prioridad: NOMBRE (+slug) > KEYWORDS > DESCRIPCIÓN. + categoría. */
type Buckets = { name: Set<string>; nameArr: string[]; kw: Set<string>; kwArr: string[]; desc: Set<string>; cat: Set<string> };
const _bcache = new WeakMap<ProductView, Buckets>();
function buckets(p: ProductView): Buckets {
  const c = _bcache.get(p);
  if (c) return c;
  const nameArr = toks([p.slug.replace(/-/g, " "), p.name].join(" "));
  const kwArr = toks((p.keywords?.length ? p.keywords : deriveKeywords(p)).join(" "));
  const descArr = toks([p.audience, p.tagline, p.shortDesc, p.pitch, p.benefits.join(" "), p.paraQue || "", p.descripcion || ""].join(" "));
  const catArr = toks([p.categoryName, p.categorySlug].join(" "));
  const b: Buckets = {
    name: new Set(nameArr), nameArr,
    kw: new Set(kwArr), kwArr,
    desc: new Set(descArr), cat: new Set(catArr),
  };
  _bcache.set(p, b);
  return b;
}

/** ¿El producto COMPARTE señal real con el query? (token exacto en nombre/keyword/categoría
 *  o typo fuerte del nombre/keyword, o su categoría es el intent). Sin esto → jamás se sugiere. */
function isRelevant(qStems: string[], p: ProductView, intentCats: Set<string>): boolean {
  if (intentCats.has(p.categorySlug)) return true;
  const b = buckets(p);
  for (const q of qStems) {
    if (b.name.has(q) || b.kw.has(q) || b.cat.has(q)) return true;
    // substring solo con tokens de ≥4 (evita que "ojo" matchee "piojos"/"rojo").
    for (const h of b.nameArr) { if (q.length >= 4 && h.length >= 4 && (h.includes(q) || q.includes(h))) return true; if (dice(q, h) >= 0.66) return true; }
    for (const h of b.kwArr) { if (q.length >= 4 && h.length >= 4 && (h.includes(q) || q.includes(h))) return true; if (dice(q, h) >= 0.7) return true; }
  }
  return false;
}

function scoreProduct(qTokens: string[], qNorm: string, p: ProductView, intentCats: Set<string>, intentKw: string[]): number {
  const b = buckets(p);
  const qStems = qTokens.map(stem);
  let score = 0;

  // intent / categoría
  if (intentCats.has(p.categorySlug)) score += 5;
  for (const kw of intentKw) { const s = stem(kw); if (b.kw.has(s) || b.name.has(s)) score += 1.2; }

  // tokens del query, POR PRIORIDAD: nombre > keyword > categoría > descripción.
  for (const q of qStems) {
    if (b.name.has(q)) { score += 6; continue; }
    if (b.kw.has(q)) { score += 4; continue; }
    if (b.cat.has(q)) { score += 3; continue; }
    if (b.desc.has(q)) { score += 2.2; continue; }
    // typo tolerance: fuzzy con más peso contra el NOMBRE que contra keywords.
    let best = 0;
    for (const h of b.nameArr) {
      if (q.length >= 4 && h.length >= 4 && (h.includes(q) || q.includes(h))) { best = Math.max(best, 3); continue; }
      const d = dice(q, h); if (d * 5 > best) best = d * 5;
    }
    for (const h of b.kwArr) {
      if (q.length >= 4 && h.length >= 4 && (h.includes(q) || q.includes(h))) { best = Math.max(best, 2.5); continue; }
      const d = dice(q, h); if (d * 3.5 > best) best = d * 3.5;
    }
    score += best;
  }

  // nombre completo muy parecido al query (frase)
  const nameNorm = normalize(p.name);
  if (qNorm && (nameNorm.includes(qNorm) || qNorm.includes(nameNorm))) score += 4;

  return score;
}

export type SearchStatus = "found" | "ambiguous" | "not_found" | "empty_query";

export interface SearchResult {
  status: SearchStatus;
  product: ProductView | null;
  ranked: { product: ProductView; score: number; relevant: boolean }[];
}

/** Busca el mejor match + ranking. `products` = catálogo activo. */
export function searchProducts(query: string, products: ProductView[]): SearchResult {
  const qNorm = normalize(query);
  if (!qNorm) {
    return { status: "empty_query", product: null, ranked: products.slice(0, 6).map((p) => ({ product: p, score: 0, relevant: false })) };
  }

  const qTokens = qNorm.split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !STOP.has(w));
  const qStems = qTokens.map(stem);

  // Filtro por animal: perros/caballos son mundos APARTE (no mezclar). Pero "pollitos"
  // son gallos jóvenes → gallos y pollos comparten pool (Master Pollito es alimento de gallos).
  const animal = detectAnimal(query);
  let pool = products;
  if (animal === "perros" || animal === "caballos") {
    pool = products.filter((p) => animalOf(p) === animal);
  } else if (animal === "gallos" || animal === "pollos") {
    pool = products.filter((p) => animalOf(p) === "gallos" || animalOf(p) === "pollos");
  }
  // Filtro por presentación (§4.5b): si piden "inyectable", NO ofrecer gotas/otras formas.
  const forma = detectForma(query);
  if (forma) pool = pool.filter((p) => productMatchesForma(p, forma));

  // intents
  const intentCats = new Set<string>();
  const intentKw: string[] = [];
  for (const it of INTENTS) {
    if (it.match.test(qNorm)) { intentCats.add(it.category); intentKw.push(...it.kw); }
  }

  const ranked = pool
    .map((p) => ({ product: p, score: scoreProduct(qTokens, qNorm, p, intentCats, intentKw), relevant: isRelevant(qStems, p, intentCats) }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const second = ranked[1];
  // El match SOLO vale si comparte señal real (palabra/categoría) con el query.
  // Sin relevancia o con puntaje bajo → not_found (el bot maneja el silencio).
  if (!top || !top.relevant || top.score < 3) {
    return { status: "not_found", product: null, ranked };
  }
  const gap = top.score - (second?.score ?? 0);
  // Ambiguo solo si el 2º TAMBIÉN es relevante y está muy cerca (y no es el mismo nombre).
  const mismoNombre = !!second && normalize(second.product.name) === normalize(top.product.name);
  const segOk = !!second && second.relevant && (second.score ?? 0) >= 3;
  const status: SearchStatus = !mismoNombre && segOk && gap < 2.5 ? "ambiguous" : "found";
  return { status, product: top.product, ranked };
}
