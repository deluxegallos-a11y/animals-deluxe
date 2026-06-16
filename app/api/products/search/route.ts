import type { NextRequest } from "next/server";
import { getProducts } from "@/lib/ai/data";
import { searchProducts } from "@/lib/ai/search";
import { publicProduct, suggestion, emptyProduct } from "@/lib/ai/present";
import { jsonCors, preflight } from "@/lib/http";
import { safeEqual } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

/* GET /api/products/search?q=...  ·  header x-api-key (opcional, exigido si BOT_API_KEY está set).
   Contrato del bot (bot_uchat/01_EXTERNAL_REQUEST.md): { ok, status, match, product, suggestions }. */
export async function GET(req: NextRequest) {
  const expected = process.env.BOT_API_KEY || "";
  if (expected) {
    const key = req.headers.get("x-api-key") || "";
    if (!safeEqual(key, expected)) return jsonCors({ ok: false, error: "unauthorized" }, 401);
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const catalog = await getProducts();
  const r = searchProducts(q, catalog);

  const suggestions = r.ranked
    .filter((x) => x.product.slug !== r.product?.slug)
    .slice(0, 3)
    .map((x) => suggestion(x.product));

  return jsonCors({
    ok: true,
    status: r.status,
    match: r.product?.slug || "",
    product: r.product ? publicProduct(r.product) : emptyProduct(),
    suggestions: suggestions.length ? suggestions : catalog.slice(0, 3).map(suggestion),
  });
}
