import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers, orders } from "@/lib/db/schema";
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
    let pedidos: { ref: string; estado: string | null; totalCop: number | null; createdAt: Date | null; guia: string | null; transportadora: string | null }[] = [];
    if (db && fresca.customerId) {
      [cliente] = await db.select().from(customers)
        .where(and(eq(customers.id, fresca.customerId), eq(customers.tenantId, ctx.tenantId))).limit(1);
      pedidos = await db.select({
        ref: orders.ref, estado: orders.estado, totalCop: orders.totalCop, createdAt: orders.createdAt,
        guia: orders.guia, transportadora: orders.transportadora,
      }).from(orders)
        .where(and(eq(orders.customerId, fresca.customerId), eq(orders.tenantId, ctx.tenantId)))
        .orderBy(desc(orders.createdAt)).limit(5);
    }
    return NextResponse.json({ ok: true, conversacion: fresca, espacio, mensajes, cliente, pedidos, error });
  } catch (e) {
    if (e instanceof SinAcceso) return NextResponse.json({ ok: false, error: e.message }, { status: 403 });
    console.error("[livechat/hilo]", e);
    return NextResponse.json({ ok: false, error: "No se pudo leer el chat" }, { status: 500 });
  }
}
