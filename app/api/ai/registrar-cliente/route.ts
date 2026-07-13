import { z } from "zod";
import { eq } from "drizzle-orm";
import { withBridge, audit } from "@/lib/ai/bridge";
import { db } from "@/lib/db/client";
import { customers } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withBridge(
  // Opción B: lead PARCIAL. Acepta lo que llegue (aunque sea solo el número) y lo
  // va completando. Nunca rechaza; siempre devuelve ok:true si guardó.
  z.object({
    nombre: z.string().optional().default(""),
    telefono: z.union([z.string(), z.number()]).transform((v) => String(v)).optional().default(""),
    ciudad: z.string().optional().default(""),
    direccion: z.string().optional().default(""),
    cedula: z.union([z.string(), z.number()]).transform((v) => String(v)).optional().default(""),
  }).passthrough(),
  async ({ customer, body }) => {
    // 100% PERMISIVO: guarda los campos que lleguen, ignora los que falten, y
    // devuelve SIEMPRE {ok:true, mensaje:""} (el bot no muestra nada; maneja el flujo).
    const nombre = (body.nombre || "").trim();
    const telefono = (body.telefono || "").trim();
    let guardado = false;
    try {
      if (db && !customer.id.startsWith("demo-")) {
        const set: Record<string, unknown> = { estado: "interesado", ultimoContacto: new Date() };
        if (nombre) set.nombre = nombre;
        if (telefono) set.telefono = telefono;
        if (body.ciudad) set.ciudad = body.ciudad;
        if (body.direccion) set.direccion = body.direccion;
        await db.update(customers).set(set).where(eq(customers.id, customer.id));
        await audit("registrar_cliente", "customers", { id: customer.id, nombre, telefono });
        guardado = true;
      }
    } catch {
      /* jamás propagamos el error al cliente; el bot no debe ver un fallo aquí */
    }
    return { ok: true, guardado, customer_id: customer.id, mensaje: "" };
  },
);
