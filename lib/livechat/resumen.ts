/* ===========================================================
   Resumen de WhatsApp — UNA sola fuente para el dashboard y el Live Chat.
   Antes cada pantalla contaba distinto (el dashboard: pedidos del día con canal
   WhatsApp; el Live Chat: chats sincronizados con etiqueta), y los números no
   cuadraban. Definiciones:
   - chats:        conversaciones donde el CLIENTE escribió dentro del rango.
   - pedidos/ventas: pedidos NO cancelados del rango con canal WhatsApp — la
                   misma consulta que «Ventas por WhatsApp» del dashboard.
   - sinResponder: chats cuyo último mensaje del cliente no tiene respuesta (ahora).
   - pidenAsesor:  chats que el bot marcó «ASESOR HUMANO» y nadie ha tomado (ahora).
   =========================================================== */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

export type ResumenWhatsapp = { chats: number; pedidos: number; ventasCop: number; sinResponder: number; pidenAsesor: number };

const VACIO: ResumenWhatsapp = { chats: 0, pedidos: 0, ventasCop: 0, sinResponder: 0, pidenAsesor: 0 };

function filas<T>(r: unknown): T[] {
  return (Array.isArray(r) ? r : ((r as { rows?: unknown[] })?.rows ?? [])) as T[];
}

export async function resumenWhatsapp(tenantId: string, desde: Date, hasta: Date): Promise<ResumenWhatsapp> {
  if (!db || !tenantId) return VACIO;
  const d = desde.toISOString();
  const h = hasta.toISOString();
  const [p] = filas<{ n: number; s: number }>(await db.execute(sql`
    select count(*)::int n, coalesce(sum(total_cop),0)::int s from orders
     where tenant_id = ${tenantId} and created_at >= ${d}::timestamptz and created_at < ${h}::timestamptz
       and coalesce(estado,'') <> 'cancelado' and coalesce(nullif(canal,''),'whatsapp') = 'whatsapp'`));
  // La tabla del Live Chat puede no existir en un entorno sin la migración 06: no romper el dashboard.
  const c = await db.execute(sql`
    select count(*) filter (where ultimo_cliente_at >= ${d}::timestamptz and ultimo_cliente_at < ${h}::timestamptz)::int chats,
           count(*) filter (where sin_leer > 0)::int sin_responder,
           count(*) filter (where etiquetas::text ilike '%asesor humano%'
                              and not (owner = 'humano' and coalesce(bot_pausado_hasta, now()) >= now()))::int piden_asesor
      from livechat_conversaciones where tenant_id = ${tenantId}`).then(
    (r) => filas<{ chats: number; sin_responder: number; piden_asesor: number }>(r)[0],
    () => undefined,
  );
  return {
    chats: c?.chats ?? 0,
    pedidos: p?.n ?? 0,
    ventasCop: p?.s ?? 0,
    sinResponder: c?.sin_responder ?? 0,
    pidenAsesor: c?.piden_asesor ?? 0,
  };
}
