import { NextRequest, NextResponse } from "next/server";
import { mpGenerateApiKey, ensureMpAuth, mpCotizar } from "@/lib/mipaquete";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Diag temporal (gated): genera apikey real + cotiza desde producción.
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!process.env.BRIDGE_TOKEN || token !== process.env.BRIDGE_TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const gen = await mpGenerateApiKey();
  const auth = await ensureMpAuth();
  const cot = await mpCotizar({ originDane: "05001000", destinyDane: "11001000", weight: 1, declaredValue: 100000, paymentType: 102 });
  return NextResponse.json({
    generateApiKey: { ok: gen.ok, baseUrl: gen.baseUrl || null, tokenLen: gen.apikey?.length || 0, error: gen.error || null },
    auth: { hasKey: !!auth.apikey, baseUrl: auth.baseUrl },
    cotizacion: { source: cot.source, error: cot.error || null, primera: cot.cotizaciones[0] || null },
  });
}
