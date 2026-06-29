/* Mapea ProductView → la forma pública que consume el bot / la web.
   Contrato estable: si renombras estos campos, el bot deja de mapear. */
import type { ProductView } from "@/lib/ai/types";
import { cop } from "@/lib/ai/format";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://animalsdeluxe.com";

/** Bloque de contexto que el LLM del bot (Victor) usa pa asesorar a fondo. */
export function buildContexto(p: ProductView): string {
  const pres = p.presentations?.length ? p.presentations.map((x) => `${x.label}: ${x.priceCOP}`).join(" | ") : "presentación única";
  const benefits = p.benefits?.length ? p.benefits.join(" · ") : "";
  const faqs = p.faq?.length ? p.faq.map((f) => `${f.q} ${f.a}`).join(" | ") : "";
  const obj = p.objeciones && Object.keys(p.objeciones).length
    ? Object.entries(p.objeciones).map(([k, v]) => `${k}: ${v}`).join(" | ") : "";
  return [
    `PRODUCTO: ${p.name} — ${p.priceCOP} COP`,
    `PRESENTACIONES: ${pres}`,
    `PARA: ${p.audience || "gallos"} · CATEGORÍA: ${p.categoryName} · ORIGEN: ${p.origin}`,
    `GANCHO: ${p.pitch || p.tagline || ""}`,
    benefits ? `BENEFICIOS: ${benefits}` : "",
    p.usage ? `MODO DE USO: ${p.usage}` : "",
    faqs ? `FAQS: ${faqs}` : "",
    obj ? `OBJECIONES: ${obj}` : "",
    `NOTA: ${p.disclaimer || "Producto de bienestar y rendimiento. No cura enfermedades."}`,
  ].filter(Boolean).join("\n");
}

/** Mensaje WhatsApp-ready en voz Victor (nunca vacío). */
export function richMensaje(p: ProductView): string {
  const benLines = (p.benefits || []).slice(0, 3).map((x) => `✅ ${x}`).join("\n");
  const pres = p.presentations?.[0];
  const precioStr = `💵 ${cop(p.priceCOP)}${pres ? ` · ${pres.label}` : ""} · contraentrega (pagás al recibir)`;
  return [
    `${p.name} 🔥 ${p.pitch || p.tagline || ""}`.trim(),
    benLines,
    precioStr,
    `¿Te lo aparto, mi rey? 🐓`,
  ].filter(Boolean).join("\n");
}

export function publicProduct(p: ProductView) {
  return {
    slug: p.slug,
    name: p.name,
    category: p.categorySlug,
    categoria: p.categoryName,
    audience: p.audience,
    origin: p.origin,
    priceCOP: p.priceCOP,
    presentations: p.presentations,
    image: p.image,
    imageUrl: p.imageUrl,
    badges: p.badges,
    tagline: p.tagline,
    shortDesc: p.shortDesc,
    benefits: p.benefits,
    ingredients: p.ingredients,
    usage: p.usage,
    pitch: p.pitch,
    faq: p.faq,
    keywords: p.keywords || [],
    objeciones: p.objeciones || {},
    producto_contexto: buildContexto(p),
    disclaimer: p.disclaimer || "Producto de bienestar y rendimiento. No cura enfermedades.",
    url: `${SITE}/producto/${p.slug}`,
  };
}

export function suggestion(p: ProductView) {
  return { name: p.name, slug: p.slug, priceCOP: p.priceCOP };
}

/** Producto "vacío" pero nunca null (regla de oro UChat). */
export function emptyProduct() {
  return {
    slug: "", name: "", category: "", categoria: "", audience: "", origin: "", priceCOP: 0,
    presentations: [], image: "", imageUrl: "", badges: [], tagline: "", shortDesc: "",
    benefits: [], ingredients: [], usage: "", pitch: "", faq: [], keywords: [], objeciones: {},
    producto_contexto: "", disclaimer: "", url: "",
  };
}
