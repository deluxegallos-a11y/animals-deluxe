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
  async ({ body, customer, tenant }) => {
    const asesor = await assignAdvisor();
    // WhatsApp del asesor: el round-robin manda; si no hay asesores, cae al asesor_wa del tenant.
    const asesorWa = asesor.whatsapp || tenant.asesorWa || "";

    // --- Pago anticipado: el bot pide los datos de cuentas de pago del TENANT ---
    if (body.razon === "pago_anticipado" || tenant.paymentMode === "anticipado") {
      const cfg = await getStoreConfig();
      // Las cuentas salen del tenant (texto libre: Bancolombia/Nequi/…); fallback a store_config.
      const cuentasTexto = (tenant.cuentasPago || "").trim();
      const mensajePago = cuentasTexto
        ? `Para confirmar tu pedido, realiza el pago a:\n\n${cuentasTexto}\n\nApenas transfieras, envíame el *comprobante* y un asesor confirma y despacha tu pedido. 🐓`
        : formatCuentas(cfg.cuentasBancarias);
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
        asesor: { nombre: asesor.nombre, whatsapp: asesorWa },
        cuentas: cuentasTexto || cfg.cuentasBancarias,
        mensaje: mensajePago,
      };
    }

    // --- Escalado normal a asesor ---
    await logEvent("asesor_asignado", { razon: body.razon, asesor: asesor.nombre });
    return {
      asesor: { nombre: asesor.nombre, whatsapp: asesorWa },
      mensaje: `Te conecto con ${asesor.nombre}, nuestro asesor 🐓. ${asesorWa ? `Escríbele al ${asesorWa}` : "En un momento te contacta"} para cerrar tu pedido.`,
    };
  },
);
