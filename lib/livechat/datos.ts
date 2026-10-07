/* ===========================================================
   Live Chat · quién está mirando y qué puede ver (servidor).
   - admin  (tenant_users.rol ≠ 'asesor', o email sin mapear → tenant por
     defecto, igual que el resto del panel): ve todas las líneas y reasigna.
   - asesor (tenant_users.rol = 'asesor' + advisors.email igual): ve SOLO sus
     chats de las líneas sin IA. El filtro vive aquí, nunca solo en el cliente.
   tenants.livechat y advisors.email se leen con SQL (ver nota en schema.ts).
   =========================================================== */
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { livechatConversaciones as conv, livechatMensajes as msg, tenantUsers } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getPanelTenantId } from "@/lib/tenant-panel";
import { leerConfig, type Espacio, type LivechatConfig } from "./puro";

export type Contexto = {
  tenantId: string;
  email: string;
  rol: "admin" | "asesor";
  asesorId: string | null;
  asesorNombre: string;
  config: LivechatConfig;
};

export class SinAcceso extends Error {}

function filas<T>(r: unknown): T[] {
  return (Array.isArray(r) ? r : ((r as { rows?: unknown[] })?.rows ?? [])) as T[];
}

export async function configDeTenant(tenantId: string): Promise<LivechatConfig> {
  if (!db) return leerConfig(null);
  const r = filas<{ livechat: unknown }>(await db.execute(sql`select livechat from tenants where id = ${tenantId}`));
  return leerConfig(r[0]?.livechat);
}

/** Contexto del usuario logueado. Lanza SinAcceso si no hay sesión o Live Chat. */
export async function contexto(): Promise<Contexto> {
  if (!db) throw new SinAcceso("Sin base de datos (modo demo)");
  const user = await getCurrentUser();
  const email = (user?.email || "").toLowerCase().trim();
  if (!user) throw new SinAcceso("Inicia sesión");
  const tenantId = await getPanelTenantId();
  if (!tenantId) throw new SinAcceso("Sin tenant");
  const [tu] = email ? await db.select({ rol: tenantUsers.rol }).from(tenantUsers).where(eq(tenantUsers.email, email)).limit(1) : [];
  const config = await configDeTenant(tenantId);
  if (tu?.rol === "asesor") {
    const a = filas<{ id: string; nombre: string }>(await db.execute(
      sql`select id, nombre from advisors where tenant_id = ${tenantId} and lower(email) = ${email} limit 1`,
    ))[0];
    if (!a) throw new SinAcceso("Tu correo no está enlazado a un asesor (Asesores → correo)");
    return { tenantId, email, rol: "asesor", asesorId: a.id, asesorNombre: a.nombre, config };
  }
  return { tenantId, email, rol: "admin", asesorId: null, asesorNombre: (user.email || "").split("@")[0], config };
}

/** Espacios que este usuario puede abrir. */
export function espaciosVisibles(ctx: Contexto): Espacio[] {
  return ctx.rol === "admin" ? ctx.config.espacios : ctx.config.espacios.filter((e) => !e.con_ia);
}

function filtroAcceso(ctx: Contexto): SQL {
  const base = eq(conv.tenantId, ctx.tenantId);
  if (ctx.rol === "admin") return base;
  const espacios = espaciosVisibles(ctx).map((e) => e.codigo);
  if (!espacios.length || !ctx.asesorId) return sql`false`;
  return and(base, eq(conv.asesorId, ctx.asesorId), inArray(conv.espacio, espacios))!;
}

export type FiltroBandeja = "todos" | "sin_leer" | "humano" | "mios" | "sin_asignar";

export async function leerBandeja(ctx: Contexto, espacio: string, filtro: FiltroBandeja = "todos", q = "", limite = 80) {
  if (!db) return [];
  if (!espaciosVisibles(ctx).some((e) => e.codigo === espacio)) return [];
  const conds: SQL[] = [filtroAcceso(ctx), eq(conv.espacio, espacio)];
  if (filtro === "sin_leer") conds.push(sql`${conv.sinLeer} > 0`);
  if (filtro === "humano") conds.push(sql`${conv.owner} = 'humano' and coalesce(${conv.botPausadoHasta}, now()) >= now()`);
  if (filtro === "mios" && ctx.asesorId) conds.push(eq(conv.asesorId, ctx.asesorId));
  if (filtro === "sin_asignar") conds.push(sql`${conv.asesorId} is null`);
  const t = q.trim();
  if (t) {
    const like = `%${t.replace(/[%_]/g, "")}%`;
    conds.push(or(ilike(conv.nombre, like), ilike(conv.telefono, like), ilike(conv.ultimoTexto, like))!);
  }
  return db
    .select()
    .from(conv)
    .where(and(...conds))
    .orderBy(sql`${conv.ultimoAt} desc nulls last`)
    .limit(limite);
}

/** La conversación si este usuario puede verla; si no, lanza. */
export async function exigirConversacion(ctx: Contexto, id: string) {
  if (!db) throw new SinAcceso("Sin base de datos");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new SinAcceso("Conversación inválida");
  const [c] = await db.select().from(conv).where(and(eq(conv.id, id), filtroAcceso(ctx))).limit(1);
  if (!c) throw new SinAcceso("No tienes acceso a esta conversación");
  const espacio = ctx.config.espacios.find((e) => e.codigo === c.espacio);
  if (!espacio) throw new SinAcceso("El espacio de esta conversación ya no está configurado");
  return { conv: c, espacio };
}

export async function leerHilo(conversacionId: string, limite = 300) {
  if (!db) return [];
  const r = await db
    .select()
    .from(msg)
    .where(eq(msg.conversacionId, conversacionId))
    .orderBy(desc(msg.providerTs))
    .limit(limite);
  return r.reverse();
}

export async function asesoresDelTenant(tenantId: string) {
  if (!db) return [];
  return filas<{ id: string; nombre: string; email: string; activo: boolean; recibe_chats: boolean }>(await db.execute(
    sql`select id, nombre, coalesce(email,'') email, coalesce(activo,true) activo, coalesce(recibe_chats,true) recibe_chats
          from advisors where tenant_id = ${tenantId} order by nombre`,
  ));
}

export { filas };
