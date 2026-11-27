import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { uchatSendTemplate } from "@/lib/uchat";
import {
  cifras, diaAnterior, diaCO, generarReporte, guardarReporte, leerReporte,
  parametrosPlantilla, textoReporte, type Reporte,
} from "@/lib/reporte/diario";

export const runtime = "nodejs";
export const maxDuration = 300;

/* GET /api/cron/reporte-diario — corre 00:15 hora Colombia (Vercel Cron) y
   reporta el día que acaba de terminar: chats, pedidos, ventas, conversión,
   errores del bot (revisados con OpenAI) y por qué no compraron, comparado
   con el día anterior. Lo manda por plantilla de WhatsApp al número de control.
   Parámetros (pruebas): ?dia=YYYY-MM-DD  ?enviar=0  ?limite=N  ?detalle=1
   Authorization: Bearer <CRON_SECRET>. */
export async function GET(req: NextRequest) {
  const secreto = (process.env.CRON_SECRET || "").trim();
  const auth = req.headers.get("authorization") || "";
  if (!secreto || !safeEqual(auth, `Bearer ${secreto}`)) return NextResponse.json({ ok: false }, { status: 401 });

  const q = req.nextUrl.searchParams;
  const tenant = q.get("tenant") || "animals-deluxe";
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(q.get("dia") || "") ? q.get("dia")! : diaCO(-1);
  const enviar = q.get("enviar") !== "0";
  const limite = Number(q.get("limite") || 0) || undefined;

  const hoy = await generarReporte(tenant, dia, { limite });

  // Día anterior: el reporte guardado; si no existe, al menos las cifras de la base.
  const diaPrevio = diaAnterior(dia);
  let ayer: Reporte | null = await leerReporte(tenant, diaPrevio);
  if (!ayer) {
    const c = await cifras(tenant, diaPrevio).catch(() => null);
    if (c) ayer = { tenant, dia: diaPrevio, chats: c.chats, pedidos: c.pedidos, ventas_cop: c.ventas_cop, conversion: c.chats ? c.pedidos / c.chats : 0, chats_revisados: 0, chats_con_error: 0, errores: {}, motivos: {}, ejemplos_error: [], pedidos_no_creados: c.pedidos_no_creados, generado_at: "" };
  }

  const params = parametrosPlantilla(hoy, ayer);
  let envio: { ok: boolean; error?: string } = { ok: false, error: "no_enviado" };
  if (enviar) {
    envio = await uchatSendTemplate(process.env.REPORTE_USER_NS || "f280503u1014074893", {
      name: process.env.REPORTE_TEMPLATE || "reporte_diario_bot",
      lang: "es",
      namespace: process.env.REPORTE_TEMPLATE_NS || "d6106b57_0722_464c_9b39_ab117ec8f72c",
      bodyParams: params,
    });
  }
  if (!limite) await guardarReporte({ ...hoy, envio: { ...envio, at: new Date().toISOString() } } as Reporte);

  const { revisados, ...resumen } = hoy;
  return NextResponse.json({
    ok: true,
    texto: textoReporte(hoy, ayer),
    envio,
    reporte: resumen,
    ...(q.get("detalle") === "1" ? { revisados } : {}),
  });
}
