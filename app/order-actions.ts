"use server";

/* ===========================================================
   Pedido contraentrega desde la WEB (formulario de la ficha).
   Reusa createOrder (DB, idempotente) + pushOrderToShopify.
   Seguridad: Zod estricto + whitelist de slugs del catálogo +
   idempotencia (no duplica el mismo pedido en 1h).
   =========================================================== */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers, products, reviews, type Presentacion } from "@/lib/db/schema";
import { createOrder } from "@/lib/ai/orders";
import { pushOrderToShopify } from "@/lib/shopify-sync";
import { getShopifyCreds } from "@/lib/shopify";
import { getProducts, getStoreConfig } from "@/lib/ai/data";

/* ===========================================================
   Checkout ONLINE por Shopify: resuelve los variant IDs del
   carrito y arma un "cart permalink" de Shopify
   (https://tienda.myshopify.com/cart/{variantId}:{qty},...).
   Ese enlace agrega los productos al carrito de Shopify y lleva
   al cliente directo a la pasarela de pago. No requiere draft
   orders ni scopes extra: solo que la tienda online esté
   publicada (sin contraseña).
   =========================================================== */
const checkoutSchema = z.array(z.object({
  slug: z.string().min(1).max(80),
  presentacion: z.string().max(80).optional().default(""),
  cantidad: z.coerce.number().int().min(1).max(20).optional().default(1),
})).min(1).max(20);

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

export async function checkoutShopify(rawItems: unknown): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(rawItems);
  if (!parsed.success) return { ok: false, error: "Carrito inválido." };
  const creds = db ? await getShopifyCreds() : null;
  if (!db || !creds) return { ok: false, error: "Pago online no disponible ahora. Usa WhatsApp contraentrega." };

  try {
    const parts: string[] = [];
    for (const it of parsed.data) {
      const [p] = await db.select({ pres: products.presentations }).from(products).where(eq(products.slug, it.slug)).limit(1);
      const pres = (p?.pres as Presentacion[]) || [];
      const match = it.presentacion ? pres.find((x) => x.label === it.presentacion) : pres[0];
      const num = match?.shopifyVariantId?.split("/").pop(); // gid://.../ProductVariant/123 -> 123
      if (num && /^\d+$/.test(num)) parts.push(`${num}:${it.cantidad}`);
    }
    if (!parts.length) return { ok: false, error: "No se pudieron resolver los productos en Shopify." };

    // Sin ?storefront=true el permalink salta el carrito y va DIRECTO al checkout (pasarela de pago).
    const url = `https://${creds.domain}/cart/${parts.join(",")}`;
    return { ok: true, url };
  } catch {
    return { ok: false, error: "No se pudo iniciar el pago. Intenta de nuevo." };
  }
}

/* ===========================================================
   Reseñas: el público agrega su reseña al producto.
   Se autopublica (estado "aprobado"); el admin puede borrarla.
   Seguridad: Zod estricto + el slug debe existir en el catálogo.
   =========================================================== */
const reviewSchema = z.object({
  slug: z.string().min(1).max(80),
  nombre: z.string().trim().min(2).max(40),
  ciudad: z.string().trim().max(40).optional().default(""),
  rating: z.coerce.number().int().min(1).max(5).optional().default(5),
  texto: z.string().trim().min(8).max(500),
});

export type AddReviewResult =
  | { ok: true; review: { id: string; nombre: string; ciudad: string; rating: number; texto: string; createdAt: string } }
  | { ok: false; error: string };

export async function addReview(raw: unknown): Promise<AddReviewResult> {
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Revisa los datos de tu reseña (mínimo 8 caracteres)." };
  const b = parsed.data;
  if (!db) return { ok: false, error: "No se pudo guardar la reseña ahora." };

  try {
    // Solo se permiten reseñas de productos que existen.
    const catalog = await getProducts();
    if (!catalog.some((p) => p.slug === b.slug)) return { ok: false, error: "Producto no válido." };

    const [r] = await db.insert(reviews).values({
      productSlug: b.slug, nombre: b.nombre, ciudad: b.ciudad, rating: b.rating, texto: b.texto, estado: "aprobado",
    }).returning();

    return {
      ok: true,
      review: { id: r.id, nombre: r.nombre, ciudad: r.ciudad || "", rating: r.rating || 5, texto: r.texto, createdAt: new Date().toISOString() },
    };
  } catch {
    return { ok: false, error: "No se pudo guardar la reseña. Intenta de nuevo." };
  }
}

const schema = z.object({
  nombre: z.string().trim().min(2).max(80),
  telefono: z.string().trim().min(7).max(20).regex(/^[0-9+()\-\s]+$/, "Teléfono inválido"),
  departamento: z.string().trim().min(2).max(60),
  ciudad: z.string().trim().min(2).max(60),
  direccion: z.string().trim().min(5).max(160),
  upsell: z.boolean().optional().default(false),
  items: z.array(z.object({
    slug: z.string().min(1).max(80),
    presentacion: z.string().max(60).optional().default(""),
    cantidad: z.coerce.number().int().min(1).max(20).optional().default(1),
  })).min(1).max(20),
});

export type PedidoWebResult =
  | { ok: true; ref: string; total: number; reused: boolean; shopify: boolean }
  | { ok: false; error: string };

export async function crearPedidoWeb(raw: unknown): Promise<PedidoWebResult> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Revisa los datos del formulario." };
  const b = parsed.data;

  try {
    const catalog = await getProducts();
    // Seguridad: solo productos que existen y están activos en el catálogo.
    const validItems = b.items.filter((it) => catalog.some((p) => p.slug === it.slug));
    if (!validItems.length) return { ok: false, error: "Los productos seleccionados no están disponibles." };

    // Upsell/promo opcional configurada en el panel.
    let upsellNote = "";
    if (b.upsell) {
      const cfg = await getStoreConfig();
      if (cfg.codForm?.upsellEnabled && cfg.codForm.upsellTitulo) {
        const precio = cfg.codForm.upsellPrecioCop || 0;
        upsellNote = `\n➕ AGREGÓ PROMO: ${cfg.codForm.upsellTitulo}${precio ? ` (+$${precio.toLocaleString("es-CO")})` : ""}`;
      }
    }

    // Cliente (lead web)
    let customerId = "web-" + Date.now();
    if (db) {
      const [c] = await db.insert(customers).values({
        nombre: b.nombre, telefono: b.telefono, departamento: b.departamento, ciudad: b.ciudad, direccion: b.direccion,
        canalOrigen: "web", estado: "cliente", ultimoContacto: new Date(),
      }).returning();
      customerId = c?.id || customerId;
    }

    // Pedido COD (idempotente)
    const order = await createOrder({
      subId: "web:" + b.telefono, customerId, items: validItems,
      nombre: b.nombre, telefono: b.telefono, ciudad: b.ciudad, direccion: b.direccion,
      metodo: "contraentrega", catalog,
    });

    // Shopify (libro de pedidos) — opcional, no rompe si no está configurado.
    let shopify = false;
    if (!order.reused && !order.pedido_id.startsWith("demo-")) {
      try {
        const shop = await pushOrderToShopify({
          orderId: order.pedido_id,
          nombre: b.nombre, telefono: b.telefono, ciudad: b.ciudad, direccion: b.direccion,
          items: order.items.map((it) => ({
            slug: it.slug, name: it.name, presentacionLabel: it.presentacionLabel,
            precioCop: it.precioCop, cantidad: it.cantidad, shopifyVariantId: it.shopifyVariantId,
          })),
          note: `Pedido contraentrega desde la web. Ref interna: ${order.ref}\nUbicación: ${b.ciudad}, ${b.departamento}${upsellNote}`,
        });
        shopify = !!shop.ok;
      } catch { /* Shopify es opcional; el pedido ya quedó en la plataforma */ }
    }

    return { ok: true, ref: order.ref, total: order.total_cop, reused: order.reused, shopify };
  } catch {
    return { ok: false, error: "No se pudo crear el pedido. Intenta de nuevo en un momento." };
  }
}
