import { z } from "zod";
import { withBridge, audit, logEvent, recordInterest } from "@/lib/ai/bridge";
import { getProducts } from "@/lib/ai/data";
import { searchProducts } from "@/lib/ai/search";
import { publicProduct, suggestion, emptyProduct, richMensaje, opcionesMensaje } from "@/lib/ai/present";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withBridge(
  z.object({ q: z.string().optional().default("") }),
  async ({ body, customer, tenant }) => {
    const catalog = await getProducts();
    const r = searchProducts(body.q, catalog);
    if (r.product) await recordInterest(customer.id, [r.product.slug]); // CRM: registró interés

    // Sugerencias: SOLO productos RELEVANTES (comparten palabra/categoría con el query).
    // Nunca "parecidas" sin relación. Excluye el elegido y dedupe por nombre.
    const vistos = new Set<string>([(r.product?.name || "").toLowerCase().trim()]);
    const sugerencias = r.ranked
      .filter((x) => x.relevant && x.product.slug !== r.product?.slug)
      .filter((x) => { const k = (x.product.name || "").toLowerCase().trim(); if (vistos.has(k)) return false; vistos.add(k); return true; })
      .slice(0, 3)
      .map((x) => suggestion(x.product));

    await logEvent("busqueda_producto", { q: body.q, status: r.status, match: r.product?.slug || "" });

    if (!r.product) {
      // No hay match real → not_found con mensaje "" (el bot maneja el silencio).
      // Solo si la consulta viene vacía damos un empujón amable (no es un "no encontré").
      return {
        status: r.status,
        match: "",
        producto: emptyProduct(),
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
    // AMBOS tenants, tono paisa:
    //  - ambiguo → lista de opciones (sin eco del query)
    //  - match único → presentación humanizada del producto (+ su imageUrl/foto).
    const opciones = [p, ...r.ranked.filter((x) => x.relevant && x.product.slug !== p.slug).map((x) => x.product)];
    const mensaje = r.status === "ambiguous"
      ? opcionesMensaje(opciones)
      : richMensaje(p);
    return {
      status: r.status,
      match: p.slug,
      producto: pub,
      producto_contexto: pub.producto_contexto,
      sugerencias,
      mensaje,
    };
  },
);
