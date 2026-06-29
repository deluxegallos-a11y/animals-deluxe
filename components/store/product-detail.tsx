"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { ShoppingCart, ChevronDown, BadgeCheck, Truck, PackageCheck, ShieldCheck, Plus, Minus, Info, Droplets, Zap, FlaskConical, Star, PenLine, MoveHorizontal } from "lucide-react";
import { cop, flag } from "@/lib/ai/format";
import { catMeta, alpha } from "@/lib/store-meta";
import { CartProvider, CartButton, useCart } from "@/components/store/cart";
import { addReview } from "@/app/order-actions";
import { CodForm } from "@/components/store/cod-form";
import type { Presentacion, FaqItem, Ingrediente, CodFormConfig } from "@/lib/db/schema";
import type { Review } from "@/lib/reviews";

export type RelatedProduct = { slug: string; name: string; priceCOP: number; imageUrl: string; categoryName: string };

export type PDProduct = {
  slug: string; name: string; categoryName: string; categorySlug: string; audience: string; origin: string;
  priceCOP: number; presentations: Presentacion[]; imageUrl: string; badges: string[]; tagline: string;
  shortDesc: string; benefits: string[]; usage: string; pitch: string;
  faq: FaqItem[]; ingredients: Ingrediente[]; disclaimer: string; envioGratis?: boolean;
};

function PDFaq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="q">
      <button onClick={() => setOpen((o) => !o)}>{q} <motion.span animate={{ rotate: open ? 180 : 0 }}><ChevronDown size={17} /></motion.span></button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}>
            <div className="a" style={{ paddingBottom: 14 }}>{a}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

const fadeUp: Variants = { hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } };
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

/* ---- Info del producto en pestañas interactivas ---- */
function InfoTabs({ p }: { p: PDProduct }) {
  const tabs: { k: string; label: string; icon: any; body: React.ReactNode }[] = [];
  if (p.shortDesc) tabs.push({ k: "desc", label: "Descripción", icon: Info, body: p.shortDesc });
  if (p.usage) tabs.push({ k: "uso", label: "Modo de uso", icon: Droplets, body: p.usage });
  if (p.pitch) tabs.push({ k: "pq", label: "Por qué funciona", icon: Zap, body: p.pitch });
  if (p.ingredients?.length) {
    tabs.push({
      k: "ing", label: "Ingredientes", icon: FlaskConical,
      body: <ul>{p.ingredients.map((i) => <li key={i.name}><b>{i.name}</b>{i.detail ? ` — ${i.detail}` : ""}</li>)}</ul>,
    });
  }
  const [act, setAct] = React.useState(0);
  if (!tabs.length) return null;
  const cur = tabs[Math.min(act, tabs.length - 1)];
  return (
    <motion.div className="infotabs" variants={fadeUp}>
      <div className="it-tabs">
        {tabs.map((t, i) => (
          <button key={t.k} type="button" className={`it-tab ${i === act ? "on" : ""}`} onClick={() => setAct(i)}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div className="it-body" key={cur.k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {cur.body}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

/* ---- Mapa beneficio → icono 3D + título ultra simple (lo entiende un niño) ---- */
const BENEFIT_VIS: { re: RegExp; emoji: string; title: string }[] = [
  { re: /energ|encend|despiert|activ|prend/i, emoji: "⚡", title: "Más energía" },
  { re: /oxig|respir|ahog|aire|pulmon/i, emoji: "🫁", title: "Más oxígeno" },
  { re: /reflej|alerta|atent|reacci|vivo/i, emoji: "👁️", title: "Reflejos al 100" },
  { re: /resist|fondo|aguant|cansa|fatig|dura/i, emoji: "🔋", title: "Aguanta más" },
  { re: /fuerz|muscul|potenc|golpe|pega|pico/i, emoji: "💪", title: "Más fuerza" },
  { re: /adicc|depend/i, emoji: "🚫", title: "Sin adicción" },
  { re: /contraindic|seguro|riesg|segur/i, emoji: "🛡️", title: "100% seguro" },
  { re: /recuper|descans|sana|repon|reponer/i, emoji: "💊", title: "Recupera rápido" },
  { re: /pluma|brillo|piel|aspect|verde/i, emoji: "✨", title: "Mejor aspecto" },
  { re: /pes|masa|tama|crec|levant/i, emoji: "📈", title: "Crece sano" },
  { re: /defens|inmun|enferm|virus/i, emoji: "🩺", title: "Más defensas" },
  { re: /digest|apetit|comer|nutri|aliment/i, emoji: "🍽️", title: "Come mejor" },
  { re: /hueso|articul|pata|pierna/i, emoji: "🦴", title: "Huesos fuertes" },
  { re: /import|premium|original|calidad/i, emoji: "🏆", title: "Calidad premium" },
];
function visFor(b: string) {
  return BENEFIT_VIS.find((x) => x.re.test(b)) || { emoji: "✅", title: b.length > 24 ? b.slice(0, 22) + "…" : b };
}

/* ---- "¿Para qué sirve?" — carrusel dopamínico (swipe, 1 beneficio por tarjeta) ---- */
const PQS_ACCENTS = ["#FF6A4D", "#FFC43D", "#FF4D3D", "#FF8A3D", "#E84141", "#FFB02E", "#FF5E5E", "#F59E0B"];
function ParaQueSirve({ benefits }: { benefits: string[] }) {
  const items = benefits.slice(0, 8);
  const [idx, setIdx] = React.useState(0);
  const rail = React.useRef<HTMLDivElement>(null);
  if (!items.length) return null;

  const onScroll = () => {
    const el = rail.current; if (!el) return;
    const step = el.scrollWidth / items.length;
    setIdx(Math.max(0, Math.min(items.length - 1, Math.round(el.scrollLeft / step))));
  };
  const goTo = (i: number) => {
    const el = rail.current; if (!el) return;
    const step = el.scrollWidth / items.length;
    el.scrollTo({ left: step * i, behavior: "smooth" });
  };

  return (
    <section className="wrap pdp-section">
      <h2 className="pdp-h2">¿Para qué <em>sirve</em>?</h2>
      <p className="pdp-sub">Desliza 👉 mira todo lo que gana tu campeón</p>
      <div className="pqs-rail" ref={rail} onScroll={onScroll}>
        {items.map((b, i) => {
          const v = visFor(b);
          const ac = PQS_ACCENTS[i % PQS_ACCENTS.length];
          return (
            <div className="pqs-slide" key={i}
              style={{ background: `radial-gradient(125% 80% at 50% 0%, ${ac}33, transparent 60%), linear-gradient(170deg,#16080b,#0a0406)` }}>
              <div className="pqs-orb" style={{ boxShadow: `inset 0 2px 8px rgba(255,255,255,.2), inset 0 -10px 20px rgba(0,0,0,.6), 0 18px 34px -12px rgba(0,0,0,.85), 0 0 44px -6px ${ac}` }}>
                <span>{v.emoji}</span>
              </div>
              <b style={{ color: ac }}>{v.title}</b>
              <span>{b}</span>
            </div>
          );
        })}
      </div>
      <div className="pqs-dots">
        {items.map((_, i) => (
          <button key={i} className={i === idx ? "on" : ""} onClick={() => goTo(i)} aria-label={`Beneficio ${i + 1}`} />
        ))}
      </div>
    </section>
  );
}

/* ---- Slider antes/después: arrastra para ver la transformación ---- */
function GalloSlider() {
  const [pos, setPos] = React.useState(50);
  const [touched, setTouched] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef(false);

  const setFromX = (clientX: number) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    setPos(Math.max(2, Math.min(98, ((clientX - r.left) / r.width) * 100)));
  };
  const onDown = (e: React.PointerEvent) => {
    drag.current = true; setTouched(true);
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* noop */ }
    setFromX(e.clientX);
  };
  const onMove = (e: React.PointerEvent) => { if (drag.current) setFromX(e.clientX); };
  const onUp = () => { drag.current = false; };

  // Auto-demo una vez para invitar a interactuar
  React.useEffect(() => {
    if (touched) return;
    const t1 = setTimeout(() => !drag.current && setPos(72), 800);
    const t2 = setTimeout(() => !drag.current && setPos(30), 1500);
    const t3 = setTimeout(() => !drag.current && setPos(52), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [touched]);

  return (
    <section className="wrap pdp-section">
      <h2 className="pdp-h2">La <em>transformación</em></h2>
      <p className="pdp-sub">Desliza 👉 y mira el cambio</p>
      <div className="gs" ref={ref} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
        style={{ ["--pos" as string]: `${pos}%` }}>
        <Image className="gs-img" src="/ai/slider-con.png" alt="Gallo con energía" fill priority sizes="(max-width:900px) 100vw, 860px" style={{ objectFit: "cover" }} />
        <div className="gs-top">
          <Image className="gs-img" src="/ai/slider-sin.png" alt="Gallo sin energía" fill sizes="(max-width:900px) 100vw, 860px" style={{ objectFit: "cover" }} />
        </div>
        <span className="gs-tag left">😴 SIN</span>
        <span className="gs-tag right">🔥 CON</span>
        <div className="gs-handle"><span className={`gs-grip ${touched ? "" : "hint"}`}><MoveHorizontal size={22} /></span></div>
      </div>
    </section>
  );
}

/* ---- Estrellas (display o selector) ---- */
function Stars({ value, onPick, size = 16 }: { value: number; onPick?: (v: number) => void; size?: number }) {
  return (
    <span className={`stars5 ${onPick ? "pick" : ""}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" tabIndex={onPick ? 0 : -1} aria-label={`${n} estrellas`}
          className={n <= value ? "on" : ""} onClick={onPick ? () => onPick(n) : undefined} disabled={!onPick}>
          <Star size={size} fill={n <= value ? "currentColor" : "none"} />
        </button>
      ))}
    </span>
  );
}

function timeAgo(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  if (!d) return "";
  const days = Math.floor((Date.now() - d) / 86400000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days} días`;
  const mo = Math.floor(days / 30);
  return mo === 1 ? "Hace 1 mes" : `Hace ${mo} meses`;
}

/* ---- Reseñas por producto: lista + formulario para agregar ---- */
function ReviewsSection({ slug, productName, initial }: { slug: string; productName: string; initial: Review[] }) {
  const [list, setList] = React.useState<Review[]>(initial);
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ nombre: "", ciudad: "", texto: "" });
  const [rating, setRating] = React.useState(5);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [thanks, setThanks] = React.useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  const count = list.length;
  const avg = count ? Math.round((list.reduce((a, r) => a + (r.rating || 5), 0) / count) * 10) / 10 : 5;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await addReview({ slug, nombre: f.nombre, ciudad: f.ciudad, rating, texto: f.texto });
    setBusy(false);
    if (r.ok) {
      setList((l) => [{ ...r.review, slug }, ...l]);
      setF({ nombre: "", ciudad: "", texto: "" }); setRating(5);
      setThanks(true); setOpen(false);
      setTimeout(() => setThanks(false), 4000);
    } else setErr(r.error);
  }

  return (
    <section className="wrap pdp-section">
      <div className="rv-head">
        <div>
          <h2 className="pdp-h2" style={{ textAlign: "left", margin: 0 }}>Reseñas de <em>clientes</em></h2>
          <div className="rv-summary">
            <Stars value={Math.round(avg)} />
            <b>{avg.toFixed(1)}</b>
            <span>· {count} {count === 1 ? "reseña" : "reseñas"}</span>
          </div>
        </div>
        <button className="rv-add" onClick={() => setOpen((o) => !o)}><PenLine size={16} /> Escribir reseña</button>
      </div>

      {thanks ? <div className="rv-thanks">✅ ¡Gracias por tu reseña! Ya está publicada.</div> : null}

      <AnimatePresence initial={false}>
        {open ? (
          <motion.form className="rv-form" onSubmit={submit}
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
            <div className="rv-form-in">
              <div className="rv-rate"><span>Tu calificación:</span><Stars value={rating} onPick={setRating} size={22} /></div>
              <div className="rv-row">
                <input required placeholder="Tu nombre" maxLength={40} value={f.nombre} onChange={(e) => set("nombre", e.target.value)} />
                <input placeholder="Ciudad (opcional)" maxLength={40} value={f.ciudad} onChange={(e) => set("ciudad", e.target.value)} />
              </div>
              <textarea required placeholder={`¿Cómo te fue con ${productName}? Cuéntale a otros galleros…`} maxLength={500} rows={3} value={f.texto} onChange={(e) => set("texto", e.target.value)} />
              {err ? <div className="rv-err">{err}</div> : null}
              <button className="rv-submit" type="submit" disabled={busy}>{busy ? "Publicando…" : "Publicar reseña"}</button>
            </div>
          </motion.form>
        ) : null}
      </AnimatePresence>

      {count ? (
        <div className="rv-list">
          {list.map((r) => (
            <div className="rv-card" key={r.id}>
              <div className="rv-top">
                <span className="rv-av">{r.nombre.charAt(0).toUpperCase()}</span>
                <div className="rv-who"><b>{r.nombre}</b><span>{r.ciudad ? `${r.ciudad} · ` : ""}{timeAgo(r.createdAt)}</span></div>
                <span className="rv-ver">✔ Comprador</span>
              </div>
              <Stars value={r.rating} size={14} />
              <p>{r.texto}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rv-empty">
          <div className="ic">⭐</div>
          <b>Sé el primero en opinar</b>
          <span>Comparte tu experiencia con {productName} y ayuda a otros galleros.</span>
        </div>
      )}
    </section>
  );
}

/* ---- Banner de impacto (gallo musculoso IA) ---- */
function PowerBand({ name }: { name: string }) {
  return (
    <section className="wrap pdp-section">
      <motion.div className="powerband" initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
        <Image src="/ai/hero-gallos.png" alt="Gallo campeón" fill sizes="100vw" style={{ objectFit: "cover" }} />
        <div className="pb-ov">
          <span className="pb-kick">⚡ Energía de campeón</span>
          <h2>TU GALLO AL <em>100%</em></h2>
          <p>Con {name}, tu campeón entra encendido, aguanta más y reacciona primero. 🐓🔥</p>
        </div>
      </motion.div>
    </section>
  );
}

/* ---- Barra de anuncios rotativa (arriba del PDP) ---- */
const ANNOUNCE = ["🚚 Pago CONTRAENTREGA en todo el país", "🌎 Envíos internacionales"];
function AnnounceBar() {
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % ANNOUNCE.length), 3200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="annbar" role="status" aria-live="polite">
      <AnimatePresence mode="wait">
        <motion.span key={i} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
          {ANNOUNCE[i]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

export function ProductDetail({ p, wa, related = [], reviews = [], codForm = {} }: { p: PDProduct; wa: string; related?: RelatedProduct[]; reviews?: Review[]; codForm?: CodFormConfig }) {
  return <CartProvider wa={wa} codForm={codForm}><PDPBody p={p} wa={wa} related={related} reviews={reviews} codForm={codForm} /></CartProvider>;
}

function PDPBody({ p, wa, related, reviews, codForm }: { p: PDProduct; wa: string; related: RelatedProduct[]; reviews: Review[]; codForm: CodFormConfig }) {
  const m = catMeta(p.categorySlug);
  const msg = `Hola Animals Deluxe 🐓, quiero pedir *${p.name}* (${cop(p.priceCOP)}). ¿Me ayudan?`;
  const waLink = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(msg)}` : "";
  const { add } = useCart();
  const [presIdx, setPresIdx] = React.useState(0);
  const [qty, setQty] = React.useState(1);
  const [codOpen, setCodOpen] = React.useState(false);
  const sel = p.presentations[presIdx] || { label: "", priceCOP: p.priceCOP };
  function onAdd() { add({ slug: p.slug, name: p.name, presLabel: sel.label, priceCOP: sel.priceCOP, qty, imageUrl: p.imageUrl }); }

  return (
    <div className="ad-store">
      <div className="bgfx"><div className="grid" /><div className="aura a1" /><div className="aura a2" /></div>

      <AnnounceBar />

      <div className="snav scrolled">
        <div className="inner">
          <Link href="/" className="logo"><img className="mk-img" src="/brand/logo.png" alt="Animals Deluxe" /> <b>ANIMALS DELUXE</b></Link>
          <CartButton />
        </div>
      </div>

      <div className="wrap pdp2">
        <motion.div className="stage" style={{ ["--cc" as string]: alpha(m.color, 0.55) }}
          initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
          <div className="glw" />
          {p.imageUrl
            ? <Image src={p.imageUrl} alt={p.name} fill priority sizes="(max-width:880px) 100vw, 45vw" style={{ objectFit: "contain" }} />
            : <motion.span className="emoji" animate={{ y: [0, -12, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>{m.emoji}</motion.span>}
          <img className="wm" src="/mascots/rooster-alfa.png" alt="" aria-hidden />
        </motion.div>

        <motion.div initial="hidden" animate="show" variants={stagger}>
          <motion.div variants={fadeUp}><Link href="/" className="back">← Volver al catálogo</Link></motion.div>
          <motion.div className="pcat" variants={fadeUp}>{flag(p.origin)} {p.categoryName}</motion.div>
          <motion.h1 variants={fadeUp}>{p.name}</motion.h1>
          <motion.p className="tl" variants={fadeUp}>{p.tagline || p.shortDesc}</motion.p>

          <motion.div className="pbar" variants={fadeUp}>
            <span className="big">{cop(sel.priceCOP)}</span>
            <span className="cod">💵 Pagas al recibir</span>
            {p.envioGratis ? <span className="freeship-pdp">🚚 Envío GRATIS</span> : null}
          </motion.div>

          {p.presentations.length > 1 ? (
            <motion.div className="pres" variants={fadeUp}>
              {p.presentations.map((pr, idx) => (
                <button key={pr.label} type="button" className={`presopt ${idx === presIdx ? "on" : ""}`} onClick={() => setPresIdx(idx)}>
                  {cop(pr.priceCOP)}<small>{pr.label}</small>
                </button>
              ))}
            </motion.div>
          ) : null}

          <motion.button type="button" className="codbtn" variants={fadeUp} onClick={() => setCodOpen(true)} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
            <PackageCheck size={20} /> Pedir contraentrega
          </motion.button>

          <motion.div className="addrow" variants={fadeUp}>
            <div className="qtystep">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Quitar uno"><Minus size={16} /></button>
              <span>{qty}</span>
              <button type="button" onClick={() => setQty((q) => Math.min(99, q + 1))} aria-label="Agregar uno"><Plus size={16} /></button>
            </div>
            <button type="button" className="addbtn" onClick={onAdd}><ShoppingCart size={18} /> Añadir — {cop(sel.priceCOP * qty)}</button>
          </motion.div>

          <motion.div className="guarantees" variants={fadeUp}>
            <span><PackageCheck size={16} /> Pagas al recibir</span>
            <span><ShieldCheck size={16} /> 100% original</span>
            <span><Truck size={16} /> Envío a todo el país</span>
          </motion.div>

          <motion.p className="disc" variants={fadeUp}>{p.disclaimer || "Producto de bienestar y rendimiento. No cura enfermedades."}</motion.p>
        </motion.div>
      </div>

      <GalloSlider />
      <ParaQueSirve benefits={p.benefits} />
      <PowerBand name={p.name} />

      <ReviewsSection slug={p.slug} productName={p.name} initial={reviews} />

      {related.length ? (
        <section className="wrap pdp-section">
          <h2 className="pdp-h2">También te puede <em>servir</em></h2>
          <div className="rel-grid">
            {related.map((r) => (
              <Link href={`/producto/${r.slug}`} className="relcard" key={r.slug}>
                <div className="ri">{r.imageUrl ? <Image src={r.imageUrl} alt={r.name} fill sizes="180px" style={{ objectFit: "cover" }} /> : <span>🐓</span>}</div>
                <div className="rb"><span className="rcat">{r.categoryName}</span><b>{r.name}</b><span className="rp">{cop(r.priceCOP)}</span></div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <footer className="sfoot"><div className="wrap"><p className="muted" style={{ textAlign: "center", margin: "0 auto" }}>Animals Deluxe · Contraentrega en Colombia 🇨🇴</p></div></footer>

      {codOpen ? <CodForm items={[{ slug: p.slug, name: p.name, presLabel: sel.label, qty, priceCOP: sel.priceCOP, imageUrl: p.imageUrl }]} upsellCfg={codForm} onClose={() => setCodOpen(false)} /> : null}

      {waLink ? (
        <a className="wafab" href={waLink} target="_blank" rel="noreferrer" aria-label="Comprar por WhatsApp">
          <span className="wafab-pulse" />
          <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden>
            <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.477-.911zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413z"/>
          </svg>
        </a>
      ) : null}
    </div>
  );
}
