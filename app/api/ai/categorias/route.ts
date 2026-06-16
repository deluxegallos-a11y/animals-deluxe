import { z } from "zod";
import { withBridge } from "@/lib/ai/bridge";
import { getCategories } from "@/lib/ai/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withBridge(z.object({}), async () => {
  const cats = await getCategories();
  const categorias = cats.map((c) => ({ id: c.id, slug: c.slug, name: c.name, color: c.color }));
  const mensaje =
    `Manejamos: ${cats.map((c) => c.name).join(", ")} 🐓. ` +
    `¿Para qué animal es y qué necesitas?`;
  return { categorias, mensaje };
});
