import { z } from "zod";
import { eq } from "drizzle-orm";
import { withBridge, audit, logEvent } from "@/lib/ai/bridge";
import { db } from "@/lib/db/client";
import { customers } from "@/lib/db/schema";
import { getProducts } from "@/lib/ai/data";
import { createOrder } from "@/lib/ai/orders";
import { pushOrderToShopify } from "@/lib/shopify-sync";
import { cop } from "@/lib/ai/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withBridge(
  z.object({
    items: z
      .array(
        z.object({
          slug: z.string().min(1),
          presentacion: z.string().optional().default(""),
          cantidad: z.number().int().positive().optional().default(1),
        }),
      )
      .min(1),
    nombre: z.string().min(1),
    telefono: z.string().min(1),
    ciudad: z.string().min(1),
    direccion: z.string().min(1),
    cupon: z.string().optional().default(""),
    metodo: z.enum(["contraentrega", "anticipado"]).optional().default("contraentrega"),
  }),
  async ({ customer, body }) => {
    const catalog = await getProducts();

    // actualizar datos del cliente
    if (db && !customer.id.startsWith("demo-")) {
      await db
        .update(customers)
        .set({
          nombre: body.nombre, telefono: body.telefono, ciudad: body.ciudad,
          direccion: body.direccion, estado: "cliente", ultimoContacto: new Date(),
        })
        .where(eq(customers.id, customer.id));
    }

    const order = await createOrder({
      subId: customer.uchatSubId || customer.id,
      customerId: customer.id,
      items: body.items,
      nombre: body.nombre, telefono: body.telefono, ciudad: body.ciudad, direccion: body.direccion,
      cupon: body.cupon || undefined,
      metodo: body.metodo,
      catalog,
    });

    // Registrar la orden en Shopify (libro de pedidos / inventario). NO notifica
    // al cliente. Si Shopify falla o no está configurado, el pedido COD ya quedó
    // guardado en Supabase y el flujo del bot continúa con la ref interna.
    let ref = order.ref;
    if (!order.reused && !order.pedido_id.startsWith("demo-")) {
      const shop = await pushOrderToShopify({
        orderId: order.pedido_id,
        nombre: body.nombre, telefono: body.telefono, ciudad: body.ciudad, direccion: body.direccion,
        items: order.items.map((it) => ({
          slug: it.slug, name: it.name, presentacionLabel: it.presentacionLabel,
          precioCop: it.precioCop, cantidad: it.cantidad, shopifyVariantId: it.shopifyVariantId,
        })),
        note: `Pedido contraentrega tomado por el bot (WhatsApp). Ref interna: ${order.ref}`,
      });
      if (shop.ok && shop.shopifyOrderName) ref = shop.shopifyOrderName;
      await logEvent(shop.ok ? "pedido_shopify_ok" : "pedido_shopify_error", {
        ref: order.ref, shopify: shop.shopifyOrderName, error: shop.error, skipped: shop.skipped,
      });
    }

    if (!order.reused) {
      await audit("crear_pedido", "orders", { ref: order.ref, total: order.total_cop });
      await logEvent("pedido_creado", { ref: order.ref, total: order.total_cop, metodo: body.metodo });
    }

    const mensaje =
      `¡Pedido confirmado! 🎉 Ref *${ref}*\n` +
      `Subtotal: ${cop(order.subtotal_cop)}` +
      (order.descuento_cop ? ` · Descuento: -${cop(order.descuento_cop)}` : "") +
      ` · Envío: ${order.envio_cop ? cop(order.envio_cop) : "GRATIS"}\n` +
      `*Total a pagar al recibir: ${cop(order.total_cop)}* 🚚\n` +
      (order.asesor.nombre ? `Tu asesor ${order.asesor.nombre} coordina la entrega. ¡Gracias por confiar en Animals Deluxe! 🐓` : "¡Gracias por tu compra! 🐓");

    return {
      pedido_id: order.pedido_id,
      ref,
      total_cop: order.total_cop,
      envio_cop: order.envio_cop,
      descuento_cop: order.descuento_cop,
      estado: order.estado,
      asesor: order.asesor,
      mensaje,
    };
  },
);
