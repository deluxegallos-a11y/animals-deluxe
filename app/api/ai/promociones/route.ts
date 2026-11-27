import { z } from "zod";
import { withBridge } from "@/lib/ai/bridge";
import { getActivePromotions } from "@/lib/ai/data";
import { cop } from "@/lib/ai/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withBridge(
  z.object({ categoria: z.string().optional().default("") }),
  async ({ body }) => {
    const promos = await getActivePromotions(body.categoria || undefined);
    const imagen_url = promos[0]?.imagen_url || "";
    const mensaje = promos.length
      ? `🔥 Promos activas: ` +
        promos.map((p) => `${p.titulo}${p.precio_promo ? ` a ${cop(p.precio_promo)}` : ""}`).join(", ") +
        `. Contraentrega. ¿Cuál te interesa?`
      : "Ahora mismo no tengo promos activas, pero los precios ya son de combate 🐓. ¿Qué buscas?";
    return { promos, imagen_url, mensaje };
  },
);
