"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/gallos/shared/Icon";
import { useCart } from "@/components/gallos/_lib/useCart";
import { PRODUCTS } from "@/components/gallos/_lib/data";

const fmt = (n: number) => "$" + n.toLocaleString("es-CO");

export function StickyCTA() {
  const [show, setShow] = useState(false);
  const { add, count, open } = useCart();

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const american = PRODUCTS[0];
  const dragon = PRODUCTS[1];

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/65 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-2xl transition-transform duration-300 md:hidden ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ WebkitBackdropFilter: "blur(24px) saturate(160%)" }}
    >
      {count > 0 ? (
        <button
          onClick={open}
          className="btn-shine font-ui flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#ffe9a8] to-[#e0a92e] py-3.5 text-sm font-semibold tracking-tight text-[#1a1206] active:scale-[0.98]"
        >
          <Icon name="cart" size={18} /> Ver carrito ({count})
        </button>
      ) : (
        <div className="flex items-stretch gap-2.5">
          <button
            onClick={() => add(american)}
            className="glass-hover flex flex-1 items-center justify-between gap-2 rounded-2xl border border-[#ff6900]/35 bg-[#ff6900]/[0.12] px-3.5 py-2.5 text-left active:scale-[0.98]"
            aria-label="Comprar American Rooster Fury"
          >
            <span className="leading-tight">
              <span className="font-ui block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#ff8c3a]">
                American
              </span>
              <span className="font-ui block text-[17px] font-semibold tracking-tight text-white">
                {fmt(american.price)}
              </span>
            </span>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#ff8c3a] to-[#ff6900] text-white">
              <Icon name="cart" size={15} />
            </span>
          </button>

          <button
            onClick={() => add(dragon)}
            className="glass-hover flex flex-1 items-center justify-between gap-2 rounded-2xl border border-[#27c34a]/35 bg-[#27c34a]/[0.12] px-3.5 py-2.5 text-left active:scale-[0.98]"
            aria-label="Comprar Dragon Mamba"
          >
            <span className="leading-tight">
              <span className="font-ui block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4fdc72]">
                Dragon
              </span>
              <span className="font-ui block text-[17px] font-semibold tracking-tight text-white">
                {fmt(dragon.price)}
              </span>
            </span>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#4fdc72] to-[#27c34a] text-white">
              <Icon name="cart" size={15} />
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
