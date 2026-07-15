/* ESTUDIO POR PRODUCTO → keywords a detalle para los 101 del tenant rooster-deluxe.
   Cada producto absorbe: (1) términos reales de sus beneficios/nombre, (2) pack por
   categoría, (3) pack por forma, (4) pack por audiencia, (5) mapa curado de jerga
   gallera / síntomas (moquillo, hongo, ojos, buas, sangre...). El fuzzy del buscador
   cubre los errores de tipeo, así que aquí van SINÓNIMOS y nombres coloquiales.
   Solo DML (app_runtime OK).  Uso:  node scripts/keywords-detalle-rooster.mjs [--dry] */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  try { for (const l of readFileSync(join(ROOT, f), "utf8").split("\n")) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); } } catch {}
}
const DRY = process.argv.includes("--dry");
const URL = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
const catalogo = JSON.parse(readFileSync(join(ROOT, "data", "rooster-deluxe-productos.json"), "utf8"));
const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/* Packs por CATEGORÍA (cómo lo pide un gallero). */
const CAT = {
  "Vitaminas y suplementos": ["vitamina", "vitaminas", "suplemento", "multivitaminico", "complejo b", "desarrollo", "engorde", "masa muscular", "apetito", "vitalidad", "fuerza", "complemento", "crecimiento"],
  "Doping/energizantes": ["doping", "dopin", "dopping", "energizante", "energetico", "energia", "fuerza", "chispa", "careo", "pelea", "aguante", "resistencia", "potencia", "fiera", "subidon", "pre pelea", "antes del juego"],
  "Vermífugos/desparasitantes": ["desparasitante", "desparasitar", "purga", "purgante", "lombrices", "gusanos", "parasitos", "verme", "tenia", "vermifugo"],
  "Antibióticos/curación": ["antibiotico", "curacion", "curar", "remedio", "infeccion", "medicina", "tratamiento"],
  "Higiene/cuidado": ["higiene", "aseo", "limpieza", "cuidado", "bano"],
  "Implementos": ["implemento", "herramienta", "accesorio"],
  "Comederos": ["comedero", "comederos", "coquitas", "coquita", "plato", "bebedero", "alimentacion"],
  "Recuperación": ["recuperacion", "recuperar", "post entreno", "descanso", "despues del entreno"],
};
/* Packs por FORMA. */
const FORMA = {
  "inyectable": ["inyectable", "inyeccion", "ampolla", "jeringa", "pinchazo", "intramuscular", "pichazo"],
  "gotas": ["gotas", "goticas", "gotero", "goteo"],
  "polvo": ["polvo", "polvito", "mezcla", "en polvo"],
  "pastillas/tabletas": ["pastillas", "pastilla", "tabletas", "tableta", "pepas", "capsulas", "comprimidos", "pepa"],
  "oral líquido": ["liquido", "jarabe", "bebida", "oral", "en la comida", "bebedero"],
  "crema/pomada": ["crema", "pomada", "unguento", "topico", "untar", "sobar"],
  "implemento": [],
  "N/A": [],
};
/* Packs por AUDIENCIA. */
const AUD = {
  "gallos de combate": ["gallo", "gallos", "combate", "careo", "pelea", "fino", "finos", "tapado", "cuerda", "ejemplar"],
  "pollitos": ["pollito", "pollitos", "pollos", "polluelos", "levante", "cria", "bebe", "recien nacidos"],
  "gallos de cría": ["cria", "reproductor", "reproductores", "crestones", "levante", "gallina", "gallinas", "cabo"],
  "general": ["gallo", "gallos", "ejemplar", "ave", "aves"],
};
/* Mapa CURADO por nombre (síntomas + jerga específica que un template no captura). */
const CURADO = [
  { re: /cure chest|clear chicks/, add: ["moquillo", "gripa", "mocos", "pecho", "respiratorio", "tupido", "congestion", "resfriado", "estornudo", "ronquera"] },
  { re: /smallpox/, add: ["viruela", "buas", "buba", "granos", "verrugas"] },
  { re: /fighter.?s vision/, add: ["ojos", "ojo", "vista", "vision", "ceguera", "lastimado ojo"] },
  { re: /karate kill/, add: ["hongo", "hongos", "karate", "micosis", "hongo del karate"] },
  { re: /beak boost/, add: ["pico", "regeneracion", "pico partido", "pico roto"] },
  { re: /percloruro/, add: ["sangre", "coagulante", "parar la sangre", "espantar sangre", "hemostatico"] },
  { re: /red rooster/, add: ["enrojecer", "frota", "rojo", "piel", "enrojecimiento", "cuero"] },
  { re: /rooster shave/, add: ["depilar", "depiladora", "pelar", "afeitar", "quitar pluma"] },
  { re: /shampoo|plume king/, add: ["shampoo", "champu", "bano", "brillo", "lavar"] },
  { re: /lice free/, add: ["piojos", "piojo", "acaros", "parasitos externos", "pica"] },
  { re: /omega 3/, add: ["omega", "plumaje", "piel", "articulaciones", "corazon"] },
  { re: /nutri.?cal/, add: ["calcio", "huesos", "nutricional", "gel", "energia"] },
  { re: /catosal/, add: ["muda", "anabolico", "recuperacion", "estimulante"] },
  { re: /higado de bacalao/, add: ["bacalao", "omega", "aceite", "higado", "perlas"] },
  { re: /ciclosona|clotetrasone|trueno oro|promicina|septibron|pollon/, add: ["antibiotico", "infeccion", "diarrea", "malestar", "decaido"] },
  { re: /post recovery/, add: ["recuperacion", "despues del entreno", "cansancio", "descanso"] },
  // PLUMAJE (bug: "que le crezca la cola" -> Smallpox). Estos 3 SÍ son de pluma; Smallpox NO.
  { re: /omega 3|vitalmin|rooster deluxe max/, add: ["cola", "plumas", "pluma", "plumaje", "emplumar", "que le crezca la cola", "cola larga", "crecer la pluma", "crezca la cola", "brillo de la pluma", "emplume", "cola grande"] },
  { re: /super trainer/, add: ["pre entreno", "entrenamiento", "calentamiento", "musculos"] },
  { re: /end worm|purgebeak|gallo purga|galliverm|gallomec|vermi|panacur|vermicina/, add: ["lombrices", "gusanos", "parasitos", "purga", "desparasitar", "tenias"] },
];

/* Extrae términos con contenido de los beneficios (quita palabras genéricas). */
const DROP = new Set(["que","para","con","los","las","una","del","aporta","aportan","favorece","promueve","brinda","mejora","mejorar","ayuda","ayudan","calidad","producto","ideal","mayor","alto","alta","buen","buena","cada","ejemplar","ejemplares","gallos","gallo","ave","aves","formula","complementa","general","tanto","como","mucho","mas","este","esta","sus","por","desde","hasta","muy","les","son","tus","dale","nivel","suplemento","necesario","necesarios"]);
function terminos(texto) {
  return norm(texto).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !DROP.has(w));
}

function keywordsDe(p) {
  const set = new Set();
  const add = (w) => set.add(norm(w));
  // 1) ESPECÍFICOS primero (NUNCA se truncan): existentes, nombre, jerga curada, beneficios.
  (Array.isArray(p.keywords) ? p.keywords : []).forEach(add);
  norm(p.nombre).split(/[^a-z0-9]+/).filter((w) => w.length >= 2).forEach((w) => set.add(w));
  const nm = norm(p.nombre);
  for (const c of CURADO) if (c.re.test(nm)) c.add.forEach(add);
  terminos(p.beneficios || "").forEach((w) => set.add(w));
  // 2) GENÉRICOS al final (si hay que truncar, se cortan estos, no los específicos).
  (CAT[p.categoria] || []).forEach(add);
  (FORMA[p.forma] || []).forEach(add);
  (AUD[p.audiencia] || []).forEach(add);
  return Array.from(set).filter(Boolean).slice(0, 50);
}

async function main() {
  const sql = postgres(URL, { prepare: false, max: 1 });
  const [t] = await sql`select id from tenants where slug = ${"rooster-deluxe"}`;
  if (!t) { console.error("✗ tenant rooster-deluxe no existe"); process.exit(1); }

  const seen = new Set();
  const rows = catalogo.map((p) => {
    let slug = p.slug; if (seen.has(slug)) slug = `${slug}-${p.num}`; seen.add(slug);
    return { slug, nombre: p.nombre, kw: keywordsDe(p) };
  });

  if (DRY) {
    for (const s of [rows[99], rows[41], rows[31], rows[35], rows[2]]) {
      console.log(`\n──── ${s.nombre} (${s.slug}) ────\n${s.kw.join(", ")}`);
    }
    console.log(`\n(dry · ${rows.length} productos · promedio ${Math.round(rows.reduce((a, r) => a + r.kw.length, 0) / rows.length)} kw c/u)`);
    await sql.end(); return;
  }

  let ok = 0;
  for (const r of rows) {
    const res = await sql`update products set keywords = ${sql.json(r.kw)}, updated_at = now()
      where tenant_id = ${t.id} and slug = ${r.slug}`;
    if (res.count) ok++;
  }
  console.log(`✓ keywords a detalle actualizados: ${ok}/${rows.length}`);
  await sql.end();
}
main().catch((e) => { console.error("✗", e.message); process.exit(1); });
