import { NextRequest, NextResponse } from "next/server";
import { mpLogin, ensureMpAuth, mpCotizar } from "@/lib/mipaquete";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Diagnóstico temporal (gated por BRIDGE_TOKEN): prueba login + cotización desde producción.
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!process.env.BRIDGE_TOKEN || token !== process.env.BRIDGE_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const login = await mpLogin();
  const key = await ensureMpAuth();
  const cot = await mpCotizar({ originDane: "05001000", destinyDane: "11001000", weight: 1, declaredValue: 100000, paymentType: 102 });
  return NextResponse.json({
    login: { ok: login.ok, error: login.error || null, tokenLen: login.apikey?.length || 0 },
    ensureAuth: { hasKey: !!key, keyLen: key.length },
    cotizacion: { source: cot.source, error: cot.error || null, primera: cot.cotizaciones[0] || null },
  });
}
