import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { withBridge, audit, logEvent } from "@/lib/ai/bridge";
import { db } from "@/lib/db/client";
import { adMap } from "@/lib/db/schema";
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

    // 1) Mapa dedicado ad_map (tabla del panel "Anuncios"). 2) Fallback: campo ad_ids del producto.
    let slugFromMap = "";
    if (adId && db) {
      const [row] = await db
        .select({ slug: adMap.productSlug })
        .from(adMap)
        .where(and(eq(adMap.adId, adId), eq(adMap.activo, true)))
        .limit(1);
      slugFromMap = row?.slug || "";
    }
    const p = adId
      ? (slugFromMap ? catalog.find((x) => x.slug === slugFromMap) : undefined)
        || catalog.find((x) => (x.adIds || []).map(String).includes(adId))
      : undefined;

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
