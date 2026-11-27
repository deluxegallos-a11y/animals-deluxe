import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { withBridge, logEvent } from "@/lib/ai/bridge";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import { cop } from "@/lib/ai/format";
import { createBoldPaymentLink, boldConfigured } from "@/lib/bold";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Pago del pedido. Tenant anticipado (Rooster) → da las cuentas de pago del tenant.
   Tenant contra entrega (Animals Deluxe) → Bold si está activo, si no, mensaje COD. */
export const POST = withBridge(
  z.object({ ref: z.string().min(1), metodo: z.string().optional().default("") }),
  async ({ body, tenant }) => {
    const ref = body.ref.toUpperCase().trim();
    let total = 0;
    if (db) {
      const [o] = await db.select().from(orders).where(and(eq(orders.tenantId, tenant.id), eq(orders.ref, ref))).limit(1);
      total = o?.totalCop ?? 0;
    }

    // --- Tenant de PAGO ANTICIPADO: cuentas del tenant, NUNCA contra entrega ---
    if (tenant.paymentMode === "anticipado") {
      const cuentas = (tenant.cuentasPago || "").trim();
      return {
        link: "",
        ref_pago: "",
        mensaje: cuentas
          ? `Para despachar tu pedido ${ref}${total ? ` (${cop(total)})` : ""}, realiza el pago a:\n\n${cuentas}\n\nApenas transfieras, envíame el *comprobante* y confirmamos el despacho. 🐓`
          : `Para despachar tu pedido ${ref}${total ? ` (${cop(total)})` : ""} necesitamos el pago por adelantado. En un momento un asesor te comparte los datos. 🐓`,
      };
    }

    // Sin Bold configurado → seguimos contraentrega (no se requiere pago anticipado).
    if (!boldConfigured()) {
      return {
        link: "",
        ref_pago: "",
        mensaje: `Tu pedido ${ref} es *contraentrega*: pagas ${total ? cop(total) : "al recibir"} cuando llegue el domiciliario. No necesitas pagar nada por adelantado 🚚🐓`,
      };
    }

    const site = process.env.NEXT_PUBLIC_SITE_URL || "https://animalsdeluxe.com";
    const r = await createBoldPaymentLink({
      amountCop: total,
      reference: ref,
      description: `Pedido ${ref} · Animals Deluxe`,
      callbackUrl: `${site}/gracias`,
    });

    if (!r.ok) {
      await logEvent("link_pago_error", { ref, total, error: r.error });
      return {
        link: "",
        ref_pago: "",
        mensaje: `No pude generar el link de pago ahora mismo, pero tranquilo: tu pedido ${ref} también puede ir *contraentrega* (pagas al recibir) 🚚. ¿Lo dejamos así?`,
      };
    }

    await logEvent("link_pago_generado", { ref, total, payment_link: r.paymentLink });
    return {
      link: r.link,
      ref_pago: r.paymentLink,
      mensaje: `Aquí tienes el link para pagar tu pedido ${ref} (${cop(total)}) de forma segura con Bold 👇 Apenas pagues, confirmamos el despacho.`,
    };
  },
);
