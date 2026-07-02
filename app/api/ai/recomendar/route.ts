import { z } from "zod";
import { withBridge, logEvent } from "@/lib/ai/bridge";
import { getProducts } from "@/lib/ai/data";
import { searchProducts, animalOf, needScore } from "@/lib/ai/search";
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
    const candidatos = r.ranked
      .filter((x) => !firstAnimal || animalOf(x.product) === firstAnimal)
      .slice(0, 3)
      .map((x) => x.product);

    // NO FABRICAR (§4.5): si nada aplica de verdad a la necesidad, ser honesto y pasar a asesor.
    // needScore ignora el impulso por animal/categoría: si el query pide algo que el producto
    // no trata (ej. "perro con pelota en el ojo"), el mejor candidato puntúa ~0.
    const nScore = candidatos.length ? Math.max(...candidatos.map((p) => needScore(body.necesidad, p))) : 0;
    const aplica = candidatos.length && (nScore < 0 || nScore >= 2.5);
    if (r.status === "not_found" || !aplica) {
      await logEvent("recomendacion_sin_match", { necesidad: body.necesidad, animal: firstAnimal, nScore });
      return {
        productos: [],
        status: "not_found" as const,
        requiere_asesor: true,
        mensaje: "Mmm, no tengo un producto que le sirva exactamente a eso 🤔. Dame un momento y te paso con un asesor para orientarte mejor. 🐓",
      };
    }
    const top = candidatos;

    await logEvent("recomendacion", { necesidad: body.necesidad, productos: top.map((p) => p.slug) });

    const productos = top.map((p) => ({
      slug: p.slug, name: p.name, priceCOP: p.priceCOP, pitch: p.pitch || p.shortDesc,
      mensaje: richMensaje(p), producto_contexto: buildContexto(p),
    }));
    const mensaje =
      `Para "${body.necesidad}" te recomiendo: ` +
      productos.map((p) => `${p.name} (${cop(p.priceCOP)})`).join(", ") +
      `. El que más vende es ${productos[0].name}. ¿Te lo aparto? 🐓`;
    return { productos, status: "found" as const, requiere_asesor: false, mensaje };
  },
);
