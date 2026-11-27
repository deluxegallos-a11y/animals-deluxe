import { z } from "zod";
import { withBridge, recordInterest } from "@/lib/ai/bridge";
import { getProductBySlug, getProducts } from "@/lib/ai/data";
import { searchProducts } from "@/lib/ai/search";
import { esQueryBasura } from "@/lib/ai/brain";
import { publicProduct, emptyProduct, richMensaje } from "@/lib/ai/present";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withBridge(
  z.object({ slug: z.string().min(1) }),
  async ({ body, customer }) => {
    // 1) match exacto por slug
    let p = await getProductBySlug(body.slug);
    // 2) fallback: el bot a veces manda un slug derivado del NOMBRE que no coincide
    //    (p.ej. "combo-cuidado-total-4-tapas" en vez de "combo-4-tapas"). Antes de rendirnos,
    //    buscamos por texto. Así NUNCA decimos "No encontré" con el producto existiendo.
    //    OJO: el fallback NO corre si el "slug" es basura (URL de audio/foto, id):
    //    ese texto normalizado se volvía palabras y pescaba cualquier producto.
    if (!p && !esQueryBasura(body.slug)) {
      const catalog = await getProducts();
      const r = searchProducts(body.slug.replace(/[-_]+/g, " "), catalog);
      if (r.product) p = r.product;
    }
    // 3) solo si de verdad no hay match: mensaje de "no encontré" (coherente con status)
    if (!p) {
      return { status: "not_found" as const, producto: emptyProduct(), mensaje: "No encontré ese producto. ¿Buscamos otro? 🐓" };
    }
    await recordInterest(customer.id, [p.slug]); // CRM: registró interés
    const pub = publicProduct(p);
    return { status: "found" as const, producto: pub, producto_contexto: pub.producto_contexto, mensaje: richMensaje(p) };
  },
);
