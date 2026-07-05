import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { mpShipments, mpTrackingEvents } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Webhook de MiPaquete: recibe estados (urlForStates) y guías+PDF (urlForGuides).
 *  Actualiza mp_shipments por mpCode y registra el tracking. Fail-soft. */
export async function POST(req: NextRequest) {
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const mpCode = String(b.code ?? b.mpCode ?? "");
    if (!db || !mpCode) return NextResponse.json({ ok: true });

    const guideNumber = String(b.guideNumber ?? "");
    const pdf = String((Array.isArray(b.pdfGuide) ? (b.pdfGuide as string[])[0] : b.pdfGuide) ?? "");
    const state = String(b.state ?? b.updateState ?? "");

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (guideNumber) set.guideNumber = guideNumber;
    if (pdf) { set.pdfGuideUrl = pdf; set.status = "guia_generada"; }
    if (state) set.status = /entrega/i.test(state) ? "entregado" : /cancel/i.test(state) ? "cancelado" : /novedad/i.test(state) ? "novedad" : "despachado";

    const [ship] = await db.select({ id: mpShipments.id }).from(mpShipments).where(eq(mpShipments.mpCode, mpCode)).limit(1);
    if (ship) {
      await db.update(mpShipments).set(set).where(eq(mpShipments.id, ship.id));
      if (state) await db.insert(mpTrackingEvents).values({ shipmentId: ship.id, mpCode, state, eventDate: new Date(), rawPayload: b as object });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "mp-webhook" });
}
