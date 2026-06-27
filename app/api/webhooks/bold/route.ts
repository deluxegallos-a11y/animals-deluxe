import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { orders, customers } from "@/lib/db/schema";
import { audit, logEvent } from "@/lib/ai/bridge";
import { verifyBoldSignature } from "@/lib/bold";
import { uchatSendText } from "@/lib/uchat";
import { cop } from "@/lib/ai/format";

export const runtime = "nodejs";

/* Webhook de Bold (CloudEvents). Verifica firma x-bold-signature (FAIL-CLOSED),
   marca el pedido como pagado y avisa al cliente en UChat. */
export async function POST(req: NextRequest) {
  // 1) cuerpo CRUDO (la firma se calcula sobre el body exacto recibido)
  const raw = await req.text();
  const signature = req.headers.get("x-bold-signature") || "";

  if (!verifyBoldSignature(raw, signature)) {
    await logEvent("bold_webhook_rechazado", { motivo: "firma_invalida" });
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const type = String(body.type || "");
  const data = (body.data as Record<string, unknown>) || {};
  const metadata = (data.metadata as Record<string, unknown>) || {};
  const reference = String(metadata.reference || "").toUpperCase().trim();
  const paymentId = String(data.payment_id || body.subject || "");

  await logEvent("bold_webhook", { type, reference, payment_id: paymentId });

  // Solo nos interesa el pago aprobado con referencia mapeable a un pedido.
  if (type !== "SALE_APPROVED" || !reference || !db) {
    return NextResponse.json({ ok: true });
  }

  const [o] = await db.select().from(orders).where(eq(orders.ref, reference)).limit(1);
  if (!o) {
    await logEvent("bold_webhook_sin_pedido", { reference });
    return NextResponse.json({ ok: true });
  }

  // Idempotente: si ya estaba pagado, no repetimos el aviso.
  if (o.estado === "pagado") {
    return NextResponse.json({ ok: true });
  }

  await db
    .update(orders)
    .set({ estado: "pagado", metodoPago: "anticipado" })
    .where(eq(orders.id, o.id));
  await audit("pago_aprobado", "orders", { ref: reference, bold_payment_id: paymentId });

  // Avisar al cliente en UChat (best-effort).
  if (o.customerId) {
    const [c] = await db.select().from(customers).where(eq(customers.id, o.customerId)).limit(1);
    const subId = c?.uchatSubId || "";
    if (subId) {
      const nombre = (c?.nombre || o.nombre || "").split(" ")[0] || "";
      const saludo = nombre ? `¡Hola ${nombre}!` : "¡Hola!";
      const msg = `${saludo} 🎉 Recibimos tu pago de ${cop(o.totalCop ?? 0)} (pedido ${reference}). Tu pedido entra a despacho 🚚🐓`;
      const sent = await uchatSendText(subId, msg);
      await logEvent("bold_aviso_uchat", { reference, ok: sent.ok, error: sent.error, skipped: sent.skipped });
    }
  }

  return NextResponse.json({ ok: true });
}
