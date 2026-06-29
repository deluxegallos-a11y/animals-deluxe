"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import { Icon, type IconName } from "@/components/gallos/shared/Icon";
import { useCart } from "@/components/gallos/_lib/useCart";
import { PRODUCTS } from "@/components/gallos/_lib/data";

const LEFT: { icon: IconName; label: string }[] = [
  { icon: "energia", label: "Más energía" },
  { icon: "escudo", label: "Más resistencia" },
  { icon: "recuperacion", label: "Mayor agilidad" },
];
const RIGHT: { icon: IconName; label: string }[] = [
  { icon: "recuperacion", label: "Recuperación rápida" },
  { icon: "vitalidad", label: "Salud y vitalidad" },
  { icon: "seguro", label: "100% seguro" },
];

const fade: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: (d: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: d, ease: [0.22, 1, 0.36, 1] },
  }),
};

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { add } = useCart();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  // Profundidad: fondo se mueve lento, botellas (adelante) se mueven más
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "8%"]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.07]);
  const bottlesY = useTransform(scrollYProgress, [0, 1], ["0%", "-12%"]);

  return (
    <section
      id="top"
      ref={ref}
      className="relative flex min-h-dvh w-full flex-col items-center overflow-hidden bg-background pt-14 md:pt-16"
    >
      {/* ESCENARIO: fondo + botellas + overlays HTML, todo escala junto */}
      <div className="relative mx-auto w-full max-w-[520px]">
        {/* Fondo generado (zoom de entrada + parallax) */}
        <motion.div
          style={{ y: bgY, scale: bgScale }}
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <Image
            src="/assets/hero/scene_bg.png"
            alt=""
            width={1024}
            height={1536}
            priority
            sizes="(max-width: 520px) 100vw, 520px"
            className="h-auto w-full select-none"
          />
        </motion.div>

        {/* Scrim para legibilidad del texto superior */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-1/2 bg-gradient-to-b from-black/70 via-black/20 to-transparent" />

        {/* Logo */}
        <motion.div
          variants={fade}
          initial="hidden"
          animate="show"
          className="absolute left-1/2 top-[1.5%] z-20 w-[24%] -translate-x-1/2"
        >
          <Image src="/assets/hero/layers/logo.png" alt="Animals Deluxe" width={170} height={120} priority className="h-auto w-full" />
        </motion.div>

        {/* Sello premium */}
        <motion.div
          variants={fade}
          custom={0.5}
          initial="hidden"
          animate="show"
          className="absolute right-[2%] top-[15%] z-20 w-[15%]"
        >
          <Image src="/assets/hero/layers/premium.png" alt="Calidad premium" width={130} height={140} className="h-auto w-full" />
        </motion.div>

        {/* Titular + subtítulo */}
        <div className="absolute inset-x-0 top-[15%] z-20 px-4 text-center">
          <motion.h1 variants={fade} custom={0.15} initial="hidden" animate="show" className="font-heading text-[10vw] leading-[0.85] sm:text-5xl">
            <span className="text-steel">El mejor</span>
            <br />
            <span className="text-steel">Doping para</span>
            <br />
            <span className="text-gold-grad text-glow-gold">Tu gallo</span>
          </motion.h1>
          <motion.p variants={fade} custom={0.3} initial="hidden" animate="show" className="mx-auto mt-2 max-w-[78%] text-[2.6vw] font-bold uppercase leading-tight tracking-wide text-white/90 sm:text-xs">
            Máximo rendimiento, <span className="text-gold">fuerza</span> y{" "}
            <span className="text-gold">energía</span> para campeones dentro y fuera del ring.
          </motion.p>
        </div>

        {/* Botellas: capa FRONTAL sobre el podio (flotan + parallax) */}
        <motion.div
          style={{ y: bottlesY }}
          initial={{ opacity: 0, y: 40, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="absolute left-1/2 top-[47%] z-10 w-[50%] -translate-x-1/2"
        >
          <div className="pointer-events-none absolute -inset-x-4 bottom-2 top-6 -z-10 rounded-full bg-[radial-gradient(50%_55%_at_50%_60%,rgba(255,201,40,0.3),transparent_70%)] blur-lg" />
          <Image src="/assets/hero/bottles_layer.png" alt="American Rooster Fury y Dragon Mamba" width={1024} height={1024} priority className="float-soft h-auto w-full drop-shadow-[0_20px_30px_rgba(0,0,0,0.6)]" />
        </motion.div>

        {/* Beneficios izquierda */}
        <motion.ul variants={fade} custom={0.5} initial="hidden" animate="show" className="absolute left-[2%] top-[49%] z-20 flex flex-col gap-3">
          {LEFT.map((b) => (
            <li key={b.label} className="flex items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-gold/60 bg-black/50 text-gold">
                <Icon name={b.icon} size={14} />
              </span>
              <span className="text-[2.5vw] font-bold uppercase leading-tight tracking-wide text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] sm:text-[11px]">
                {b.label}
              </span>
            </li>
          ))}
        </motion.ul>

        {/* Beneficios derecha */}
        <motion.ul variants={fade} custom={0.6} initial="hidden" animate="show" className="absolute right-[2%] top-[49%] z-20 flex flex-col items-end gap-3">
          {RIGHT.map((b) => (
            <li key={b.label} className="flex flex-row-reverse items-center gap-2 text-right">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-dragon/60 bg-black/50 text-dragon">
                <Icon name={b.icon} size={14} />
              </span>
              <span className="text-[2.5vw] font-bold uppercase leading-tight tracking-wide text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] sm:text-[11px]">
                {b.label}
              </span>
            </li>
          ))}
        </motion.ul>

        {/* Nombres de producto */}
        <motion.div variants={fade} custom={0.7} initial="hidden" animate="show" className="absolute inset-x-0 bottom-[6%] z-20 flex items-end justify-between px-4">
          <div>
            <p className="font-heading text-[3.2vw] leading-none sm:text-base">
              <span className="text-american">American</span> <span className="text-white">Rooster</span> <span className="text-american">Fury</span>
            </p>
            <p className="text-[2.2vw] font-bold uppercase tracking-wide text-gold sm:text-[10px]">Fórmula Original</p>
          </div>
          <div className="text-right">
            <p className="font-heading text-[3.2vw] leading-none text-dragon sm:text-base">Dragon Mamba</p>
            <p className="text-[2.2vw] font-bold uppercase tracking-wide text-gold sm:text-[10px]">Fórmula Élite</p>
          </div>
        </motion.div>
      </div>

      {/* CTA debajo del escenario (sobre negro, se funde con la imagen) */}
      <motion.div
        variants={fade}
        custom={0.85}
        initial="hidden"
        animate="show"
        className="relative z-20 -mt-2 flex w-full max-w-[520px] flex-col items-center px-5"
      >
        <button
          onClick={() => add(PRODUCTS[0])}
          className="btn-shine cta-pulse flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-gold font-body text-sm font-bold uppercase tracking-wide text-[#050505] transition-transform duration-150 ease-out hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Quiero un gallo campeón
          <Icon name="arrow-right" size={18} />
        </button>
        <span className="mt-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/75">
          <Icon name="entrega" size={18} className="text-gold" /> Envío a todo Colombia
        </span>
      </motion.div>
    </section>
  );
}
