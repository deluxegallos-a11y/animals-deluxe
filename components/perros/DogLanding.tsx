"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "@/components/gallos/shared/Icon";
import { useCheckout } from "@/components/gallos/_lib/useCheckout";
import type { Product } from "@/components/gallos/_lib/types";
import {
  DOG_PRODUCT,
  DOG_PRODUCT_6M,
  DOG_REVIEWS,
  DOG_FAQS,
  dogChoices,
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
  const { start } = useCheckout();
  // Botón genérico -> pregunta cuál (3m/6m); botón de un plan -> directo al pago.
  const buy = (p?: Product) =>
    p ? start({ products: [p] }) : start({ choices: dogChoices() });

  return (
    <div className="relative mx-auto w-full max-w-[760px] overflow-x-clip bg-background">
      {/* Header de marca: botón de compra arriba a la derecha.
          `relative` en el contenedor lo ancla aquí (bajo el banner marquee). */}
      <header className="absolute right-0 top-0 z-10 flex w-full max-w-[760px] items-center justify-end px-4 pt-5 sm:px-5">
        <button
          onClick={() => buy()}
          aria-label="Comprar"
          className="relative grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white/80 text-[#2b1769] backdrop-blur-sm transition-colors hover:border-[#7c3aed]/50"
        >
          <Icon name="cart" size={20} />
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
          box={{ top: "62%", left: "39%", width: "54%", height: "6.5%" }}
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
          width={852}
          height={1846}
          alt="Para todas las razas. Elige tu plan ideal: 3 meses o 6 meses"
        >
          <BuyButton
            box={{ top: "82.5%", left: "7%", width: "37%", height: "4%" }}
            onClick={() => buy(DOG_PRODUCT)}
            label="Comprar"
            fontClass="text-[clamp(12px,3vw,16px)]"
          />
          <BuyButton
            box={{ top: "82.5%", left: "53%", width: "37%", height: "4%" }}
            onClick={() => buy(DOG_PRODUCT_6M)}
            label="Comprar"
            fontClass="text-[clamp(12px,3vw,16px)]"
          />
          <BuyButton
            box={{ top: "93.7%", left: "4%", width: "91%", height: "4.3%" }}
            onClick={() => buy()}
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
            box={{ top: "85.6%", left: "4%", width: "92%", height: "6%" }}
            onClick={() => buy()}
            label="Comprar"
            fontClass="text-[clamp(15px,4.4vw,24px)]"
          />
        </FlatImage>
      </Reveal3D>
    </div>
  );
}
