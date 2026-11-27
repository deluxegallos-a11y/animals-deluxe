/* ===========================================================
   Reporte diario del bot (contra entrega · Animals Deluxe).
   Cada noche revisa TODOS los chats del día con OpenAI, cuenta ventas y
   errores del bot, lo compara con el día anterior y lo manda por WhatsApp
   (plantilla) al número de control. El resultado queda guardado en
   events (tipo 'reporte_diario') para comparar al día siguiente.
   =========================================================== */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { events } from "@/lib/db/schema";

const TZ = "America/Bogota";

export const ERRORES = [
  "precio_incorrecto",
  "producto_equivocado",
  "dato_o_dosis_inventada",
  "ofrecio_producto_de_pago_anticipado",
  "minimo_o_envio_mal_aplicado",
  "pidio_datos_repetidos_o_ya_dados",
  "no_respondio_o_respuesta_doble",
  "pedido_mal_creado_o_no_creado",
  // Pago anticipado (Rooster Deluxe, chats reales 26-nov):
  "ofrecio_contra_entrega",
  "mando_cuentas_antes_de_tiempo",
  "repitio_mensaje_o_perdio_contexto",
  "otro_error",
] as const;

export const MOTIVOS = [
  "compro",
  "solo_saludo_o_anuncio_sin_respuesta",
  "pregunto_precio_y_se_fue",
  "envio_caro_o_minimo",
  "producto_no_disponible_u_otra_marca",
  "falto_dato_y_abandono",
  "desconfianza_o_quiere_pagar_distinto",
  "lo_va_a_pensar_o_despues",
  "paso_a_asesor_humano",
  "error_del_bot",
  "otro",
] as const;

export const NOMBRE_ERROR: Record<string, string> = {
  precio_incorrecto: "precio mal",
  producto_equivocado: "producto equivocado",
  dato_o_dosis_inventada: "dato/dosis inventada",
  ofrecio_producto_de_pago_anticipado: "ofreció producto de anticipado",
  minimo_o_envio_mal_aplicado: "mínimo/envío mal",
  pidio_datos_repetidos_o_ya_dados: "pidió datos ya dados",
  no_respondio_o_respuesta_doble: "no respondió/doble",
  pedido_mal_creado_o_no_creado: "pedido mal creado",
  ofrecio_contra_entrega: "ofreció contra entrega",
  mando_cuentas_antes_de_tiempo: "cuentas antes de tiempo",
  repitio_mensaje_o_perdio_contexto: "repitió/perdió el hilo",
  otro_error: "otro",
};

export const NOMBRE_MOTIVO: Record<string, string> = {
  solo_saludo_o_anuncio_sin_respuesta: "solo saludó",
  pregunto_precio_y_se_fue: "preguntó precio y se fue",
  envio_caro_o_minimo: "envío/mínimo",
  producto_no_disponible_u_otra_marca: "producto no disponible",
  falto_dato_y_abandono: "abandonó en los datos",
  desconfianza_o_quiere_pagar_distinto: "desconfianza",
  lo_va_a_pensar_o_despues: "lo va a pensar",
  paso_a_asesor_humano: "pasó a asesor",
  error_del_bot: "error del bot",
  otro: "otro",
};

export type ChatRevisado = {
  user_ns: string;
  nombre: string;
  compro: boolean;
  motivo: string;
  producto: string;
  errores: { tipo: string; detalle: string }[];
};

export type Reporte = {
  tenant: string;
  dia: string; // YYYY-MM-DD hora Colombia
  chats: number;
  pedidos: number;
  ventas_cop: number;
  conversion: number; // pedidos / chats (0..1)
  chats_revisados: number;
  chats_sin_revisar?: number;
  error_revision?: string;
  chats_con_error: number;
  errores: Record<string, number>;
  motivos: Record<string, number>;
  ejemplos_error: { nombre: string; tipo: string; detalle: string }[];
  pedidos_no_creados: number;
  generado_at: string;
  revisados?: ChatRevisado[];
};

function filas<T>(r: unknown): T[] {
  return (Array.isArray(r) ? r : ((r as { rows?: unknown[] })?.rows ?? [])) as T[];
}

/** YYYY-MM-DD en hora de Colombia, desplazado `dias` (−1 = ayer). */
export function diaCO(dias = 0, base = new Date()): string {
  const d = new Date(base.getTime() + dias * 86_400_000);
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

export function diaAnterior(dia: string): string {
  return diaCO(-1, new Date(`${dia}T12:00:00-05:00`));
}

/** Cada marca: de dónde salen sus chats y con qué reglas se juzgan.
 *  · animals-deluxe: chats en livechat_mensajes (sync cada 5 min) · contra entrega
 *  · rooster-deluxe: otra cuenta de UChat (f287229) sin Live Chat → se leen por la API
 *    de UChat con ROOSTER_UCHAT_API_TOKEN · pago anticipado */
type CfgMarca = { nombre: string; tokenEnv: string; fuente: "livechat" | "uchat"; modo: "contra_entrega" | "anticipado" };
export const MARCAS_REPORTE: Record<string, CfgMarca> = {
  "animals-deluxe": { nombre: "Animals Deluxe", tokenEnv: "UCHAT_API_TOKEN", fuente: "livechat", modo: "contra_entrega" },
  "rooster-deluxe": { nombre: "Rooster Deluxe", tokenEnv: "ROOSTER_UCHAT_API_TOKEN", fuente: "uchat", modo: "anticipado" },
};
const cfgDe = (slug: string): CfgMarca => MARCAS_REPORTE[slug] || MARCAS_REPORTE["animals-deluxe"];
const UCHAT_BASE = () => (process.env.UCHAT_API_BASE || "https://www.uchat.com.au/api").replace(/\/$/, "");
async function uchatGet(token: string, path: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(`${UCHAT_BASE()}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": "Mozilla/5.0 (reporte-diario)" } });
    return r.ok ? ((await r.json()) as Record<string, unknown>) : null;
  } catch { return null; }
}

/** Contactos internos (aviso de pedidos, número de control) que no son clientes. */
function internos(): string[] {
  return (process.env.REPORTE_EXCLUIR_NS || "f280503u1065709577,f280503u1014074893,f280503u1032906375")
    .split(",").map((s) => s.trim()).filter(Boolean);
}

async function tenantId(slug: string): Promise<string | null> {
  if (!db) return null;
  const r = filas<{ id: string }>(await db.execute(sql`select id from tenants where slug = ${slug} limit 1`));
  return r[0]?.id ?? null;
}

/** Cifras que salen directo de la base (sin IA). */
export async function cifras(slug: string, dia: string) {
  const tid = await tenantId(slug);
  if (!db || !tid) throw new Error("sin_db_o_tenant");
  const excluir = sql.join(internos().map((x) => sql`${x}`), sql`, `);
  const [c] = filas<{ n: string }>(await db.execute(sql`
    select count(distinct m.conversacion_id) n
    from livechat_mensajes m join livechat_conversaciones c on c.id = m.conversacion_id
    where m.tenant_id = ${tid} and m.emisor = 'cliente'
      and (m.provider_ts at time zone ${TZ})::date = ${dia}::date
      and c.user_ns not in (${excluir})`));
  const [o] = filas<{ n: string; total: string | null }>(await db.execute(sql`
    select count(*) n, sum(total_cop) total from orders
    where tenant_id = ${tid} and (created_at at time zone ${TZ})::date = ${dia}::date`));
  const [e] = filas<{ n: string }>(await db.execute(sql`
    select count(*) n from events
    where tipo = 'pedido_no_creado' and (created_at at time zone ${TZ})::date = ${dia}::date
      and coalesce(payload->>'sub_id','') not like 'eval%' and coalesce(payload->>'marca', ${slug}) = ${slug}`));
  return { tid, chats: Number(c?.n || 0), pedidos: Number(o?.n || 0), ventas_cop: Number(o?.total || 0), pedidos_no_creados: Number(e?.n || 0) };
}

type ChatDia = { user_ns: string; nombre: string; telefono: string; compro: boolean; lineas: string[] };

async function chatsDelDia(tid: string, dia: string): Promise<ChatDia[]> {
  if (!db) return [];
  const excluir = sql.join(internos().map((x) => sql`${x}`), sql`, `);
  const msgs = filas<{ user_ns: string; nombre: string; telefono: string; emisor: string; tipo: string; texto: string; ts: string }>(await db.execute(sql`
    select c.user_ns, c.nombre, c.telefono, m.emisor, m.tipo, m.texto,
           to_char(m.provider_ts at time zone ${TZ}, 'HH24:MI') ts
    from livechat_mensajes m join livechat_conversaciones c on c.id = m.conversacion_id
    where m.tenant_id = ${tid} and (m.provider_ts at time zone ${TZ})::date = ${dia}::date
      and c.user_ns not in (${excluir})
      and c.id in (select conversacion_id from livechat_mensajes
                   where tenant_id = ${tid} and emisor = 'cliente'
                     and (provider_ts at time zone ${TZ})::date = ${dia}::date)
    order by c.user_ns, m.provider_ts`));
  const tels = new Set(filas<{ t: string }>(await db.execute(sql`
    select right(regexp_replace(coalesce(telefono,''), '\\D', '', 'g'), 10) t from orders
    where tenant_id = ${tid} and (created_at at time zone ${TZ})::date = ${dia}::date`)).map((r) => r.t));
  const porChat = new Map<string, ChatDia>();
  for (const m of msgs) {
    let ch = porChat.get(m.user_ns);
    if (!ch) {
      const t10 = (m.telefono || "").replace(/\D/g, "").slice(-10);
      ch = { user_ns: m.user_ns, nombre: m.nombre, telefono: m.telefono, compro: !!t10 && tels.has(t10), lineas: [] };
      porChat.set(m.user_ns, ch);
    }
    const quien = m.emisor === "cliente" ? "CLIENTE" : m.emisor === "ia" ? "BOT" : m.emisor.startsWith("asesor") ? "ASESOR" : m.emisor.toUpperCase();
    const txt = (m.texto || "").replace(/\s+/g, " ").trim() || `[${m.tipo}]`;
    ch.lineas.push(`${m.ts} ${quien}: ${txt.slice(0, 450)}`);
  }
  return [...porChat.values()];
}

/** Chats del día leídos directo de UChat (marca sin Live Chat en la plataforma).
 *  /subscribers viene ordenado por última interacción: se pagina hasta pasar el día. */
async function chatsDesdeUchat(tid: string, slug: string, dia: string): Promise<ChatDia[]> {
  const token = process.env[cfgDe(slug).tokenEnv] || "";
  if (!token || !db) return [];
  const diaDe = (unix: number) => new Date(unix * 1000).toLocaleDateString("en-CA", { timeZone: TZ });
  const horaDe = (unix: number) => new Date(unix * 1000).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  const corte = new Date(`${dia}T00:00:00-05:00`).getTime() - 86_400_000; // margen de 1 día por zona horaria
  const subs: { ns: string; nombre: string; tel: string }[] = [];
  for (let page = 1; page <= 8; page++) {
    const j = await uchatGet(token, `/subscribers?limit=100&page=${page}`);
    const d = (j?.data as Record<string, unknown>[] | undefined) || [];
    if (!d.length) break;
    let viejo = false;
    for (const x of d) {
      const li = Date.parse(String(x.last_interaction || x.last_message_at || "").replace(" ", "T") + "Z");
      if (li && li < corte) { viejo = true; continue; }
      subs.push({ ns: String(x.user_ns), nombre: String(x.name || x.first_name || ""), tel: String(x.phone || "") });
    }
    if (viejo) break;
  }
  const tels = new Set(filas<{ t: string }>(await db.execute(sql`
    select right(regexp_replace(coalesce(telefono,''), '\\D', '', 'g'), 10) t from orders
    where tenant_id = ${tid} and (created_at at time zone ${TZ})::date = ${dia}::date`)).map((r) => r.t));
  const excl = new Set(internos());
  const out = await enParalelo(subs.filter((x) => !excl.has(x.ns)), 5, async (sb): Promise<ChatDia | null> => {
    const j = await uchatGet(token, `/subscriber/chat-messages?user_ns=${encodeURIComponent(sb.ns)}&include_bot=1&limit=100`);
    const msgs = ((j?.data as { type?: string; sender_id?: string; agent_id?: number; msg_type?: string; content?: string; ts?: number }[] | undefined) || [])
      .filter((m) => m.ts && diaDe(m.ts) === dia).sort((a, b) => (a.ts || 0) - (b.ts || 0));
    if (!msgs.some((m) => m.type === "in")) return null;
    const t10 = sb.tel.replace(/\D/g, "").slice(-10);
    return {
      user_ns: sb.ns, nombre: sb.nombre, telefono: sb.tel, compro: !!t10 && tels.has(t10),
      lineas: msgs.map((m) => {
        const quien = m.type === "in" ? "CLIENTE" : m.agent_id ? "ASESOR" : "BOT";
        const txt = (m.content || "").replace(/\s+/g, " ").trim() || `[${m.msg_type || "media"}]`;
        return `${horaDe(m.ts!)} ${quien}: ${txt.slice(0, 450)}`;
      }),
    };
  });
  return out.filter((x): x is ChatDia => !!x);
}

/** Catálogo y reglas vigentes del bot (bot fields de UChat), para que el juez sepa qué es correcto. */
async function contextoBot(slug = "animals-deluxe"): Promise<string> {
  const token = process.env[cfgDe(slug).tokenEnv] || "";
  if (!token) return "";
  const j = (await uchatGet(token, "/flow/bot-fields?limit=100")) as { data?: { name?: string; value?: unknown }[] } | null;
  if (!j) return "";
  const f = (n: string) => String(j.data?.find((x) => x.name === n)?.value ?? "");
  return `${f("catalogo_cod")}\n\nREGLAS:\n${f("reglas_cod")}`;
}

let ultimoErrorOpenAI = "";

/** null = no se pudo revisar (sin clave, sin saldo, modelo no disponible). */
const JUEZ_ANTICIPADO = `Revisás chats de WhatsApp del bot de ventas de PAGO ANTICIPADO de Rooster Deluxe (suplementos e implementos para gallos finos; el cliente TRANSFIERE el valor de los productos ANTES del despacho y el ENVÍO lo paga al recibir según su zona — así funciona, no es error). Abajo están el catálogo y las reglas OFICIALES: son la única verdad.
Marcá un error SOLO si es claro y verificable: precio distinto al catálogo o cambiar de precio en el mismo chat; producto distinto al que pidió el cliente o forma equivocada (gotas/inyectable/pastillas/polvo/crema); dosis o dato que no está en el catálogo; el BOT ofrece o acepta contra entrega (ofrecio_contra_entrega); el bot manda las cuentas de pago sin haber dado antes el producto y el total, o cuando el cliente dijo "más tarde/te aviso/lo pienso" (mando_cuentas_antes_de_tiempo); el bot repite el mismo mensaje, vuelve a saludar como si fuera nuevo, o pregunta algo que el cliente ya dijo (repitio_mensaje_o_perdio_contexto); no responder o responder doble. NO son errores: el tono o el saludo inicial; que el cliente no compre; lo que escribe un ASESOR humano (aunque ofrezca contra entrega o precio por mayor: eso lo decide el negocio); decir "el envío lo pagas al recibir"; una dosis igual al catálogo con otras palabras. Ante la duda, NO es error.`;

async function juzgar(ctx: string, ch: ChatDia, modelo: string, modo: CfgMarca["modo"] = "contra_entrega"): Promise<ChatRevisado | null> {
  const key = process.env.OPENAI_API_KEY || "";
  if (!key) return null;
  const sistema = modo === "anticipado" ? `${JUEZ_ANTICIPADO}
Respondé SOLO JSON: {"compro": boolean, "motivo": una de ${JSON.stringify(MOTIVOS)}, "producto": "producto principal que le interesó o vacío", "errores": [{"tipo": una de ${JSON.stringify(ERRORES)}, "detalle": "frase corta en español con lo que pasó"}]}

${ctx}` : `Revisás chats de WhatsApp del bot de ventas CONTRA ENTREGA de Animals Deluxe (suplementos para gallos de pelea, perros y caballos; el cliente paga al recibir). Abajo están el catálogo y las reglas OFICIALES que el bot debe cumplir: son la única verdad.
Marcá un error SOLO si es claro y verificable contra el catálogo/reglas o contra el chat: precio distinto al catálogo; producto distinto al que pidió el cliente o forma equivocada (gotas/inyectable/pastillas/polvo); dosis o dato que no está en el catálogo; ofrecer un producto o presentación de pago anticipado / Rooster Deluxe; mínimo o envío mal aplicado; pedir otra vez un dato que el cliente ya dio; no responder o responder doble; pedido creado con producto o total equivocado, o no creado habiendo dicho sí. NO son errores (no los marques): el tono o el saludo; que el cliente no compre; lo que escribe un ASESOR humano; un total que dice "solo el producto" con el envío aparte o "+ envío" (así funciona contra entrega); un pedido que llega justo a $50.000 en productos (cumple el mínimo); una dosis que dice lo mismo que el catálogo con otras palabras; no dar un dato que el cliente nunca pidió. Ante la duda, NO es error.
Respondé SOLO JSON: {"compro": boolean, "motivo": una de ${JSON.stringify(MOTIVOS)}, "producto": "producto principal que le interesó o vacío", "errores": [{"tipo": una de ${JSON.stringify(ERRORES)}, "detalle": "frase corta en español con lo que pasó"}]}

${ctx}`;
  const usuario = `${ch.compro ? "SEGÚN LA BASE, ESTE CLIENTE HIZO PEDIDO HOY." : "Según la base, no hay pedido de este cliente hoy (puede que lo haya tomado un asesor)."}\nCliente: ${ch.nombre}\n\n${ch.lineas.slice(-70).join("\n")}`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelo, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: sistema }, { role: "user", content: usuario }] }),
      });
      if (!r.ok) {
        const cuerpo = (await r.text()).slice(0, 300);
        ultimoErrorOpenAI = /insufficient_quota|credit_balance/.test(cuerpo) ? "OpenAI sin saldo" : `OpenAI ${r.status}`;
        console.error("reporte_diario_openai", r.status, cuerpo);
        if (/insufficient_quota|credit_balance/.test(cuerpo)) return null;
        if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 3000 * (i + 1))); continue; }
        return null;
      }
      const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
      const o = JSON.parse(j.choices?.[0]?.message?.content || "{}") as Partial<ChatRevisado>;
      const errores = (Array.isArray(o.errores) ? o.errores : [])
        .filter((e) => e && typeof e.tipo === "string")
        .map((e) => ({ tipo: (ERRORES as readonly string[]).includes(e.tipo) ? e.tipo : "otro_error", detalle: String(e.detalle || "").slice(0, 160) }));
      const compro = ch.compro || o.compro === true;
      const motivo = compro ? "compro" : (MOTIVOS as readonly string[]).includes(String(o.motivo)) ? String(o.motivo) : "otro";
      return { user_ns: ch.user_ns, nombre: ch.nombre, compro, motivo, producto: String(o.producto || "").slice(0, 60), errores };
    } catch {
      await new Promise((s) => setTimeout(s, 1500));
    }
  }
  return null;
}

async function enParalelo<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

/** Arma el reporte completo de un día (revisa todos los chats con OpenAI). */
export async function generarReporte(slug: string, dia: string, opts: { modelo?: string; limite?: number } = {}): Promise<Reporte> {
  const cfg = cfgDe(slug);
  const base = await cifras(slug, dia);
  const ctx = await contextoBot(slug);
  let chats = cfg.fuente === "uchat" ? await chatsDesdeUchat(base.tid, slug, dia) : await chatsDelDia(base.tid, dia);
  // Sin Live Chat, los chats del día se cuentan desde UChat.
  if (cfg.fuente === "uchat") base.chats = chats.length;
  if (opts.limite) chats = chats.slice(0, opts.limite);
  const modelo = opts.modelo || process.env.REPORTE_MODELO || "gpt-4o-mini";
  ultimoErrorOpenAI = "";
  const intentos = await enParalelo(chats, 6, (ch) => juzgar(ctx, ch, modelo, cfg.modo));
  const revisados = intentos.filter((r): r is ChatRevisado => r !== null);
  const errores: Record<string, number> = {};
  const motivos: Record<string, number> = {};
  const ejemplos: Reporte["ejemplos_error"] = [];
  for (const r of revisados) {
    motivos[r.motivo] = (motivos[r.motivo] || 0) + 1;
    for (const e of r.errores) {
      errores[e.tipo] = (errores[e.tipo] || 0) + 1;
      if (ejemplos.length < 15) ejemplos.push({ nombre: r.nombre, tipo: e.tipo, detalle: e.detalle });
    }
  }
  return {
    tenant: slug,
    dia,
    chats: base.chats,
    pedidos: base.pedidos,
    ventas_cop: base.ventas_cop,
    conversion: base.chats ? base.pedidos / base.chats : 0,
    chats_revisados: revisados.length,
    chats_sin_revisar: intentos.length - revisados.length,
    error_revision: intentos.length - revisados.length ? ultimoErrorOpenAI || "falla de OpenAI" : "",
    chats_con_error: revisados.filter((r) => r.errores.length).length,
    errores,
    motivos,
    ejemplos_error: ejemplos,
    pedidos_no_creados: base.pedidos_no_creados,
    generado_at: new Date().toISOString(),
    revisados,
  };
}

export async function guardarReporte(r: Reporte): Promise<void> {
  if (!db) return;
  await db.insert(events).values({ tipo: "reporte_diario", payload: r as unknown as object });
}

/** Último reporte guardado de ese día (o null). */
export async function leerReporte(slug: string, dia: string): Promise<Reporte | null> {
  if (!db) return null;
  const r = filas<{ payload: Reporte }>(await db.execute(sql`
    select payload from events where tipo = 'reporte_diario'
      and payload->>'tenant' = ${slug} and payload->>'dia' = ${dia}
    order by created_at desc limit 1`));
  return r[0]?.payload ?? null;
}

const cop = (n: number) => "$" + Math.round(n).toLocaleString("es-CO").replace(/,/g, ".");
const pct = (x: number) => `${(x * 100).toFixed(1).replace(".", ",")}%`;
function dif(hoy: number, ayer: number | undefined, fmt: (n: number) => string = String): string {
  if (ayer === undefined) return fmt(hoy);
  const d = hoy - ayer;
  const signo = d > 0 ? "▲" : d < 0 ? "▼" : "=";
  return `${fmt(hoy)} (ayer ${fmt(ayer)} ${signo})`;
}
const totalErrores = (r: Reporte) => Object.values(r.errores).reduce((a, b) => a + b, 0);
function top(m: Record<string, number>, nombres: Record<string, string>, n: number, excluir: string[] = []): string {
  return Object.entries(m).filter(([k]) => !excluir.includes(k)).sort((a, b) => b[1] - a[1]).slice(0, n)
    .map(([k, v]) => `${nombres[k] || k} ${v}`).join(", ");
}

/** Parámetros de la plantilla (una línea cada uno: Meta no acepta saltos de línea en variables). */
export function parametrosPlantilla(hoy: Reporte, ayer: Reporte | null): string[] {
  const fecha = new Date(`${hoy.dia}T12:00:00-05:00`).toLocaleDateString("es-CO", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
  const errAyer = ayer && ayer.chats_revisados ? totalErrores(ayer) : undefined;
  // Meta rechaza variables vacías, con saltos de línea/tabs o con 4+ espacios seguidos:
  // se limpian TODAS (el motivo de error de OpenAI puede traer saltos de línea).
  const lim = (s: string) => (s || "").replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim().slice(0, 300) || "ninguno";
  // La plantilla es la misma para las dos marcas: la fecha lleva el nombre de la marca
  // cuando no es Animals, para que en el WhatsApp de control no se confundan.
  return [
    hoy.tenant && hoy.tenant !== "animals-deluxe" ? `${cfgDe(hoy.tenant).nombre.toUpperCase()} · ${fecha}` : fecha,
    dif(hoy.chats, ayer?.chats),
    dif(hoy.pedidos, ayer?.pedidos),
    dif(hoy.ventas_cop, ayer?.ventas_cop, cop),
    dif(hoy.conversion, ayer?.conversion, pct),
    `${dif(totalErrores(hoy), errAyer)} en ${hoy.chats_con_error} de ${hoy.chats_revisados} chats revisados${hoy.chats_sin_revisar ? ` (${hoy.chats_sin_revisar} sin revisar: ${hoy.error_revision || "falla de OpenAI"})` : ""}`,
    top(hoy.errores, NOMBRE_ERROR, 3),
    top(hoy.motivos, NOMBRE_MOTIVO, 3, ["compro"]),
  ].map(lim);
}

/** Mismo contenido en texto (para revisar o para el registro). */
export function textoReporte(hoy: Reporte, ayer: Reporte | null): string {
  const p = parametrosPlantilla(hoy, ayer);
  return `📊 Reporte del bot ${cfgDe(hoy.tenant).nombre} — ${p[0]}\n💬 Chats atendidos: ${p[1]}\n🛒 Pedidos: ${p[2]}\n💵 Ventas: ${p[3]}\n📈 Conversión: ${p[4]}\n⚠️ Errores del bot: ${p[5]}\n🔎 Errores principales: ${p[6]}\n🚪 Por qué no compraron: ${p[7]}`;
}
