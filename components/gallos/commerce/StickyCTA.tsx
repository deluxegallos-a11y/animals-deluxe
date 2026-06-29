"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/gallos/shared/Icon";
import { useCart } from "@/components/gallos/_lib/useCart";
import { PRODUCTS } from "@/components/gallos/_lib/data";

/* Botón flotante "Finalizar compra": aparece al pasar el primer CTA del hero y
   abre el carrito (que ofrece pagar contraentrega o anticipado). Si el carrito
   está vacío, agrega el producto más vendido para que se pueda finalizar. */
export function StickyCTA() {
  const [show, setShow] = useState(false);
  const { add, count, open } = useCart();

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = () => {
    if (count === 0) add(PRODUCTS[0]);
    open();
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] z-40 flex justify-center px-4"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <button
            onClick={go}
            aria-label="Finalizar compra"
            className="btn-shine font-ui flex items-center gap-2 rounded-full bg-gradient-to-b from-[#ffe9a8] to-[#e0a92e] px-6 py-3.5 text-sm font-semibold uppercase tracking-tight text-[#1a1206] shadow-[0_14px_36px_-8px_rgba(224,169,46,0.7)] active:scale-[0.97]"
          >
            <Icon name="cart" size={18} />
            Finalizar compra
            {count > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-black/15 px-1 text-[11px] font-bold">
                {count}
              </span>
            )}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
