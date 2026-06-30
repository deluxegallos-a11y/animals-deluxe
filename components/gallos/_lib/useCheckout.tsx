"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import type { Product } from "@/components/gallos/_lib/types";
import { track } from "@/components/gallos/_lib/tracking";
import { checkoutShopify } from "@/app/order-actions";

/* ============================================================
   Asistente de compra por pasos (animado), compartido por las
   3 landings. Reemplaza el "abrir carrito" por un flujo:
     1) elegir producto/versión (solo si el botón es genérico)
     2) elegir método de pago
     3a) contraentrega -> formulario (CodForm) -> ¡gracias!
     3b) anticipado    -> pasarela Shopify (PSE/Bancolombia)
   ============================================================ */

/** Una opción del paso "¿cuál quieres?" (puede agrupar varios productos,
 *  p.ej. "Quiero los dos" en gallos). */
export type Choice = { label: string; sub?: string; products: Product[] };

/** Acento de color por landing (perros = violeta, gallos/caballos = dorado). */
export type Accent = { from: string; to: string; solid: string; ink: string };

export type CheckoutStep = "product" | "pay" | "cod" | "done";

interface CheckoutCtx {
  accent: Accent;
  open: boolean;
  step: CheckoutStep;
  choices: Choice[];
  selected: Product[];
  ref: string;
  loading: boolean;
  /** Inicia el flujo. `products` = producto(s) ya definidos (botón específico,
   *  salta al pago). `choices` = opciones a elegir (botón genérico). */
  start: (opts: { products?: Product[]; choices?: Choice[] }) => void;
  /** Elige una opción en el paso "producto" y avanza al pago. */
  pick: (products: Product[]) => void;
  /** Pago contraentrega -> abre el formulario. */
  payCod: () => void;
  /** Pago anticipado -> pasarela Shopify (con fallback WhatsApp). */
  payAnticipado: () => Promise<void>;
  /** El formulario se envió con éxito -> pantalla de gracias. */
  setDone: (ref: string) => void;
  /** Volver al paso anterior dentro del flujo. */
  back: () => void;
  close: () => void;
}

const Ctx = createContext<CheckoutCtx | null>(null);

const GOLD: Accent = {
  from: "#ffe9a8",
  to: "#e0a92e",
  solid: "#e0a92e",
  ink: "#1a1206",
};

export function CheckoutProvider({
  children,
  accent = GOLD,
}: {
  children: React.ReactNode;
  accent?: Accent;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<CheckoutStep>("product");
  const [choices, setChoices] = useState<Choice[]>([]);
  const [selected, setSelected] = useState<Product[]>([]);
  const [ref, setRef] = useState("");
  const [loading, setLoading] = useState(false);

  const start = useCallback(
    (opts: { products?: Product[]; choices?: Choice[] }) => {
      setRef("");
      if (opts.products && opts.products.length) {
        setSelected(opts.products);
        setChoices([]);
        setStep("pay");
      } else {
        setChoices(opts.choices || []);
        setSelected([]);
        setStep("product");
      }
      setOpen(true);
      track("begin_checkout", {});
    },
    [],
  );

  const pick = useCallback((products: Product[]) => {
    setSelected(products);
    setStep("pay");
    track("select_product", {
      items: products.map((p) => p.id).join(","),
    });
  }, []);

  const payCod = useCallback(() => setStep("cod"), []);

  const payAnticipado = useCallback(async () => {
    if (!selected.length || loading) return;
    setLoading(true);
    const subtotal = selected.reduce((s, p) => s + p.price, 0);
    track("begin_checkout", { value: subtotal, metodo: "anticipado" });
    try {
      const res = await checkoutShopify(
        selected.map((p) => ({ slug: p.id, cantidad: 1 })),
      );
      if (res.ok) {
        window.location.href = res.url;
        return;
      }
      // Fallback: si la pasarela no resuelve, contacto por WhatsApp.
      const text = encodeURIComponent(
        "Hola, quiero PAGAR ANTICIPADO (transferencia/PSE):\n" +
          selected.map((p) => `• ${p.name}`).join("\n") +
          `\nTotal: $${subtotal.toLocaleString("es-CO")} COP`,
      );
      window.open(
        `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP || "573000000000"}?text=${text}`,
        "_blank",
      );
    } finally {
      setLoading(false);
    }
  }, [selected, loading]);

  const setDone = useCallback((r: string) => {
    setRef(r);
    setStep("done");
    track("purchase", { metodo: "contraentrega" });
  }, []);

  const back = useCallback(() => {
    setStep((s) => {
      if (s === "pay") return choices.length ? "product" : "pay";
      if (s === "cod") return "pay";
      return s;
    });
  }, [choices.length]);

  const close = useCallback(() => setOpen(false), []);

  const value: CheckoutCtx = {
    accent,
    open,
    step,
    choices,
    selected,
    ref,
    loading,
    start,
    pick,
    payCod,
    payAnticipado,
    setDone,
    back,
    close,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCheckout() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCheckout debe usarse dentro de CheckoutProvider");
  return ctx;
}
