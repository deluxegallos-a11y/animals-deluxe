import { getCategories } from "@/lib/ai/data";
import { jsonCors, preflight } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function GET() {
  const cats = await getCategories();
  return jsonCors({ ok: true, categories: cats });
}
