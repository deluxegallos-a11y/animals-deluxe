import type { NextRequest } from "next/server";
import { getProductBySlug } from "@/lib/ai/data";
import { publicProduct } from "@/lib/ai/present";
import { jsonCors, preflight } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return jsonCors({ ok: false, error: "not_found" }, 404);
  return jsonCors({ ok: true, product: publicProduct(p) });
}
