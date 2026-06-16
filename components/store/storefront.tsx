"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, useMotionValue, useSpring, AnimatePresence, type Variants } from "framer-motion";
import {
  Zap, ShieldCheck, Truck, Crown, Flame, Activity, Droplets, Dumbbell, Star,
  BadgeCheck, Clock, PackageCheck, MessageCircle, ChevronDown, Sparkles, Heart,
} from "lucide-react";
import { MegaBolts, Bolts, Spotlight, GodRays, Embers } from "@/components/store/bolts";
import { ProductCarousel, type SProduct } from "@/components/store/product-carousel";
import { catMeta, alpha } from "@/lib/store-meta";
import { cop } from "@/lib/ai/format";

export type { SProduct };
export type SCat = { slug: string; name: string; color: string };

const fadeUp: Variants = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } };
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

const waMsg = (wa: string, text: string) => (wa ? `https://wa.me/${wa}?text=${encodeURIComponent(text)}` : "");

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
        <Link href="/" className="logo"><span className="mk">👑</span> <b>ANIMALS DELUXE</b></Link>
        <div className="nlinks">
          <a href="#lineas">Líneas</a><a href="#combos">Combos</a><a href="#faq">Dudas</a>
        </div>
        {wa ? <a className="nwa" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Pedir por WhatsApp</a> : null}
      </div>
    </div>
  );
}

/* ---------- 3. Hero ---------- */
const HFEATS = [
  { i: Zap, t: "Energía inmediata" }, { i: Activity, t: "Activación superior" },
  { i: Heart, t: "Vitalidad constante" }, { i: Sparkles, t: "Recuperación óptima" },
];
function Hero({ count, wa }: { count: number; wa: string }) {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 80]);
  const rot = useTransform(scrollY, [0, 500], [0, -5]);
  const fade = useTransform(scrollY, [0, 360], [1, 0]);

  // parallax del gallo según el cursor — cada movimiento, una reacción
  const px = useSpring(useMotionValue(0), { stiffness: 90, damping: 18 });
  const py = useSpring(useMotionValue(0), { stiffness: 90, damping: 18 });
  function onMove(e: React.MouseEvent) {
    const r = e.currentTarget.getBoundingClientRect();
    px.set(((e.clientX - r.left) / r.width - 0.5) * 30);
    py.set(((e.clientY - r.top) / r.height - 0.5) * 24);
  }
  function onLeave() { px.set(0); py.set(0); }

  return (
    <header className="hero" onMouseMove={onMove} onMouseLeave={onLeave}>
      <GodRays />
      <MegaBolts />
      <Embers count={14} />
      <div className="stormglow" />
      <div className="wrap grid2">
        <motion.div initial="hidden" animate="show" variants={stagger}>
          <motion.span className="kick" variants={fadeUp}><span className="pulse" /> Contraentrega en todo Colombia</motion.span>
          <motion.h1 className="hh" variants={fadeUp}>
            <span className="l1">Potencia.</span>
            <span className="l2">Energía.</span>
            <span className="l1">Rendimiento.</span>
          </motion.h1>
          <motion.p className="hsub" variants={fadeUp}>
            Fórmulas premium para que tu gallo llegue encendido al careo. Resultados de combate — pagas cuando recibes.
          </motion.p>
          <motion.div className="hfeats" variants={fadeUp}>
            {HFEATS.map((f) => <div className="hf" key={f.t}><span className="ic"><f.i size={17} /></span>{f.t}</div>)}
          </motion.div>
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

        <motion.div className="mascot" style={{ y, rotate: rot, x: px }}
          initial={{ opacity: 0, scale: 0.82 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
          <motion.div className="rays2" animate={{ rotate: 360 }} transition={{ duration: 90, repeat: Infinity, ease: "linear" }} />
          <motion.div className="halo" animate={{ scale: [1, 1.07, 1], opacity: [0.5, 0.85, 0.5] }} transition={{ duration: 4, repeat: Infinity }} />
          <motion.div className="ring" animate={{ rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }} />
          <motion.div className="ring r2" animate={{ rotate: -360 }} transition={{ duration: 28, repeat: Infinity, ease: "linear" }} />
          <motion.img src="/mascots/rooster-warrior.png" alt="Animals Deluxe — gallo campeón"
            style={{ y: py, borderRadius: "50%", maskImage: "radial-gradient(circle, #000 60%, transparent 74%)", WebkitMaskImage: "radial-gradient(circle, #000 60%, transparent 74%)" }}
            animate={{ y: [0, -14, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} />
          <div className="pedestal" />
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
function Problema() {
  return (
    <section className="band">
      <Bolts />
      <motion.div className="wrap lead" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={fadeUp}>
        <div className="eyebrow">¿Te pasa esto?</div>
        <h2>Tu gallo entrena duro… pero llega <em>sin chispa</em> al careo</h2>
        <p>Le metes corral, comida y horas — y aun así se cansa, le falta aire, se desinfla en el momento clave. No es falta de raza: es que le falta el <b style={{ color: "#fff" }}>combustible correcto</b> en el momento correcto.</p>
      </motion.div>
    </section>
  );
}

/* ---------- 6. Mecanismo ---------- */
const MECH = [
  { i: Flame, b: "Energía instantánea", s: "Doping americano de alta biodisponibilidad que enciende la fiera justo antes del juego." },
  { i: Droplets, b: "Más oxigenación", s: "Mejor llegada de oxígeno = más aguante, reflejos y recuperación entre embestidas." },
  { i: Dumbbell, b: "Masa y fuerza", s: "Vitaminas y proteína de competencia para construir el campeón, no solo mantenerlo." },
];
function Mecanismo() {
  return (
    <section className="band">
      <motion.div className="wrap lead" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={fadeUp}>
        <div className="eyebrow">Por qué funciona</div>
        <h2>El <em>guía</em> que tu campeón necesitaba</h2>
        <p>No vendemos humo: fórmulas premium importadas, dosificadas para rendimiento real.</p>
      </motion.div>
      <motion.div className="wrap mech" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={stagger}>
        {MECH.map((m) => (
          <motion.div className="m" key={m.b} variants={fadeUp} whileHover={{ y: -4 }}>
            <div className="ic"><m.i size={22} /></div><b>{m.b}</b><span>{m.s}</span>
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
        <div className="gloww" /><div className="rays" /><Bolts />
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
      <motion.div className="urg" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
        <div className="u"><Flame size={18} color="#FF6A4D" /> <b>Pocas unidades</b> de las fórmulas premium</div>
        <div className="u"><Clock size={18} color="#FF6A4D" /> Pedidos de hoy <b>salen mañana</b></div>
        <div className="u"><PackageCheck size={18} color="#FF6A4D" /> <b>Contraentrega</b> — pagas al recibir</div>
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
        <MegaBolts />
        <div className="in">
          <div>
            <div className="eyebrow" style={{ color: "var(--cyan)", fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", fontSize: 12.5 }}>🚚 Envíos a todo Colombia</div>
            <h2 className="hh" style={{ fontSize: "clamp(28px,4.4vw,46px)", margin: "8px 0 10px" }}><span className="l1">Recibe tu pedido</span><span className="l2">donde estés</span></h2>
            <p style={{ color: "var(--ink-2)", fontSize: 16, marginBottom: 18, maxWidth: 440 }}>Pagas cuando recibes. Sin anticipos, sin riesgos. Tu campeón merece lo mejor. 🐓🔥</p>
            {wa ? <a className="btn-g" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Pedir por WhatsApp</a> : <a className="btn-g" href="#lineas">Ver catálogo</a>}
          </div>
          <img className="flagimg" src="/mascots/colombia-flag.png" alt="Colombia" />
        </div>
      </motion.div>
    </section>
  );
}

/* ---------- Floating WhatsApp ---------- */
function Fab({ wa }: { wa: string }) {
  if (!wa) return null;
  return (
    <a className="fab" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
      <span className="dotwa" /><MessageCircle size={18} /> <span className="lbl">Pedir por WhatsApp</span>
    </a>
  );
}

/* ===================== ENSAMBLE ===================== */
export function Storefront({ products, cats, wa }: { products: SProduct[]; cats: SCat[]; wa: string }) {
  const byCat = new Map<string, SProduct[]>();
  for (const p of products) { if (!byCat.has(p.categorySlug)) byCat.set(p.categorySlug, []); byCat.get(p.categorySlug)!.push(p); }
  const sections = cats.filter((c) => (byCat.get(c.slug)?.length ?? 0) > 0);
  const combos = buildCombos(byCat);

  return (
    <div className="ad-store">
      <div className="bgfx"><div className="grid" /><div className="aura a1" /><div className="aura a2" /><div className="aura a3" /></div>
      <Spotlight />
      <Announcement />
      <Nav wa={wa} />
      <Hero count={products.length >= 41 ? 41 : products.length} wa={wa} />
      <TrustBar />
      <Problema />
      <Mecanismo />
      <Divider />

      <div id="lineas" />
      {sections.map((c, i) => <CategorySection key={c.slug} cat={c} products={byCat.get(c.slug)!} wa={wa} idx={i} />)}

      <Divider />
      <Combos combos={combos} wa={wa} />
      <Urgencia />
      <Testimonios />
      <FAQ />
      <CTAFinal wa={wa} />

      <footer className="sfoot">
        <div className="wrap row">
          <div>
            <div className="logo" style={{ marginBottom: 8 }}><span className="mk">👑</span> <b>ANIMALS DELUXE</b></div>
            <p className="muted">Suplementos de bienestar y rendimiento para gallos, pollos, perros y caballos. No curan enfermedades. Contraentrega en todo Colombia 🇨🇴</p>
          </div>
          <div className="pay"><span>💵 Contraentrega</span><span>📦 Envío nacional</span><span>🔒 Compra segura</span></div>
        </div>
      </footer>
      <Fab wa={wa} />
    </div>
  );
}
