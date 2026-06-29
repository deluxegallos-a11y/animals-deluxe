"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, useInView, animate, AnimatePresence, type Variants } from "framer-motion";
import {
  Zap, ShieldCheck, Truck, Crown, Flame, Dumbbell, Star,
  BadgeCheck, Clock, PackageCheck, MessageCircle, ChevronDown,
  Users, Package, Wind, MapPin,
} from "lucide-react";
import { MegaBolts, Bolts, GlobalRays, Spotlight, GodRays, Embers, BgTubs, BoxingRing } from "@/components/store/bolts";
import { Reveal, Stagger, StaggerItem } from "@/components/store/motion";
import { CartProvider, CartButton } from "@/components/store/cart";
import { ProductCarousel, type SProduct } from "@/components/store/product-carousel";
import { catMeta, alpha } from "@/lib/store-meta";
import { cop } from "@/lib/ai/format";
import type { CodFormConfig } from "@/lib/db/schema";

export type { SProduct };
export type SCat = { slug: string; name: string; color: string };

const fadeUp: Variants = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } };
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

const waMsg = (wa: string, text: string) => (wa ? `https://wa.me/${wa}?text=${encodeURIComponent(text)}` : "");

/* ---------- Contador animado al entrar en pantalla ---------- */
function CountUp({ to, decimals = 0, suffix = "", prefix = "" }: { to: number; decimals?: number; suffix?: string; prefix?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration: 1.4, ease: [0.22, 1, 0.36, 1], onUpdate: (x) => setV(x) });
    return () => c.stop();
  }, [inView, to]);
  return <span ref={ref}>{prefix}{v.toLocaleString("es-CO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}

/* ---------- Banda de stats (visual, números grandes) ---------- */
const STATS = [
  { i: Users, to: 1000, suffix: "+", l: "Galleros confían" },
  { i: Star, to: 4.9, decimals: 1, suffix: "★", l: "Valoración real" },
  { i: Package, to: 0, suffix: "+", l: "Productos premium", dyn: true },
  { i: Truck, to: 72, prefix: "24–", suffix: "h", l: "Envío nacional" },
];
function Stats({ count }: { count: number }) {
  return (
    <section className="wrap statsband">
      <motion.div className="statsgrid" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={stagger}>
        {STATS.map((s) => (
          <motion.div className="statc" key={s.l} variants={fadeUp} whileHover={{ y: -5 }}>
            <span className="ic"><s.i size={20} /></span>
            <div className="num"><CountUp to={s.dyn ? count : s.to} decimals={s.decimals || 0} suffix={s.suffix || ""} prefix={s.prefix || ""} /></div>
            <div className="lb">{s.l}</div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

/* ---------- 1. Announcement ---------- */
function Announcement() {
  const items = ["⚡ Pago CONTRAENTREGA en todo Colombia", "🚚 Pagas cuando recibes — sin anticipos", "🇺🇸 Fórmulas premium importadas", "🐓 +1.000 galleros confían en nosotros"];
  const row = [...items, ...items];
  return (
    <div className="annc">
      <div className="track">{row.map((t, i) => <span key={i}>{t} <b>·</b></span>)}</div>
    </div>
  );
}

/* ---------- 2. Nav ---------- */
function Nav({ wa }: { wa: string }) {
  const [s, setS] = React.useState(false);
  React.useEffect(() => {
    const on = () => setS(window.scrollY > 24); on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div className={`snav ${s ? "scrolled" : ""}`}>
      <div className="inner">
        <Link href="/" className="logo"><img className="mk-img" src="/brand/logo.png" alt="Animals Deluxe" /> <b>ANIMALS DELUXE</b></Link>
        <div className="nlinks">
          <a href="#lineas">Líneas</a><a href="#combos">Combos</a><a href="#faq">Dudas</a>
        </div>
        <CartButton />
      </div>
    </div>
  );
}

/* ---------- 3. Hero ---------- */
function Hero({ count, wa }: { count: number; wa: string }) {
  const { scrollY } = useScroll();
  const fade = useTransform(scrollY, [0, 360], [1, 0]);

  return (
    <header className="hero">
      <BgTubs />
      <GodRays />
      <MegaBolts />
      <Embers count={14} />
      <div className="ringback" aria-hidden><BoxingRing /></div>
      <div className="stormglow" />
      <div className="wrap grid2">
        <motion.div className="hcopy" initial="hidden" animate="show" variants={stagger}>
          <motion.span className="kick" variants={fadeUp}><span className="pulse" /> Contraentrega en toda Colombia</motion.span>
          <motion.h1 className="hh" variants={fadeUp}>
            <span className="l1">De gallo</span>
            <span className="l2" data-text="a leyenda">a leyenda</span>
          </motion.h1>
          <motion.p className="hsub" variants={fadeUp}>
            Suplementos premium para tu campeón. <b>Pagas al recibir.</b>
          </motion.p>
          <motion.div className="hbtns" variants={fadeUp}>
            <a className="btn-g" href="#lineas"><Zap size={17} /> Ver productos</a>
            {wa ? <a className="btn-ghost" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Comprar ahora</a> : null}
          </motion.div>
          <motion.div className="hbadges" variants={fadeUp}>
            <div className="b"><b>4.9★</b><span>+1.000 galleros</span></div>
            <div className="b"><b>{count}+</b><span>Productos premium</span></div>
            <div className="b"><b>🇨🇴</b><span>Envío nacional</span></div>
          </motion.div>
        </motion.div>

        <motion.div className="mascot"
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
          <motion.div className="halo" animate={{ scale: [1, 1.06, 1], opacity: [0.45, 0.8, 0.45] }} transition={{ duration: 4, repeat: Infinity }} />
          <div className="vidframe">
            <span className="cnr tl" /><span className="cnr tr" /><span className="cnr bl" /><span className="cnr br" />
            <span className="vtag">⚡ Modo fiera</span>
            <video className="herovid" autoPlay loop muted playsInline preload="auto"
              poster="/mascots/rooster-warrior.png" aria-label="Animals Deluxe — gallo campeón">
              <source src="https://res.cloudinary.com/dh9zhrqiw/video/upload/q_auto,w_1100/v1781637273/hf_20260616_190835_e1994dae-4847-4961-813b-13bf26f57fb5_rnwsdg.mp4" type="video/mp4" />
            </video>
          </div>
        </motion.div>
      </div>
      <motion.a href="#lineas" className="scrollcue" style={{ opacity: fade }} aria-label="Bajar">
        <span /><b>Desliza</b>
      </motion.a>
    </header>
  );
}

/* ---------- 4. TrustBar ---------- */
const TRUST = [
  { i: Crown, t: "Calidad americana" }, { i: ShieldCheck, t: "100% original" },
  { i: Truck, t: "Contraentrega" }, { i: BadgeCheck, t: "+1.000 pedidos" }, { i: Star, t: "Best Choice" },
];
function TrustBar() {
  return (
    <div className="tbar">
      <div className="in">
        {TRUST.map((t) => <span className="t" key={t.t}><t.i size={17} /> {t.t}</span>)}
      </div>
    </div>
  );
}

function Divider() { return <div className="wrap"><div className="divbolt" /></div>; }

/* ---------- 5. Problema ---------- */
const PROB = [
  { i: Flame, t: "Se cansa rápido", s: "Sin energía en el momento clave" },
  { i: Wind, t: "Le falta aire", s: "Poca oxigenación, poco aguante" },
  { i: Dumbbell, t: "No levanta masa", s: "Entrena pero no desarrolla" },
];
function Problema() {
  return (
    <section className="band">
      <div className="wrap prob2">
        <motion.div className="ppic" initial={{ opacity: 0, scale: 0.9, x: -20 }} whileInView={{ opacity: 1, scale: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
          <div className="glw" />
          <motion.img src="/mascots/rooster-boxer.png" alt="Gallo Animals Deluxe" animate={{ y: [0, -10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} />
        </motion.div>
        <motion.div className="ptxt" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={stagger}>
          <motion.div className="eyebrow" variants={fadeUp}>¿Te pasa esto?</motion.div>
          <motion.h2 variants={fadeUp}>Entrena duro pero llega <em>sin chispa</em></motion.h2>
          <motion.div className="bulls" variants={stagger}>
            {PROB.map((b) => (
              <motion.div className="bl" key={b.t} variants={fadeUp} whileHover={{ x: 5 }}>
                <span className="ic"><b.i size={18} /></span>
                <div><b>{b.t}</b><span>{b.s}</span></div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- 6. Mecanismo ---------- */
const PILAR = [
  { i: Flame, img: "/mascots/rooster-boxer.png", t: "Energía", s: "Enciende la fiera para el careo", chip: "Efecto en 1h", c: "#FF4D2E" },
  { i: Dumbbell, img: "/mascots/rooster-alfa.png", t: "Fuerza", s: "Masa y músculo de competencia", chip: "Más volumen", c: "#FF9A1F" },
  { i: Wind, img: "/mascots/rooster-champion.png", t: "Aguante", s: "Más oxígeno, más resistencia", chip: "No se desinfla", c: "#22E07A" },
];
function Mecanismo() {
  return (
    <section className="band">
      <motion.div className="wrap lead" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={fadeUp}>
        <div className="eyebrow">Por qué funciona</div>
        <h2>3 pilares del <em>campeón</em></h2>
      </motion.div>
      <motion.div className="wrap pilares" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={stagger}>
        {PILAR.map((p) => (
          <motion.div className="pilar" key={p.t} variants={fadeUp} whileHover={{ y: -6 }} style={{ ["--pc" as string]: p.c }}>
            <div className="pglow" />
            <img src={p.img} alt={p.t} />
            <span className="pic"><p.i size={20} /></span>
            <h3>{p.t}</h3>
            <p>{p.s}</p>
            <span className="chip">{p.chip}</span>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

/* ---------- Cómo pedir (3 pasos visuales) ---------- */
const PASOS = [
  { i: MessageCircle, t: "Escríbenos", s: "Por WhatsApp, sin compromiso" },
  { i: BadgeCheck, t: "Confirmas", s: "Eliges productos y dirección" },
  { i: PackageCheck, t: "Pagas al recibir", s: "Contraentrega en tu puerta" },
];
function Pasos() {
  return (
    <section className="band">
      <motion.div className="wrap lead" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={fadeUp}>
        <div className="eyebrow">Fácil y seguro</div>
        <h2>Pide en <em>3 pasos</em></h2>
      </motion.div>
      <motion.div className="wrap pasos" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={stagger}>
        {PASOS.map((p, i) => (
          <motion.div className="paso" key={p.t} variants={fadeUp} whileHover={{ y: -5 }}>
            <div className="n">{i + 1}</div>
            <span className="ic"><p.i size={24} /></span>
            <b>{p.t}</b><span>{p.s}</span>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

/* ---------- 7. Categorías con carrusel ---------- */
function CategorySection({ cat, products, wa, idx }: { cat: SCat; products: SProduct[]; wa: string; idx: number }) {
  const m = catMeta(cat.slug);
  return (
    <section className={`catsec wrap ${idx % 2 ? "alt" : ""}`} id={cat.slug}>
      <motion.div className="cathead"
        style={{ ["--c" as string]: m.color, ["--c-bg" as string]: alpha(m.color, 0.10), ["--hue" as string]: `${m.hue}deg`, ["--ray" as string]: alpha(m.color, 0.12) }}
        initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.5 }}>
        <div className="gloww" /><span className="accentbar" /><Bolts />
        <motion.div className="galloc" initial={{ scale: 0.7, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 150, damping: 15 }}>
          <div className="disc" />
          <motion.img src={m.mascot} alt={cat.name} animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} />
        </motion.div>
        <div className="meta">
          <div className="tagline">{m.emoji} {m.tagline}</div>
          <h2>{cat.name}</h2>
          <div className="cnt">{products.length} producto{products.length !== 1 ? "s" : ""} · desliza para ver →</div>
        </div>
        <div className="num">{String(idx + 1).padStart(2, "0")}</div>
      </motion.div>
      <ProductCarousel products={products} wa={wa} />
    </section>
  );
}

/* ---------- 9. Combos ---------- */
type Combo = { titulo: string; desc: string; now: number; was: number; pop?: boolean; items: string[] };
function buildCombos(byCat: Map<string, SProduct[]>): Combo[] {
  const pick = (slug: string, n = 1) => (byCat.get(slug) || []).slice(0, n);
  const sum = (ps: SProduct[]) => ps.reduce((s, p) => s + p.priceCOP, 0);
  const mk = (titulo: string, desc: string, ps: SProduct[], off: number, pop?: boolean): Combo => {
    const was = sum(ps); const now = Math.round((was * (1 - off)) / 500) * 500;
    return { titulo, desc, was, now, pop, items: ps.map((p) => p.name) };
  };
  const c1 = [...pick("energia"), ...pick("vitaminas")];
  const c2 = [...pick("entrenamiento"), ...pick("suplementos"), ...pick("vitaminas")];
  const c3 = [...pick("energia"), ...pick("respiratorio"), ...pick("desparasitantes")];
  return [
    mk("Combo Energía", "Enciende la fiera para el careo: doping + vitaminas.", c1.length ? c1 : pick("energia", 2), 0.15),
    mk("Combo Desarrollo", "Construye el campeón: masa, fuerza y recuperación.", c2.length ? c2 : pick("suplementos", 2), 0.18, true),
    mk("Combo Completo", "Todo para el campeón: energía, pecho y limpieza.", c3.length ? c3 : pick("energia", 3), 0.2),
  ].filter((c) => c.was > 0);
}
function Combos({ combos, wa }: { combos: Combo[]; wa: string }) {
  if (!combos.length) return null;
  return (
    <section className="band" id="combos">
      <motion.div className="wrap lead" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={fadeUp}>
        <div className="eyebrow">Ahorra más</div><h2>Combos que <em>rinden</em></h2>
        <p>Arma el campeón completo y paga menos. Contraentrega.</p>
      </motion.div>
      <motion.div className="wrap combos" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={stagger}>
        {combos.map((c) => (
          <motion.div className={`combo ${c.pop ? "pop" : ""}`} key={c.titulo} variants={fadeUp} whileHover={{ y: -5 }}>
            {c.pop ? <div className="poptag">★ Más popular</div> : null}
            <h3>{c.titulo}</h3>
            <div className="desc">{c.desc}{c.items.length ? ` · ${c.items.slice(0, 3).join(" + ")}` : ""}</div>
            <div className="prices"><span className="now">{cop(c.now)}</span><span className="was">{cop(c.was)}</span></div>
            <div className="save">Ahorras {cop(c.was - c.now)}</div>
            <a className="cbtn" href={waMsg(wa, `Hola 🐓 quiero el *${c.titulo}* (${cop(c.now)}) contraentrega.`) || "#lineas"} target="_blank" rel="noreferrer">
              <MessageCircle size={16} /> Pedir combo
            </a>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

/* ---------- 10. Urgencia ---------- */
function Urgencia() {
  return (
    <section className="wrap">
      <motion.div className="codbanner" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.55 }}>
        <MegaBolts />
        <div className="codbanner-in">
          <div className="codbanner-ic"><PackageCheck size={34} /></div>
          <div className="codbanner-txt">
            <h3>Pago <em>contraentrega</em></h3>
            <p>Pagás cuando lo recibís en tu puerta. Sin anticipos, sin riesgos. 🐓</p>
          </div>
          <div className="codbanner-tags">
            <span><Truck size={15} /> Envío nacional</span>
            <span><Clock size={15} /> Despacho 24h</span>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

/* ---------- 11. Testimonios ---------- */
const TST = [
  { n: "Jhon C.", c: "Montería", s: "El Energy Cobra es otra cosa, mi gallo llegó encendido al careo. Volví a pedir de una.", a: "J" },
  { n: "Ferney R.", c: "Cúcuta", s: "Pedí contraentrega y llegó a los 2 días. Las vitaminas le pusieron la pluma brillante.", a: "F" },
  { n: "Diego M.", c: "Cali", s: "Lo mejor: pago cuando recibo. Producto original, se nota la diferencia en el levante.", a: "D" },
];
function Testimonios() {
  return (
    <section className="band">
      <motion.div className="wrap lead" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={fadeUp}>
        <div className="eyebrow">Lo que dicen</div><h2>Galleros que <em>repiten</em></h2>
      </motion.div>
      <motion.div className="wrap tst" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={stagger}>
        {TST.map((t) => (
          <motion.div className="tcard2" key={t.n} variants={fadeUp} whileHover={{ y: -4 }}>
            <div className="stars">★★★★★</div>
            <p>“{t.s}”</p>
            <div className="who">
              <div className="av">{t.a}</div>
              <div><b>{t.n}</b><span>{t.c}</span></div>
              <span className="ver">✔ Verificado</span>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

/* ---------- 12. FAQ ---------- */
const FAQS = [
  { q: "¿Cómo pago?", a: "Contraentrega: pagas en efectivo cuando recibes el pedido en tu casa. Sin anticipos, sin riesgos. En todo Colombia." },
  { q: "¿De verdad funciona?", a: "Son fórmulas premium importadas, dosificadas para rendimiento real. Miles de galleros las usan y repiten. Productos de bienestar y rendimiento (no curan enfermedades)." },
  { q: "¿Cuándo veo resultados?", a: "La energía se nota desde la primera dosis (1 hora antes del juego). Vitaminas y masa: en pocas semanas de uso constante." },
  { q: "¿Cuánto demora el envío?", a: "Despachamos al día siguiente. Según tu ciudad, llega entre 1 y 3 días. Te avisamos por WhatsApp." },
];
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="q">
      <button onClick={() => setOpen((o) => !o)}>{q} <motion.span animate={{ rotate: open ? 180 : 0 }}><ChevronDown size={18} /></motion.span></button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
            <div className="a" style={{ paddingBottom: 18 }}>{a}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
function FAQ() {
  return (
    <section className="band" id="faq">
      <motion.div className="wrap lead" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={fadeUp}>
        <div className="eyebrow">Resolvemos tus dudas</div><h2>Preguntas <em>frecuentes</em></h2>
      </motion.div>
      <div className="wrap faq">{FAQS.map((f) => <FAQItem key={f.q} {...f} />)}</div>
    </section>
  );
}

/* ---------- 13. Envíos + CTA final ---------- */
function CTAFinal({ wa }: { wa: string }) {
  return (
    <section className="wrap">
      <motion.div className="ship" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
        <div className="in">
          <div>
            <div className="eyebrow" style={{ color: "var(--cyan)", fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", fontSize: 12.5 }}>🚚 Envíos a todo Colombia</div>
            <h2 className="hh" style={{ fontSize: "clamp(28px,4.4vw,46px)", margin: "8px 0 10px" }}><span className="l1">Recibe tu pedido</span><span className="l2">donde estés</span></h2>
            <p style={{ color: "var(--ink-2)", fontSize: 16, marginBottom: 18, maxWidth: 440 }}>Pagas cuando recibes. Sin anticipos, sin riesgos. Tu campeón merece lo mejor. 🐓🔥</p>
            {wa ? <a className="btn-g" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Pedir por WhatsApp</a> : <a className="btn-g" href="#lineas">Ver catálogo</a>}
          </div>
          <img className="ship-brand" src="/brand/logo-gold.png" alt="Animals Deluxe" />
        </div>
      </motion.div>
    </section>
  );
}

/* ---------- Floating WhatsApp ---------- */
function Fab({ wa }: { wa: string }) {
  if (!wa) return null;
  const msg = "Hola Animals Deluxe 🐓, quiero comprar. ¿Me ayudan?";
  return (
    <a className="wafab" href={`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" aria-label="Comprar por WhatsApp">
      <span className="wafab-pulse" />
      <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden>
        <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.477-.911zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413z"/>
      </svg>
    </a>
  );
}

/* ---------- Países de envío (banderas + COD grande) ---------- */
const PAISES = [
  { f: "🇲🇽", n: "México" }, { f: "🇳🇮", n: "Nicaragua" }, { f: "🇵🇦", n: "Panamá" },
  { f: "🇵🇷", n: "Puerto Rico" }, { f: "🇩🇴", n: "Rep. Dominicana" }, { f: "🇨🇴", n: "Colombia" },
  { f: "🇻🇪", n: "Venezuela" }, { f: "🇺🇸", n: "Estados Unidos" }, { f: "🇪🇨", n: "Ecuador" }, { f: "🇵🇪", n: "Perú" },
];
function PaisesEnvio() {
  return (
    <section className="band paises">
      <MegaBolts />
      <div className="wrap pais-grid2">
        <Reveal className="pais-head">
          <div className="eyebrow" style={{ color: "var(--cyan)" }}><Truck size={15} style={{ verticalAlign: "-2px" }} /> Cobertura</div>
          <h2 className="big-ship"><span className="l1">Envíos a todo</span><span className="l2">Colombia</span></h2>
          <p className="cod-line"><PackageCheck size={20} /> Pago <b>CONTRAENTREGA</b> — pagás cuando recibís 🐓</p>
          <p className="pais-sub"><MapPin size={14} /> Y también llegamos a:</p>
        </Reveal>
        <Stagger className="pais-flags" amount={0.15}>
          {PAISES.map((p) => (
            <StaggerItem className="flagcard" key={p.n}>
              <span className="fl">{p.f}</span><span className="nm">{p.n}</span>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* ===================== ENSAMBLE ===================== */
export function Storefront({ products, cats, wa, codForm = {} }: { products: SProduct[]; cats: SCat[]; wa: string; codForm?: CodFormConfig }) {
  const byCat = new Map<string, SProduct[]>();
  for (const p of products) { if (!byCat.has(p.categorySlug)) byCat.set(p.categorySlug, []); byCat.get(p.categorySlug)!.push(p); }
  const sections = cats.filter((c) => (byCat.get(c.slug)?.length ?? 0) > 0);
  const combos = buildCombos(byCat);

  // Intercala las secciones de contenido ENTRE las categorías (mezcladas),
  // pa que no sea "todo productos y luego todo lo demás".
  const fillers: React.ReactNode[] = [
    <Urgencia key="f-urg" />,
    <Stats key="f-stats" count={products.length >= 41 ? 41 : products.length} />,
    <Combos key="f-combos" combos={combos} wa={wa} />,
    <Testimonios key="f-tst" />,
    <PaisesEnvio key="f-paises" />,
    <Pasos key="f-pasos" />,
  ];
  let fi = 0;
  const mixed: React.ReactNode[] = [];
  sections.forEach((c, i) => {
    mixed.push(<CategorySection key={c.slug} cat={c} products={byCat.get(c.slug)!} wa={wa} idx={i} />);
    if ((i + 1) % 2 === 0 && fi < fillers.length) mixed.push(fillers[fi++]);
  });
  while (fi < fillers.length) mixed.push(fillers[fi++]);

  return (
    <CartProvider wa={wa} codForm={codForm}>
    <div className="ad-store">
      <div className="bgfx"><div className="grid" /><div className="aura a1" /><div className="aura a2" /><div className="aura a3" /><GlobalRays /></div>
      <Spotlight />
      <Announcement />
      <Nav wa={wa} />
      <Hero count={products.length >= 41 ? 41 : products.length} wa={wa} />
      <Mecanismo />

      <div id="lineas" />
      {mixed}

      <FAQ />
      <CTAFinal wa={wa} />

      <footer className="sfoot">
        <div className="wrap row">
          <div>
            <div className="logo" style={{ marginBottom: 8 }}><img className="mk-img" src="/brand/logo.png" alt="Animals Deluxe" /> <b>ANIMALS DELUXE</b></div>
            <p className="muted">Suplementos de bienestar y rendimiento para gallos, pollos, perros y caballos. No curan enfermedades. Contraentrega en todo Colombia 🇨🇴</p>
          </div>
          <div className="pay"><span>💵 Contraentrega</span><span>📦 Envío nacional</span><span>🔒 Compra segura</span></div>
        </div>
      </footer>
      <Fab wa={wa} />
    </div>
    </CartProvider>
  );
}
