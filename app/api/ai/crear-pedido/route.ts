import { z } from "zod";
import { eq } from "drizzle-orm";
import { withBridge, audit, logEvent } from "@/lib/ai/bridge";
import { db } from "@/lib/db/client";
import { customers } from "@/lib/db/schema";
import { getProducts } from "@/lib/ai/data";
import { createOrder } from "@/lib/ai/orders";
import { pushOrderToShopify } from "@/lib/shopify-sync";
import { cop } from "@/lib/ai/format";
import { searchProducts } from "@/lib/ai/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (x: unknown) => (x == null ? "" : String(x)).trim();
const qty = (x: unknown) => {
  const n = parseInt(String(x ?? "").replace(/[^0-9]/g, ""), 10);
  return n > 0 ? n : 1;
};

export const POST = withBridge(
  // Body PERMISIVO (§2.1): NUNCA rechazamos por formato ("faltan datos"). Normalizamos
  // y resolvemos todo dentro; si falta un mínimo real, devolvemos campos_faltantes.
  z.object({}).passthrough(),
  async ({ customer, body }) => {
    const b = body as Record<string, unknown>;
    // LOG del request crudo (para depurar exactamente qué manda UChat).
    await logEvent("crear_pedido_req", { sub_id: customer.uchatSubId || customer.id, body: b });
    const catalog = await getProducts();

    // --- Campos (acepta nombres alternativos que puede mandar el bot) ---
    const nombre = str(b.nombre ?? b.cliente ?? b.nombre_cliente ?? b.nombreCliente);
    const telefono = str(b.telefono ?? b.celular ?? b.movil ?? b.whatsapp ?? b.tel ?? b.numero);
    const ciudad = str(b.ciudad ?? b.municipio ?? b.pueblo);
    const oficina = str(b.oficina ?? b.agencia ?? b.punto_recogida ?? b.transportadora_oficina);
    let direccion = str(b.direccion ?? b.direccion_entrega ?? b.dir);
    if (!direccion && oficina) direccion = oficina;
    else if (direccion && oficina && !direccion.toLowerCase().includes(oficina.toLowerCase())) direccion = `${direccion} · ${oficina}`;
    const cedula = str(b.cedula ?? b.cc ?? b.documento ?? b.identificacion ?? b.nid);
    const correo = str(b.correo ?? b.email);
    const cupon = str(b.cupon ?? b.codigo ?? b.cupon_codigo);
    const metodo: "contraentrega" | "anticipado" = str(b.metodo).toLowerCase().startsWith("antic") ? "anticipado" : "contraentrega";

    // --- Resolver productos: acepta items[] (con slug O nombre) o producto suelto + cantidad ---
    type Raw = { name: string; cantidad: number; presentacion?: string };
    const raws: Raw[] = [];
    // items puede llegar como ARRAY o como STRING con JSON dentro (falla típica de UChat),
    // o como un solo objeto. Toleramos las 3 formas.
    let itemsArr: unknown = b.items;
    if (typeof itemsArr === "string" && itemsArr.trim()) {
      try { itemsArr = JSON.parse(itemsArr); } catch { itemsArr = []; }
    }
    if (itemsArr && !Array.isArray(itemsArr) && typeof itemsArr === "object") itemsArr = [itemsArr];
    if (Array.isArray(itemsArr)) {
      for (const it of itemsArr as Record<string, unknown>[]) {
        const name = str(it?.slug ?? it?.nombre ?? it?.name ?? it?.producto ?? it?.producto_nombre);
        if (name) raws.push({ name, cantidad: qty(it?.cantidad ?? it?.qty), presentacion: str(it?.presentacion) || undefined });
      }
    }
    // producto "suelto" (fuera de items) — muy común desde el bot
    const prodSuelto = str(b.producto ?? b.producto_nombre ?? b.nombre_producto ?? b.item);
    if (!raws.length && prodSuelto) raws.push({ name: prodSuelto, cantidad: qty(b.cantidad ?? b.unidades) });

    // resolver cada nombre → slug REAL del catálogo (por slug exacto o búsqueda tolerante)
    const items: { slug: string; presentacion?: string; cantidad: number }[] = [];
    const noEncontrados: string[] = [];
    for (const r of raws) {
      const bySlug = catalog.find((p) => p.slug === r.name.toLowerCase());
      let slug = bySlug?.slug;
      if (!slug) {
        const res = searchProducts(r.name, catalog);
        if (res.product) slug = res.product.slug;
      }
      if (slug) items.push({ slug, presentacion: r.presentacion, cantidad: r.cantidad });
      else noEncontrados.push(r.name);
    }

    // --- Mínimos → campos_faltantes con NOMBRE (nunca genérico) ---
    const faltantes: string[] = [];
    if (!nombre) faltantes.push("nombre");
    if (!telefono) faltantes.push("telefono");
    if (!ciudad) faltantes.push("ciudad");
    if (!direccion) faltantes.push("direccion");
    if (!cedula) faltantes.push("cedula");
    if (!items.length) faltantes.push("producto");
    if (faltantes.length) {
      await logEvent("pedido_no_creado", {
        motivo: "campos_faltantes", campos: faltantes, no_encontrados: noEncontrados,
        recibido: Object.keys(b), sub_id: customer.uchatSubId || customer.id,
      });
      const et: Record<string, string> = {
        nombre: "tu nombre", telefono: "tu teléfono", ciudad: "tu ciudad",
        direccion: "tu dirección (o la oficina de la transportadora)",
        cedula: "tu número de cédula (la transportadora la exige para entregar)",
        producto: noEncontrados.length ? `el producto (no encontré "${noEncontrados[0]}")` : "el producto que quieres",
      };
      return {
        ok: false,
        campos_faltantes: faltantes,
        mensaje: `Para confirmar tu pedido me falta ${faltantes.map((f) => et[f]).join(", ")}. ¿Me lo pasas? 🐓`,
      };
    }

    // actualizar datos del cliente
    if (db && !customer.id.startsWith("demo-")) {
      await db
        .update(customers)
        .set({ nombre, telefono, ciudad, direccion, estado: "cliente", ultimoContacto: new Date() })
        .where(eq(customers.id, customer.id));
    }

    const order = await createOrder({
      subId: customer.uchatSubId || customer.id,
      customerId: customer.id,
      items,
      nombre, telefono, ciudad, direccion, cedula,
      cupon: cupon || undefined,
      metodo,
      catalog,
    });

    // La ref que ve el cliente SIEMPRE es la interna AD-XXXX (con esa consulta
    // estado-pedido, y es idempotente). El nombre de Shopify queda guardado aparte.
    const ref = order.ref;
    if (!order.reused && !order.pedido_id.startsWith("demo-")) {
      const shop = await pushOrderToShopify({
        orderId: order.pedido_id,
        nombre, telefono, ciudad, direccion, cedula,
        items: order.items.map((it) => ({
          slug: it.slug, name: it.name, presentacionLabel: it.presentacionLabel,
          precioCop: it.precioCop, cantidad: it.cantidad, shopifyVariantId: it.shopifyVariantId,
        })),
        note: `Pedido contraentrega tomado por el bot (WhatsApp). Ref interna: ${order.ref}`,
      });
      await logEvent(shop.ok ? "pedido_shopify_ok" : "pedido_shopify_error", {
        ref: order.ref, shopify: shop.shopifyOrderName, error: shop.error, skipped: shop.skipped,
      });
    }

    if (!order.reused) {
      await audit("crear_pedido", "orders", { ref: order.ref, total: order.total_cop });
      await logEvent("pedido_creado", { ref: order.ref, total: order.total_cop, metodo });
    }

    const listaProductos = order.items.map((it) => `${it.cantidad}× ${it.name}`).join(", ");
    const mensaje =
      `✅ ¡Listo${nombre ? " " + nombre.split(" ")[0] : ""}! Tu pedido quedó confirmado 🎉 Ref *${ref}*\n` +
      `${listaProductos}\n` +
      `Subtotal: ${cop(order.subtotal_cop)}` +
      (order.descuento_cop ? ` · Descuento: -${cop(order.descuento_cop)}` : "") +
      ` · Envío: ${order.envio_cop ? cop(order.envio_cop) : "GRATIS"}\n` +
      `*Total a pagar al recibir: ${cop(order.total_cop)}* 🚚\n` +
      `Te despachamos a ${ciudad} contra entrega. ¡Gracias por confiar en Animals Deluxe! 🐓`;

    return {
      pedido_id: order.pedido_id,
      ref,
      total_cop: order.total_cop,
      flete: order.envio_cop,
      envio_cop: order.envio_cop,
      descuento_cop: order.descuento_cop,
      estado: order.estado,
      asesor: order.asesor,
      no_encontrados: noEncontrados,
      mensaje,
    };
  },
);
