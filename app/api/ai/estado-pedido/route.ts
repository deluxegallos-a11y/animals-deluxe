import { z } from "zod";
import { eq } from "drizzle-orm";
import { withBridge } from "@/lib/ai/bridge";
import { db } from "@/lib/db/client";
import { orders, orderItems } from "@/lib/db/schema";
import { cop } from "@/lib/ai/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ESTADO_TXT: Record<string, string> = {
  pendiente_confirmacion: "pendiente de confirmación",
  confirmado: "confirmado ✅",
  despachado: "despachado 🚚",
  entregado: "entregado 📦",
  pagado: "pagado 💵",
  cancelado: "cancelado ❌",
};

export const POST = withBridge(
  z.object({ ref: z.string().min(1) }),
  async ({ body }) => {
    if (!db) {
      return { estado: "pendiente_confirmacion", total_cop: 0, items: [], mensaje: `Tu pedido ${body.ref} está pendiente de confirmación 🐓` };
    }
    const ref = body.ref.toUpperCase().trim();
    const [o] = await db.select().from(orders).where(eq(orders.ref, ref)).limit(1);
    if (!o) {
      return { estado: "", total_cop: 0, items: [], mensaje: `No encontré el pedido ${ref}. ¿Me confirmas la referencia? (ej. AD-7F3A)` };
    }
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    const list = items.map((it) => ({ name: it.productName || "", cantidad: it.cantidad ?? 1 }));
    const txt = ESTADO_TXT[o.estado || ""] || o.estado || "";
    return {
      estado: o.estado || "",
      total_cop: o.totalCop ?? 0,
      items: list,
      mensaje: `Tu pedido *${ref}* está ${txt}. Total: ${cop(o.totalCop)} (contraentrega). ${list.length ? `Incluye: ${list.map((i) => `${i.cantidad}× ${i.name}`).join(", ")}.` : ""}`,
    };
  },
);
