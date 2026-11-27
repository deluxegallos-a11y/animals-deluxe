/* Mapea ProductView → la forma pública que consume el bot / la web.
   Contrato estable: si renombras estos campos, el bot deja de mapear. */
import type { ProductView } from "@/lib/ai/types";
import { cop } from "@/lib/ai/format";
import { peekTenant } from "@/lib/ai/tenant";
import { formaDe } from "@/lib/ai/search";
import { politicaDe, politicaTexto, type PoliticaPago } from "@/lib/ai/marcas";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://animalsdeluxe.com";

/** Política de pago de la MARCA del request. Es el tenant quien la define, no el
 *  producto: así el bot nunca ofrece contra entrega algo del canal anticipado. */
function politicaPago(): PoliticaPago {
  return politicaDe(peekTenant());
}

/** ¿El tenant del request cobra por adelantado? (anticipado → nunca "contra entrega"). */
function esAnticipado(): boolean {
  return politicaPago() === "anticipado";
}

/** El `usage` viejo (Rooster) muchas veces NO es dosis: repite la presentación
 *  ("Presentación por 100 pastillas.") y el bot lo mandaba como "🥄 Uso:". Separa:
 *  · dosis → solo si trae cantidad + unidad de dosis (gotas, ml, pastilla, gramos…)
 *  · info  → otro dato útil del producto que no es dosis (ej. placas: "se graban de a 25") */
export function usoLimpio(usage?: string | null): { dosis: string; info: string } {
  let u = (usage || "").replace(/\s+/g, " ").trim();
  if (!u) return { dosis: "", info: "" };
  const m = u.match(/\bdosis\s*:\s*(.+)$/i);
  if (m) return { dosis: m[1].trim(), info: "" };
  // Quita la frase de presentación ("Presentación por 100 pastillas." / "de 50 ml y 100 ml.")
  u = u.replace(/^presentaci[oó]n[^.]*\.?\s*/i, "").trim();
  if (!u) return { dosis: "", info: "" };
  const esDosis = /\d/.test(u) && /(gota|\bml\b|pastilla|tableta|capsul|gramo|\bgr?\b|cucharad|jeringa|pechuga)/i.test(u);
  return esDosis ? { dosis: u, info: "" } : { dosis: "", info: u };
}

/** Bloque de contexto que el LLM del bot (Victor) usa pa asesorar a fondo. */
export function buildContexto(p: ProductView): string {
  const forma = formaDe(p);
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
    // La FORMA va explícita y en mayúsculas: es el dato que el bot inventaba
    // (mandó dar en gotas un inyectable). Si no la sabemos, se lo decimos.
    forma
      ? `FORMA: ${forma.toUpperCase()} — NO ofrezcas otra vía de administración.`
      : `FORMA: no registrada — NO afirmes si es inyectable, gotas o polvo; confirma con el asesor.`,
    // UNA sola dosis: la del dueño (dosificacion). El `usage` viejo traía otra
    // ("6 a 8 gotas") y el bot mezclaba las dos (23 dosis inventadas el 25-nov).
    p.dosificacion ? `DOSIS (única válida): ${p.dosificacion}`
      : usoLimpio(p.usage).dosis ? `DOSIS (sin confirmar por el dueño; si preguntan, dila tal cual): ${usoLimpio(p.usage).dosis}`
      : `DOSIS: no registrada — NO inventes dosis; di que la confirma el asesor.`,
    usoLimpio(p.usage).info ? `INFO: ${usoLimpio(p.usage).info}` : "",
    faqs ? `FAQS: ${faqs}` : "",
    obj ? `OBJECIONES: ${obj}` : "",
    `NOTA: ${p.disclaimer || "Producto de bienestar y rendimiento. No cura enfermedades."}`,
  ].filter(Boolean).join("\n");
}

/** Descripción de venta enriquecida (§4.6). Usa la editada; si no hay, la compone
 *  con gancho + beneficios ✅ para que NUNCA llegue una ficha pobre al cliente. */
export function descripcionRica(p: ProductView): string {
  if (p.descripcion && p.descripcion.trim()) {
    const d = p.descripcion.trim();
    if (!p.dosificacion) return d;
    // La línea "🥄 Modo de uso: …" de la descripción vieja traía otra dosis
    // (Energy Cobra "4 a 5 gotas" vs la del dueño). Se cambia por la del dueño.
    const linea = /^[ \t]*(?:🥄[ \t]*)?(?:modo de uso|uso|dosis|dosificaci[oó]n)[ \t]*:.*$/gim;
    const limpia = d.replace(linea, "").replace(/\n{3,}/g, "\n\n").trim();
    const partes = limpia.split("\n").filter((l, i, a) => l.trim() || (a[i - 1] ?? "").trim());
    const iPrecio = partes.findIndex((l) => l.trim().startsWith("💵"));
    const dosis = `🥄 Dosis: ${p.dosificacion}`;
    if (iPrecio >= 0) partes.splice(iPrecio, 0, dosis); else partes.push(dosis);
    return partes.join("\n");
  }
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
  // Ícono por forma: que el cliente vea de una si es 💉 inyectable o 💧 gotas (M7).
  const forma = formaDe(p);
  const ICONO: Record<string, string> = {
    inyectable: "💉", gotas: "💧", polvo: "🥄", pastillas: "💊", shampoo: "🧴", topico: "🧴",
  };
  const ficha = [
    forma ? `${ICONO[forma] || "📌"} Se aplica: *${forma}*` : "",
    p.presentacion ? `📦 Presentación: ${p.presentacion}` : "",
    p.dosificacion ? `🥄 Dosis: ${p.dosificacion}` : "",
    !p.dosificacion && usoLimpio(p.usage).dosis ? `🥄 Uso: ${usoLimpio(p.usage).dosis}` : "",
    !p.dosificacion && usoLimpio(p.usage).info ? `📌 ${usoLimpio(p.usage).info}` : "",
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
    // Con dosis del dueño, `usage` repite ESA dosis (nunca otra distinta).
    usage: p.dosificacion || usoLimpio(p.usage).dosis,
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
    // FORMA de administración (M7). "" = la ficha no lo dice → el bot NO debe adivinar
    // (el CyanoMax es inyectable y el bot lo mandaba dar en gotas).
    forma: formaDe(p),
    // La dosis concreta manda sobre el `usage` genérico ("aplica la dosis recomendada").
    uso: p.dosificacion || usoLimpio(p.usage).dosis || "",
    envio_gratis: !!p.envioGratis,
    // Reglas de negocio (M6.2 · M6.3): el bot no debe ofrecer contra entrega un
    // producto solo-anticipado, ni 1 unidad de uno que va de a 2+.
    solo_anticipado: !!p.soloAnticipado,
    min_unidades: Math.max(1, p.minUnidades ?? 1),
    // POLÍTICA DE PAGO de la marca (M-CERO): el backend la manda explícita para que
    // el bot no la adivine. Un producto solo-anticipado dentro del bot de contra
    // entrega reporta 'anticipado', que es como realmente se cobra.
    politica_pago: (p.soloAnticipado ? "anticipado" : politicaPago()) as PoliticaPago,
    politica_pago_texto: politicaTexto(p.soloAnticipado ? "anticipado" : politicaPago()),
    marca: peekTenant()?.slug || "",
    marca_nombre: peekTenant()?.nombre || "",
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

/** Mensaje de DESAMBIGUACIÓN: el cliente nombró algo que tiene varias versiones
 *  (botas, tijeras, Cure Chest…). Tono paisa, SIN eco del query. */
export function cualMensaje(products: ProductView[], nota?: string): string {
  const vistos = new Set<string>();
  const uniq = products.filter((p) => { const k = p.name.toLowerCase().trim(); if (vistos.has(k)) return false; vistos.add(k); return true; });
  const nombres = uniq.slice(0, 4).map((p) => `*${p.name}* (${cop(p.priceCOP)})`);
  const lista = nombres.length > 1
    ? `${nombres.slice(0, -1).join(", ")} o ${nombres[nombres.length - 1]}`
    : nombres[0] || "";
  return [nota ? `👉 ${nota}` : "", `¡De una mi rey! 🐓 ¿Cuál de estos buscas: ${lista}?`].filter(Boolean).join("\n");
}

/** El cliente pidió VARIOS productos en un mensaje: precio de cada uno, sin preguntar
 *  "¿cuál de estos?" (no son versiones del mismo producto). */
export function variosMensaje(products: ProductView[]): string {
  const vistos = new Set<string>();
  const uniq = products.filter((p) => { const k = p.name.toLowerCase().trim(); if (vistos.has(k)) return false; vistos.add(k); return true; });
  const lines = uniq.slice(0, 6).map((p) => `🔥 *${p.name}* · ${cop(p.priceCOP)}`);
  return `¡De una mi rey! 🐓 Te paso los que pediste:\n${lines.join("\n")}\n¿Cuáles te mando y pa qué ciudad?`;
}

/** Producto "vacío" pero nunca null (regla de oro UChat). */
export function emptyProduct() {
  return {
    slug: "", name: "", category: "", categoria: "", audience: "", origin: "", priceCOP: 0,
    presentations: [], image: "", imageUrl: "", badges: [], tagline: "", shortDesc: "",
    benefits: [], ingredients: [], usage: "", pitch: "", faq: [], keywords: [], objeciones: {},
    descripcion: "", para_que: "", edad_minima: "", dosificacion: "", presentacion: "",
    forma: "", uso: "", solo_anticipado: false, min_unidades: 1,
    // Misma forma que publicProduct: el bot mapea siempre los mismos campos.
    politica_pago: politicaPago(), politica_pago_texto: politicaTexto(politicaPago()),
    marca: peekTenant()?.slug || "", marca_nombre: peekTenant()?.nombre || "",
    envio_gratis: false, precio_cop: 0, cierre_precio: "",
    producto_contexto: "", disclaimer: "", url: "",
  };
}
