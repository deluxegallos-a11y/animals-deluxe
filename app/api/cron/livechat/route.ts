import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { safeEqual } from "@/lib/crypto";
import { filas } from "@/lib/livechat/datos";
import { sincronizarTenant } from "@/lib/livechat/sync";

export const runtime = "nodejs";
export const maxDuration = 120;

/* GET /api/cron/livechat — respaldo: sincroniza todas las marcas con Live Chat
   activo aunque nadie tenga el panel abierto. Vercel Cron manda
   Authorization: Bearer <CRON_SECRET>. */
export async function GET(req: NextRequest) {
  const secreto = (process.env.CRON_SECRET || "").trim();
  const auth = req.headers.get("authorization") || "";
  if (!secreto || !safeEqual(auth, `Bearer ${secreto}`)) return NextResponse.json({ ok: false }, { status: 401 });
  if (!db) return NextResponse.json({ ok: false, error: "sin_db" });
  const tenants = filas<{ id: string; slug: string }>(await db.execute(
    sql`select id, slug from tenants where activo and coalesce((livechat->>'activo')::boolean, false)`,
  ));
  const resultado: Record<string, unknown> = {};
  for (const t of tenants) resultado[t.slug] = await sincronizarTenant(t.id).catch((e) => ({ error: e instanceof Error ? e.message : "error" }));
  return NextResponse.json({ ok: true, resultado });
}
