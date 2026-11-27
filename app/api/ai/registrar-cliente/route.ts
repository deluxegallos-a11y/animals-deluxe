import { z } from "zod";
import { and, desc, eq, gte } from "drizzle-orm";
import { withBridge, audit } from "@/lib/ai/bridge";
import { db } from "@/lib/db/client";
import { customers, orders } from "@/lib/db/schema";

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
  async ({ customer, body, tenant }) => {
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
        // PAGO ANTICIPADO: el pedido nació sin datos (crear_pedido manda solo las cuentas).
        // Los datos que llegan con el comprobante completan ESE pedido (el más reciente
        // por verificar pago, últimos 7 días) — sin pisar lo que ya tenga.
        if (tenant.paymentMode === "anticipado") {
          const desde = new Date(Date.now() - 7 * 86_400_000);
          const [o] = await db.select().from(orders)
            .where(and(eq(orders.customerId, customer.id), eq(orders.estado, "por_verificar_pago"), gte(orders.createdAt, desde)))
            .orderBy(desc(orders.createdAt)).limit(1);
          if (o) {
            const cedula = String(body.cedula || "").replace(/\D/g, "");
            const upd: Record<string, unknown> = {};
            if (nombre.split(/\s+/).filter((w) => w.length >= 2).length >= 2) upd.nombre = nombre;
            if (telefono && !o.telefono) upd.telefono = telefono;
            if (body.ciudad && !o.ciudad) upd.ciudad = body.ciudad;
            if (body.direccion && !o.direccion) upd.direccion = body.direccion;
            if (cedula.length >= 5 && !o.cedula) upd.cedula = cedula;
            if (Object.keys(upd).length) {
              await db.update(orders).set(upd).where(eq(orders.id, o.id));
              await audit("datos_pedido_anticipado", "orders", { ref: o.ref, campos: Object.keys(upd) });
            }
          }
        }
      }
    } catch {
      /* jamás propagamos el error al cliente; el bot no debe ver un fallo aquí */
    }
    return { ok: true, guardado, customer_id: customer.id, mensaje: "" };
  },
);
