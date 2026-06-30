"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/gallos/shared/Icon";
import { useCheckout } from "@/components/gallos/_lib/useCheckout";
import { dogChoices } from "@/components/perros/_lib/dog";

/* Botón flotante "Finalizar compra": aparece al pasar el primer CTA del hero y
   abre el asistente de compra (es genérico -> empieza preguntando cuál plan). */
export function DogStickyCTA() {
  const [show, setShow] = useState(false);
  const { start } = useCheckout();

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
            onClick={() => start({ choices: dogChoices() })}
            aria-label="Finalizar compra"
            className="btn-shine font-ui flex items-center gap-2 rounded-full bg-gradient-to-b from-[#a78bfa] to-[#7c3aed] px-6 py-3.5 text-sm font-semibold uppercase tracking-tight text-white shadow-[0_14px_36px_-8px_rgba(124,58,237,0.75)] active:scale-[0.97]"
          >
            <Icon name="cart" size={18} />
            Finalizar compra
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
