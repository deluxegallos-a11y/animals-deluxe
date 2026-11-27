import { NextRequest, NextResponse } from "next/server";
import { sql, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers } from "@/lib/db/schema";
import { uchatGetSubscriber, uchatConfigured } from "@/lib/uchat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Recupera el teléfono (y nombre) de los leads viejos sin número consultando UChat por su sub_id.
 *  Protegido con x-bridge-token. Procesa por lotes (?limit=, default 150). Fail-soft por cliente. */
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-bridge-token") || new URL(req.url).searchParams.get("token") || "";
  const expected = process.env.BRIDGE_TOKEN || "";
  if (expected && token !== expected) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!db) return NextResponse.json({ ok: false, error: "no_db" }, { status: 500 });
  if (!uchatConfigured()) return NextResponse.json({ ok: false, error: "falta UCHAT_API_TOKEN en las variables de entorno" }, { status: 400 });

  const limit = Math.min(400, Math.max(1, Number(new URL(req.url).searchParams.get("limit") || "150")));
  const leads = await db.select({ id: customers.id, sub: customers.uchatSubId, nombre: customers.nombre })
    .from(customers)
    .where(sql`coalesce(telefono,'') = '' and coalesce(uchat_sub_id,'') <> ''`)
    .limit(limit);

  let recuperados = 0, sinTel = 0, fallidos = 0;
  for (const l of leads) {
    try {
      const r = await uchatGetSubscriber(l.sub as string);
      if (!r.ok) { fallidos++; continue; }
      if (!r.telefono) { sinTel++; continue; }
      const set: Record<string, unknown> = { telefono: r.telefono };
      if (r.nombre && !l.nombre) set.nombre = r.nombre;
      await db.update(customers).set(set).where(eq(customers.id, l.id));
      recuperados++;
    } catch { fallidos++; }
  }

  const [pend] = await db.select({ n: sql<number>`count(*)::int` }).from(customers).where(sql`coalesce(telefono,'') = '' and coalesce(uchat_sub_id,'') <> ''`);
  return NextResponse.json({ ok: true, procesados: leads.length, recuperados, sinTelefonoEnUchat: sinTel, fallidos, faltanPorProcesar: pend?.n ?? 0 });
}

export async function GET() {
  return NextResponse.json({ ok: true, uso: "POST /api/admin/backfill-telefonos?limit=150 con header x-bridge-token; requiere UCHAT_API_TOKEN" });
}
