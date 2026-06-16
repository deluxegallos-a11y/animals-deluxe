import { z } from "zod";
import { eq } from "drizzle-orm";
import { withBridge, logEvent } from "@/lib/ai/bridge";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import { cop } from "@/lib/ai/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Pago opcional (anticipo/prepago). Si Wompi no está activo → mensaje COD. */
export const POST = withBridge(
  z.object({ ref: z.string().min(1), metodo: z.string().optional().default("") }),
  async ({ body }) => {
    const ref = body.ref.toUpperCase().trim();
    let total = 0;
    if (db) {
      const [o] = await db.select().from(orders).where(eq(orders.ref, ref)).limit(1);
      total = o?.totalCop ?? 0;
    }

    const wompiPub = process.env.WOMPI_PUBLIC_KEY || "";
    if (!wompiPub) {
      return {
        link: "",
        ref_pago: "",
        mensaje: `Tu pedido ${ref} es *contraentrega*: pagas ${total ? cop(total) : "al recibir"} cuando llegue el domiciliario. No necesitas pagar nada por adelantado 🚚🐓`,
      };
    }

    const site = process.env.NEXT_PUBLIC_SITE_URL || "https://animalsdeluxe.com";
    const link = `https://checkout.wompi.co/p/?public-key=${encodeURIComponent(wompiPub)}&currency=COP&amount-in-cents=${Math.max(0, total) * 100}&reference=${encodeURIComponent(ref)}&redirect-url=${encodeURIComponent(site + "/producto")}`;
    await logEvent("link_pago_generado", { ref, total });
    return {
      link,
      ref_pago: ref,
      mensaje: `Aquí tienes el link para pagar tu anticipo (${cop(total)}) de forma segura 👇 Apenas pagues, confirmamos el despacho.`,
    };
  },
);
