"use client";

import { CartProvider } from "@/components/gallos/_lib/useCart";
import { CheckoutProvider } from "@/components/gallos/_lib/useCheckout";
import { applyDogPrices } from "@/components/perros/_lib/dog";

const VIOLET = { from: "#a78bfa", to: "#7c3aed", solid: "#a78bfa", ink: "#ffffff" };

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
  return (
    <CartProvider>
      <CheckoutProvider accent={VIOLET}>{children}</CheckoutProvider>
    </CartProvider>
  );
}
