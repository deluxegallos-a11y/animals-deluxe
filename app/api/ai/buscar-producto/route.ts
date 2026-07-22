import { z } from "zod";
import { withBridge, audit, logEvent, recordInterest } from "@/lib/ai/bridge";
import { getProducts, getExtraAliases, logSearchMiss } from "@/lib/ai/data";
import { identifyProduct } from "@/lib/ai/brain";
import { rulesForTenant } from "@/lib/ai/aliases";
import { publicProduct, suggestion, emptyProduct, richMensaje, opcionesMensaje, cualMensaje } from "@/lib/ai/present";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withBridge(
  z.object({ q: z.string().optional().default("") }),
  async ({ body, customer, tenant }) => {
    const [catalog, extraAliases] = await Promise.all([getProducts(), getExtraAliases()]);

    // CEREBRO: alias → nombre → keyword única → necesidad fuerte → fuzzy → necesidad → nada.
    const r = identifyProduct(body.q, catalog, extraAliases, rulesForTenant(tenant.slug));
    if (r.product) await recordInterest(customer.id, [r.product.slug]); // CRM: registró interés

    // Sugerencias: SOLO productos RELEVANTES (comparten palabra/categoría con el query).
    // Nunca "parecidas" sin relación. Excluye el elegido y dedupe por nombre.
    const yaMostrados = new Set<string>(
      [r.product, ...r.options].filter(Boolean).map((p) => (p!.name || "").toLowerCase().trim()),
    );
    const sugerencias = r.ranked
      .filter((x) => x.relevant && x.product.slug !== r.product?.slug)
      .filter((x) => { const k = (x.product.name || "").toLowerCase().trim(); if (yaMostrados.has(k)) return false; yaMostrados.add(k); return true; })
      .slice(0, 3)
      .map((x) => suggestion(x.product));

    await logEvent("busqueda_producto", {
      q: body.q, status: r.status, match: r.product?.slug || "", matched_by: r.matchedBy, score: r.score,
    });

    // APRENDIZAJE: todo not_found y todo match flojo (<0.5) queda registrado
    // en search_misses → de ahí salen los alias nuevos.
    if (body.q && (r.status === "not_found" || (r.matchedBy === "fuzzy" && r.score < 0.5))) {
      await logSearchMiss({
        query: body.q,
        queryNormalizado: r.norm.stripped || r.norm.q,
        mejorCandidato: r.product?.slug || r.ranked[0]?.product.slug || "",
        score: r.score,
        status: r.status,
      });
    }

    if (!r.product) {
      // No hay match real → not_found con mensaje "" (el bot maneja el silencio).
      // Solo si la consulta viene vacía damos un empujón amable (no es un "no encontré").
      return {
        status: r.status,
        match: "",
        matched_by: r.matchedBy,
        producto: emptyProduct(),
        opciones: [],
        sugerencias, // solo relevantes (puede ir vacío)
        mensaje: body.q
          ? ""
          : "¿Para qué animal y qué buscas? Tengo energía, vitaminas, respiratorio, desparasitantes y más. 🐓",
      };
    }

    const p = r.product;
    await audit("buscar_producto", "products", { slug: p.slug, q: body.q });

    const pub = publicProduct(p);
    // Coherencia mensaje↔status (§4.5): si hay producto, el mensaje NUNCA dice "no encontré".
    //  - ambiguous → "¿cuál de estos buscas?" con las versiones concretas
    //  - category  → "pa eso te sirven" con máx 3 de esa necesidad
    //  - found     → ficha humanizada del producto (+ su imageUrl/foto)
    const mensaje =
      r.status === "ambiguous" ? cualMensaje(r.options, r.nota)
      : r.status === "category" ? opcionesMensaje(r.options)
      : (r.nota ? `👉 ${r.nota}\n` : "") + richMensaje(p);

    return {
      // El contrato del bot solo conoce found/ambiguous/not_found: "category" se
      // expone como ambiguous (mismo manejo: pregunta cuál) y el detalle real va
      // en matched_by, para no romper los flujos ya publicados en UChat.
      status: r.status === "category" ? "ambiguous" : r.status,
      match: p.slug,
      matched_by: r.matchedBy,
      producto: pub,
      producto_contexto: pub.producto_contexto,
      opciones: r.options.map((x) => suggestion(x)),
      sugerencias,
      mensaje,
    };
  },
);
