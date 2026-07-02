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
export function needScore(query: string, p: ProductView): number {
  const qNorm = normalize(query);
  const qTokens = qNorm
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2 && !STOP.has(w) && !ANIMAL_WORDS.has(w));
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

function haystackTokens(p: ProductView): string[] {
  const text = [
    p.slug.replace(/-/g, " "),
    p.name,
    p.audience,
    p.tagline,
    p.shortDesc,
    p.pitch,
    p.benefits.join(" "),
    p.categoryName,
    p.categorySlug,
    (p.keywords?.length ? p.keywords : deriveKeywords(p)).join(" "),
  ].join(" ");
  return normalize(text).split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !STOP.has(w));
}

function scoreProduct(qTokens: string[], qNorm: string, p: ProductView, intentCats: Set<string>, intentKw: string[]): number {
  const hayTokens = haystackTokens(p);
  const haySet = new Set(hayTokens);
  let score = 0;

  // intent / categoría
  if (intentCats.has(p.categorySlug)) score += 6;
  for (const kw of intentKw) if (haySet.has(kw)) score += 1.5;

  // tokens del query
  for (const q of qTokens) {
    if (haySet.has(q)) { score += 4; continue; }
    // substring dentro de algún token (ej "cobra" en "supercobra")
    let best = 0;
    for (const h of hayTokens) {
      if (h.includes(q) || q.includes(h)) { best = Math.max(best, 2.5); continue; }
      const d = dice(q, h);
      if (d > best) best = d * 3.5; // typo tolerance
    }
    score += best;
  }

  // nombre completo muy parecido al query
  const nameNorm = normalize(p.name);
  if (qNorm && (nameNorm.includes(qNorm) || qNorm.includes(nameNorm))) score += 5;
  score += dice(qNorm, nameNorm) * 2;

  return score;
}

export type SearchStatus = "found" | "ambiguous" | "not_found" | "empty_query";

export interface SearchResult {
  status: SearchStatus;
  product: ProductView | null;
  ranked: { product: ProductView; score: number }[];
}

/** Busca el mejor match + ranking. `products` = catálogo activo. */
export function searchProducts(query: string, products: ProductView[]): SearchResult {
  const qNorm = normalize(query);
  if (!qNorm) {
    return { status: "empty_query", product: null, ranked: products.slice(0, 6).map((p) => ({ product: p, score: 0 })) };
  }

  const qTokens = qNorm.split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !STOP.has(w));

  // Filtro por animal: si el query menciona un animal, SOLO ese animal (no mezclar).
  const animal = detectAnimal(query);
  const pool = animal ? products.filter((p) => animalOf(p) === animal) : products;

  // intents
  const intentCats = new Set<string>();
  const intentKw: string[] = [];
  for (const it of INTENTS) {
    if (it.match.test(qNorm)) { intentCats.add(it.category); intentKw.push(...it.kw); }
  }

  const ranked = pool
    .map((p) => ({ product: p, score: scoreProduct(qTokens, qNorm, p, intentCats, intentKw) }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const second = ranked[1];
  if (!top || top.score < 3) {
    return { status: "not_found", product: null, ranked };
  }
  const gap = top.score - (second?.score ?? 0);
  const status: SearchStatus = gap < 2.5 && (second?.score ?? 0) >= 3 ? "ambiguous" : "found";
  return { status, product: top.product, ranked };
}
