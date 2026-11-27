import type { NextRequest } from "next/server";
import { NextResponse, after } from "next/server";
import { contadores, contexto, espaciosVisibles, FILTROS, leerBandeja, SinAcceso, type FiltroBandeja } from "@/lib/livechat/datos";
import { sincronizarEspacio } from "@/lib/livechat/sync";
import { resumenWhatsapp } from "@/lib/livechat/resumen";
import { rangoFechas } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* GET /api/livechat/bandeja?espacio=bot&filtro=todos&q=
   Sesión del panel obligatoria (/api es público en el middleware: se valida aquí).
   Antes de leer, sincroniza el espacio con UChat respetando el límite por
   espacio (el claim en livechat_sync lo hace valer entre instancias). */

export async function GET(req: NextRequest) {
  try {
    const ctx = await contexto();
    const visibles = espaciosVisibles(ctx);
    const sp = req.nextUrl.searchParams;
    const espacio = visibles.find((e) => e.codigo === sp.get("espacio")) ?? visibles[0];
    if (!espacio) return NextResponse.json({ ok: true, conversaciones: [], error: "" });
    const filtro = (FILTROS as string[]).includes(sp.get("filtro") || "") ? (sp.get("filtro") as FiltroBandeja) : "todos";
    const sync = sp.get("sync") === "0" ? null : await sincronizarEspacio(ctx.tenantId, espacio, {
      forzar: sp.get("forzar") === "1",
      alFondo: (trabajo) => after(trabajo),
    });
    const hoy = rangoFechas("hoy");
    const [conversaciones, conteo, resumen] = await Promise.all([
      leerBandeja(ctx, espacio.codigo, filtro, (sp.get("q") || "").slice(0, 80)),
      contadores(ctx, espacio.codigo),
      // Mismos números que el dashboard (rango «Hoy»).
      ctx.rol === "admin" ? resumenWhatsapp(ctx.tenantId, hoy.from, hoy.to) : Promise.resolve(null),
    ]);
    return NextResponse.json({
      ok: true,
      espacio: espacio.codigo,
      conversaciones,
      contadores: conteo,
      resumen,
      error: sync && !sync.ok ? (sync as { motivo?: string }).motivo || "" : "",
    });
  } catch (e) {
    if (e instanceof SinAcceso) return NextResponse.json({ ok: false, error: e.message }, { status: 403 });
    console.error("[livechat/bandeja]", e);
    return NextResponse.json({ ok: false, error: "No se pudo leer la bandeja" }, { status: 500 });
  }
}
