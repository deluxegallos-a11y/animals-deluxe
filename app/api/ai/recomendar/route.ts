import { z } from "zod";
import { withBridge, logEvent } from "@/lib/ai/bridge";
import { getProducts } from "@/lib/ai/data";
import { searchProducts, animalOf, needScore, looksMedical, detectForma } from "@/lib/ai/search";
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
    // Piso de relevancia (§4.5): recomienda por PROPÓSITO, no padees con productos flojos/no
    // relacionados. Solo entran candidatos con puntaje cercano al mejor (y >= 3).
    const topScore = r.ranked[0]?.score ?? 0;
    const floor = Math.max(3, topScore * 0.45);
    const candidatos = r.ranked
      .filter((x) => !firstAnimal || animalOf(x.product) === firstAnimal)
      .filter((x) => x.score >= floor)
      .slice(0, 3)
      .map((x) => x.product);

    // NO FABRICAR (§4.5): solo bloqueamos cuando el query es un PROBLEMA MÉDICO/síntoma
    // (ojo, herida, fractura, bulto…) que ningún producto trata de verdad. Las necesidades
    // comerciales normales (crecimiento, energía, músculo, vitaminas…) sí recomiendan.
    const nScore = candidatos.length ? Math.max(...candidatos.map((p) => needScore(body.necesidad, p))) : 0;
    const problemaMedicoSinMatch = looksMedical(body.necesidad) && !(nScore < 0 || nScore >= 2.5);
    // Si piden una FORMA (inyectable/gotas…) pero ningún candidato matchea el PROPÓSITO en esa forma → honesto.
    const formaSinPropósito = !!detectForma(body.necesidad) && candidatos.length > 0 && nScore >= 0 && nScore < 2.5;
    if (r.status === "not_found" || !candidatos.length || problemaMedicoSinMatch || formaSinPropósito) {
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
      `. El que más vende es ${productos[0].name}. ¿Cuál te interesa? 🐓`;
    return { productos, status: "found" as const, requiere_asesor: false, mensaje };
  },
);
