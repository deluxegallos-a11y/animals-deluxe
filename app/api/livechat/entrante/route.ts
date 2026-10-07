import type { NextRequest } from "next/server";
import { NextResponse, after } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { safeEqual } from "@/lib/crypto";
import { filas } from "@/lib/livechat/datos";
import { espacioPorFlow, leerConfig } from "@/lib/livechat/puro";
import { ingresarPorUserNs } from "@/lib/livechat/sync";

export const runtime = "nodejs";

/* POST /api/livechat/entrante — entrada INSTANTÁNEA de la línea de asesores.
   La llama un External Request del subflujo de entrada de UChat en cada mensaje:
     header  x-livechat-secreto: <LIVECHAT_ENTRANTE_SECRETO>
     body    {"user_ns":"{{user_ns}}","flow_ns":"fNNNNNN"}
   Responde SIEMPRE 200 {ok:true} rápido (aunque el secreto esté mal) para que
   UChat no reintente ni corte el flujo; el trabajo corre después (after). */
const recientes = new Map<string, number>();

export async function POST(req: NextRequest) {
  const esperado = (process.env.LIVECHAT_ENTRANTE_SECRETO || "").trim();
  const llega = req.headers.get("x-livechat-secreto") || "";
  if (!esperado || !safeEqual(llega, esperado)) return NextResponse.json({ ok: true });

  let cuerpo: Record<string, unknown> = {};
  try {
    const txt = await req.text();
    cuerpo = txt ? JSON.parse(txt) : {};
  } catch { /* lectura tolerante */ }
  const userNs = String(cuerpo.user_ns || "").trim();
  const flowNs = String(cuerpo.flow_ns || userNs.split("u")[0] || "").trim();
  if (!/^f\d+u\d+$/.test(userNs) || !db) return NextResponse.json({ ok: true });

  // Junta llamadas repetidas del mismo chat en 2 s (misma instancia).
  const ahora = Date.now();
  if ((recientes.get(userNs) || 0) > ahora - 2000) return NextResponse.json({ ok: true });
  recientes.set(userNs, ahora);
  if (recientes.size > 500) for (const [k, t] of recientes) if (t < ahora - 10_000) recientes.delete(k);

  after(async () => {
    try {
      const tenants = filas<{ id: string; livechat: unknown }>(await db!.execute(
        sql`select id, livechat from tenants where activo and livechat->'espacios' @> ${JSON.stringify([{ flow_ns: flowNs }])}::jsonb`,
      ));
      for (const t of tenants) {
        const e = espacioPorFlow(leerConfig(t.livechat), flowNs);
        if (e) await ingresarPorUserNs(t.id, e, userNs);
      }
    } catch (err) {
      console.error("[livechat/entrante]", err instanceof Error ? err.message : err);
    }
  });
  return NextResponse.json({ ok: true });
}
