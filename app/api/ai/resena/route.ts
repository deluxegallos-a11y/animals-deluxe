import { z } from "zod";
import { withBridge, logEvent } from "@/lib/ai/bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESENA_URL = process.env.NEXT_PUBLIC_REVIEW_URL || "https://g.page/r/animalsdeluxe/review";

export const POST = withBridge(
  z.object({ sentimiento: z.enum(["positivo", "neutro", "negativo"]) }),
  async ({ body }) => {
    await logEvent("resena_solicitada", { sentimiento: body.sentimiento });

    if (body.sentimiento === "negativo") {
      return {
        link_resena: "",
        mensaje: "Lamento que no haya sido la mejor experiencia 🙏. Te paso con un asesor para resolverlo de una vez.",
      };
    }
    return {
      link_resena: RESENA_URL,
      mensaje: `¡Gracias, eso nos motiva! 🐓🔥 Si te dejas 30 segundos para una reseñita aquí 👇 nos ayudas un montón: ${RESENA_URL}`,
    };
  },
);
