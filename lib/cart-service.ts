/* ===========================================================
   cartService — capa desacoplada de checkout.
   Hoy: WhatsApp contraentrega. Mañana: Shopify Storefront API.
   =========================================================== */
import { cop } from "@/lib/ai/format";

export type CartItem = {
  slug: string;
  name: string;
  presLabel: string;
  priceCOP: number;
  qty: number;
  imageUrl?: string;
  // mapeo a Shopify (placeholder para el futuro)
  variantId?: string;
};

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((s, i) => s + i.priceCOP * i.qty, 0);
}
export function cartCount(items: CartItem[]): number {
  return items.reduce((s, i) => s + i.qty, 0);
}

/** Arma el mensaje de WhatsApp con TODO el carrito (contraentrega). */
export function buildWhatsAppMessage(items: CartItem[]): string {
  const lines = items.map(
    (i) => `• ${i.name}${i.presLabel ? ` (${i.presLabel})` : ""} x${i.qty} — ${cop(i.priceCOP * i.qty)}`,
  );
  return [
    "🐓 *Pedido — Animals Deluxe*",
    "",
    ...lines,
    "",
    `*Subtotal:* ${cop(cartSubtotal(items))}`,
    "💵 Pago: *CONTRAENTREGA* (pago al recibir)",
    "",
    "¿Me confirman envío y total? 🙌",
  ].join("\n");
}

/** Checkout actual: abre WhatsApp con el pedido. */
export function checkoutWhatsApp(items: CartItem[], wa: string): string {
  return `https://wa.me/${wa}?text=${encodeURIComponent(buildWhatsAppMessage(items))}`;
}

/* ── FUTURO: Shopify Storefront API ──────────────────────────
   Para conectar el checkout real de Shopify:
   1. cartCreate { lines: [{ merchandiseId: variantId, quantity }] }
   2. cartLinesAdd / cartLinesUpdate
   3. devolver cart.checkoutUrl y redirigir.
   Requiere SHOPIFY_STOREFRONT_TOKEN + dominio, y mapear cada
   producto/presentación a su variantId (CartItem.variantId).
   Ver README-INTEGRACION.md.
   ──────────────────────────────────────────────────────────── */
export async function checkoutShopify(_items: CartItem[]): Promise<string> {
  // TODO: implementar con Shopify Storefront API (cartCreate → checkoutUrl).
  throw new Error("Shopify checkout aún no conectado. Usa checkoutWhatsApp por ahora.");
}
