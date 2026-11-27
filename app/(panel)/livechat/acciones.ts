"use server";

/* ===========================================================
   Live Chat · acciones del panel (todas validan acceso en el servidor).
   Regla de UChat: en la línea con IA, send-text pausa el bot 30 min; por eso
   escribir en un chat del bot = «Tomar» el chat (pausa explícita de 12 h).
   =========================================================== */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  livechatConversaciones as conv, livechatMensajes as msg, livechatRespuestasRapidas as rr, products,
} from "@/lib/db/schema";
import { contexto, exigirConversacion, filas, SinAcceso, type Contexto } from "@/lib/livechat/datos";
import {
  clienteUchat, enviarMedia, enviarPlantilla as enviarPlantillaUchat, enviarTexto, listarPlantillas,
  pausarBot, reanudarBot, ErrorLivechat, type ClienteUchat,
} from "@/lib/livechat/uchat";
import { actualizarResumen, registrarEvento, sincronizarConversacion } from "@/lib/livechat/sync";
import { leerPlantillas, ventanaAbierta, type Plantilla } from "@/lib/livechat/puro";
import { cop } from "@/lib/ai/format";

export type Res<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

const MINUTOS_TOMAR = 720;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://animalsdeluxe.com";

async function conAcceso<T>(fn: (ctx: Contexto) => Promise<T>): Promise<Res<T>> {
  try {
    const ctx = await contexto();
    return { ok: true, data: await fn(ctx) };
  } catch (e) {
    if (e instanceof SinAcceso || e instanceof ErrorLivechat) return { ok: false, error: e.message };
    console.error("[livechat]", e);
    return { ok: false, error: "No se pudo completar la acción" };
  }
}

function soloAdmin(ctx: Contexto) {
  if (ctx.rol !== "admin") throw new SinAcceso("Solo coordinación puede hacer esto");
}

type ConvRow = typeof conv.$inferSelect;
function ventana(c: ConvRow): boolean {
  // El dato de UChat (allow_send_message) manda; si no hay, 24 h desde el último del cliente.
  return c.ventanaAbierta ?? ventanaAbierta(c.ultimoClienteAt);
}

async function guardarSalida(ctx: Contexto, c: ConvRow, tipo: string, texto: string, mediaUrl = "") {
  await db!.insert(msg).values({
    tenantId: ctx.tenantId, conversacionId: c.id, providerMsgId: `panel:${crypto.randomUUID()}`,
    direccion: "out", emisor: "asesor_panel", tipo, texto, mediaUrl, autor: ctx.asesorNombre,
  });
  await db!.update(conv).set({ sinLeer: 0 }).where(eq(conv.id, c.id));
  await actualizarResumen(c.id);
}

/** En la línea del bot, escribir = tomar el chat (pausa explícita y visible). */
async function tomarSiHaceFalta(ctx: Contexto, c: ConvRow, conIa: boolean, cli: ClienteUchat) {
  if (!conIa) return;
  const pausado = c.owner === "humano" && c.botPausadoHasta && c.botPausadoHasta > new Date();
  if (pausado) return;
  await pausarBot(cli, c.userNs, MINUTOS_TOMAR);
  await db!.update(conv).set({ owner: "humano", botPausadoHasta: new Date(Date.now() + MINUTOS_TOMAR * 60_000) }).where(eq(conv.id, c.id));
  await registrarEvento(ctx.tenantId, c.id, `${ctx.asesorNombre} tomó el chat (bot en pausa ${MINUTOS_TOMAR / 60} h)`, ctx.asesorNombre);
}

async function enviarTextoInterno(ctx: Contexto, conversacionId: string, texto: string) {
  const t = String(texto || "").trim();
  if (!t) throw new SinAcceso("Escribe un mensaje");
  if (t.length > 4000) throw new SinAcceso("Mensaje demasiado largo (máx. 4.000)");
  const { conv: c, espacio } = await exigirConversacion(ctx, conversacionId);
  if (!ventana(c)) throw new SinAcceso("Pasaron más de 24 h desde el último mensaje del cliente: usa una plantilla");
  const cli = clienteUchat(espacio);
  await tomarSiHaceFalta(ctx, c, espacio.con_ia, cli);
  await enviarTexto(cli, c.userNs, t);
  await guardarSalida(ctx, c, "text", t);
}

async function enviarImagenInterno(ctx: Contexto, conversacionId: string, url: string, pie = "") {
  const u = String(url || "").trim();
  if (!/^https:\/\/\S+$/i.test(u)) throw new SinAcceso("La imagen debe ser un enlace https");
  const { conv: c, espacio } = await exigirConversacion(ctx, conversacionId);
  if (!ventana(c)) throw new SinAcceso("Ventana de 24 h cerrada: usa una plantilla");
  const cli = clienteUchat(espacio);
  await tomarSiHaceFalta(ctx, c, espacio.con_ia, cli);
  try {
    await enviarMedia(cli, c.userNs, "image", u);
    await guardarSalida(ctx, c, "image", "", u);
  } catch {
    // Si UChat no acepta la imagen, que al menos llegue el enlace.
    await enviarTexto(cli, c.userNs, u);
    await guardarSalida(ctx, c, "text", u);
  }
  const p = pie.trim();
  if (p) {
    await enviarTexto(cli, c.userNs, p);
    await guardarSalida(ctx, c, "text", p);
  }
}

export async function enviarMensaje(conversacionId: string, texto: string): Promise<Res> {
  return conAcceso((ctx) => enviarTextoInterno(ctx, conversacionId, texto));
}

export async function enviarImagen(conversacionId: string, url: string, pie = ""): Promise<Res> {
  return conAcceso((ctx) => enviarImagenInterno(ctx, conversacionId, url, pie));
}

/** Ficha del producto: foto + presentación con precio y forma de pago de la marca. */
export async function enviarProducto(conversacionId: string, productoId: string): Promise<Res> {
  return conAcceso(async (ctx) => {
    const [p] = await db!.select().from(products)
      .where(and(eq(products.id, productoId), eq(products.tenantId, ctx.tenantId), eq(products.activo, true))).limit(1);
    if (!p) throw new SinAcceso("Producto no encontrado");
    const [t] = filas<{ payment_mode: string }>(await db!.execute(sql`select payment_mode from tenants where id = ${ctx.tenantId}`));
    const anticipado = t?.payment_mode === "anticipado" || p.soloAnticipado;
    const img = p.imageUrl || (p.image ? (/^https?:\/\//.test(p.image) ? p.image : `${SITE}/products/${p.image}`) : "");
    const gancho = (p.descripcion || "").trim()
      || [p.tagline || p.shortDesc || "", ...(p.benefits || []).slice(0, 4).map((b) => `✅ ${b}`)].filter(Boolean).join("\n");
    const texto = [
      `🐓 *${p.name}*`,
      gancho,
      p.dosificacion ? `💉 Uso: ${p.dosificacion}` : "",
      `💰 ${cop(p.priceCop)} ${p.envioGratis ? "· envío GRATIS 🚚" : "+ envío"}`,
      anticipado ? "💳 Pago anticipado (transferencia)." : "📦 Pagas contra entrega, cuando recibes.",
      (p.minUnidades ?? 1) > 1 ? `Se vende desde ${p.minUnidades} unidades.` : "",
    ].filter(Boolean).join("\n");
    if (img) await enviarImagenInterno(ctx, conversacionId, img, texto);
    else await enviarTextoInterno(ctx, conversacionId, texto);
  });
}

export async function tomarChat(conversacionId: string): Promise<Res> {
  return conAcceso(async (ctx) => {
    const { conv: c, espacio } = await exigirConversacion(ctx, conversacionId);
    if (!espacio.con_ia) throw new SinAcceso("Esta línea no tiene bot");
    await tomarSiHaceFalta(ctx, { ...c, owner: "bot" }, true, clienteUchat(espacio));
  });
}

export async function devolverAlBot(conversacionId: string): Promise<Res> {
  return conAcceso(async (ctx) => {
    const { conv: c, espacio } = await exigirConversacion(ctx, conversacionId);
    if (!espacio.con_ia) throw new SinAcceso("Esta línea no tiene bot");
    await reanudarBot(clienteUchat(espacio), c.userNs);
    await db!.update(conv).set({ owner: "bot", botPausadoHasta: null }).where(eq(conv.id, c.id));
    await registrarEvento(ctx.tenantId, c.id, `${ctx.asesorNombre} devolvió el chat al bot`, ctx.asesorNombre);
  });
}

export async function asignarAsesor(conversacionId: string, asesorId: string | null): Promise<Res> {
  return conAcceso(async (ctx) => {
    soloAdmin(ctx);
    const { conv: c } = await exigirConversacion(ctx, conversacionId);
    let nombre = "nadie";
    if (asesorId) {
      const [a] = filas<{ nombre: string }>(await db!.execute(sql`select nombre from advisors where id = ${asesorId} and tenant_id = ${ctx.tenantId}`));
      if (!a) throw new SinAcceso("Asesor no encontrado");
      nombre = a.nombre;
    }
    await db!.update(conv).set({ asesorId, asignadoEn: asesorId ? new Date() : null }).where(eq(conv.id, c.id));
    await registrarEvento(ctx.tenantId, c.id, `${ctx.asesorNombre} asignó el chat a ${nombre}`, ctx.asesorNombre);
  });
}

export async function notaInterna(conversacionId: string, texto: string): Promise<Res> {
  return conAcceso(async (ctx) => {
    const t = String(texto || "").trim().slice(0, 2000);
    if (!t) throw new SinAcceso("La nota está vacía");
    const { conv: c } = await exigirConversacion(ctx, conversacionId);
    await db!.insert(msg).values({
      tenantId: ctx.tenantId, conversacionId: c.id, providerMsgId: `nota:${crypto.randomUUID()}`,
      direccion: "event", emisor: "nota", tipo: "event", texto: t, autor: ctx.asesorNombre,
    });
  });
}

export async function marcarLeido(conversacionId: string): Promise<Res> {
  return conAcceso(async (ctx) => {
    const { conv: c } = await exigirConversacion(ctx, conversacionId);
    if (c.sinLeer) await db!.update(conv).set({ sinLeer: 0 }).where(eq(conv.id, c.id));
  });
}

export async function plantillasDe(conversacionId: string): Promise<Res<Plantilla[]>> {
  return conAcceso(async (ctx) => {
    const { espacio } = await exigirConversacion(ctx, conversacionId);
    return leerPlantillas(await listarPlantillas(clienteUchat(espacio)));
  });
}

export async function enviarPlantilla(conversacionId: string, nombre: string, valores: string[]): Promise<Res> {
  return conAcceso(async (ctx) => {
    const { conv: c, espacio } = await exigirConversacion(ctx, conversacionId);
    const cli = clienteUchat(espacio);
    const p = leerPlantillas(await listarPlantillas(cli)).find((x) => x.nombre === nombre);
    if (!p) throw new SinAcceso("Plantilla no encontrada");
    if (p.noCompatible) throw new SinAcceso(p.noCompatible);
    const namespace = p.namespace || (process.env.UCHAT_WABA_NAMESPACE || "").trim();
    if (!namespace) throw new SinAcceso("Falta el namespace de la cuenta de WhatsApp");
    const vals = Array.from({ length: p.variables }, (_, i) => String(valores?.[i] ?? "").trim());
    if (vals.some((v) => !v)) throw new SinAcceso("Llena todas las variables de la plantilla");
    await enviarPlantillaUchat(cli, c.userNs, { namespace, nombre: p.nombre, idioma: p.idioma, valores: vals });
    let cuerpo = p.cuerpo;
    vals.forEach((v, i) => { cuerpo = cuerpo.replaceAll(`{{${i + 1}}}`, v); });
    await guardarSalida(ctx, c, "text", `📋 Plantilla «${p.nombre}»\n${cuerpo}`);
  });
}

/** Fuerza traer el hilo de UChat ya (botón «actualizar»). */
export async function refrescarHilo(conversacionId: string): Promise<Res> {
  return conAcceso(async (ctx) => {
    const { conv: c, espacio } = await exigirConversacion(ctx, conversacionId);
    await sincronizarConversacion(ctx.tenantId, espacio, c, { forzar: true });
  });
}

/* ---------- respuestas rápidas ---------- */

export async function guardarRespuestaRapida(atajo: string, texto: string): Promise<Res<{ id: string; atajo: string }>> {
  return conAcceso(async (ctx) => {
    soloAdmin(ctx);
    const a = String(atajo || "").trim().toLowerCase().replace(/^\//, "").replace(/[^a-z0-9_-]/g, "");
    const t = String(texto || "").trim();
    if (!a || a.length > 30) throw new SinAcceso("Atajo inválido (letras, números, - o _)");
    if (!t || t.length > 2000) throw new SinAcceso("Texto vacío o muy largo");
    const [fila] = await db!.insert(rr).values({ tenantId: ctx.tenantId, atajo: a, texto: t })
      .onConflictDoUpdate({ target: [rr.tenantId, rr.atajo], set: { texto: t } })
      .returning({ id: rr.id, atajo: rr.atajo });
    return fila;
  });
}

export async function borrarRespuestaRapida(id: string): Promise<Res> {
  return conAcceso(async (ctx) => {
    soloAdmin(ctx);
    await db!.delete(rr).where(and(eq(rr.id, id), eq(rr.tenantId, ctx.tenantId)));
  });
}

/* ---------- asesores (correo de login y reparto) ---------- */

export async function configurarAsesor(asesorId: string, email: string, recibeChats: boolean): Promise<Res> {
  return conAcceso(async (ctx) => {
    soloAdmin(ctx);
    const e = String(email || "").trim().toLowerCase();
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new SinAcceso("Correo inválido");
    await db!.execute(sql`update advisors set email = ${e}, recibe_chats = ${!!recibeChats} where id = ${asesorId} and tenant_id = ${ctx.tenantId}`);
    if (e) {
      // El login del asesor queda en su marca con rol 'asesor' (ve solo sus chats).
      // Nunca degrada a un admin existente.
      await db!.execute(sql`
        insert into tenant_users (tenant_id, email, rol) values (${ctx.tenantId}, ${e}, 'asesor')
        on conflict (email) do update set rol = 'asesor', tenant_id = excluded.tenant_id
        where tenant_users.rol <> 'admin'`);
    }
  });
}
