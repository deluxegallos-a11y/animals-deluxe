import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { and, eq, ne, asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers, conversations, messages } from "@/lib/db/schema";
import { logEvent } from "@/lib/ai/bridge";
import { safeEqual } from "@/lib/crypto";

export const runtime = "nodejs";

/* Eventos: message.received / conversation.assigned / subscriber.tagged.
   Verifica token (?token= o x-webhook-token contra UCHAT_WEBHOOK_TOKEN). */
export async function POST(req: NextRequest) {
  const expected = process.env.UCHAT_WEBHOOK_TOKEN || "";
  if (expected) {
    const token = req.nextUrl.searchParams.get("token") || req.headers.get("x-webhook-token") || "";
    if (!safeEqual(token, expected)) return NextResponse.json({ ok: false }, { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const evento = String((payload.event || payload.type || "")).toLowerCase();
  const subId = String((payload.sub_id || payload.subscriber_id || (payload.subscriber as Record<string, unknown>)?.id || ""));
  const texto = String((payload.text || payload.message || (payload.last_message as Record<string, unknown>)?.text || ""));

  await logEvent("uchat_webhook", { evento, subId });

  if (db && subId) {
    const [cust] = await db.select().from(customers).where(eq(customers.uchatSubId, subId)).limit(1);
    if (cust) {
      let [conv] = await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.customerId, cust.id), ne(conversations.estado, "cerrada")))
        .orderBy(asc(conversations.createdAt))
        .limit(1);
      if (!conv) {
        [conv] = await db.insert(conversations).values({ customerId: cust.id, estado: "activa" }).returning();
      } else {
        await db.update(conversations).set({ ultimoMensajeAt: new Date() }).where(eq(conversations.id, conv.id));
      }
      if (conv && texto && evento.includes("message")) {
        await db.insert(messages).values({ conversationId: conv.id, rol: "cliente", texto, meta: payload });
      }
    }
  }

  // 200 rápido (UChat exige < 200ms)
  return NextResponse.json({ ok: true });
}
