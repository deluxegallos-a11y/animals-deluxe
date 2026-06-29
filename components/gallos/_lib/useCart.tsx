"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import type { Product, CartLine } from "@/components/gallos/_lib/types";
import { PRODUCTS } from "@/components/gallos/_lib/data";
import { track } from "@/components/gallos/_lib/tracking";
import { checkoutShopify } from "@/app/order-actions";

interface CartCtx {
  lines: CartLine[];
  isOpen: boolean;
  count: number;
  subtotal: number;
  open: () => void;
  close: () => void;
  add: (product: Product, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  checkout: () => Promise<void>;
  loading: boolean;
}

const Ctx = createContext<CartCtx | null>(null);

/**
 * Inyecta los precios reales (tomados de NUESTRO catálogo por slug en el
 * server component de la página) sobre el array PRODUCTS, que es la única
 * fuente de precio de la landing (tarjetas, StickyCTA y carrito).
 * Se aplica en el cuerpo del provider para que el SSR y el cliente
 * rendericen el mismo precio (sin desajuste de hidratación).
 */
function applyPriceOverrides(overrides?: Record<string, number | undefined>) {
  if (!overrides) return;
  for (const p of PRODUCTS) {
    const v = overrides[p.id];
    if (typeof v === "number" && v > 0) p.price = v;
  }
}

export function CartProvider({
  children,
  priceOverrides,
}: {
  children: React.ReactNode;
  priceOverrides?: Record<string, number | undefined>;
}) {
  applyPriceOverrides(priceOverrides);

  const [lines, setLines] = useState<CartLine[]>([]);
  const [isOpen, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const add = useCallback((product: Product, qty = 1) => {
    setLines((prev) => {
      const found = prev.find((l) => l.product.id === product.id);
      if (found) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, qty: l.qty + qty } : l,
        );
      }
      return [...prev, { product, qty }];
    });
    setOpen(true);
    track("add_to_cart", {
      id: product.id,
      name: product.name,
      price: product.price,
      qty,
    });
  }, []);

  const setQty = useCallback((id: string, qty: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.product.id === id ? { ...l, qty: Math.max(0, qty) } : l))
        .filter((l) => l.qty > 0),
    );
  }, []);

  const remove = useCallback((id: string) => {
    setLines((prev) => prev.filter((l) => l.product.id !== id));
  }, []);

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + l.product.price * l.qty, 0),
    [lines],
  );
  const count = useMemo(() => lines.reduce((s, l) => s + l.qty, 0), [lines]);

  const checkout = useCallback(async () => {
    if (!lines.length) return;
    setLoading(true);
    track("begin_checkout", { value: subtotal, items: count });
    try {
      // Checkout real de NUESTRA plataforma: arma el permalink de Shopify
      // (pasarela de pago) a partir de los variant IDs por slug.
      const res = await checkoutShopify(
        lines.map((l) => ({ slug: l.product.id, cantidad: l.qty })),
      );
      if (res.ok) {
        window.location.href = res.url;
        return;
      }
      // Fallback contraentrega: WhatsApp con el pedido (siempre disponible).
      const text = encodeURIComponent(
        "Hola, quiero pedir:\n" +
          lines.map((l) => `• ${l.qty}x ${l.product.name}`).join("\n") +
          `\nTotal aprox: $${subtotal.toLocaleString("es-CO")} COP` +
          "\nPago: CONTRAENTREGA (pago al recibir)",
      );
      window.open(
        `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP || "573000000000"}?text=${text}`,
        "_blank",
      );
    } finally {
      setLoading(false);
    }
  }, [lines, subtotal, count]);

  const value: CartCtx = {
    lines,
    isOpen,
    count,
    subtotal,
    open: () => setOpen(true),
    close: () => setOpen(false),
    add,
    setQty,
    remove,
    checkout,
    loading,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart debe usarse dentro de CartProvider");
  return ctx;
}
