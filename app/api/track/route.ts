import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { visits } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Deriva la fuente de tráfico a partir del path. */
function fuenteDe(path: string): string {
  const p = (path || "").toLowerCase();
  if (p.startsWith("/gallos")) return "gallos";
  if (p.startsWith("/perros")) return "perros";
  if (p.startsWith("/caballos")) return "caballos";
  if (p === "/" || p.startsWith("/producto")) return "tienda";
  return "otro";
}

const str = (x: unknown, max = 300) => (x == null ? "" : String(x)).slice(0, max);

export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({}));
    const path = str(b.path, 200);
    // No registramos el panel admin
    if (/^\/(dashboard|pedidos|clientes|productos|anuncios|promociones|asesores|conversaciones|configuracion|resenas|login)/.test(path)) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    if (db) {
      await db.insert(visits).values({
        path, fuente: fuenteDe(path),
        referrer: str(b.referrer, 300), utmSource: str(b.utm_source, 120), utmCampaign: str(b.utm_campaign, 120),
        sessionId: str(b.session_id, 60),
      });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
