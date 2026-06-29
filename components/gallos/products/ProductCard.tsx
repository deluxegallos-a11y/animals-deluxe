"use client";

import Image from "next/image";
import { Button } from "@/components/gallos/shared/Button";
import { Badge } from "@/components/gallos/shared/Badge";
import { Icon } from "@/components/gallos/shared/Icon";
import { useCart } from "@/components/gallos/_lib/useCart";
import { track } from "@/components/gallos/_lib/tracking";
import type { Product } from "@/components/gallos/_lib/types";

const themeMap = {
  american: {
    name: "text-american",
    glow: "glow-american",
    border: "hover:border-american/50",
    ring: "border-american/30 bg-american/10 text-american",
    check: "text-american",
  },
  dragon: {
    name: "text-dragon",
    glow: "glow-dragon",
    border: "hover:border-dragon/50",
    ring: "border-dragon/30 bg-dragon/10 text-dragon",
    check: "text-dragon",
  },
} as const;

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const t = themeMap[product.theme];

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-[20px] border border-border bg-surface p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 ${t.border} md:p-8`}
    >
      {/* glow ambiental */}
      <div
        className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-30 blur-3xl ${
          product.theme === "american" ? "bg-american" : "bg-dragon"
        }`}
      />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-heading text-2xl leading-none md:text-3xl">
            {product.theme === "american" ? (
              <>
                <span className="text-american">American</span>{" "}
                <span className="text-white">Rooster</span>{" "}
                <span className="text-american">Fury</span>
              </>
            ) : (
              <span className={t.name}>{product.name}</span>
            )}
          </h3>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gold">
            {product.subtitle}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {product.badges.map((b) => (
            <Badge key={b} kind={b} />
          ))}
        </div>
      </div>

      <div className="relative z-10 mt-4 flex gap-5">
        <div className="relative h-44 w-28 shrink-0 md:h-56 md:w-36">
          <div
            className={`absolute inset-x-2 bottom-2 top-6 -z-10 rounded-full opacity-50 blur-2xl ${
              product.theme === "american" ? "bg-american/40" : "bg-dragon/40"
            }`}
          />
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-contain transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-2"
          />
        </div>

        <div className="flex flex-1 flex-col">
          <p className="mb-3 text-sm text-white/60">{product.description}</p>
          <ul className="space-y-1.5">
            {product.benefits.map((b) => (
              <li key={b} className="flex items-center gap-2 text-sm text-white/85">
                <Icon name="check" size={14} className={t.check} />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="relative z-10 mt-5 flex items-end justify-between border-t border-border pt-4">
        <div>
          <span className="font-display text-3xl text-white">
            {product.volume}
          </span>
          <p className="text-[11px] uppercase tracking-wide text-white/45">
            Dosis recomendada
            <br />
            {product.dose}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl text-gold">
            ${product.price.toLocaleString("es-CO")}
          </p>
          <p className="text-[11px] text-white/45">{product.currency}</p>
        </div>
      </div>

      <Button
        variant="primary"
        icon="cart"
        fullWidth
        className={`relative z-10 mt-5 ${t.glow}`}
        onClick={() => {
          track("select_product", { id: product.id });
          add(product);
        }}
      >
        Comprar ahora
      </Button>
    </article>
  );
}
