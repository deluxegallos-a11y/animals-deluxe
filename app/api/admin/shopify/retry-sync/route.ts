/* ===========================================================
   Reintento de sincronía Plataforma → Shopify.
   POST: re-sincroniza todos los productos en estado pending/error.
   Protegido: requiere sesión del panel (Supabase). Útil como job
   manual o llamado desde un cron externo con cookie de servicio.
   =========================================================== */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { retryPendingProducts } from "@/lib/shopify-sync";
import { shopifyConfigured } from "@/lib/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  if (!(await shopifyConfigured())) {
    return NextResponse.json({ ok: false, error: "shopify_no_configurado" }, { status: 400 });
  }

  const result = await retryPendingProducts();
  // result.ok = nº de productos sincronizados con éxito.
  return NextResponse.json({ success: true, ...result });
}
