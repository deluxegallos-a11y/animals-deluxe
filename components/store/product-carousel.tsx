"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { motion, useMotionValue, useSpring, type Variants } from "framer-motion";
import { ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react";
import { cop, flag } from "@/lib/ai/format";
import { catMeta, alpha } from "@/lib/store-meta";
import { useCart } from "@/components/store/cart";

export type SProduct = {
  slug: string; name: string; categoryName: string; categorySlug: string;
  priceCOP: number; tagline: string; shortDesc: string; imageUrl: string; origin: string;
  badges: string[]; benefits: string[]; envioGratis?: boolean;
  presentations?: { label: string; priceCOP: number }[];
};

const fadeUp: Variants = { hidden: { opacity: 0, y: 26 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } };

export function ProductCard3D({ p, wa }: { p: SProduct; wa: string }) {
  const m = catMeta(p.categorySlug);
  const ref = React.useRef<HTMLDivElement>(null);
  const rx = useSpring(useMotionValue(0), { stiffness: 160, damping: 18 });
  const ry = useSpring(useMotionValue(0), { stiffness: 160, damping: 18 });
  const [glare, setGlare] = React.useState({ x: 50, y: 0, o: 0 });
  const { add } = useCart();
  const pres = p.presentations || [];
  const prices = pres.map((x) => x.priceCOP).filter((n) => n > 0);
  const hasVariants = new Set(prices).size > 1;
  const minPrice = prices.length ? Math.min(...prices) : p.priceCOP;
  const cheapest = pres.find((x) => x.priceCOP === minPrice);
  function onAdd() {
    add({ slug: p.slug, name: p.name, presLabel: cheapest?.label || "", priceCOP: minPrice, qty: 1, imageUrl: p.imageUrl });
  }

  function onMove(e: React.MouseEvent) {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    ry.set((px - 0.5) * 9); rx.set(-(py - 0.5) * 9);
    setGlare({ x: px * 100, y: py * 100, o: 1 });
  }
  function onLeave() { rx.set(0); ry.set(0); setGlare((g) => ({ ...g, o: 0 })); }

  return (
    <motion.div variants={fadeUp} className="tilt" style={{ height: "100%" }}>
      <motion.div ref={ref} className="pc3" onMouseMove={onMove} onMouseLeave={onLeave}
        style={{ rotateX: rx, rotateY: ry, height: "100%", ["--c" as string]: m.color, ["--cc" as string]: alpha(m.color, 0.5) }}
        whileHover={{ scale: 1.015 }}>
        <div className="glare" style={{ ["--mx" as string]: `${glare.x}%`, ["--my" as string]: `${glare.y}%`, opacity: glare.o }} />
        <div className="pimg">
          <div className="gl" /><div className="ring3" />
          {p.imageUrl
            ? <Image src={p.imageUrl} alt={p.name} fill sizes="(max-width:480px) 50vw, (max-width:1100px) 22vw, 16vw" style={{ objectFit: "cover" }} />
            : <span className="emoji">{m.emoji}</span>}
          <span className="flag">{flag(p.origin)}</span>
          {p.badges?.[0] ? <span className="bdg">{p.badges[0]}</span> : null}
          {p.envioGratis ? <span className="freeship">🚚 ENVÍO GRATIS</span> : null}
        </div>
        <div className="pbody">
          <span className="pcat">{p.categoryName}</span>
          <h3>{p.name}</h3>
          {p.benefits.length ? (
            <div className="chips">{p.benefits.slice(0, 2).map((b) => <i key={b}>{b}</i>)}</div>
          ) : <span className="ptag">{p.tagline || p.shortDesc}</span>}
          <div className="pfoot">
            <span className="price">{hasVariants ? <i className="desde">desde </i> : null}{cop(minPrice)}</span>
          </div>
          <button className="pedir" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(); }} style={{ position: "relative", zIndex: 6 }}>
            <ShoppingCart size={14} /> Añadir
          </button>
        </div>
        <Link href={`/producto/${p.slug}`} aria-label={p.name} style={{ position: "absolute", inset: 0, zIndex: 4 }} />
      </motion.div>
    </motion.div>
  );
}

const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

export function ProductCarousel({ products, wa }: { products: SProduct[]; wa: string }) {
  const [emblaRef, embla] = useEmblaCarousel(
    { loop: products.length > 4, align: "start", dragFree: true },
    [Autoplay({ delay: 3800, stopOnInteraction: false, stopOnMouseEnter: true })],
  );
  const scrollPrev = React.useCallback(() => embla?.scrollPrev(), [embla]);
  const scrollNext = React.useCallback(() => embla?.scrollNext(), [embla]);

  return (
    <div className="embla">
      <div ref={emblaRef}>
        <motion.div className="embla__c" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.05 }} variants={stagger}>
          {products.map((p) => (
            <div className="embla__s" key={p.slug}><ProductCard3D p={p} wa={wa} /></div>
          ))}
        </motion.div>
      </div>
      {products.length > 4 ? (
        <>
          <button className="emarr prev" onClick={scrollPrev} aria-label="Anterior"><ChevronLeft size={20} /></button>
          <button className="emarr next" onClick={scrollNext} aria-label="Siguiente"><ChevronRight size={20} /></button>
        </>
      ) : null}
    </div>
  );
}
