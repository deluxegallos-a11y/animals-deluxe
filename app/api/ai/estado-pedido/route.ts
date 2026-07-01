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
      return { estado: "pendiente_confirmacion", total_cop: 0, guia: "", transportadora: "", requiere_asesor: false, items: [], mensaje: `Tu pedido ${body.ref} está pendiente de confirmación 🐓` };
    }
    const ref = body.ref.toUpperCase().trim();
    const [o] = await db.select().from(orders).where(eq(orders.ref, ref)).limit(1);
    if (!o) {
      // Sin info clara → que un asesor lo confirme (UChat asigna la conversación).
      return {
        estado: "sin_info", total_cop: 0, guia: "", transportadora: "", requiere_asesor: true, items: [],
        mensaje: "Dame un momento, ya te confirmo cómo va tu envío 🐓",
      };
    }
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    const list = items.map((it) => ({ name: it.productName || "", cantidad: it.cantidad ?? 1 }));
    const txt = ESTADO_TXT[o.estado || ""] || o.estado || "";
    const guia = o.guia || "";
    const transportadora = o.transportadora || "";
    // Si ya está despachado y hay guía, dásela al cliente para que rastree.
    const infoEnvio = o.estado === "despachado" && guia
      ? ` Ya va en camino${transportadora ? ` por *${transportadora}*` : ""}. Guía: *${guia}*.`
      : "";
    // Si el estado no es uno conocido, dejar que un asesor confirme.
    const requiere_asesor = !ESTADO_TXT[o.estado || ""];
    return {
      estado: o.estado || "",
      total_cop: o.totalCop ?? 0,
      guia,
      transportadora,
      requiere_asesor,
      items: list,
      mensaje: `Tu pedido *${ref}* está ${txt}. Total: ${cop(o.totalCop)} (contraentrega).${infoEnvio} ${list.length ? `Incluye: ${list.map((i) => `${i.cantidad}× ${i.name}`).join(", ")}.` : ""}`,
    };
  },
);
