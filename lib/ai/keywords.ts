/* ===========================================================
   Palabras clave por producto — identificación robusta.
   Se DERIVAN automáticamente de cada producto (categoría +
   nombre + audiencia + beneficios + origen), así TODO producto
   queda identificable por el bot y el panel sin trabajo manual.
   Determinístico → igual en demo, prod y tests.
   =========================================================== */
import { normalize } from "@/lib/ai/format";

/* sinónimos/lenguaje gallero por categoría (refuerzan el match) */
const CAT_KW: Record<string, string[]> = {
  energia: ["energizante", "doping", "energia", "fuerza", "fiera", "pelea", "careo", "resistencia", "aguante", "potencia", "vuelo"],
  vitaminas: ["vitamina", "multivitaminico", "complejo", "salud", "defensas", "apetito"],
  desparasitantes: ["desparasitante", "purga", "lombrices", "parasitos", "gusanos", "limpieza"],
  respiratorio: ["respiratorio", "pecho", "mocos", "gripa", "tos", "pulmon", "congestion", "estornudo"],
  cuidado: ["pluma", "piel", "brillo", "muda", "plumaje", "hongos", "cuidado", "escamas"],
  suplementos: ["suplemento", "polvo", "formula", "mezcla", "nutricion", "proteina"],
  entrenamiento: ["entrenamiento", "musculo", "masa", "recuperacion", "peso", "gym"],
  pollos: ["pollo", "levante", "cria", "engorde", "polluelo"],
  perros: ["perro", "canino", "cachorro", "mascota"],
  caballos: ["caballo", "equino", "yegua", "potro"],
};

const ORIGIN_KW: Record<string, string[]> = {
  us: ["americano", "importado", "premium"],
  br: ["brasilero", "importado"],
  mx: ["mexicano", "importado"],
  co: ["nacional"],
};

const STOP = new Set([
  "de", "la", "el", "los", "las", "un", "una", "para", "por", "con", "que", "del", "al", "y", "o",
  "en", "a", "su", "lo", "mas", "muy", "the", "and", "of", "to", "es", "son", "tu", "se",
]);

export type KwInput = {
  name?: string; categorySlug?: string; categoryName?: string;
  audience?: string; origin?: string; tagline?: string; benefits?: string[];
};

/** Devuelve hasta ~12 palabras clave normalizadas y únicas para un producto. */
export function deriveKeywords(p: KwInput): string[] {
  const out = new Set<string>();
  const add = (w: string) => {
    const n = normalize(w).trim();
    if (n.length >= 3 && !STOP.has(n)) out.add(n);
  };

  // 1) sinónimos de categoría + origen
  (CAT_KW[p.categorySlug || ""] || []).forEach(add);
  (ORIGIN_KW[p.origin || "co"] || []).forEach(add);

  // 2) tokens significativos del nombre (sin la marca genérica)
  normalize(p.name || "").split(/[^a-z0-9]+/).forEach((t) => { if (t.length >= 4) add(t); });

  // 3) audiencia (gallos, combate, exhibición…)
  normalize(p.audience || "").split(/[^a-z0-9]+/).forEach((t) => { if (t.length >= 4) add(t); });

  // 4) beneficios (primeras palabras fuertes de cada beneficio)
  (p.benefits || []).slice(0, 4).forEach((b) =>
    normalize(b).split(/[^a-z0-9]+/).filter((t) => t.length >= 5).slice(0, 2).forEach(add),
  );

  return Array.from(out).slice(0, 12);
}
