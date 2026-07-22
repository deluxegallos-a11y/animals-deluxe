import { z } from "zod";
import { withBridge, logEvent } from "@/lib/ai/bridge";
import { getProducts, getExtraAliases } from "@/lib/ai/data";
import { searchProducts, animalOf, needScore, looksMedical, detectForma } from "@/lib/ai/search";
import { buildContexto, richMensaje, opcionesMensaje } from "@/lib/ai/present";
import { identifyProduct } from "@/lib/ai/brain";
import { rulesForTenant } from "@/lib/ai/aliases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withBridge(
  z.object({ necesidad: z.string().min(1) }),
  async ({ body, tenant }) => {
    const [catalog, extraAliases] = await Promise.all([getProducts(), getExtraAliases()]);

    // CEREBRO primero: si la necesidad está mapeada ("pal moquillo", "que le crezca
    // la cola", "purga"…) o nombra un producto, respondemos con ESO y no con
    // parecidos ortográficos. Solo si el cerebro no resuelve caemos al ranking.
    const brain = identifyProduct(body.necesidad, catalog, extraAliases, rulesForTenant(tenant.slug));
    if (brain.status === "category" || brain.status === "ambiguous" || brain.status === "found") {
      const top = (brain.options.length ? brain.options : [brain.product!]).slice(0, 3);
      await logEvent("recomendacion", { necesidad: body.necesidad, productos: top.map((p) => p.slug), matched_by: brain.matchedBy });
      return {
        productos: top.map((p) => ({
          slug: p.slug, name: p.name, priceCOP: p.priceCOP, pitch: p.pitch || p.shortDesc,
          mensaje: richMensaje(p), producto_contexto: buildContexto(p),
        })),
        status: "found" as const,
        requiere_asesor: false,
        mensaje: (brain.nota ? `👉 ${brain.nota}\n` : "") + (top.length > 1 ? opcionesMensaje(top) : richMensaje(top[0])),
      };
    }

    const r = searchProducts(body.necesidad, catalog);
    // Nunca mezclar animales: las recomendaciones comparten el animal del mejor match.
    const firstAnimal = r.ranked[0] ? animalOf(r.ranked[0].product) : null;
    // Piso de relevancia (§4.5): recomienda por PROPÓSITO, no padees con productos flojos/no
    // relacionados. Solo entran candidatos con puntaje cercano al mejor (y >= 3).
    const topScore = r.ranked[0]?.score ?? 0;
    const floor = Math.max(3, topScore * 0.45);
    // Candidatos: relevantes, del mismo animal, sobre el piso, DEDUPE por nombre
    // (dos SKUs "Rooster Deluxe Max" no deben ocupar 2 espacios).
    const candidatos: typeof catalog = [];
    const vistosN = new Set<string>();
    for (const x of r.ranked) {
      if (firstAnimal && animalOf(x.product) !== firstAnimal) continue;
      if (x.score < floor) continue;
      const k = x.product.name.toLowerCase().trim();
      if (vistosN.has(k)) continue;
      vistosN.add(k);
      candidatos.push(x.product);
      if (candidatos.length >= 3) break;
    }

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
    // Mensaje HUMANIZADO en tono paisa, SIN eco del query — para AMBOS tenants
    // (Animals Deluxe y Rooster Deluxe). Cada uno ya ve solo SU catálogo.
    const mensaje = opcionesMensaje(top);
    return { productos, status: "found" as const, requiere_asesor: false, mensaje };
  },
);
