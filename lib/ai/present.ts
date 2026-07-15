/* Mapea ProductView → la forma pública que consume el bot / la web.
   Contrato estable: si renombras estos campos, el bot deja de mapear. */
import type { ProductView } from "@/lib/ai/types";
import { cop } from "@/lib/ai/format";
import { peekTenant } from "@/lib/ai/tenant";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://animalsdeluxe.com";

/** ¿El tenant del request cobra por adelantado? (anticipado → nunca "contra entrega"). */
function esAnticipado(): boolean {
  return peekTenant()?.paymentMode === "anticipado";
}

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

/** Descripción de venta enriquecida (§4.6). Usa la editada; si no hay, la compone
 *  con gancho + beneficios ✅ para que NUNCA llegue una ficha pobre al cliente. */
export function descripcionRica(p: ProductView): string {
  if (p.descripcion && p.descripcion.trim()) return p.descripcion.trim();
  const gancho = p.tagline || p.pitch || p.shortDesc || "";
  const bens = (p.benefits || []).map((b) => `✅ ${b}`).join("\n");
  return [gancho, bens].filter(Boolean).join("\n");
}

/** Cierre de precio listo para pegar (precio + envío/gratis + forma de pago del tenant). */
export function cierrePrecio(p: ProductView): string {
  const envio = p.envioGratis ? "envío GRATIS 🚚" : "+ envío";
  // Anticipado (Rooster Deluxe): NUNCA menciona contra entrega.
  const pago = esAnticipado() ? "pago por adelantado." : "contra entrega, pagás al recibir.";
  return `💵 ${cop(p.priceCOP)} · ${envio} · ${pago}`;
}

/** Mensaje WhatsApp-ready en voz Victor (nunca vacío). Enriquecido con ficha. */
export function richMensaje(p: ProductView): string {
  const benLines = (p.benefits || []).slice(0, 5).map((x) => `✅ ${x}`).join("\n");
  const ficha = [
    p.presentacion ? `📦 Presentación: ${p.presentacion}` : "",
    p.dosificacion ? `🥄 Dosis: ${p.dosificacion}` : "",
    p.edadMinima ? `📅 Desde: ${p.edadMinima}` : "",
  ].filter(Boolean).join("\n");
  return [
    `¡De una! 👉 Este es *${p.name}* 🔥 ${p.pitch || p.tagline || ""}`.trim(),
    benLines,
    ficha,
    cierrePrecio(p),
    `¿Para qué ciudad sería el envío? 🐓`,
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
    // Ficha enriquecida (§4.6) — el bot arma el mensaje con estos campos.
    descripcion: descripcionRica(p),
    para_que: p.paraQue || "",
    edad_minima: p.edadMinima || "",
    dosificacion: p.dosificacion || "",
    presentacion: p.presentacion || p.presentations?.[0]?.label || "",
    envio_gratis: !!p.envioGratis,
    precio_cop: p.priceCOP,
    cierre_precio: cierrePrecio(p),
    producto_contexto: buildContexto(p),
    disclaimer: p.disclaimer || "Producto de bienestar y rendimiento. No cura enfermedades.",
    url: `${SITE}/producto/${p.slug}`,
  };
}

export function suggestion(p: ProductView) {
  return { name: p.name, slug: p.slug, priceCOP: p.priceCOP };
}

/** Beneficio corto (≤48 chars) para listar opciones sin frases largas. */
export function beneficioCorto(p: ProductView): string {
  let s = (p.shortDesc || (p.benefits && p.benefits[0]) || p.paraQue || p.tagline || "").replace(/\s+/g, " ").trim();
  if (s.length > 48) {
    const cut = s.slice(0, 48);
    const sp = cut.lastIndexOf(" ");
    s = (sp > 12 ? cut.slice(0, sp) : cut).trim() + "…";
  }
  return s;
}

/** Mensaje de OPCIONES en tono paisa. NUNCA hace eco del query del cliente. */
export function opcionesMensaje(products: ProductView[]): string {
  const vistos = new Set<string>();
  const uniq = products.filter((p) => { const k = p.name.toLowerCase().trim(); if (vistos.has(k)) return false; vistos.add(k); return true; });
  const lines = uniq.slice(0, 3).map((p) => `🔥 ${p.name} — ${beneficioCorto(p)} · ${cop(p.priceCOP)}`);
  return `¡De una mi rey! 🐓 Pa eso te sirven estas opciones:\n${lines.join("\n")}\n¿Cuál te muestro?`;
}

/** Producto "vacío" pero nunca null (regla de oro UChat). */
export function emptyProduct() {
  return {
    slug: "", name: "", category: "", categoria: "", audience: "", origin: "", priceCOP: 0,
    presentations: [], image: "", imageUrl: "", badges: [], tagline: "", shortDesc: "",
    benefits: [], ingredients: [], usage: "", pitch: "", faq: [], keywords: [], objeciones: {},
    descripcion: "", para_que: "", edad_minima: "", dosificacion: "", presentacion: "", envio_gratis: false, precio_cop: 0, cierre_precio: "",
    producto_contexto: "", disclaimer: "", url: "",
  };
}
