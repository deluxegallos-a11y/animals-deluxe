import { z } from "zod";
import { withBridge } from "@/lib/ai/bridge";
import { getProducts } from "@/lib/ai/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withBridge(
  z.object({ categoria: z.string().optional().default("") }),
  async ({ body }) => {
    const list = await getProducts({ categorySlug: body.categoria || undefined });
    const productos = list.map((p) => ({
      slug: p.slug, name: p.name, priceCOP: p.priceCOP, categoria: p.categorySlug,
    }));
    const mensaje = productos.length
      ? `Tenemos ${productos.length} productos${body.categoria ? ` en ${body.categoria}` : ""} 🐓. Dime para qué animal o qué necesitas y te recomiendo el mejor.`
      : "Por ahora no tengo productos en esa categoría, pero cuéntame qué buscas y te ayudo. 😊";
    return { productos, mensaje };
  },
);
