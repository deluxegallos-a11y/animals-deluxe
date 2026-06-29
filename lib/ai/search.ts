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

  // intents
  const intentCats = new Set<string>();
  const intentKw: string[] = [];
  for (const it of INTENTS) {
    if (it.match.test(qNorm)) { intentCats.add(it.category); intentKw.push(...it.kw); }
  }

  const ranked = products
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
