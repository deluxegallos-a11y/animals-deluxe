import { z } from "zod";
import { withBridge, logEvent } from "@/lib/ai/bridge";
import { assignAdvisor } from "@/lib/ai/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withBridge(
  z.object({ razon: z.string().optional().default("") }),
  async ({ body }) => {
    const asesor = await assignAdvisor();
    await logEvent("asesor_asignado", { razon: body.razon, asesor: asesor.nombre });
    return {
      asesor: { nombre: asesor.nombre, whatsapp: asesor.whatsapp || "" },
      mensaje: `Te conecto con ${asesor.nombre}, nuestro asesor 🐓. ${asesor.whatsapp ? `Escríbele al ${asesor.whatsapp}` : "En un momento te contacta"} para cerrar tu pedido.`,
    };
  },
);
