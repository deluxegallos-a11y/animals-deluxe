"use client";

import Image from "next/image";
import { Button } from "@/components/gallos/shared/Button";
import { Icon } from "@/components/gallos/shared/Icon";
import { Reveal } from "@/components/gallos/shared/Reveal";
import { PRODUCTS } from "@/components/gallos/_lib/data";
import { useCart } from "@/components/gallos/_lib/useCart";

export function FinalCTA() {
  const { add } = useCart();
  return (
    <section className="relative overflow-hidden px-6 py-20 md:px-16 md:py-28">
      <div className="bg-hero-radial pointer-events-none absolute inset-0 -z-10 opacity-90" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-gold/10 to-transparent" />

      <Reveal>
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <div className="mb-6 flex items-end justify-center gap-4">
            {PRODUCTS.map((p) => (
              <Image
                key={p.id}
                src={p.image}
                alt={p.name}
                width={120}
                height={180}
                className="h-auto w-20 object-contain drop-shadow-[0_10px_30px_rgba(255,201,40,0.25)] md:w-28"
              />
            ))}
          </div>
          <h2 className="font-display text-4xl leading-[0.95] text-white md:text-6xl">
            ¡No esperes más!
            <br />
            <span className="text-gold text-glow-gold">
              Lleva tu gallo al siguiente nivel
            </span>
          </h2>
          <p className="mt-4 max-w-lg text-sm text-white/70 md:text-base">
            Pago contra entrega · Producto 100% original · Envío a todo Colombia.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button variant="primary" icon="cart" pulse onClick={() => add(PRODUCTS[0])}>
              Comprar ahora
            </Button>
            <Button
              variant="secondary"
              icon="whatsapp"
              onClick={() =>
                window.open(
                  `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP || "573000000000"}`,
                  "_blank",
                )
              }
            >
              Pedir por WhatsApp
            </Button>
          </div>
          <span className="mt-4 flex items-center gap-2 text-xs text-white/55">
            <Icon name="seguro" size={16} /> Garantía de satisfacción 100%
          </span>
        </div>
      </Reveal>
    </section>
  );
}
