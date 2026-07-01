import { z } from "zod";
import { withBridge, logEvent } from "@/lib/ai/bridge";
import { getProducts } from "@/lib/ai/data";
import { searchProducts, animalOf } from "@/lib/ai/search";
import { buildContexto, richMensaje } from "@/lib/ai/present";
import { cop } from "@/lib/ai/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withBridge(
  z.object({ necesidad: z.string().min(1) }),
  async ({ body }) => {
    const catalog = await getProducts();
    const r = searchProducts(body.necesidad, catalog);
    // Nunca mezclar animales: las recomendaciones comparten el animal del mejor match.
    const firstAnimal = r.ranked[0] ? animalOf(r.ranked[0].product) : null;
    const top = r.ranked
      .filter((x) => !firstAnimal || animalOf(x.product) === firstAnimal)
      .slice(0, 3)
      .map((x) => x.product);

    await logEvent("recomendacion", { necesidad: body.necesidad, productos: top.map((p) => p.slug) });

    const productos = top.map((p) => ({
      slug: p.slug, name: p.name, priceCOP: p.priceCOP, pitch: p.pitch || p.shortDesc,
      mensaje: richMensaje(p), producto_contexto: buildContexto(p),
    }));
    const mensaje = productos.length
      ? `Para "${body.necesidad}" te recomiendo: ` +
        productos.map((p) => `${p.name} (${cop(p.priceCOP)})`).join(", ") +
        `. El que más vende es ${productos[0].name}. ¿Te lo aparto? 🐓`
      : "Cuéntame un poco más (animal y qué necesitas) y te recomiendo el ideal. 😊";
    return { productos, mensaje };
  },
);
