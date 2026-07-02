import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { withBridge, audit, logEvent } from "@/lib/ai/bridge";
import { db } from "@/lib/db/client";
import { adMap } from "@/lib/db/schema";
import { getProducts } from "@/lib/ai/data";
import { publicProduct, suggestion, emptyProduct, richMensaje } from "@/lib/ai/present";
import { cop } from "@/lib/ai/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Identifica el/los producto(s) por el ad_id del anuncio (WhatsApp Ads referral).
   Un ad puede mapear a VARIOS productos (ver ad_map). Nunca devuelve null
   (regla de oro UChat): si el ad_id no está mapeado → status:"not_found" para
   que el bot caiga al flujo por nombre (buscar-producto), sin "no encontré". */
export const POST = withBridge(
  z.object({
    ad_id: z.union([z.string(), z.number()]).transform((v) => String(v)).optional().default(""),
  }),
  async ({ body }) => {
    const adId = body.ad_id.trim();
    const catalog = await getProducts();

    // 1) Mapa dedicado ad_map (tabla del panel "Anuncios") — 1 o varios productos por ad.
    let slugs: string[] = [];
    if (adId && db) {
      const rows = await db
        .select({ slug: adMap.productSlug })
        .from(adMap)
        .where(and(eq(adMap.adId, adId), eq(adMap.activo, true)))
        .orderBy(asc(adMap.orden));
      slugs = rows.map((r) => r.slug);
    }
    // 2) Fallback: campo ad_ids del producto (compat).
    if (!slugs.length && adId) {
      const p = catalog.find((x) => (x.adIds || []).map(String).includes(adId));
      if (p) slugs = [p.slug];
    }

    const productos = slugs
      .map((s) => catalog.find((x) => x.slug === s))
      .filter((p): p is NonNullable<typeof p> => !!p);

    await logEvent("producto_por_anuncio", { ad_id: adId, match: productos.map((p) => p.slug) });

    if (!productos.length) {
      // NO error: el bot cae al flujo por nombre (buscar-producto).
      return {
        status: "not_found" as const,
        match: "",
        ad_id: adId,
        productos: [],
        producto: emptyProduct(),
        producto_contexto: "",
        sugerencias: catalog.slice(0, 3).map(suggestion),
        mensaje: adId
          ? "No tengo ese anuncio mapeado, pero contame qué buscás pa tu campeón 🐓 y te muestro."
          : "¡Hola, mi rey! Contame qué buscás pa tu campeón y te muestro 🐓.",
      };
    }

    await audit("producto_por_anuncio", "products", { ad_id: adId, slugs: productos.map((p) => p.slug) });

    const pubs = productos.map((p) => publicProduct(p));
    const mensaje =
      productos.length === 1
        ? richMensaje(productos[0])
        : `Por este anuncio manejamos ${productos.length}: ` +
          productos.map((p) => `*${p.name}* (${cop(p.priceCOP)})`).join(" y ") +
          `. ¿Cuál te muestro primero? 🐓`;

    return {
      status: "found" as const,
      match: productos[0].slug,
      ad_id: adId,
      // lista (contrato nuevo): 1 o varios productos
      productos: pubs,
      // compat: el primero como objeto singular
      producto: pubs[0],
      producto_contexto: pubs[0].producto_contexto,
      mensaje,
    };
  },
);
