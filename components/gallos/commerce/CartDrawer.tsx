"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useCart } from "@/components/gallos/_lib/useCart";
import { Button } from "@/components/gallos/shared/Button";
import { Icon } from "@/components/gallos/shared/Icon";

export function CartDrawer() {
  const { isOpen, close, lines, subtotal, setQty, remove, checkout, loading } =
    useCart();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.aside
            className="fixed right-0 top-0 z-[70] flex h-dvh w-full max-w-md flex-col border-l border-border bg-background shadow-[var(--shadow-deep)]"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-label="Carrito de compra"
          >
            <header className="flex items-center justify-between border-b border-border p-5">
              <h2 className="font-heading text-xl text-white">Tu carrito</h2>
              <button
                onClick={close}
                aria-label="Cerrar"
                className="grid h-10 w-10 place-items-center rounded-[20px] border border-border text-white"
              >
                <Icon name="close" size={18} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
              {lines.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-white/50">
                  <Icon name="cart" size={40} />
                  <p>Tu carrito está vacío.</p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {lines.map((l) => (
                    <li
                      key={l.product.id}
                      className="flex gap-3 rounded-[20px] border border-border bg-surface p-3"
                    >
                      <div className="relative h-20 w-16 shrink-0">
                        <Image
                          src={l.product.image}
                          alt={l.product.name}
                          fill
                          className="object-contain"
                        />
                      </div>
                      <div className="flex flex-1 flex-col">
                        <p className="text-sm font-semibold text-white">
                          {l.product.name}
                        </p>
                        <p className="text-xs text-gold">
                          ${l.product.price.toLocaleString("es-CO")} COP
                        </p>
                        <div className="mt-auto flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setQty(l.product.id, l.qty - 1)}
                              aria-label="Menos"
                              className="grid h-7 w-7 place-items-center rounded-lg border border-border text-white"
                            >
                              <Icon name="minus" size={14} />
                            </button>
                            <span className="w-6 text-center text-sm text-white">
                              {l.qty}
                            </span>
                            <button
                              onClick={() => setQty(l.product.id, l.qty + 1)}
                              aria-label="Más"
                              className="grid h-7 w-7 place-items-center rounded-lg border border-border text-white"
                            >
                              <Icon name="plus" size={14} />
                            </button>
                          </div>
                          <button
                            onClick={() => remove(l.product.id)}
                            className="text-xs text-white/45 hover:text-danger"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {lines.length > 0 && (
              <footer className="border-t border-border p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm text-white/60">Subtotal</span>
                  <span className="font-display text-2xl text-white">
                    ${subtotal.toLocaleString("es-CO")} COP
                  </span>
                </div>
                <Button
                  variant="primary"
                  icon="arrow-right"
                  fullWidth
                  pulse
                  disabled={loading}
                  onClick={checkout}
                >
                  {loading ? "Procesando…" : "Finalizar compra"}
                </Button>
                <p className="mt-2 text-center text-[11px] text-white/40">
                  Pago seguro · Compra en menos de un minuto
                </p>
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
