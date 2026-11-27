import { z } from "zod";
import { withBridge } from "@/lib/ai/bridge";
import { cotizarEnvio, getProducts } from "@/lib/ai/data";
import { pedidoEnvioGratis } from "@/lib/ai/shipping";
import { cop } from "@/lib/ai/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withBridge(
  z.object({
    ciudad: z.string().min(1),
    items: z
      .array(
        z.object({
          slug: z.string().min(1),
          cantidad: z.number().int().positive().optional().default(1),
        }),
      )
      .optional()
      .default([]),
    metodo: z.enum(["contraentrega", "anticipado"]).optional().default("contraentrega"),
  }),
  async ({ body }) => {
    // Si vienen ítems, cotizamos con valor real (sobreflete + recargo + gratis).
    let subtotalCop = 0;
    let unidades = 0;
    let envioGratis = false;
    if (body.items.length) {
      const catalog = await getProducts();
      const resolved = body.items.map((it) => {
        const p = catalog.find((x) => x.slug === it.slug);
        const precio = p?.presentations[0]?.priceCOP ?? p?.priceCOP ?? 0;
        return { slug: it.slug, cantidad: it.cantidad, precio, envioGratis: p?.envioGratis };
      });
      subtotalCop = resolved.reduce((s, r) => s + r.precio * r.cantidad, 0);
      unidades = resolved.reduce((s, r) => s + r.cantidad, 0);
      envioGratis = pedidoEnvioGratis(resolved);
    }

    const c = await cotizarEnvio(body.ciudad, {
      subtotalCop,
      unidades: unidades || undefined,
      metodo: body.metodo,
      envioGratis,
    });

    const mensaje = c.envio_gratis
      ? `¡Buenísimo! 🎉 A ${c.ciudad} el envío te sale *GRATIS* y es contraentrega (pagas al recibir). ¿Te armo el pedido?`
      : c.contraentrega
        ? `¡Sí llegamos a ${c.ciudad}! 🚚 Contraentrega (pagas al recibir). Envío: ${cop(c.costo_envio)} · Entrega ${c.tiempo}. ¿Te armo el pedido?`
        : `Llegamos a ${c.ciudad}, ahí el pago va anticipado. Envío: ${cop(c.costo_envio)} · Entrega ${c.tiempo}. ¿Seguimos?`;

    return {
      // legacy (compat)
      cobertura: c.cobertura,
      contraentrega: c.contraentrega,
      // contrato del bot
      cubre: c.cubre,
      zona: c.zona,
      costo_envio: c.costo_envio,
      envio_gratis: c.envio_gratis,
      tiempo: c.tiempo,
      mensaje,
    };
  },
);
