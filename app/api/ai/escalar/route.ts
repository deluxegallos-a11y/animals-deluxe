import { z } from "zod";
import { and, eq, ne, asc } from "drizzle-orm";
import { withBridge, audit, logEvent } from "@/lib/ai/bridge";
import { db } from "@/lib/db/client";
import { conversations } from "@/lib/db/schema";
import { assignAdvisor } from "@/lib/ai/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withBridge(
  z.object({ motivo: z.string().min(1) }),
  async ({ customer, body }) => {
    const asesor = await assignAdvisor();

    if (db && !customer.id.startsWith("demo-")) {
      const [open] = await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.customerId, customer.id), ne(conversations.estado, "cerrada")))
        .orderBy(asc(conversations.createdAt))
        .limit(1);
      if (open) {
        await db
          .update(conversations)
          .set({ estado: "escalada", asignadaA: "id" in asesor ? (asesor as { id: string }).id : null, ultimoMensajeAt: new Date() })
          .where(eq(conversations.id, open.id));
      } else {
        await db.insert(conversations).values({
          customerId: customer.id,
          estado: "escalada",
          asignadaA: "id" in asesor ? (asesor as { id: string }).id : null,
        });
      }
      await audit("escalar", "conversations", { customer_id: customer.id, motivo: body.motivo });
    }
    await logEvent("conversacion_escalada", { motivo: body.motivo });

    return {
      mensaje: `Ya le pasé tu caso a ${asesor.nombre} 🙌. Un asesor humano te escribe en breve para ayudarte con: ${body.motivo}.`,
    };
  },
);
