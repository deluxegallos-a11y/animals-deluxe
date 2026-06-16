import { z } from "zod";
import { withBridge, logEvent } from "@/lib/ai/bridge";
import { validateCoupon } from "@/lib/ai/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withBridge(
  z.object({ codigo: z.string().min(1) }),
  async ({ body }) => {
    const c = await validateCoupon(body.codigo);
    if (!c) {
      return { valido: false, tipo: "", valor: 0, mensaje: "Ese cupón no es válido o ya venció 😕. ¿Tienes otro?" };
    }
    await logEvent("cupon_validado", { codigo: c.codigo });
    const desc = c.tipo === "porcentaje" ? `${c.valor}% de descuento` : `$${c.valor} de descuento`;
    return {
      valido: true,
      tipo: c.tipo || "porcentaje",
      valor: c.valor,
      mensaje: `¡Cupón ${c.codigo} aplicado! 🎉 ${desc}. ¿Armamos el pedido?`,
    };
  },
);
