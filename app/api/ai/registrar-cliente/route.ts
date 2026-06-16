import { z } from "zod";
import { eq } from "drizzle-orm";
import { withBridge, audit } from "@/lib/ai/bridge";
import { db } from "@/lib/db/client";
import { customers } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withBridge(
  z.object({
    nombre: z.string().min(1),
    telefono: z.string().min(1),
    ciudad: z.string().optional().default(""),
    direccion: z.string().optional().default(""),
  }),
  async ({ customer, body }) => {
    if (db && !customer.id.startsWith("demo-")) {
      await db
        .update(customers)
        .set({
          nombre: body.nombre,
          telefono: body.telefono,
          ciudad: body.ciudad || customer.ciudad,
          direccion: body.direccion || customer.direccion,
          estado: "interesado",
          ultimoContacto: new Date(),
        })
        .where(eq(customers.id, customer.id));
      await audit("registrar_cliente", "customers", { id: customer.id, nombre: body.nombre });
    }
    return {
      customer_id: customer.id,
      mensaje: `¡Listo ${body.nombre}! 🙌 Ya tengo tus datos. Cuando quieras armamos el pedido (es contraentrega, pagas al recibir).`,
    };
  },
);
