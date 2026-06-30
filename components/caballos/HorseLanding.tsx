"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "@/components/gallos/shared/Icon";
import { useCheckout } from "@/components/gallos/_lib/useCheckout";
import { HORSE_PRODUCT, HORSE_REVIEWS, HORSE_FAQS } from "@/components/caballos/_lib/horse";
import { StatsBar } from "@/components/gallos/sections/StatsBar";
import { ReviewsNative } from "@/components/caballos/ReviewsNative";
import { FaqNative } from "@/components/caballos/FaqNative";
import { Reveal3D } from "@/components/gallos/shared/Reveal3D";

/* Mismo patrón que la landing de gallos: imágenes planas + botones reales
   (posición absoluta en % vía style inline, que gana al .btn-shine).
   Los porcentajes y los width/height de cada <Image> están calibrados
   pixel-perfect: NO se tocan. */

type Box = { top: string; left: string; width: string; height: string };

function BuyButton({
  box,
  onClick,
  fontClass,
}: {
  box: Box;
  onClick: () => void;
  fontClass: string;
}) {
  const style: CSSProperties = { position: "absolute", ...box };
  return (
    <button
      onClick={onClick}
      style={style}
      aria-label="Comprar Horse Deluxe"
      className={`btn-premium btn-shine z-[3] flex items-center justify-center gap-2 rounded-full font-body font-bold uppercase leading-none tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${fontClass}`}
    >
      Comprar ahora <Icon name="cart" size={18} />
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

export function HorseLanding() {
  const { start } = useCheckout();
  // Un solo producto: directo al paso de pago (sin elegir cuál).
  const buy = () => start({ products: [HORSE_PRODUCT] });

  return (
    <div className="mx-auto w-full max-w-[760px] overflow-x-clip bg-background">
      {/* Header de marca: logo en la esquina + carrito, con aire arriba */}
      <header className="flex items-center justify-between px-4 pt-6 pb-4 sm:px-5">
        <Image
          src="/assets/brand/logo-full.png"
          alt="Animals Deluxe"
          width={1024}
          height={1024}
          priority
          sizes="64px"
          className="h-14 w-14 select-none drop-shadow-[0_0_18px_rgba(255,201,40,0.35)] sm:h-16 sm:w-16"
        />
        <button
          onClick={buy}
          aria-label="Comprar"
          className="relative grid h-11 w-11 place-items-center rounded-full border border-white/12 bg-white/[0.04] text-white backdrop-blur-sm transition-colors hover:border-gold/60"
        >
          <Icon name="cart" size={20} />
        </button>
      </header>

      {/* 1 — HERO */}
      <FlatImage
        id="top"
        src="/assets/horse/h1.png"
        width={862}
        height={1824}
        alt="Horse Deluxe — El secreto de los campeones, suplemento premium para caballos"
        priority
      >
        <BuyButton
          box={{ top: "92.0%", left: "3.8%", width: "92.5%", height: "7.2%" }}
          onClick={buy}
          fontClass="text-[clamp(14px,3.6vw,20px)]"
        />
      </FlatImage>

      {/* 2 — BENEFICIOS CLAVE */}
      <Reveal3D>
        <FlatImage
          src="/assets/horse/h2.png"
          width={862}
          height={1824}
          alt="Beneficios clave: más energía, resistencia, fuerza, recuperación y sistema inmune"
        >
          <BuyButton
            box={{ top: "87.2%", left: "6.5%", width: "86.0%", height: "10.1%" }}
            onClick={buy}
            fontClass="text-[clamp(15px,4vw,22px)]"
          />
        </FlatImage>
      </Reveal3D>

      {/* 3 — ANTES Y DESPUÉS */}
      <Reveal3D>
        <FlatImage
          src="/assets/horse/h3.png"
          width={863}
          height={1822}
          alt="Antes y después — Por qué elegir Horse Deluxe, proteína original americana"
        >
          <BuyButton
            box={{ top: "91.5%", left: "12.4%", width: "75.2%", height: "6.4%" }}
            onClick={buy}
            fontClass="text-[clamp(13px,3.4vw,19px)]"
          />
        </FlatImage>
      </Reveal3D>

      {/* 4a — FÓRMULA EXCLUSIVA + IDEAL PARA (sin botón) */}
      <Reveal3D>
        <FlatImage
          src="/assets/horse/h4a.png"
          width={862}
          height={1030}
          alt="Fórmula exclusiva: aminoácidos, vitaminas, complejo B, minerales y esencia de manzana"
        />
      </Reveal3D>

      {/* Contador premium */}
      <StatsBar />

      {/* Reseñas nativas (reemplazan los testimonios de la imagen) */}
      <ReviewsNative
        seedReviews={HORSE_REVIEWS}
        eyebrow="Testimonios reales"
        title={
          <>
            Lo que dicen nuestros <span className="accent-gold">clientes</span>
          </>
        }
      />

      {/* FAQ nativa */}
      <FaqNative
        faqs={HORSE_FAQS}
        eyebrow="Soporte"
        title={
          <>
            Preguntas <span className="accent-gold">frecuentes</span>
          </>
        }
        subtitle="Todo lo que necesitas saber sobre Horse Deluxe"
      />

      {/* 4b — PRECIO + COMPRA + GARANTÍA + sellos (imagen recortada) */}
      <Reveal3D>
        <FlatImage
          src="/assets/horse/h4b.png"
          width={862}
          height={523}
          alt="Por solo 160.000 COP — Garantía 100% de satisfacción, envío contraentrega"
        >
          <BuyButton
            box={{ top: "31.2%", left: "8.0%", width: "83.5%", height: "18.2%" }}
            onClick={buy}
            fontClass="text-[clamp(15px,4vw,22px)]"
          />
        </FlatImage>
      </Reveal3D>
    </div>
  );
}
