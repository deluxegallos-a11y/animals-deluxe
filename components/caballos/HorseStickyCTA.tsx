"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/gallos/shared/Icon";
import { useCart } from "@/components/gallos/_lib/useCart";
import { HORSE_PRODUCT } from "@/components/caballos/_lib/horse";

const fmt = (n: number) => "$" + n.toLocaleString("es-CO");

export function HorseStickyCTA() {
  const [show, setShow] = useState(false);
  const { add, count, open } = useCart();

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/65 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-2xl transition-transform duration-300 md:hidden ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ WebkitBackdropFilter: "blur(24px) saturate(160%)" }}
    >
      <div className="flex items-center gap-3">
        <div className="leading-tight">
          <span className="font-ui block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#ff8c3a]">
            Horse Deluxe
          </span>
          <span className="font-ui block text-[18px] font-semibold tracking-tight text-white">
            {fmt(HORSE_PRODUCT.price)}
          </span>
        </div>
        <button
          onClick={() => (count > 0 ? open() : add(HORSE_PRODUCT))}
          className="btn-shine font-ui flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#ffe9a8] to-[#e0a92e] py-3.5 text-sm font-semibold uppercase tracking-tight text-[#1a1206] active:scale-[0.98]"
        >
          <Icon name="cart" size={18} />
          {count > 0 ? `Ver carrito (${count})` : "Comprar ahora"}
        </button>
      </div>
    </div>
  );
}
