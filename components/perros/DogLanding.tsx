"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "@/components/gallos/shared/Icon";
import { useCart } from "@/components/gallos/_lib/useCart";
import type { Product } from "@/components/gallos/_lib/types";
import {
  DOG_PRODUCT,
  DOG_PRODUCT_6M,
  DOG_REVIEWS,
  DOG_FAQS,
} from "@/components/perros/_lib/dog";
import { ReviewsDogs } from "@/components/perros/ReviewsDogs";
import { FaqNative } from "@/components/perros/FaqNative";
import { Reveal3D } from "@/components/gallos/shared/Reveal3D";

/* Mismo patrón que gallos y caballos: imágenes planas a ancho completo +
   botones reales superpuestos (posición absoluta en % vía style inline).
   Paleta violeta para combinar con el diseño de More Muscle Dogs. */

type Box = { top: string; left: string; width: string; height: string };

function BuyButton({
  box,
  onClick,
  label = "Comprar ahora",
  fontClass,
}: {
  box: Box;
  onClick: () => void;
  label?: string;
  fontClass: string;
}) {
  const style: CSSProperties = {
    position: "absolute",
    ...box,
    background: "linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%)",
    color: "#ffffff",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.45), 0 10px 30px -8px rgba(124,58,237,0.7)",
  };
  return (
    <button
      onClick={onClick}
      style={style}
      aria-label={label}
      className={`btn-shine z-[3] flex items-center justify-center gap-2 rounded-full font-body font-bold uppercase leading-none tracking-wide transition-transform active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${fontClass}`}
    >
      {label} <Icon name="cart" size={18} />
    </button>
  );
}

function FlatImage({
  id,
  src,
  width,
  height,
  alt,
  priority = false,
  children,
}: {
  id?: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  priority?: boolean;
  children?: ReactNode;
}) {
  return (
    <section id={id} className="relative w-full scroll-mt-16">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes="(max-width: 760px) 100vw, 760px"
        className="block h-auto w-full select-none"
      />
      {children}
    </section>
  );
}

export function DogLanding() {
  const { add, open, count } = useCart();
  const buy = (p: Product = DOG_PRODUCT) => add(p);

  return (
    <div className="mx-auto w-full max-w-[760px] bg-background">
      {/* Header de marca: carrito flotante arriba a la derecha */}
      <header className="absolute right-0 top-0 z-10 flex w-full max-w-[760px] items-center justify-end px-4 pt-4 sm:px-5">
        <button
          onClick={open}
          aria-label="Abrir carrito"
          className="relative grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white/80 text-[#2b1769] backdrop-blur-sm transition-colors hover:border-[#7c3aed]/50"
        >
          <Icon name="cart" size={20} />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#7c3aed] px-1 text-[11px] font-bold text-white">
              {count}
            </span>
          )}
        </button>
      </header>

      {/* 1 — HERO + BENEFICIOS QUE SE NOTAN */}
      <FlatImage
        id="top"
        src="/assets/dog/d1.png"
        width={864}
        height={1821}
        alt="More Muscle Dogs Premium — Más músculo, más energía, más vida para tu mejor amigo"
        priority
      >
        <BuyButton
          box={{ top: "61.8%", left: "39.5%", width: "55%", height: "7.6%" }}
          onClick={() => buy()}
          fontClass="text-[clamp(13px,3.4vw,19px)]"
        />
      </FlatImage>

      {/* 2 — ANTES/DESPUÉS + INGREDIENTES PREMIUM */}
      <Reveal3D>
        <FlatImage
          src="/assets/dog/d2.png"
          width={864}
          height={1821}
          alt="Resultados que se ven, se notan y se sienten. Ingredientes premium de More Muscle Dogs"
        >
          <BuyButton
            box={{ top: "91.0%", left: "5.4%", width: "89.2%", height: "7.0%" }}
            onClick={() => buy()}
            fontClass="text-[clamp(15px,4vw,22px)]"
          />
        </FlatImage>
      </Reveal3D>

      {/* 3 — PARA TODAS LAS RAZAS + ELIGE TU PLAN IDEAL */}
      <Reveal3D>
        <FlatImage
          src="/assets/dog/d3.png"
          width={862}
          height={1824}
          alt="Para todas las razas. Elige tu plan ideal: 3 meses o 6 meses"
        >
          <BuyButton
            box={{ top: "82.7%", left: "8.8%", width: "36.0%", height: "3.7%" }}
            onClick={() => buy(DOG_PRODUCT)}
            label="Comprar"
            fontClass="text-[clamp(12px,3vw,16px)]"
          />
          <BuyButton
            box={{ top: "82.7%", left: "54.2%", width: "36.0%", height: "3.7%" }}
            onClick={() => buy(DOG_PRODUCT_6M)}
            label="Comprar"
            fontClass="text-[clamp(12px,3vw,16px)]"
          />
          <BuyButton
            box={{ top: "95.3%", left: "5.4%", width: "89.0%", height: "3.7%" }}
            onClick={() => buy(DOG_PRODUCT)}
            fontClass="text-[clamp(13px,3.4vw,19px)]"
          />
        </FlatImage>
      </Reveal3D>

      {/* Reseñas nativas (sección añadida) */}
      <ReviewsDogs
        reviews={DOG_REVIEWS}
        storageKey="dog_reviews_v1"
        eyebrow="Testimonios reales"
        title="Lo que dicen los dueños"
      />

      {/* FAQ nativa */}
      <FaqNative
        faqs={DOG_FAQS}
        eyebrow="Soporte"
        title="Preguntas frecuentes"
        subtitle="Todo lo que necesitas saber sobre More Muscle Dogs Premium"
      />

      {/* 4 — TU PERRO MERECE LO MEJOR + CTA FINAL */}
      <Reveal3D>
        <FlatImage
          src="/assets/dog/d4.png"
          width={863}
          height={1823}
          alt="Tu perro merece lo mejor. Beneficios que se notan — Comprar More Muscle Dogs Premium"
        >
          <BuyButton
            box={{ top: "82.3%", left: "4.6%", width: "90.6%", height: "6.0%" }}
            onClick={() => buy()}
            label="Comprar"
            fontClass="text-[clamp(15px,4.4vw,24px)]"
          />
        </FlatImage>
      </Reveal3D>
    </div>
  );
}
