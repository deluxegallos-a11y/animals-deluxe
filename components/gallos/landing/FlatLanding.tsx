"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "@/components/gallos/shared/Icon";
import { useCart } from "@/components/gallos/_lib/useCart";
import { PRODUCTS } from "@/components/gallos/_lib/data";
import { ReviewsNative } from "@/components/gallos/reviews/ReviewsNative";
import { FaqNative } from "@/components/gallos/faq/FaqNative";
import { StatsBar } from "@/components/gallos/sections/StatsBar";
import { TrustBadges } from "@/components/gallos/sections/TrustBadges";
import { Reveal3D } from "@/components/gallos/shared/Reveal3D";

/* ------------------------------------------------------------------ *
 * Landing "plana": cada imagen de sección se monta tal cual (calidad
 * intacta) y encima se posicionan botones reales sobre las cajas
 * punteadas. Las posiciones son porcentuales (responsive) y detectadas
 * a partir de cada PNG -> ver scripts/_detect.mjs.
 * ------------------------------------------------------------------ */

type Box = { top: string; left: string; width: string; height: string };

function OverlayButton({
  box,
  onClick,
  children,
  ariaLabel,
  fontClass,
}: {
  box: Box;
  onClick: () => void;
  children: ReactNode;
  ariaLabel: string;
  fontClass: string;
}) {
  // position absolute va inline para ganarle al position:relative de .btn-shine
  const style: CSSProperties = { position: "absolute", ...box };
  return (
    <button
      onClick={onClick}
      style={style}
      aria-label={ariaLabel}
      className={`btn-shine cta-pulse z-[3] flex items-center justify-center gap-2 rounded-full bg-gold font-body font-bold uppercase leading-none tracking-wide text-[#050505] transition-transform duration-150 ease-out hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${fontClass}`}
    >
      {children}
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

export function FlatLanding() {
  const { buyNow } = useCart();
  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  const arrow = (size = 18) => <Icon name="arrow-right" size={size} />;
  const cart = (size = 16) => <Icon name="cart" size={size} />;

  return (
    <div className="mx-auto w-full max-w-[760px] overflow-x-clip bg-background pt-20 md:pt-24">
      {/* SECCIÓN 1 — Hero + beneficios + "la diferencia es real" */}
      <FlatImage
        id="top"
        src="/assets/sections/sec1.png"
        width={852}
        height={1846}
        alt="El mejor doping para tu gallo — American Rooster Fury y Dragon Mamba"
        priority
      >
        <OverlayButton
          box={{ top: "54.0%", left: "17.5%", width: "65.5%", height: "5.5%" }}
          onClick={() => scrollTo("productos")}
          ariaLabel="Quiero un gallo campeón"
          fontClass="text-[clamp(13px,3.4vw,19px)]"
        >
          Quiero un gallo campeón {arrow()}
        </OverlayButton>
      </FlatImage>

      {/* SECCIÓN 2 — Productos (2 botones) + comparativa */}
      <Reveal3D>
        <FlatImage
          id="productos"
          src="/assets/sections/sec2.png"
          width={1104}
          height={1425}
          alt="Nuestros productos: American Rooster Fury y Dragon Mamba"
        >
          <OverlayButton
            box={{ top: "45.5%", left: "6.3%", width: "40.8%", height: "5.0%" }}
            onClick={() => buyNow(PRODUCTS[0])}
            ariaLabel="Comprar American Rooster Fury"
            fontClass="text-[clamp(10px,2.4vw,14px)]"
          >
            Comprar {cart(15)}
          </OverlayButton>
          <OverlayButton
            box={{ top: "45.5%", left: "52.9%", width: "40.9%", height: "5.0%" }}
            onClick={() => buyNow(PRODUCTS[1])}
            ariaLabel="Comprar Dragon Mamba"
            fontClass="text-[clamp(10px,2.4vw,14px)]"
          >
            Comprar {cart(15)}
          </OverlayButton>
        </FlatImage>
      </Reveal3D>

      {/* Contador premium (estadísticas con count-up) */}
      <StatsBar />

      {/* SECCIÓN 3a — Reseñas nativas (reemplaza los testimonios de la imagen) */}
      <ReviewsNative />

      {/* SECCIÓN 3b — Sellos de confianza + garantía (imagen recortada) */}
      <Reveal3D>
        <FlatImage
          src="/assets/sections/sec3b.png"
          width={1055}
          height={951}
          alt="Garantía 100% satisfacción — envío seguro, pago contra entrega, producto original"
        >
          <OverlayButton
            box={{ top: "76.4%", left: "12.2%", width: "75.2%", height: "11.9%" }}
            onClick={() => scrollTo("productos")}
            ariaLabel="Quiero probarlo"
            fontClass="text-[clamp(14px,3.6vw,20px)]"
          >
            Quiero probarlo {arrow(20)}
          </OverlayButton>
        </FlatImage>
      </Reveal3D>

      {/* Marcas de confianza: pago seguro + transportadoras */}
      <TrustBadges />

      {/* SECCIÓN 4a — FAQ nativa (acordeón funcional) */}
      <FaqNative />

      {/* SECCIÓN 4b — Banner final "¡No esperes más!" (imagen recortada) */}
      <Reveal3D>
        <FlatImage
          src="/assets/sections/sec4b.png"
          width={901}
          height={501}
          alt="No esperes más — lleva tu gallo al siguiente nivel"
        >
          <OverlayButton
            box={{ top: "37.9%", left: "26.7%", width: "46.0%", height: "17.8%" }}
            onClick={() => scrollTo("productos")}
            ariaLabel="Comprar ahora"
            fontClass="text-[clamp(12px,2.8vw,16px)]"
          >
            Comprar ahora {arrow(16)}
          </OverlayButton>
        </FlatImage>
      </Reveal3D>

    </div>
  );
}
