import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import { audit, logEvent } from "@/lib/ai/bridge";

export const runtime = "nodejs";

function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), obj);
}

/* Verifica la firma de eventos de Wompi (FAIL-CLOSED).
   checksum = SHA256( valores(properties) concatenados + timestamp + events_secret ). */
export async function POST(req: NextRequest) {
  const secret = process.env.WOMPI_EVENTS_SECRET || "";
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const signature = body.signature as { properties?: string[]; checksum?: string } | undefined;
  const data = (body.data as Record<string, unknown>) || {};
  const timestamp = body.timestamp ?? "";

  // Sin secreto o sin firma → NO confiamos (fail closed).
  if (!secret || !signature?.properties?.length || !signature.checksum) {
    await logEvent("wompi_webhook_rechazado", { motivo: "sin_firma_o_secreto" });
    return NextResponse.json({ ok: false, error: "signature_required" }, { status: 401 });
  }

  const concatenated = signature.properties.map((p) => String(getPath(data, p) ?? "")).join("") + String(timestamp) + secret;
  const computed = crypto.createHash("sha256").update(concatenated).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(String(signature.checksum).toLowerCase()))) {
    await logEvent("wompi_webhook_rechazado", { motivo: "checksum_invalido" });
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  const tx = (data.transaction as Record<string, unknown>) || {};
  const status = String(tx.status || "");
  const reference = String(tx.reference || "");

  if (status === "APPROVED" && reference && db) {
    const [o] = await db.select().from(orders).where(eq(orders.ref, reference.toUpperCase())).limit(1);
    if (o && o.estado !== "pagado") {
      await db.update(orders).set({ estado: "pagado", metodoPago: "anticipado" }).where(eq(orders.id, o.id));
      await audit("pago_aprobado", "orders", { ref: reference, tx: tx.id });
    }
  }
  await logEvent("wompi_webhook", { status, reference });
  return NextResponse.json({ ok: true });
}
