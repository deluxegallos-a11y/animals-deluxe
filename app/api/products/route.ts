import type { NextRequest } from "next/server";
import { getProducts } from "@/lib/ai/data";
import { publicProduct } from "@/lib/ai/present";
import { jsonCors, preflight } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || undefined;
  const limit = Number(searchParams.get("limit")) || undefined;
  const list = await getProducts({ categorySlug: category, limit });
  return jsonCors({ ok: true, count: list.length, products: list.map(publicProduct) });
}
