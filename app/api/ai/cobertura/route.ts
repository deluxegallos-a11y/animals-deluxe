import { z } from "zod";
import { withBridge } from "@/lib/ai/bridge";
import { resolveCobertura } from "@/lib/ai/data";
import { cop } from "@/lib/ai/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withBridge(
  z.object({ ciudad: z.string().min(1) }),
  async ({ body }) => {
    const c = await resolveCobertura(body.ciudad);
    const mensaje = c.cobertura
      ? (c.contraentrega
          ? `¡Sí llegamos a ${c.ciudad}! 🚚 Es contraentrega (pagas al recibir). Envío: ${c.costo_envio ? cop(c.costo_envio) : "GRATIS"}. ¿Te armo el pedido?`
          : `Llegamos a ${c.ciudad}, pero ahí el pago va anticipado. Envío: ${cop(c.costo_envio)}. ¿Seguimos?`)
      : `Por ahora no tengo cobertura confirmada en ${c.ciudad}, pero te paso con un asesor para resolverlo 🙌`;
    return {
      cobertura: c.cobertura,
      contraentrega: c.contraentrega,
      costo_envio: c.costo_envio,
      mensaje,
    };
  },
);
