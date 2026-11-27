import { z } from "zod";
import { eq } from "drizzle-orm";
import { withBridge, logEvent, audit } from "@/lib/ai/bridge";
import { assignAdvisor, getStoreConfig } from "@/lib/ai/data";
import { db } from "@/lib/db/client";
import { conversations } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Formatea las cuentas bancarias de la tienda para el mensaje al cliente. */
function formatCuentas(cuentas: { banco: string; tipo: string; numero: string; titular: string }[]): string {
  if (!cuentas.length) {
    return "En un momento un asesor te comparte los datos para el pago anticipado.";
  }
  const lineas = cuentas
    .map((c) => `🏦 *${c.banco}* (${c.tipo})\n   N° ${c.numero}\n   Titular: ${c.titular}`)
    .join("\n\n");
  return (
    "Para pago anticipado puedes transferir a:\n\n" +
    lineas +
    "\n\nApenas transfieras, un asesor te confirma el pago y despacha tu pedido. 🐓"
  );
}

export const POST = withBridge(
  z.object({ razon: z.string().optional().default("") }),
  async ({ body, customer }) => {
    const asesor = await assignAdvisor();

    // --- Pago anticipado: el bot pide los datos de cuentas bancarias ---
    if (body.razon === "pago_anticipado") {
      const cfg = await getStoreConfig();
      // Marca la conversación para que un asesor confirme el pago manualmente.
      if (db && !customer.id.startsWith("demo-")) {
        const [conv] = await db.select().from(conversations).where(eq(conversations.customerId, customer.id)).limit(1);
        if (conv) {
          await db.update(conversations)
            .set({ estado: "escalada", asignadaA: "id" in asesor ? (asesor as { id: string }).id : null, ultimoMensajeAt: new Date() })
            .where(eq(conversations.id, conv.id));
        } else {
          await db.insert(conversations).values({
            customerId: customer.id, estado: "escalada",
            asignadaA: "id" in asesor ? (asesor as { id: string }).id : null,
          });
        }
      }
      await audit("solicitud_pago_anticipado", "conversations", { customerId: customer.id, asesor: asesor.nombre });
      await logEvent("pago_anticipado_solicitado", { asesor: asesor.nombre, cuentas: cfg.cuentasBancarias.length });

      return {
        razon: "pago_anticipado",
        asesor: { nombre: asesor.nombre, whatsapp: asesor.whatsapp || "" },
        cuentas: cfg.cuentasBancarias,
        mensaje: formatCuentas(cfg.cuentasBancarias),
      };
    }

    // --- Escalado normal a asesor ---
    await logEvent("asesor_asignado", { razon: body.razon, asesor: asesor.nombre });
    return {
      asesor: { nombre: asesor.nombre, whatsapp: asesor.whatsapp || "" },
      mensaje: `Te conecto con ${asesor.nombre}, nuestro asesor 🐓. ${asesor.whatsapp ? `Escríbele al ${asesor.whatsapp}` : "En un momento te contacta"} para cerrar tu pedido.`,
    };
  },
);
