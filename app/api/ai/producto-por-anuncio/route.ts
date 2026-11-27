import { z } from "zod";
import { withBridge, audit, logEvent } from "@/lib/ai/bridge";
import { getProducts } from "@/lib/ai/data";
import { publicProduct, suggestion, emptyProduct, richMensaje } from "@/lib/ai/present";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Identifica el producto por el ad_id del anuncio (WhatsApp Ads referral).
   Patrón Chatea Pro: el bot captura el ad_id del referral y llama acá.
   Nunca devuelve null (regla de oro UChat). */
export const POST = withBridge(
  z.object({
    ad_id: z.union([z.string(), z.number()]).transform((v) => String(v)).optional().default(""),
  }),
  async ({ body }) => {
    const adId = body.ad_id.trim();
    const catalog = await getProducts();
    const p = adId ? catalog.find((x) => (x.adIds || []).map(String).includes(adId)) : undefined;

    await logEvent("producto_por_anuncio", { ad_id: adId, match: p?.slug || "" });

    if (!p) {
      const sugerencias = catalog.slice(0, 3).map(suggestion);
      return {
        status: "not_found" as const,
        match: "",
        ad_id: adId,
        producto: emptyProduct(),
        producto_contexto: "",
        sugerencias,
        mensaje: adId
          ? `No encontré el producto de ese anuncio, pero contame qué buscás pa tu campeón 🐓 (energía, vitaminas, respiratorio, desparasitantes…).`
          : `¡Hola, mi rey! Contame qué buscás pa tu campeón y te muestro 🐓.`,
      };
    }

    await audit("producto_por_anuncio", "products", { slug: p.slug, ad_id: adId });
    const pub = publicProduct(p);
    return {
      status: "found" as const,
      match: p.slug,
      ad_id: adId,
      producto: pub,
      producto_contexto: pub.producto_contexto,
      mensaje: richMensaje(p),
    };
  },
);
