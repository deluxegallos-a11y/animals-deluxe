/* ===========================================================
   CEREBRO DE IDENTIFICACIÓN DE PRODUCTOS
   Pipeline determinístico (corre igual en tests, demo y prod). Para en el
   primer match confiable:

     PASO 0  normalización + variante fonética española
     PASO 1  tabla de ALIAS (apodos, typos, jerga)          → found | ambiguous
     PASO 2  nombre del producto (exacto / contenido)        → found
     PASO 2b keyword EXACTA y ÚNICA en el catálogo           → found
     PASO 3s necesidad FUERTE (frase de ≥2 palabras)         → category
     PASO 3  fuzzy por trigramas contra nombre+alias (≥0.35) → found | ambiguous
     PASO 4  necesidad DÉBIL (palabra suelta)                → category
     PASO 5  nada                                            → not_found (mensaje "")

   Nunca devuelve un producto "parecido" de otra categoría: si no hay señal
   real, devuelve not_found y el bot maneja el silencio con el catálogo.
   =========================================================== */
import type { ProductView } from "@/lib/ai/types";
import { normalize } from "@/lib/ai/format";
import { ALIAS_CATALOG, NEED_RULES, ROOSTER_RULES, type AliasEntry, type NeedRule, type Ruleset } from "@/lib/ai/aliases";
import { searchProducts, speciesPool, detectForma, productMatchesForma } from "@/lib/ai/search";

/* ---------------- PASO 0 — normalización ---------------- */

/** Muletillas que no aportan identidad. Se quitan SOLO en la variante "stripped":
 *  el query crudo se conserva porque hay alias con artículo ("la 77", "la mamba"). */
const FILLERS = [
  "quiero", "quisiera", "necesito", "busco", "buscar", "me puedes", "me puede", "puedes", "puede",
  "mandar", "manda", "mandame", "enviar", "envia", "enviame", "pasame", "pasar",
  "fotos de", "foto de", "fotos", "foto", "imagenes de", "imagen de", "imagenes", "imagen",
  "cuanto vale", "cuanto valen", "cuanto cuesta", "cuanto cuestan", "que precio tiene", "precio de",
  "por favor", "porfavor", "porfa", "gracias", "hola", "buenas", "señor", "senor",
  "tienes", "tiene", "tienen", "hay", "me das", "dame", "regalame", "vendes", "venden",
  "trae", "traes", "traiga", "trai", "que trae", "la que trae", "el que trae",
];

/** Quita muletillas y artículos sueltos. */
export function stripFillers(q: string): string {
  let s = ` ${q} `;
  for (const f of FILLERS) s = s.split(` ${f} `).join(" ");
  // Conectores: iterar hasta estabilizar. Una sola pasada dejaba tokens pegados
  // ("la que trae vitaminas" → "que vitaminas", y ese "que vitaminas" hacía match
  // ortográfico con "vitamina b12 5500").
  const conn = /\s+(el|la|los|las|un|una|unos|unas|de|del|para|pa|pal|por|con|que|mi|me|le|su|lo|y|o|en|a)\s+/;
  let prev = "";
  while (prev !== s) { prev = s; s = s.replace(conn, " "); }
  return s.replace(/\s+/g, " ").trim();
}

/** Singular simple (botas→bota, monas→mona, comederos→comedero). */
export function singular(w: string): string {
  if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s")) return w.slice(0, -1);
  return w;
}

/**
 * Variante FONÉTICA española: colapsa las confusiones que realmente comete el
 * cliente escribiendo por WhatsApp. Se aplica a AMBOS lados de la comparación,
 * así "bermicina"≈"vermicina", "siano"≈"cyano", "rebamba"≈"red bamba".
 */
export function phonetic(s: string): string {
  return normalize(s)
    .replace(/qu/g, "k")
    .replace(/c([eiy])/g, "s$1")
    .replace(/ll/g, "y")
    .replace(/y/g, "i")
    .replace(/([^cs])h/g, "$1")
    .replace(/^h/, "")
    .replace(/v/g, "b")
    .replace(/z/g, "s")
    .replace(/x/g, "ks")
    .replace(/g([ui])e/g, "g$1")
    .replace(/gu([ei])/g, "g$1")
    .replace(/mb/g, "nb")
    .replace(/rr/g, "r")
    .replace(/(.)\1/g, "$1") // dobles: cc, ss, nn, tt…
    .replace(/\s+/g, " ")
    .trim();
}

export type NormalizedQuery = {
  raw: string;
  /** normalizado (minúsculas, sin tildes, espacios colapsados) */
  q: string;
  /** sin muletillas ni artículos */
  stripped: string;
  /** variante fonética del stripped */
  phon: string;
  tokens: string[];
};

/* ---------------- PASO -1 — candado de entrada ----------------
   BUG DE PROD (2-ago-2026, 13 casos): cuando el cliente manda una NOTA DE VOZ o una
   FOTO, UChat reenvía la URL del media como `q`:
     "https://www.uchat.com.au/media/whatsapp/1179721351895048/…/-VNwT.mp3"
   Al normalizar, la URL se vuelve palabras sueltas y el token "media" hacía match
   EXACTO (score 1.0) con "Comedero MEDIA Luna" → el bot le mandaba un comedero a
   alguien que solo había mandado un audio.
   Una URL, un archivo o un id no son una consulta: se cortan ANTES de tocar el
   catálogo. */
const EXT_MEDIA = /\.(png|jpe?g|jpg|gif|webp|bmp|svg|mp3|mp4|ogg|oga|opus|wav|m4a|aac|amr|3gp|mov|webm|pdf|docx?|xlsx?)(\?|#|$)/i;

/** ¿Este texto NO es una consulta de producto? (URL, archivo, id, puro número). */
export function esQueryBasura(raw: string): boolean {
  const s = (raw || "").trim();
  if (!s) return true;
  if (/^(https?:)?\/\//i.test(s) || /^www\./i.test(s)) return true;   // URL
  if (/\b(?:https?:\/\/|www\.)\S+/i.test(s)) return true;             // URL embebida
  if (EXT_MEDIA.test(s)) return true;                                  // nombre de archivo
  if (/^[a-f0-9]{16,}$/i.test(s)) return true;                         // hash / id
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-/i.test(s)) return true;               // uuid
  if (!/[a-záéíóúñ]/i.test(s)) return true;                            // sin una sola letra
  return false;
}

export function normalizeQuery(raw: string): NormalizedQuery {
  const q = normalize(raw).replace(/[^a-z0-9\s+]/g, " ").replace(/\s+/g, " ").trim();
  const stripped = stripFillers(q);
  return {
    raw, q, stripped,
    phon: phonetic(stripped),
    tokens: stripped.split(" ").filter(Boolean),
  };
}

/* ---------------- trigramas (identidad) ----------------
   SIN padding: el padding infla la similitud de palabras cortas y hacía que
   "cola" pareciera "cobra" (0.36). Sin padding esa pareja da 0. */
function trigrams(s: string): Set<string> {
  const t = s.replace(/\s+/g, "");
  const out = new Set<string>();
  const n = t.length <= 3 ? t.length : 3;
  for (let i = 0; i <= t.length - n; i++) out.add(t.slice(i, i + n));
  return out;
}

/** Similitud Dice por trigramas, 0..1. Penaliza diferencias grandes de longitud. */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const la = a.replace(/\s/g, "").length, lb = b.replace(/\s/g, "").length;
  if (Math.abs(la - lb) > Math.max(2, Math.round(0.4 * Math.max(la, lb)))) return 0;
  const A = trigrams(a), B = trigrams(b);
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return (2 * inter) / (A.size + B.size);
}

/** Similitud considerando también la variante fonética (se queda con la mejor). */
export function simPhon(a: string, b: string): number {
  return Math.max(similarity(a, b), similarity(phonetic(a), phonetic(b)));
}

/**
 * Similitud de IDENTIDAD: la usada para decidir "es este producto".
 * Además del umbral exige que coincida el primer fonema, salvo que el parecido
 * sea muy alto (≥0.55). Un typo casi nunca cambia la letra inicial, y sin esta
 * guarda "moquillo" pasaba por "coquitas" (comparten "oqu"+"qui" → 0.36).
 */
export function identitySim(a: string, b: string): number {
  const s = simPhon(a, b);
  // La exención por parecido alto era 0.55 y dejaba pasar cruces absurdos:
  // "goticas" (gotas) vs "boticas" (alias de BOTAS) da 0.80 y el bot le ofrecía
  // botas a quien pedía goticas para dopar. Un typo casi nunca cambia la primera
  // letra, así que el primer fonema es obligatorio salvo parecido casi total.
  if (s >= 0.9) return s;
  const pa = phonetic(a), pb = phonetic(b);
  return pa[0] && pa[0] === pb[0] ? s : 0;
}

/* ---------------- índice de alias ---------------- */

export type AliasIndex = { alias: string; slugs: string[]; nota?: string }[];

/** Construye el índice (catálogo en código + alias extra de la DB).
 *  `base` = catálogo de alias del tenant (rooster por defecto). */
export function buildAliasIndex(extra: AliasEntry[] = [], base: AliasEntry[] = ALIAS_CATALOG): AliasIndex {
  const out: AliasIndex = [];
  for (const e of [...base, ...extra]) {
    for (const a of e.aliases) {
      const alias = normalize(a).replace(/\s+/g, " ").trim();
      if (alias) out.push({ alias, slugs: e.slugs, nota: e.nota });
    }
  }
  // Alias más largo primero: "dragon mamba" gana sobre "mamba", "atp gold" sobre "gold".
  return out.sort((x, y) => y.alias.length - x.alias.length);
}

const DEFAULT_INDEX = buildAliasIndex();

/** ¿El texto contiene el alias como palabra/frase completa? */
function containsPhrase(text: string, phrase: string): boolean {
  return ` ${text} `.includes(` ${phrase} `);
}

/* ---------------- resultado ---------------- */

export type BrainStatus = "found" | "ambiguous" | "category" | "not_found" | "empty_query";
export type MatchedBy = "alias" | "name" | "keyword" | "fuzzy" | "need" | "";

export interface BrainResult {
  status: BrainStatus;
  product: ProductView | null;
  /** ambiguous → opciones a elegir; category → productos de la necesidad. */
  options: ProductView[];
  matchedBy: MatchedBy;
  /** Confianza 0..1 del match de identidad (0 en need/not_found). */
  score: number;
  /** Aclaración obligatoria (ej. patapiojas: solo normales). */
  nota?: string;
  /** Ranking del motor fuzzy (para sugerencias). */
  ranked: { product: ProductView; score: number; relevant: boolean }[];
  norm: NormalizedQuery;
}

const THRESHOLD = 0.35;

/**
 * Palabras que NO identifican un producto por parecido ortográfico y por eso
 * quedan FUERA del fuzzy (PASO 3). Dos familias:
 *  · FORMAS farmacéuticas ("pastillas", "gotas", "inyectable"…): describen la
 *    presentación, no el producto. Sin este filtro "pastillas para parásitos"
 *    hacía match con "cure-chest-for-rooster-PASTILLAS" (respiratorio) y
 *    secuestraba la necesidad real (desparasitante).
 *  · NECESIDADES AMPLIAS ("vitaminas", "parásitos", "pulgas"…): son señal de
 *    CATEGORÍA, no de un SKU puntual → deben enrutar a la regla de necesidad
 *    (categoría), no a un producto suelto que casualmente lleve la palabra.
 * El PASO 1 (alias) corre antes, así que un alias legítimo con estas palabras
 * ("super vitamina b12", "el polvo rojo") sigue resolviendo sin problema.
 */
const FUZZY_STOP = new Set([
  // formas
  "pastilla", "pastillas", "gota", "gotas", "inyectable", "inyeccion", "inyecciones",
  "jarabe", "crema", "cremas", "polvo", "polvos", "liquido", "liquida", "gel",
  "tableta", "tabletas", "capsula", "capsulas", "ampolla", "ampollas",
  "sobre", "sobres", "frasco", "spray", "suspension", "solucion",
  // necesidades amplias
  "vitamina", "vitaminas", "mineral", "minerales", "suplemento", "suplementos",
  "parasito", "parasitos", "purga", "desparasitante", "desparasitantes",
  "lombriz", "lombrices", "pulga", "pulgas", "piojo", "piojos",
  "energia", "energizante", "doping", "dopin", "pelea", "peleas",
  // genéricas del dominio: aparecen en medio catálogo, no identifican un SKU
  "gallo", "gallos", "rooster", "ave", "aves", "animal", "animales",
  // "media" es forma/tamaño ("Comedero MEDIA Luna"), nunca lo que busca el cliente.
  // Cinturón y tirantes junto al candado de URLs: si "media" vuelve a colarse por
  // otra vía, ya no puede identificar un producto por sí sola.
  "media", "luna",
]);

/** Dedupe por nombre (el catálogo tiene SKUs repetidos: 2× Mona, 2× Tijera Roja…). */
function dedupe(list: ProductView[]): ProductView[] {
  const seen = new Set<string>();
  return list.filter((p) => {
    const k = normalize(p.name);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function bySlugs(slugs: string[], products: ProductView[]): ProductView[] {
  const out: ProductView[] = [];
  for (const s of slugs) {
    const p = products.find((x) => x.slug === s);
    if (p) out.push(p);
  }
  return dedupe(out);
}

function pack(
  hits: ProductView[],
  matchedBy: MatchedBy,
  score: number,
  norm: NormalizedQuery,
  ranked: BrainResult["ranked"],
  nota?: string,
): BrainResult {
  const uniq = dedupe(hits);
  return {
    status: uniq.length > 1 ? "ambiguous" : "found",
    product: uniq[0] || null,
    options: uniq.length > 1 ? uniq.slice(0, 4) : [],
    matchedBy, score, nota, ranked, norm,
  };
}

/* ---------------- PASO 4 — necesidad ---------------- */

type NeedHit = { slugs: string[]; categorySlug?: string; words: number; id: string };

/** Gana la frase MÁS LARGA (no la primera): "pal moquillo" pesa más que "moquillo",
 *  y así una necesidad clara no queda a merced del orden de la lista. */
function matchNeed(norm: NormalizedQuery, needRules: NeedRule[] = NEED_RULES): NeedHit | null {
  let best: NeedHit | null = null;
  for (const rule of needRules) {
    for (const m of rule.match) {
      const phrase = normalize(m);
      if (!containsPhrase(norm.q, phrase) && !containsPhrase(norm.stripped, phrase)) continue;
      const words = phrase.split(" ").length;
      if (!best || words > best.words) {
        best = { slugs: rule.slugs || [], categorySlug: rule.categorySlug, words, id: rule.id };
      }
    }
  }
  return best;
}

/** Productos de la necesidad. Si el cliente pidió una FORMA ("goticas",
 *  "inyectable", "pastillas"), los de esa forma van primero: "goticas para dopar"
 *  devolvía los 3 primeros de la categoría por orden alfabético y salían tres
 *  INYECTABLES, justo lo contrario de lo que pidió. */
function needProducts(hit: NeedHit, products: ProductView[], forma?: string | null): ProductView[] {
  const base = hit.slugs.length
    ? bySlugs(hit.slugs, products)
    : hit.categorySlug
      ? dedupe(products.filter((p) => p.categorySlug === hit.categorySlug))
      : [];
  if (!base.length) return [];
  if (forma) {
    const enForma = base.filter((p) => productMatchesForma(p, forma));
    if (enForma.length) return enForma.slice(0, 3);
  }
  return base.slice(0, 3);
}

/* ---------------- pipeline ---------------- */

/**
 * Identifica QUÉ producto quiere el cliente.
 * @param extraAliases alias adicionales cargados de la DB (panel), opcional.
 * @param rules ruleset del tenant (alias + necesidades). Default = rooster.
 */
export function identifyProduct(
  rawQuery: string,
  products: ProductView[],
  extraAliases: AliasEntry[] = [],
  rules: Ruleset = ROOSTER_RULES,
): BrainResult {
  const norm = normalizeQuery(rawQuery);

  /* --- PASO -1: CANDADO. Query vacío o basura (URL de audio/foto, archivo, id)
     → not_found seco, SIN mirar el catálogo. Nunca un producto "por si acaso". */
  if (esQueryBasura(rawQuery)) {
    return { status: "not_found", product: null, options: [], matchedBy: "", score: 0, ranked: [], norm };
  }

  // Índice de alias del tenant (+ alias extra de la DB). Se cachea el del set
  // rooster sin extras (caso más común en los tests) para no reconstruirlo.
  const index = (rules === ROOSTER_RULES && !extraAliases.length)
    ? DEFAULT_INDEX
    : buildAliasIndex(extraAliases, rules.aliases);
  // FILTRO POR ESPECIE — se aplica de PASO 1b en adelante. Un producto de perro o
  // de caballo solo entra si el cliente nombró ese animal; si no, el pool es
  // gallos+pollos. Bug real: "algo para el músculo" resolvía More Muscle Dogs
  // (perros) y "proteína para subir masa" resolvía Horse Deluxe (caballos), y el
  // bot terminaba ofreciéndoselos a un gallero.
  // El PASO 1a (alias EXPLÍCITO) queda fuera del filtro a propósito: si el cliente
  // escribe "more muscle dogs" ya nombró al perro y debe resolver igual.
  const pool = speciesPool(rawQuery, products);
  // FORMA pedida ("goticas", "inyectable", "pastillas"…): la usa la etapa de
  // necesidad para no ofrecer inyectables a quien pidió gotas.
  const forma = detectForma(rawQuery);
  // Motor fuzzy existente: se usa para el RANKING (sugerencias), no para decidir
  // identidad. Corre sobre el pool para que las sugerencias tampoco mezclen animales.
  const ranked = searchProducts(norm.stripped || norm.q, pool).ranked;
  const empty: BrainResult = { status: "not_found", product: null, options: [], matchedBy: "", score: 0, ranked, norm };

  if (!norm.q) return { ...empty, status: "empty_query" };

  // ¿El query tiene algún token que IDENTIFIQUE un SKU? (no forma, no necesidad
  // amplia, no palabra genérica del dominio como "gallo"). Si no, saltamos los
  // pasos de identidad (keyword y fuzzy) y deja decidir a la regla de necesidad:
  // "vitaminas y minerales" es CATEGORÍA, no el único SKU con esa keyword.
  const hasIdentity = norm.tokens.some((t) => !FUZZY_STOP.has(t));

  /* --- PASO 1a: ALIAS contenido en el query (alias más largo gana) ---
     "dragon mamba" gana sobre "mamba"; "atp gold" sobre "gold". */
  for (const e of index) {
    const hit =
      containsPhrase(norm.q, e.alias) ||
      containsPhrase(norm.stripped, e.alias) ||
      containsPhrase(phonetic(norm.q), phonetic(e.alias)) ||
      // singular/plural: "botas"→"bota" y viceversa
      containsPhrase(norm.stripped.split(" ").map(singular).join(" "), e.alias.split(" ").map(singular).join(" "));
    if (!hit) continue;
    const hits = bySlugs(e.slugs, products);
    if (hits.length) return pack(hits, "alias", 1, norm, ranked, e.nota);
  }

  /* --- PASO 1b: el query es PARTE de un alias ("mamba" → "la mamba") ---
     Segunda pasada, y aquí gana el alias MÁS CORTO (el que mejor le calza):
     si fuera en la misma pasada, "mamba" caería en "dragon mamba". */
  if (norm.stripped.length >= 4) {
    for (const e of [...index].sort((a, b) => a.alias.length - b.alias.length)) {
      if (!containsPhrase(e.alias, norm.stripped)) continue;
      // Contra `pool`: "musculo" es parte del alias "musculo perro", y sin este
      // filtro un gallero pidiendo músculo recibía el producto de perros.
      const hits = bySlugs(e.slugs, pool);
      if (hits.length) return pack(hits, "alias", 1, norm, ranked, e.nota);
    }
  }

  /* --- PASO 2: NOMBRE del producto (exacto o contenido) --- */
  const nameHits = pool.filter((p) => {
    const n = normalize(p.name);
    return containsPhrase(norm.q, n) || containsPhrase(norm.stripped, n) || n === norm.stripped;
  });
  if (nameHits.length) {
    // gana el nombre más largo (más específico)
    const best = [...nameHits].sort((a, b) => b.name.length - a.name.length);
    const top = normalize(best[0].name);
    return pack(best.filter((p) => normalize(p.name) === top), "name", 1, norm, ranked);
  }

  /* --- PASO 2b: KEYWORD exacta y ÚNICA en todo el catálogo ---
     Una keyword genérica ("moquillo") la comparten varios productos → NO
     identifica; se deja para la etapa de necesidad. */
  const kwOwners = new Map<string, Set<string>>();
  for (const p of pool) {
    for (const k of p.keywords || []) {
      const kk = normalize(k);
      if (!kk) continue;
      if (!kwOwners.has(kk)) kwOwners.set(kk, new Set());
      kwOwners.get(kk)!.add(normalize(p.name));
    }
  }
  if (hasIdentity) for (const cand of [norm.stripped, norm.q]) {
    const owners = kwOwners.get(cand);
    if (owners && owners.size === 1) {
      const hits = pool.filter((p) => (p.keywords || []).some((k) => normalize(k) === cand));
      if (hits.length) return pack(hits, "keyword", 1, norm, ranked);
    }
  }

  /* --- PASO 3s: NECESIDAD FUERTE (frase de ≥2 palabras) ---
     Va ANTES del fuzzy: "que le crezca la cola" es una necesidad clarísima y no
     debe competir con parecidos ortográficos ("cola"≈"cobra"). */
  const need = matchNeed(norm, rules.needs);
  if (need && need.words >= 2) {
    const prods = needProducts(need, pool, forma);
    if (prods.length) return { status: "category", product: prods[0], options: prods, matchedBy: "need", score: 0, ranked, norm };
  }

  /* --- PASO 3: FUZZY contra NOMBRE + ALIAS (umbral 0.35) ---
     Solo identidad: nombres y alias. Las keywords no identifican (por eso
     "botas" no podía terminar en Comedero). */
  type Cand = { product: ProductView; sim: number };
  const cands: Cand[] = [];
  // Identidad = query SIN palabras de forma/necesidad amplia. Si no queda nada
  // (ej. "vitaminas y minerales"), no hay señal de SKU → que decida la necesidad.
  const identityStripped = norm.tokens.filter((t) => !FUZZY_STOP.has(t)).join(" ");
  if (hasIdentity) for (const p of pool) {
    const name = normalize(p.name);
    let best = identityStripped ? identitySim(identityStripped, name) : 0;
    // por token del nombre y ventanas de 1-2 palabras del query
    const qWins: string[] = [];
    for (let i = 0; i < norm.tokens.length; i++) {
      const t = norm.tokens[i], t2 = norm.tokens[i + 1];
      // Una palabra de forma/necesidad amplia por sí sola no identifica → fuera del fuzzy.
      if (!FUZZY_STOP.has(t)) qWins.push(t);
      // Ventana de 2 palabras: solo si TIENE un ancla de identidad real (un token
      // NO-stopword de ≥4 letras). Si no ("red rooster" = color + palabra genérica
      // "rooster", o "vitaminas minerales" = puras stopwords), la ventana queda
      // dominada por la palabra común y hacía match falso (red rooster→rooster xt).
      if (t2 !== undefined && [t, t2].some((w) => !FUZZY_STOP.has(w) && w.length >= 4)) qWins.push(`${t} ${t2}`);
    }
    // El nombre tampoco identifica por su token de forma ("…-pastillas", "…-inyectable").
    const nameToks = name.split(" ").filter((w) => w.length >= 4 && !FUZZY_STOP.has(w));
    for (const w of qWins) {
      if (w.length < 4) continue;
      for (const nt of nameToks) best = Math.max(best, identitySim(w, nt));
      for (const e of index) {
        if (!e.slugs.includes(p.slug)) continue;
        best = Math.max(best, identitySim(w, e.alias));
      }
    }
    if (best >= THRESHOLD) cands.push({ product: p, sim: best });
  }
  cands.sort((a, b) => b.sim - a.sim);

  if (cands.length) {
    const top = cands[0];
    // 2-3 candidatos cercanos Y de la misma categoría → ambiguous.
    const close = dedupe(
      cands.filter((c) => top.sim - c.sim <= 0.08 && c.product.categorySlug === top.product.categorySlug).map((c) => c.product),
    ).slice(0, 3);
    if (close.length > 1) {
      return { status: "ambiguous", product: close[0], options: close, matchedBy: "fuzzy", score: top.sim, ranked, norm };
    }
    return { status: "found", product: top.product, options: [], matchedBy: "fuzzy", score: top.sim, ranked, norm };
  }

  /* --- PASO 4: NECESIDAD DÉBIL (palabra suelta) --- */
  if (need) {
    const prods = needProducts(need, pool, forma);
    if (prods.length) return { status: "category", product: prods[0], options: prods, matchedBy: "need", score: 0, ranked, norm };
  }

  /* --- PASO 5: nada --- */
  return empty;
}
