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
  // Esquema LENIENTE (§2.1): no rechazamos con el genérico "faltan datos" de zod;
  // validamos los mínimos dentro y devolvemos `campos_faltantes` con nombres.
  z.object({
    items: z
      .array(
        z.object({
          slug: z.string().optional().default(""),
          presentacion: z.string().optional().default(""),
          cantidad: z.number().int().positive().optional().default(1),
        }),
      )
      .optional()
      .default([]),
    nombre: z.string().optional().default(""),
    telefono: z.string().optional().default(""),
    ciudad: z.string().optional().default(""),
    direccion: z.string().optional().default(""),
    cedula: z.union([z.string(), z.number()]).transform((v) => String(v)).optional().default(""),
    correo: z.string().optional().default(""),
    cupon: z.string().optional().default(""),
    metodo: z.enum(["contraentrega", "anticipado"]).optional().default("contraentrega"),
  }),
  async ({ customer, body }) => {
    // §2.1 — CREAR SIEMPRE si están los mínimos. correo/cedula/calle NO bloquean.
    const items = (body.items || []).filter((it) => it.slug && it.slug.trim());
    const FALTA: { campo: string; etiqueta: string }[] = [
      { campo: "nombre", etiqueta: "tu nombre" },
      { campo: "telefono", etiqueta: "tu teléfono" },
      { campo: "ciudad", etiqueta: "tu ciudad" },
      { campo: "direccion", etiqueta: "tu dirección (o la oficina de la transportadora)" },
      { campo: "cedula", etiqueta: "tu número de cédula (la transportadora la exige para entregar)" },
    ];
    const faltantes = FALTA.filter((f) => !String((body as Record<string, unknown>)[f.campo] || "").trim());
    if (!items.length) faltantes.push({ campo: "producto", etiqueta: "el producto que quieres" });
    if (faltantes.length) {
      await logEvent("pedido_no_creado", { motivo: "campos_faltantes", campos: faltantes.map((f) => f.campo), sub_id: customer.uchatSubId || customer.id });
      return {
        ok: false,
        campos_faltantes: faltantes.map((f) => f.campo),
        mensaje: `Para confirmar tu pedido me falta ${faltantes.map((f) => f.etiqueta).join(", ")}. ¿Me lo pasas? 🐓`,
      };
    }

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
      items,
      nombre: body.nombre, telefono: body.telefono, ciudad: body.ciudad, direccion: body.direccion,
      cedula: body.cedula || "",
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
        cedula: body.cedula || "",
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
