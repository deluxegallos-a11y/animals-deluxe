/* ===========================================================
   VALIDADOR DEL BOT DE CONTRA ENTREGA (Animals Deluxe) con OpenAI
   ------------------------------------------------------------
   Simula clientes con los MISMOS mensajes que provocaron los errores que el
   dueño reportó (jun–nov 2026) y le da al bot:
     · el prompt real de Victor (bot_uchat/04) + las reglas duras (bot_uchat/07)
     · el MISMO modelo que corre en UChat (gpt-4o-mini, temp 0.2)
     · funciones que responden con el catálogo REAL congelado de prod
       (tests/fixtures/*.json) y la misma lógica del backend (brain, flete,
       mínimos, separación de marcas)
   Luego un JUEZ (modelo más fuerte) revisa cada conversación contra la verdad
   del dueño y la reprueba si repite un error.

   Uso:
     OPENAI_API_KEY=sk-... node --import tsx scripts/validar-bot-openai.ts
     … [--solo dragon]   corre solo los escenarios cuyo id contenga "dragon"
     … [--veces 3]       repite cada escenario N veces (detecta respuestas inestables)
   Variables opcionales: BOT_MODEL (default gpt-4o-mini) · JUDGE_MODEL (default gpt-4.1)
   Sale con código 1 si algún escenario falla → sirve como compuerta antes de
   publicar un cambio de prompt o de catálogo.
   =========================================================== */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProductView } from "@/lib/ai/types";
import { identifyProduct } from "@/lib/ai/brain";
import { ANIMALS_RULES } from "@/lib/ai/aliases";
import { filtrarCatalogo } from "@/lib/ai/catalog-rules";
import { publicProduct } from "@/lib/ai/present";
import { calcularFlete, FREE_SHIPPING_SLUGS } from "@/lib/ai/shipping";
import { contieneQuery, redireccionValida, exclusivosDelOtro } from "@/lib/ai/marcas";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEY = process.env.OPENAI_API_KEY || "";
if (!KEY) { console.error("Falta OPENAI_API_KEY"); process.exit(2); }
const BOT_MODEL = process.env.BOT_MODEL || "gpt-4o-mini";
const JUDGE_MODEL = process.env.JUDGE_MODEL || "gpt-4.1";
const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : ""; };
const SOLO = arg("--solo");
const VECES = Math.max(1, parseInt(arg("--veces") || "1", 10));

const leer = (p: string) => readFileSync(join(ROOT, p), "utf8");
const animals = filtrarCatalogo("animals-deluxe", JSON.parse(leer("tests/fixtures/animals-catalog.json")) as ProductView[]);
const rooster = JSON.parse(leer("tests/fixtures/rooster-catalog.json")) as ProductView[];
const VERDAD = JSON.parse(leer("data/verdad-dueno-animals.json"));
const ROOSTER_WA = "312 291 1088";

/* ---------- prompt del bot: el de UChat (04) + reglas duras (07) ---------- */
const bloques = (md: string) => [...md.matchAll(/```\n([\s\S]*?)```/g)].map((m) => m[1].trim());
const PROMPT = [
  ...bloques(leer("bot_uchat/04_PROMPT_AGENTE_VENDEDOR.md")),
  ...bloques(leer("bot_uchat/07_REGLAS_DURAS_CONTRAENTREGA.md")),
  "ENTORNO DE PRUEBA: las funciones devuelven JSON. Cuando una función trae `mensaje`, ese texto YA se le mostró " +
  "al cliente con la foto (igual que el sub-flow de UChat): no lo repitas entero, seguí vendiendo desde ahí.",
].join("\n\n");

/* ---------- funciones (misma lógica que el backend) ---------- */
const fichaBot = (p: ProductView) => {
  const x = publicProduct(p);
  return {
    slug: x.slug, nombre: x.name, precio_cop: x.precio_cop, presentaciones: x.presentations.map((y) => `${y.label}: ${y.priceCOP}`),
    forma: x.forma, presentacion: x.presentacion, dosificacion: x.dosificacion, para: x.audience,
    descripcion: x.descripcion, envio_gratis: x.envio_gratis, min_unidades: x.min_unidades,
    politica_pago: x.politica_pago_texto, cierre_precio: x.cierre_precio,
  };
};
function buscar(q: string) {
  const r = identifyProduct(q, animals, [], ANIMALS_RULES);
  // Igual que /buscar-producto: un alias/fuzzy que no cubre el query cede ante el otro canal.
  const debil = r.product && (r.matchedBy === "alias" || r.matchedBy === "fuzzy") && !contieneQuery(q, r.product);
  if (r.product && r.status !== "ambiguous" && !debil) return { status: "found", producto: fichaBot(r.product) };
  if (r.options.length && !debil) return { status: "ambiguous", opciones: r.options.slice(0, 4).map((p) => ({ nombre: p.name, precio_cop: p.priceCOP, forma: fichaBot(p).forma })) };
  // Igual que detectarOtraMarca: solo exclusivos de Rooster, sin reglas, con candado de contención.
  const o = identifyProduct(q, exclusivosDelOtro(rooster, animals), [], { aliases: [], needs: [] });
  if (o.product && redireccionValida(q, o)) return {
    status: "otra_marca", marca: "Rooster Deluxe", politica_pago: "anticipado", whatsapp: ROOSTER_WA, producto: o.product.name,
    mensaje: `👉 *${o.product.name}* no lo manejamos en este canal de contra entrega. Ese lo despacha *Rooster Deluxe* con pago anticipado 📲 Escribile al *${ROOSTER_WA}* 🐓`,
  };
  return { status: "not_found", mensaje: "" };
}
const TEL = (s: string) => { let d = String(s || "").replace(/\D/g, ""); if (d.startsWith("57") && d.length === 12) d = d.slice(2); return d.length === 10 && d.startsWith("3"); };
function crearPedido(a: Record<string, unknown>) {
  const items = (Array.isArray(a.items) ? a.items : []) as { producto?: string; cantidad?: number }[];
  const res = items.map((it) => ({ it, r: identifyProduct(String(it.producto || ""), animals, [], ANIMALS_RULES) }));
  const fuera = res.filter((x) => !x.r.product);
  if (fuera.length) {
    const b = buscar(String(fuera[0].it.producto));
    if (b.status === "otra_marca") return { ok: false, status: "otra_marca", requiere_asesor: true, mensaje: b.mensaje };
    return { ok: false, campos_faltantes: ["producto"], mensaje: `No encontré "${fuera[0].it.producto}". ¿Cuál producto es exactamente? 🐓` };
  }
  const lineas = res.map(({ it, r }) => { const p = r.product!; return { p, cant: Math.max(Number(it.cantidad) || 1, p.minUnidades ?? 1) }; });
  const subtotal = lineas.reduce((s, l) => s + l.p.priceCOP * l.cant, 0);
  if (subtotal < VERDAD.minimo_contraentrega_cop) return {
    ok: false, status: "minimo_contraentrega",
    mensaje: `Mi rey, la transportadora despacha contra entrega desde *$45.000* en productos y tu pedido va en $${subtotal.toLocaleString("es-CO")}. ¿Le sumamos otra unidad u otro producto y te lo despacho de una? 🐓`,
  };
  const falt: string[] = [];
  if (String(a.nombre || "").trim().split(/\s+/).filter((w) => w.length >= 2).length < 2) falt.push("nombre completo con apellidos");
  if (String(a.cedula || "").replace(/\D/g, "").length < 5) falt.push("cédula");
  if (!TEL(String(a.telefono || ""))) falt.push("celular");
  if (!String(a.ciudad || "").trim()) falt.push("ciudad");
  if (!String(a.direccion || "").trim()) falt.push("dirección u oficina");
  if (falt.length) return { ok: false, campos_faltantes: falt, mensaje: `Para confirmar tu pedido me falta ${falt.join(", ")}. ¿Me lo pasas? 🐓` };
  const pagaFlete = lineas.filter((l) => !l.p.envioGratis && !FREE_SHIPPING_SLUGS.has(l.p.slug)).reduce((s, l) => s + l.p.priceCOP * l.cant, 0);
  const flete = pagaFlete ? calcularFlete(pagaFlete) : 0;
  return {
    ok: true, ref: "AD-TEST", producto_resumen: lineas.map((l) => `${l.cant}× ${l.p.name}`).join(", "), total_cop: subtotal, flete,
    mensaje: `✅ ¡Listo! Tu pedido quedó confirmado 🎉 Ref *AD-TEST*\n${lineas.map((l) => `${l.cant}× ${l.p.name}`).join(", ")}\n*Total a recaudar: $${subtotal.toLocaleString("es-CO")}* (solo el producto)\n` +
      (flete ? `🚚 El flete lo cobra la transportadora al entregar (aprox $${flete.toLocaleString("es-CO")}, puede variar).` : "🚚 ¡Envío GRATIS! 🎉"),
  };
}
const TOOLS = [
  { type: "function", function: { name: "buscar_producto", description: "Busca un producto del catálogo de Animals Deluxe por nombre o necesidad. SIEMPRE antes de hablar de un producto.", parameters: { type: "object", properties: { q: { type: "string" } }, required: ["q"] } } },
  { type: "function", function: { name: "verificar_cobertura", description: "Cobertura, flete y tiempo de entrega a una ciudad. Pasá items (slug del producto + cantidad) para que el flete salga exacto.", parameters: { type: "object", properties: { ciudad: { type: "string" }, items: { type: "array", items: { type: "object", properties: { slug: { type: "string" }, cantidad: { type: "number" } } } } }, required: ["ciudad"] } } },
  { type: "function", function: { name: "crear_pedido", description: "Crea el pedido contra entrega cuando el cliente confirmó y dio sus datos.", parameters: { type: "object", properties: { nombre: { type: "string" }, cedula: { type: "string" }, telefono: { type: "string" }, ciudad: { type: "string" }, departamento: { type: "string" }, direccion: { type: "string" }, items: { type: "array", items: { type: "object", properties: { producto: { type: "string" }, cantidad: { type: "number" } } } } }, required: ["items"] } } },
];
function ejecutar(nombre: string, args: Record<string, unknown>) {
  if (nombre === "buscar_producto") return buscar(String(args.q || ""));
  if (nombre === "verificar_cobertura") {
    // Igual que /api/ai/cobertura: flete = calcularFlete(productos que pagan envío). Devuelve
    // el NÚMERO ya calculado y un `mensaje`, nunca la fórmula.
    const its = (Array.isArray(args.items) ? args.items : []) as { slug?: string; cantidad?: number }[];
    const sub = its.reduce((s, it) => {
      const p = animals.find((x) => x.slug === it.slug);
      return s + (p && !p.envioGratis && !FREE_SHIPPING_SLUGS.has(p.slug) ? p.priceCOP * (Number(it.cantidad) || 1) : 0);
    }, 0);
    const gratis = its.length > 0 && sub === 0 && its.every((it) => animals.some((x) => x.slug === it.slug));
    const costo = gratis ? 0 : calcularFlete(sub);
    return {
      cubre: true, contraentrega: true, costo_envio: costo, envio_gratis: gratis, tiempo: "3 a 5 días hábiles",
      mensaje: `¡Sí llegamos a ${args.ciudad}! 🚚 ${gratis ? "El envío te sale *GRATIS* 🎉" : `El envío te sale en *$${costo.toLocaleString("es-CO")}*`}, entrega en *3 a 5 días hábiles* y es contraentrega (pagas al recibir). ¿Te armo el pedido?`,
    };
  }
  if (nombre === "crear_pedido") return crearPedido(args);
  return { error: "funcion_desconocida" };
}

/* ---------- OpenAI ---------- */
type Msg = { role: string; content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[]; tool_call_id?: string };
async function chat(model: string, messages: Msg[], extra: Record<string, unknown> = {}) {
  for (let intento = 0; intento < 4; intento++) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, ...extra }),
    });
    if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 2000 * (intento + 1))); continue; }
    const j = await r.json();
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
    return j.choices[0].message as Msg;
  }
  throw new Error("OpenAI sin respuesta tras reintentos");
}

async function conversar(turnos: string[]) {
  const msgs: Msg[] = [{ role: "system", content: PROMPT }];
  const transcript: string[] = [];
  for (const t of turnos) {
    msgs.push({ role: "user", content: t });
    transcript.push(`CLIENTE: ${t}`);
    for (let paso = 0; paso < 6; paso++) {
      const m = await chat(BOT_MODEL, msgs, { tools: TOOLS, temperature: 0.2 });
      msgs.push(m);
      if (m.tool_calls?.length) {
        for (const tc of m.tool_calls) {
          let a: Record<string, unknown> = {};
          try { a = JSON.parse(tc.function.arguments || "{}"); } catch {}
          const out = ejecutar(tc.function.name, a);
          transcript.push(`  [función ${tc.function.name}(${JSON.stringify(a)}) → ${JSON.stringify(out).slice(0, 700)}]`);
          if ((out as { mensaje?: string }).mensaje) transcript.push(`BOT (mensaje de la función mostrado al cliente): ${(out as { mensaje: string }).mensaje}`);
          msgs.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(out) });
        }
        continue;
      }
      transcript.push(`BOT: ${m.content || ""}`);
      break;
    }
  }
  return transcript.join("\n");
}

/* ---------- escenarios: cada uno = un error real reportado por el dueño ---------- */
type Esc = { id: string; reporte: string; turnos: string[]; criterio: string };
const ESC: Esc[] = [
  { id: "dragon-mamba-inyectable", reporte: "31-ago: 'El dragón mamba doping es inyectable no es en gotas'",
    turnos: ["Hola quiero el dragon mamba", "cómo se le aplica?"],
    criterio: "Debe decir que Dragon Mamba es INYECTABLE (jeringa/ml en la pechuga). FALLA si dice gotas. Precio $150.000." },
  { id: "red-mamba-gotas-dosis", reporte: "13-nov: dosis del Red Mamba = protocolo de 4 gotas",
    turnos: ["buenas, cuánto vale el red dopping mamba y cómo se da?"],
    criterio: "Red Dopping Mamba son GOTAS, $50.000. La dosis debe coincidir con el protocolo: 4 gotas 1 hora antes; acostumbrar en 2 últimos entrenamientos 4 gotas; 2 días antes 3 gotas después del desayuno; día de pelea 4 gotas 1 h antes. FALLA si dice inyectable o inventa otra dosis (ej. 6 gotas)." },
  { id: "nordic-inyectable", reporte: "18-ago: 'recomienda la vitamina inyectable NORDIC ROOSTER como si fuera en gotas'",
    turnos: ["me interesa el nordic rooster, cuántas gotas le doy?"],
    criterio: "Debe corregir: Nordic Rooster es INYECTABLE, no gotas. FALLA si da una dosis en gotas." },
  { id: "cyanomax-inyectable", reporte: "5-ago: 'está ofreciendo el CYANOMAX en gotas y es inyectable'",
    turnos: ["el cyanomax b12 viene en gotas?"],
    criterio: "Debe decir que CyanoMax B12 5500 es INYECTABLE (0.5 ml en la pechuga cada 15 días, mayores de 4 meses). FALLA si dice gotas." },
  { id: "ultra-gallo-mensual", reporte: "3-nov: 'el Ultra Gallo B12 se aplica una vez al mes, no cada 8 días' · 10-nov: 'es por 10 ml no 50 ml'",
    turnos: ["ultra gallo cada cuánto se aplica y de cuántos ml es el frasco?"],
    criterio: "Ultra Gallo: inyectable, 0.2 ml UNA VEZ AL MES, frasco de 10 ml, $50.000. FALLA si dice cada 8 días/cada semana o 50 ml." },
  { id: "rooster-strength-gotas", reporte: "6-sep: 'El rooster STRENGTH es en gotas no en pastillas'",
    turnos: ["el rooster strength son pastillas?"],
    criterio: "Rooster Strength es en GOTAS (8 gotas diarias en el pico), 100 ml, $50.000. FALLA si dice pastillas." },
  { id: "red-rooster-anticipado", reporte: "26-ago/31-ago/6-oct/28-oct: 'sigue ofreciendo el red rooster en contra entrega y es pago anticipado'",
    turnos: ["quiero un red rooster contraentrega para Cali"],
    criterio: "Red Rooster NO es de este bot. Debe redirigir a Rooster Deluxe (pago anticipado) dando el número 312 291 1088. FALLA si lo ofrece contra entrega, da precio como venta COD, o intenta crear el pedido." },
  { id: "karate-kill-anticipado", reporte: "26-ago: 'ofreciendo el karate kill en contra entrega y es pago anticipado'",
    turnos: ["tenés karate kill? lo pago al recibir"],
    criterio: "Karate Kill NO es de este bot. Debe redirigir a Rooster Deluxe / pago anticipado con el número 312 291 1088. FALLA si lo ofrece contra entrega." },
  { id: "cure-chest", reporte: "18-sep/19-nov/22-nov: 'cure chest cápsulas vale 100.000 y es pago anticipado; el de gotas vale 45.000'",
    turnos: ["cuánto vale el cure chest?", "y en cápsulas?"],
    criterio: "Cure Chest GOTAS = $45.000 contra entrega. Las cápsulas NO se venden en este bot (son de Rooster/pago anticipado). FALLA si dice $40.000, si ofrece cápsulas contra entrega o les pone precio $45.000/$60.000." },
  { id: "espuelas-redireccion", reporte: "17-ago: respondió 'eso lo maneja el asesor por pago anticipado' sin dar a quién escribir",
    turnos: ["tienen espuelas excalibur de 35 líneas?"],
    criterio: "Espuelas no son de este bot. Debe redirigir a Rooster Deluxe dando un número de WhatsApp concreto (312 291 1088). FALLA si no da ningún número o si las ofrece contra entrega." },
  { id: "super-cobra-500-contraentrega", reporte: "25-nov: 'super cobra 500' salía como Energy Cobra · 26-nov dueño: Super Cobra 500 SÍ es contra entrega",
    turnos: ["tenés el super cobra 500?"],
    criterio: "Debe presentar el Super Cobra 500 (desparasitante) a $100.000 contra entrega. FALLA si presenta Energy Cobra, si lo manda a Rooster Deluxe o si dice otro precio (ej. $40.000)." },
  { id: "shampoo-anticipado", reporte: "26-nov dueño: Rooster Smallpox y Rooster Deluxe Shampoo son pago anticipado",
    turnos: ["tienen shampoo para los gallos?"],
    criterio: "Los shampoos NO son de este bot: debe redirigir a Rooster Deluxe (pago anticipado, 312 291 1088). FALLA si ofrece un shampoo contra entrega o le pone precio como venta contra entrega." },
  { id: "juaquin-cierre-fury", reporte: "25-nov (venta perdida): vio Energy Cobra, luego American Fury, mandó sus datos y el bot preguntó 3 veces '¿solo Energy Cobra o también el Fury?' sin crear el pedido",
    turnos: ["Hola. ¿Puedes darme más información sobre energy cobra", "Hola. ¿Puedes darme más información sobre american fury",
      "Joaquín Zambrano Ruiz, cédula 87451105, cel 3207465750, barrio La Graciela manzana 15 casa 20, Dosquebradas, Risaralda"],
    criterio: "Tras ver el American Fury y mandar los datos completos, el bot debe CREAR el pedido del American Rooster Fury, o hacer el ECO de confirmación de los datos con el American Rooster Fury como ÚNICO producto (el eco es parte del proceso de venta original y es correcto). FALLA si pregunta '¿solo este o también el Energy Cobra?', si mete Energy Cobra en el pedido, o si vuelve a pedir datos que ya dio." },
  { id: "rooster-es-el-fury", reporte: "25-nov: el cliente venía con el American Rooster Fury, escribió 'rooster' y el bot le mostró Rooster And Worm",
    turnos: ["info del american fury", "rooster"],
    criterio: "Al escribir 'rooster' el cliente se refiere al American Rooster Fury del que venían hablando. FALLA si el bot presenta Rooster And Worm u otro producto distinto, o si lo manda a Rooster Deluxe." },
  { id: "fury-cuantas-gotas", reporte: "25-nov: preguntó 'cuántas gotas' del Fury (inyectable) y el bot respondió con la dosis en gotas de Energy Cobra",
    turnos: ["info del american fury", "como se le da, cuántas gotas"],
    criterio: "American Fury es INYECTABLE: debe aclarar que no es en gotas y dar 0.2-0.3 ml en la pechuga, 3 días antes. FALLA si da una dosis en gotas o habla de Energy Cobra." },
  { id: "purge-beach-minimo", reporte: "17-ago/19-nov: 'el envío mínimo del PURGEBEACK son dos goteros; Interrapidísimo despacha desde 45.000'",
    turnos: ["quiero 1 purge beach para Medellín", "Juan Pérez Gómez, cc 10203040, 3101234567, calle 10 # 20-30 Medellín Antioquia"],
    criterio: "No debe confirmar un pedido de 1 solo Purge Beach ($25.000). Debe explicar que el mínimo es 2 goteros / $45.000 y ajustar a 2 o pedir sumar producto. PASA si el pedido quedó con 2 unidades o si pidió sumar. FALLA si confirma 1 unidad por $25.000." },
  { id: "gallos-no-perros", reporte: "2-jul/1-ago/20-ago/6-sep/24-sep: 'sigue ofreciendo el producto de perros para los gallos'",
    turnos: ["necesito algo para subirle masa muscular a mis gallos"],
    criterio: "FALLA si ofrece More Muscle (perros) o Horse Deluxe (caballos). Debe ofrecer productos para gallos." },
  { id: "combo-del-mes", reporte: "27-ago/31-ago/27-oct: 'está ofreciendo los combos trocados; el combo del mes es 230.000 y el otro 300.000'",
    turnos: ["qué trae el combo del mes y cuánto vale?", "y el equipo de campeones?"],
    criterio: "Combo del Mes = $230.000 con Weight Muscle + Red Dopping Mamba + Omega-3 + Super Trainer. Equipo de Campeones = $300.000 con Super Trainer + Energy Cobra + Ultra Gallo + American Rooster Fury. FALLA si mezcla precios o contenidos." },
  { id: "b15-correcto", reporte: "15-sep: 'preguntan por el B15 5500 ultra y muestra otra vitamina'",
    turnos: ["info del b15 5500 ultra"],
    criterio: "Debe presentar el Super Energizante B15 5500 Ultra ($100.000, gotas, 30 ml). FALLA si presenta otro producto (ej. CyanoMax o Ultra Gallo)." },
  { id: "envio-sin-inventar", reporte: "27-ago: 'está poniendo precio del envío por 4.900' · 2-jul: 'no se entrega de un día para otro'",
    turnos: ["cuánto vale el envío del energy cobra a Pasto y cuándo llega?"],
    criterio: "Energy Cobra $70.000 + envío. Flete aprox $24.900 ($20.000 + 7%). Entrega 3 a 5 días hábiles. FALLA si dice $4.900, envío gratis, o 'de un día para otro / mañana'." },
  { id: "weight-muscle-no-gratis", reporte: "6-jul/14-jul/16-jul/23-jul: 'sigue ofreciendo el WEIGHT MUSCLE con envío gratis'",
    turnos: ["el weight muscle tiene envío gratis?"],
    criterio: "Weight Muscle $80.000 + envío (NO es gratis). FALLA si dice envío gratis." },
  { id: "datos-una-vez", reporte: "27-jul: 'repite pidiendo los datos después de que el cliente ya los dio' · 3-nov: 'nombre completo con apellidos'",
    turnos: ["quiero un energy cobra", "Carlos Ramírez Ortiz, cédula 71234567, cel 3157654321, oficina Interrapidísimo de Montería, Córdoba"],
    criterio: "Con esos datos completos debe crear el pedido (o confirmar) SIN volver a pedir nombre/cédula/celular/dirección/ciudad. FALLA si vuelve a pedir datos que ya estaban." },
];

/* ---------- juez ---------- */
async function juzgar(e: Esc, transcript: string) {
  const sys = "Sos un auditor estricto de un bot de ventas por WhatsApp de Animals Deluxe (CONTRA ENTREGA, Colombia). " +
    "Evaluás UNA conversación contra un criterio y la verdad del dueño. Lo que diga una línea [función …] es la verdad del sistema; " +
    "lo que importa es lo que el BOT le dijo al cliente (líneas BOT). Respondé SOLO JSON: {\"pasa\": boolean, \"fallas\": [string], \"evidencia\": string}.";
  const user = `ERROR QUE NO SE PUEDE REPETIR (reporte del dueño): ${e.reporte}\nCRITERIO: ${e.criterio}\n\nCONVERSACIÓN:\n${transcript}`;
  const m = await chat(JUDGE_MODEL, [{ role: "system", content: sys }, { role: "user", content: user }], { temperature: 0, response_format: { type: "json_object" } });
  try { return JSON.parse(m.content || "{}") as { pasa: boolean; fallas: string[]; evidencia: string }; }
  catch { return { pasa: false, fallas: ["juez devolvió JSON inválido"], evidencia: m.content || "" }; }
}

/* ---------- main ---------- */
async function main() {
  const lista = ESC.filter((e) => !SOLO || e.id.includes(SOLO));
  console.log(`Validando ${lista.length} escenarios × ${VECES} · bot=${BOT_MODEL} · juez=${JUDGE_MODEL}\n`);
  const filas: { id: string; pasa: boolean; fallas: string[]; transcript: string }[] = [];
  await Promise.all(lista.flatMap((e) => Array.from({ length: VECES }, async (_, i) => {
    const transcript = await conversar(e.turnos);
    const v = await juzgar(e, transcript);
    filas.push({ id: VECES > 1 ? `${e.id}#${i + 1}` : e.id, pasa: !!v.pasa, fallas: v.fallas || [], transcript });
    console.log(`${v.pasa ? "✅" : "❌"} ${e.id}${VECES > 1 ? `#${i + 1}` : ""}${v.pasa ? "" : " — " + (v.fallas || []).join(" | ")}`);
  })));
  filas.sort((a, b) => a.id.localeCompare(b.id));
  const ok = filas.filter((f) => f.pasa).length;
  const out = join(ROOT, "tests", "reportes");
  mkdirSync(out, { recursive: true });
  const fecha = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const file = join(out, `validacion-bot-${fecha}.md`);
  writeFileSync(file, `# Validación bot contra entrega · ${fecha}\n\nbot=${BOT_MODEL} · juez=${JUDGE_MODEL} · **${ok}/${filas.length}**\n\n` +
    filas.map((f) => `## ${f.pasa ? "✅" : "❌"} ${f.id}\n${f.fallas.length ? "**Fallas:** " + f.fallas.join(" · ") + "\n" : ""}\n\`\`\`\n${f.transcript}\n\`\`\`\n`).join("\n"));
  console.log(`\n${ok}/${filas.length} pasan · reporte: ${file}`);
  process.exit(ok === filas.length ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });
