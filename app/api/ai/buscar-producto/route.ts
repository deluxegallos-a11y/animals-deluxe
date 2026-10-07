import { z } from "zod";
import { withBridge, audit, logEvent, recordInterest } from "@/lib/ai/bridge";
import { getProducts, getExtraAliases, logSearchMiss } from "@/lib/ai/data";
import { identifyProduct, esQueryBasura } from "@/lib/ai/brain";
import { rulesForTenant } from "@/lib/ai/aliases";
import { detectarOtraMarca } from "@/lib/ai/marcas";
import { publicProduct, suggestion, emptyProduct, richMensaje, opcionesMensaje, cualMensaje } from "@/lib/ai/present";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withBridge(
  z.object({ q: z.string().optional().default("") }),
  async ({ body, customer, tenant }) => {
    // CANDADO DURO (antes de tocar la DB): query vacío, o basura que no es una
    // consulta (UChat manda la URL del audio/foto como `q` cuando el cliente
    // manda una nota de voz). Nunca se devuelve un producto "por si acaso".
    if (esQueryBasura(body.q)) {
      await logEvent("busqueda_producto", { q: body.q, status: "not_found", match: "", matched_by: "descartado", score: 0 });
      return {
        status: "not_found" as const,
        match: "",
        matched_by: "descartado",
        producto: emptyProduct(),
        opciones: [],
        sugerencias: [],
        // SIEMPRE "": sin match confiable el backend NO inventa texto; el silencio
        // lo maneja el flujo del bot (mismo contrato que el resto del cerebro).
        mensaje: "",
      };
    }

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
      // OTRA MARCA (M-CERO): antes de dar por perdida la consulta, miramos si lo que
      // pidió es un producto EXCLUSIVO del otro negocio (botas, canilleras, comederos,
      // antibióticos…). Si lo es, redirigimos a ese canal en vez de callar.
      const otra = await detectarOtraMarca(body.q);
      if (otra) {
        await logEvent("otra_marca", {
          q: body.q, marca: otra.marca, producto: otra.producto_slug, sub_id: customer.uchatSubId || "",
        });
        return {
          status: otra.status, // "otra_marca"
          match: "",
          matched_by: "otra_marca",
          producto: emptyProduct(),
          opciones: [],
          sugerencias: [], // no ofrecemos sustitutos: es del otro canal, no de este
          otra_marca: {
            marca: otra.marca,
            marca_nombre: otra.marca_nombre,
            politica_pago: otra.politica_pago,
            whatsapp: otra.whatsapp,
            whatsapp_link: otra.whatsapp_link,
            producto: otra.producto_nombre,
          },
          mensaje: otra.mensaje,
        };
      }
      // Sin match real → not_found con mensaje "" (el bot maneja el silencio).
      // El caso de q vacío ya se cortó arriba, antes de tocar la DB.
      return {
        status: "not_found" as const,
        match: "",
        matched_by: r.matchedBy,
        producto: emptyProduct(),
        opciones: [],
        sugerencias, // solo relevantes (puede ir vacío)
        mensaje: "",
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
