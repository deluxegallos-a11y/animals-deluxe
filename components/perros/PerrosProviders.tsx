"use client";

import { CartProvider } from "@/components/gallos/_lib/useCart";
import { applyDogPrices } from "@/components/perros/_lib/dog";

/**
 * Aplica los precios reales (de NUESTRO catálogo, slug "more-muscle-dogs") sobre
 * DOG_PRODUCT / DOG_PRODUCT_6M antes de renderizar el árbol, y provee el carrito
 * (reusa el CartProvider de gallos -> checkout Shopify + fallback WhatsApp). Los
 * precios llegan desde el server component, así SSR y cliente coinciden (sin
 * desajuste de hidratación). Mismo patrón que CaballosProviders/priceOverrides.
 */
export function PerrosProviders({
  prices,
  children,
}: {
  prices?: { threeM?: number; sixM?: number };
  children: React.ReactNode;
}) {
  applyDogPrices(prices);
  return <CartProvider>{children}</CartProvider>;
}
