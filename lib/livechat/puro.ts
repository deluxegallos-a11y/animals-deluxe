/* ===========================================================
   Live Chat · lógica PURA (sin DB ni red) — se prueba en tests/livechat.test.ts.
   Config de espacios, clasificación de mensajes de UChat, eco del panel,
   ventana de 24 h y reparto equitativo de la línea de asesores.

   Forma real de un mensaje de GET /subscriber/chat-messages (verificada en el
   workspace «animals deluxe», oct-2026):
     { id, mid, user_ns, type: "in"|"out"|"agent", msg_type: "text"|"image"|"audio"|…,
       sender_id: "bot"|<user_ns>, agent_id, username, ts (epoch s, UTC),
       content, payload: { text?, url?, title?, transcribed_text? } }
   type "in" = cliente · "agent" = humano del equipo · "out" = bot (sender_id "bot").
   =========================================================== */

export type Espacio = {
  codigo: string; // "bot" | "directo" | …
  nombre: string; // pestaña en la bandeja
  flow_ns: string; // fNNNNNN — prefijo de los user_ns del workspace
  uchat_token_env: string; // NOMBRE de la variable de entorno con el token
  con_ia: boolean; // workspace con agente IA (send-text pausa el bot)
  reparto: boolean; // reparto equitativo a asesores al primer mensaje
};
export type LivechatConfig = { activo: boolean; espacios: Espacio[] };

const ENV_RE = /^[A-Z][A-Z0-9_]{2,63}$/;
const FLOW_RE = /^f\d{3,12}$/;

/** Lee tenants.livechat con tolerancia: descarta espacios mal formados. */
export function leerConfig(raw: unknown): LivechatConfig {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const lista = Array.isArray(o.espacios) ? o.espacios : [];
  const espacios: Espacio[] = [];
  for (const e of lista) {
    if (!e || typeof e !== "object") continue;
    const x = e as Record<string, unknown>;
    const codigo = String(x.codigo || "").trim().toLowerCase();
    const flow = String(x.flow_ns || "").trim();
    const env = String(x.uchat_token_env || "").trim();
    if (!/^[a-z][a-z0-9_-]{1,30}$/.test(codigo) || !FLOW_RE.test(flow) || !ENV_RE.test(env)) continue;
    if (espacios.some((y) => y.codigo === codigo)) continue;
    const conIa = x.con_ia === undefined ? codigo === "bot" : x.con_ia === true;
    espacios.push({
      codigo,
      nombre: String(x.nombre || (conIa ? "Live Chat IA" : "Live Chat Directo")),
      flow_ns: flow,
      uchat_token_env: env,
      con_ia: conIa,
      reparto: x.reparto === true,
    });
  }
  return { activo: o.activo === true && espacios.length > 0, espacios };
}

/** Espacio al que pertenece un user_ns (el user_ns trae el flow: f280503u986640483). */
export function espacioDeUserNs(cfg: LivechatConfig, userNs: string): Espacio | null {
  return cfg.espacios.find((e) => userNs.startsWith(e.flow_ns + "u")) ?? null;
}

export function espacioPorFlow(cfg: LivechatConfig, flowNs: string): Espacio | null {
  return cfg.espacios.find((e) => e.flow_ns === flowNs) ?? null;
}

/* ---------- fechas ---------- */

/** "2026-10-07 20:53:28" (UTC en la API de UChat) → Date. */
export function fechaUchat(s: unknown): Date | null {
  const t = String(s ?? "").trim();
  if (!t) return null;
  const d = new Date(t.includes("T") ? t : t.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fechaDeTs(ts: unknown): Date {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return new Date();
  return new Date(n < 1e12 ? n * 1000 : n);
}

/** WhatsApp: mensajes libres solo dentro de 24 h desde el último mensaje del cliente. */
export const VENTANA_MS = 24 * 60 * 60 * 1000;
export function ventanaAbierta(ultimoClienteAt: Date | null | undefined, ahora = new Date()): boolean {
  if (!ultimoClienteAt) return false;
  return ahora.getTime() - new Date(ultimoClienteAt).getTime() < VENTANA_MS;
}

/* ---------- clasificación ---------- */

export type Emisor = "cliente" | "ia" | "asesor_uchat" | "asesor_panel" | "sistema" | "nota";
export type MensajeClasificado = {
  providerMsgId: string;
  direccion: "in" | "out" | "event";
  emisor: Emisor;
  tipo: string; // text | image | video | audio | file | event
  texto: string;
  mediaUrl: string;
  autor: string;
  ts: Date;
};

const TIPOS: Record<string, string> = {
  text: "text", feed: "text", comment_reply: "text", interactive: "text", button: "text", quick_reply: "text",
  image: "image", sticker: "image", video: "video", audio: "audio", voice: "audio",
  file: "file", document: "file", template: "text",
};

function s(x: unknown): string {
  return x == null ? "" : String(x);
}

/** Convierte un mensaje crudo de UChat a nuestra forma. `prefijo` evita choques
 *  de ids entre workspaces (p. ej. "directo:"). null = no se muestra. */
export function clasificarMensaje(m: Record<string, unknown>, prefijo = ""): MensajeClasificado | null {
  const payload = (m.payload && typeof m.payload === "object" ? m.payload : {}) as Record<string, unknown>;
  const idBase = s(m.mid) || (m.id != null ? `id:${s(m.id)}` : "");
  if (!idBase) return null;
  const type = s(m.type).toLowerCase();
  const msgType = s(m.msg_type || payload.type).toLowerCase();

  let direccion: MensajeClasificado["direccion"] = "out";
  let emisor: Emisor;
  if (type === "note" || msgType === "note") { emisor = "nota"; direccion = "event"; }
  else if (type === "system" || msgType === "system" || msgType === "event") { emisor = "sistema"; direccion = "event"; }
  else if (type === "in") { emisor = "cliente"; direccion = "in"; }
  else if (type === "agent" || (Number(m.agent_id) > 0 && s(m.sender_id) !== "bot")) emisor = "asesor_uchat";
  else emisor = "ia";

  const tipo = direccion === "event" ? "event" : TIPOS[msgType] || (s(payload.url) ? "file" : "text");
  const transcrito = s(payload.transcribed_text).trim();
  let texto = (s(payload.text) || s(m.content)).trim();
  if (!texto && tipo === "audio") texto = transcrito;
  if (!texto && tipo !== "text") texto = s(payload.title || payload.caption).trim();
  const mediaUrl = tipo === "text" ? "" : s(payload.url);
  if (!texto && !mediaUrl && direccion !== "event") return null;

  return {
    providerMsgId: prefijo + idBase,
    direccion,
    emisor,
    tipo,
    texto,
    mediaUrl,
    autor: emisor === "ia" ? "Bot IA" : s(m.username),
    ts: fechaDeTs(m.ts),
  };
}

/** Texto corto para la lista de la bandeja. */
export function vistaPrevia(m: { tipo: string; texto: string }): string {
  const t = m.texto.replace(/\s+/g, " ").trim();
  const ico: Record<string, string> = { image: "📷 Foto", video: "🎬 Video", audio: "🎤 Nota de voz", file: "📎 Archivo" };
  if (m.tipo in ico) return t ? `${ico[m.tipo]} · ${t}`.slice(0, 160) : ico[m.tipo];
  return t.slice(0, 160);
}

/* ---------- eco del panel ---------- */

/** Lo enviado desde la plataforma se guarda al instante con id "panel:". Cuando
 *  UChat lo devuelve (como mensaje del dueño del token, type "agent") hay que
 *  emparejarlo en vez de duplicarlo. Devuelve el id del pendiente que es su eco. */
export type PendientePanel = { id: string; tipo: string; texto: string; mediaUrl: string; ts: Date };
const MARGEN_ECO_MS = 10 * 60 * 1000;
export function comparable(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}
export function ecoDelPanel(pendientes: PendientePanel[], m: MensajeClasificado): string | null {
  if (m.direccion !== "out" || m.emisor === "ia") return null;
  const cerca = pendientes.filter((p) => p.tipo === m.tipo && Math.abs(p.ts.getTime() - m.ts.getTime()) <= MARGEN_ECO_MS);
  if (!cerca.length) return null;
  if (m.tipo === "text") {
    const c = comparable(m.texto);
    return cerca.find((p) => comparable(p.texto) === c)?.id ?? null;
  }
  const mismo = cerca.find((p) => p.mediaUrl && p.mediaUrl === m.mediaUrl);
  if (mismo) return mismo.id;
  // UChat re-aloja la media en su CDN: el enlace cambia → el más cercano en el tiempo.
  return [...cerca].sort((a, b) => Math.abs(a.ts.getTime() - m.ts.getTime()) - Math.abs(b.ts.getTime() - m.ts.getTime()))[0].id;
}

/* ---------- reparto equitativo (línea de asesores) ---------- */

export type Candidato = { id: string; nombre: string };
/** 1) continuidad: si el cliente ya tuvo asesor y sigue disponible, ese.
 *  2) menos chats asignados hoy → 3) menos en 7 días → 4) nombre. */
export function elegirAsesor(
  candidatos: Candidato[],
  previoId: string | null,
  delDia: Record<string, number>,
  deLaSemana: Record<string, number>,
): { asesor: Candidato; motivo: "continuidad" | "equitativo" } | null {
  if (!candidatos.length) return null;
  const previo = previoId ? candidatos.find((c) => c.id === previoId) : undefined;
  if (previo) return { asesor: previo, motivo: "continuidad" };
  const orden = [...candidatos].sort(
    (a, b) =>
      (delDia[a.id] || 0) - (delDia[b.id] || 0) ||
      (deLaSemana[a.id] || 0) - (deLaSemana[b.id] || 0) ||
      a.nombre.localeCompare(b.nombre, "es"),
  );
  return { asesor: orden[0], motivo: "equitativo" };
}

/* ---------- utilidades ---------- */

export function normalizarTelefono(raw: unknown): string {
  let t = s(raw).replace(/\D/g, "");
  if (t.length === 10 && t.startsWith("3")) t = "57" + t;
  return t;
}

/** Placeholders de las respuestas rápidas: {nombre} y {asesor}. */
export function rellenar(texto: string, v: { nombre?: string; asesor?: string }): string {
  const primer = (v.nombre || "").trim().split(/\s+/)[0] || "";
  return texto
    .replace(/\{nombre\}/gi, primer)
    .replace(/\{asesor\}/gi, (v.asesor || "").trim())
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/ {2,}/g, " ")
    .trim();
}

/* ---------- plantillas de WhatsApp ---------- */

export type Plantilla = {
  nombre: string; idioma: string; namespace: string; cuerpo: string; variables: number;
  noCompatible: string | null; // motivo por el que no se puede mandar desde la bandeja
};

export function contarVariables(t: string): number {
  const nums = [...t.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => Number(m[1]));
  return nums.length ? Math.max(...nums) : 0;
}

/** Respuesta de POST /whatsapp-template/list → plantillas utilizables. */
export function leerPlantillas(crudo: unknown): Plantilla[] {
  const data = crudo && typeof crudo === "object" && Array.isArray((crudo as { data?: unknown }).data)
    ? ((crudo as { data: unknown[] }).data) : Array.isArray(crudo) ? crudo : [];
  const out: Plantilla[] = [];
  for (const t of data) {
    if (!t || typeof t !== "object") continue;
    const o = t as Record<string, unknown>;
    const nombre = s(o.name);
    if (!nombre) continue;
    const comps = Array.isArray(o.components) ? (o.components as Record<string, unknown>[]) : [];
    const de = (tipo: string) => comps.find((c) => s(c?.type).toUpperCase() === tipo);
    const body = de("BODY");
    const header = de("HEADER");
    const cuerpo = s(body?.text);
    const formato = s(header?.format || (header?.text ? "TEXT" : "")).toUpperCase();
    const estado = s(o.status).toUpperCase();
    let noCompatible: string | null = null;
    if (estado && estado !== "APPROVED") noCompatible = `No está aprobada por Meta (${estado.toLowerCase()})`;
    else if (header && formato && formato !== "TEXT") noCompatible = "Tiene encabezado con imagen o video: úsala desde UChat";
    else if (header?.text && contarVariables(s(header.text)) > 0) noCompatible = "El encabezado tiene variables: úsala desde UChat";
    else if (!cuerpo) noCompatible = "No tiene cuerpo de texto";
    out.push({
      nombre,
      idioma: s(o.language || o.lang) || "es",
      namespace: s(o.namespace),
      cuerpo,
      variables: contarVariables(cuerpo),
      noCompatible,
    });
  }
  return out;
}
