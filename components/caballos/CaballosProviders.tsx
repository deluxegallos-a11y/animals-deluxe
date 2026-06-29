"use client";

import { CartProvider } from "@/components/gallos/_lib/useCart";
import { applyHorsePrice } from "@/components/caballos/_lib/horse";

/**
 * Aplica el precio real (de NUESTRO catálogo, slug "horse-deluxe") sobre
 * HORSE_PRODUCT antes de renderizar el árbol, y provee el carrito (reusa el
 * CartProvider de gallos -> checkout Shopify + fallback WhatsApp). El precio
 * llega desde el server component, así SSR y cliente coinciden (sin desajuste
 * de hidratación). Mismo patrón que priceOverrides en /gallos.
 */
export function CaballosProviders({
  price,
  children,
}: {
  price?: number;
  children: React.ReactNode;
}) {
  applyHorsePrice(price);
  return <CartProvider>{children}</CartProvider>;
}
