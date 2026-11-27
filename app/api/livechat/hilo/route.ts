import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers, orderItems, orders } from "@/lib/db/schema";
import { contexto, exigirConversacion, leerHilo, SinAcceso } from "@/lib/livechat/datos";
import { sincronizarConversacion } from "@/lib/livechat/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* GET /api/livechat/hilo?id=<conversacion>[&sync=0]
   Mensajes del chat + ficha del cliente (CRM y pedidos). Trae lo nuevo de UChat
   respetando el límite por chat (bot 3 s, sin IA 30 s). */
export async function GET(req: NextRequest) {
  try {
    const ctx = await contexto();
    const id = req.nextUrl.searchParams.get("id") || "";
    const { conv, espacio } = await exigirConversacion(ctx, id);
    let error = "";
    if (req.nextUrl.searchParams.get("sync") !== "0") {
      await sincronizarConversacion(ctx.tenantId, espacio, conv).catch((e) => { error = e instanceof Error ? e.message : "error"; });
    }
    const { conv: fresca } = await exigirConversacion(ctx, id);
    const mensajes = await leerHilo(id);

    let cliente = null;
    if (db && fresca.customerId) {
      [cliente] = await db.select().from(customers)
        .where(and(eq(customers.id, fresca.customerId), eq(customers.tenantId, ctx.tenantId))).limit(1);
    }
    // Pedidos del cliente del CRM o del mismo teléfono (últimos 10 dígitos).
    const tel10 = fresca.telefono.slice(-10);
    const pedidos = db && (fresca.customerId || tel10.length === 10)
      ? await db.select({
          id: orders.id, ref: orders.ref, estado: orders.estado, totalCop: orders.totalCop, createdAt: orders.createdAt,
          guia: orders.guia, transportadora: orders.transportadora, ciudad: orders.ciudad, direccion: orders.direccion,
          paymentType: orders.paymentType,
        }).from(orders)
          .where(and(eq(orders.tenantId, ctx.tenantId), or(
            fresca.customerId ? eq(orders.customerId, fresca.customerId) : sql`false`,
            tel10.length === 10 ? sql`right(regexp_replace(coalesce(${orders.telefono}, ''), '[^0-9]', '', 'g'), 10) = ${tel10}` : sql`false`,
          )))
          .orderBy(desc(orders.createdAt)).limit(6)
      : [];
    const items = db && pedidos.length
      ? await db.select({ orderId: orderItems.orderId, nombre: orderItems.productName, presentacion: orderItems.presentacionLabel, cantidad: orderItems.cantidad })
          .from(orderItems).where(and(eq(orderItems.tenantId, ctx.tenantId), inArray(orderItems.orderId, pedidos.map((p) => p.id))))
      : [];
    const pedidosConItems = pedidos.map((p) => ({
      ...p,
      items: items.filter((i) => i.orderId === p.id).map((i) => `${i.cantidad && i.cantidad > 1 ? `${i.cantidad}× ` : ""}${i.nombre}${i.presentacion ? ` (${i.presentacion})` : ""}`),
    }));
    return NextResponse.json({ ok: true, conversacion: fresca, espacio, mensajes, cliente, pedidos: pedidosConItems, error });
  } catch (e) {
    if (e instanceof SinAcceso) return NextResponse.json({ ok: false, error: e.message }, { status: 403 });
    console.error("[livechat/hilo]", e);
    return NextResponse.json({ ok: false, error: "No se pudo leer el chat" }, { status: 500 });
  }
}
