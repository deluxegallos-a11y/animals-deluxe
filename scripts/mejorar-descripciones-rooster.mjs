/* Reescribe las descripciones de los 101 productos de rooster-deluxe: completas,
   con emojis y explicando qué es cada producto. USA SOLO datos reales del JSON
   (nombre, categoria, forma, audiencia, beneficios, especificaciones, presentaciones)
   — cero claims inventados. Actualiza products.descripcion + short_desc (scoped al tenant).
   Uso:  node scripts/mejorar-descripciones-rooster.mjs         (aplica)
         node scripts/mejorar-descripciones-rooster.mjs --dry   (solo muestra 3 ejemplos) */
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

const CAT = {
  "Vitaminas y suplementos": { emoji: "💊", tipo: "suplemento vitamínico" },
  "Doping/energizantes":     { emoji: "⚡", tipo: "energizante / doping" },
  "Vermífugos/desparasitantes": { emoji: "🪱", tipo: "desparasitante" },
  "Higiene/cuidado":         { emoji: "🧴", tipo: "producto de higiene y cuidado" },
  "Antibióticos/curación":   { emoji: "🩹", tipo: "producto de curación" },
  "Implementos":             { emoji: "⚔️", tipo: "implemento" },
  "Comederos":               { emoji: "🥣", tipo: "comedero" },
  "Recuperación":            { emoji: "💪", tipo: "recuperador post-entreno" },
};
const FORMA = {
  "gotas": "en gotas", "inyectable": "inyectable", "polvo": "en polvo",
  "pastillas/tabletas": "en pastillas", "oral líquido": "líquido oral",
  "crema/pomada": "de uso tópico", "implemento": "", "N/A": "",
};
const AUD = {
  "gallos de combate": "tus gallos de combate", "pollitos": "tus pollitos",
  "gallos de cría": "tus reproductores", "general": "tus ejemplares",
};
// Gancho corto (tagline) y cierre persuasivo por categoría — aspiracional, sin claims falsos.
const HOOK = {
  "Vitaminas y suplementos": "💪 Desarrollo, fuerza y vitalidad para tus campeones",
  "Doping/energizantes":     "⚡ Energía y resistencia para el momento del juego",
  "Vermífugos/desparasitantes": "🪱 Adiós parásitos: protege a tus ejemplares",
  "Higiene/cuidado":         "🧴 Limpieza y cuidado premium para tus gallos",
  "Antibióticos/curación":   "🩹 Cuidado y recuperación cuando más lo necesita",
  "Implementos":             "⚔️ Calidad para el manejo de tus ejemplares",
  "Comederos":               "🥣 Alimentación práctica y ordenada",
  "Recuperación":            "💪 Recuperación total después del entreno",
};
const PUNCH = {
  "Vitaminas y suplementos": "🏆 Dale a tus gallos el desarrollo que se merecen.",
  "Doping/energizantes":     "🔥 Prepara a tus campeones para la victoria.",
  "Vermífugos/desparasitantes": "✅ Ejemplares sanos, limpios y en plena forma.",
  "Higiene/cuidado":         "✨ Presentación impecable para tus gallos.",
  "Antibióticos/curación":   "💚 Cuídalos a tiempo y recupéralos rápido.",
  "Implementos":             "👌 Herramienta confiable para tu manejo diario.",
  "Comederos":               "🐔 Prácticos y resistentes para tu galpón.",
  "Recuperación":            "💥 Que se recuperen listos para el próximo reto.",
};
const cop = (n) => "$" + Number(n || 0).toLocaleString("es-CO");

function descripcion(p) {
  const c = CAT[p.categoria] || { emoji: "🐓", tipo: "producto" };
  const forma = FORMA[p.forma] ?? "";
  const aud = AUD[p.audiencia] || "tus ejemplares";
  // Header: qué ES el producto
  const quees = [c.tipo, forma].filter(Boolean).join(" ");
  const header = `${c.emoji} *${p.nombre}* — ${quees} para ${aud}.`;
  // Beneficios (frase real) → intro
  const intro = (p.beneficios || "").trim();
  const bloques = [header, "", intro].filter((x) => x !== undefined);
  // Modo de uso / especificaciones
  if (p.especificaciones && p.especificaciones.trim()) {
    bloques.push("", `📋 *Cómo se usa:* ${p.especificaciones.trim()}`);
  }
  // Presentaciones + precios
  if (Array.isArray(p.presentaciones) && p.presentaciones.length) {
    bloques.push("", "📦 *Presentaciones:*");
    for (const pr of p.presentaciones) bloques.push(`• ${pr.detalle} — *${cop(pr.precio_cop)}*`);
  }
  // Cierre persuasivo por categoría + CTA (anticipado, sin contra entrega)
  const punch = PUNCH[p.categoria] || "";
  if (punch) bloques.push("", punch);
  bloques.push("", "🚚 Envíos a todo el país · 💳 pago por adelantado. ¡Escríbenos y arma tu pedido! 🐓");
  return bloques.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Gancho corto para el header del bot (tagline/pitch). Grounded en la categoría. */
function gancho(p) {
  return HOOK[p.categoria] || "🐓 Calidad premium para tus ejemplares";
}

async function main() {
  const sql = postgres(URL, { prepare: false, max: 1 });
  const [t] = await sql`select id from tenants where slug = ${"rooster-deluxe"}`;
  if (!t) { console.error("✗ tenant rooster-deluxe no existe"); process.exit(1); }

  // Reproduce el mismo slug-dedup del seed (2ª ocurrencia → -num).
  const seen = new Set();
  const rows = catalogo.map((p) => {
    let slug = p.slug; if (seen.has(slug)) slug = `${slug}-${p.num}`; seen.add(slug);
    return { slug, desc: descripcion(p), short: (p.beneficios || "").trim(), tag: gancho(p) };
  });

  if (DRY) {
    for (const s of [rows[1], rows[16], rows[46]]) { console.log("\n──── " + s.slug + " ────\n🏷️  " + s.tag + "\n" + s.desc); }
    console.log(`\n(dry-run · ${rows.length} productos listos para actualizar)`);
    await sql.end(); return;
  }

  let ok = 0;
  for (const r of rows) {
    const res = await sql`update products set descripcion = ${r.desc}, short_desc = ${r.short},
      tagline = ${r.tag}, pitch = ${r.tag}, updated_at = now()
      where tenant_id = ${t.id} and slug = ${r.slug}`;
    if (res.count) ok++;
  }
  console.log(`✓ descripciones actualizadas: ${ok}/${rows.length}`);
  await sql.end();
}
main().catch((e) => { console.error("✗", e.message); process.exit(1); });
