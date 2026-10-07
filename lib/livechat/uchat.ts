/* ===========================================================
   Live Chat · cliente de la API de UChat, uno por espacio (workspace).
   El token sale de la variable de entorno cuyo NOMBRE trae el espacio
   (tenants.livechat.espacios[].uchat_token_env) — nunca de la base.

   UChat limita llamadas por token (429 «Too Many Attempts»): se respeta
   Retry-After y se reintenta hasta 2 veces. Errores sin cabeceras ni token.
   (lib/uchat.ts es el envío fail-soft que usa el webhook de pagos; este es
   el estricto que necesita la bandeja.)
   =========================================================== */
import type { Espacio } from "./puro";

const BASE = (process.env.UCHAT_API_BASE || "https://www.uchat.com.au/api").replace(/\/$/, "");
const ESPERA_MS = 15_000;

export class ErrorLivechat extends Error {
  reintentarEnMs?: number;
  constructor(msg: string, public codigo = "uchat") {
    super(msg);
  }
}

export type ClienteUchat = {
  espacio: Espacio;
  pedir: (metodo: "GET" | "POST" | "PUT", ruta: string, cuerpo?: unknown) => Promise<unknown>;
};

export function tokenDeEspacio(e: Espacio): string {
  return (process.env[e.uchat_token_env] || "").trim();
}

export function clienteUchat(espacio: Espacio): ClienteUchat {
  const token = tokenDeEspacio(espacio);
  if (!token) throw new ErrorLivechat(`Falta el token de UChat de «${espacio.nombre}» (variable ${espacio.uchat_token_env})`, "falta_token");

  async function pedirUnaVez(metodo: string, ruta: string, cuerpo?: unknown): Promise<unknown> {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), ESPERA_MS);
    const ruta0 = ruta.split("?")[0];
    try {
      const r = await fetch(`${BASE}${ruta}`, {
        method: metodo,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(cuerpo ? { "Content-Type": "application/json" } : {}),
        },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
        cache: "no-store",
        signal: control.signal,
      });
      const txt = await r.text();
      let json: unknown = null;
      try { json = txt ? JSON.parse(txt) : null; } catch { json = null; }
      if (!r.ok) {
        const msg = json && typeof json === "object" && typeof (json as { message?: unknown }).message === "string"
          ? (json as { message: string }).message.slice(0, 200) : `HTTP ${r.status}`;
        if (r.status === 401 || r.status === 403) throw new ErrorLivechat(`UChat rechazó el token (${ruta0}): revisa la variable ${espacio.uchat_token_env}`, "token");
        if (r.status === 429) {
          const ra = Number(r.headers.get("retry-after"));
          const err = new ErrorLivechat(`UChat está recibiendo demasiadas llamadas (${ruta0}); intenta en unos segundos`, "429");
          err.reintentarEnMs = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 8000) : 2500;
          throw err;
        }
        throw new ErrorLivechat(`UChat respondió ${r.status} en ${ruta0}: ${msg}`);
      }
      if (json && typeof json === "object" && (json as { status?: unknown }).status === "error") {
        throw new ErrorLivechat(`UChat: ${String((json as { message?: unknown }).message ?? "error").slice(0, 200)}`);
      }
      return json;
    } catch (e) {
      if (e instanceof ErrorLivechat) throw e;
      if (e instanceof Error && e.name === "AbortError") throw new ErrorLivechat(`UChat no respondió a tiempo (${ruta0})`);
      throw new ErrorLivechat(`No se pudo hablar con UChat: ${e instanceof Error ? e.message : "error de red"}`);
    } finally {
      clearTimeout(reloj);
    }
  }

  return {
    espacio,
    async pedir(metodo, ruta, cuerpo) {
      for (let intento = 0; ; intento++) {
        try {
          return await pedirUnaVez(metodo, ruta, cuerpo);
        } catch (e) {
          const espera = e instanceof ErrorLivechat ? e.reintentarEnMs : undefined;
          if (espera === undefined || intento >= 2) throw e;
          await new Promise((r) => setTimeout(r, espera));
        }
      }
    },
  };
}

/* ---------- endpoints (formas verificadas en producción) ---------- */

type Lista = { data?: Record<string, unknown>[] };

/** Suscriptores más recientes primero (UChat los ordena por última interacción). */
export async function listarSuscriptores(c: ClienteUchat, page = 1, limit = 100) {
  const r = (await c.pedir("GET", `/subscribers?limit=${limit}&page=${page}`)) as Lista;
  return Array.isArray(r?.data) ? r.data : [];
}

export async function infoSuscriptor(c: ClienteUchat, userNs: string) {
  const r = (await c.pedir("GET", `/subscriber/get-info?user_ns=${encodeURIComponent(userNs)}`)) as { data?: Record<string, unknown> };
  return (r?.data ?? {}) as Record<string, unknown>;
}

export async function mensajesDe(c: ClienteUchat, userNs: string, limit = 100) {
  const r = (await c.pedir(
    "GET",
    `/subscriber/chat-messages?user_ns=${encodeURIComponent(userNs)}&limit=${limit}&include_bot=1&include_note=1&include_system=1`,
  )) as Lista;
  return Array.isArray(r?.data) ? r.data : [];
}

/** OJO: en un workspace con IA, send-text activa el auto-pause del bot (30 min). */
export function enviarTexto(c: ClienteUchat, userNs: string, texto: string) {
  return c.pedir("POST", "/subscriber/send-text", { user_ns: userNs, content: texto });
}

export function enviarMedia(c: ClienteUchat, userNs: string, tipo: "image" | "audio" | "video" | "file", url: string) {
  return c.pedir("POST", "/subscriber/send-content", {
    user_ns: userNs,
    send_as_agent: 1,
    data: { version: "v1", content: { messages: [{ type: tipo, url }] } },
  });
}

export function pausarBot(c: ClienteUchat, userNs: string, minutos: number) {
  return c.pedir("POST", "/subscriber/pause-bot", { user_ns: userNs, minutes: minutos });
}

export function reanudarBot(c: ClienteUchat, userNs: string) {
  return c.pedir("POST", "/subscriber/resume-bot", { user_ns: userNs });
}

export async function listarPlantillas(c: ClienteUchat) {
  return c.pedir("POST", "/whatsapp-template/list?limit=100&page=1");
}

export function enviarPlantilla(
  c: ClienteUchat, userNs: string,
  p: { namespace: string; nombre: string; idioma: string; valores: string[] },
) {
  const params: Record<string, string> = {};
  // Meta rechaza parámetros vacíos o con saltos de línea.
  p.valores.forEach((v, i) => { params[`BODY_{{${i + 1}}}`] = String(v).replace(/\s+/g, " ").trim().slice(0, 200) || "-"; });
  return c.pedir("POST", "/subscriber/send-whatsapp-template", {
    user_ns: userNs,
    content: { namespace: p.namespace, name: p.nombre, lang: p.idioma || "es", params },
  });
}
