"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { cop, flag } from "@/lib/ai/format";
import { catMeta, alpha } from "@/lib/store-meta";
import type { Presentacion } from "@/lib/db/schema";

export type PDProduct = {
  slug: string; name: string; categoryName: string; categorySlug: string; audience: string; origin: string;
  priceCOP: number; presentations: Presentacion[]; imageUrl: string; badges: string[]; tagline: string;
  shortDesc: string; benefits: string[]; usage: string; pitch: string; disclaimer: string;
};

const fadeUp: Variants = { hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } };
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

export function ProductDetail({ p, wa }: { p: PDProduct; wa: string }) {
  const m = catMeta(p.categorySlug);
  const msg = `Hola Animals Deluxe 🐓, quiero pedir *${p.name}* (${cop(p.priceCOP)}). ¿Me ayudan?`;
  const waLink = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(msg)}` : "";

  return (
    <div className="ad-store">
      <div className="bgfx"><div className="grid" /><div className="aura a1" /><div className="aura a2" /></div>

      <div className="snav scrolled">
        <div className="inner">
          <Link href="/" className="logo"><span className="mk">🐓</span> <b>ANIMALS DELUXE</b></Link>
          {waLink ? <a className="nwa" href={waLink} target="_blank" rel="noreferrer">💬 Pedir</a> : null}
        </div>
      </div>

      <div className="wrap pdp2">
        <motion.div className="stage" style={{ ["--cc" as string]: alpha(m.color, 0.55) }}
          initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
          <div className="glw" />
          {p.imageUrl
            ? <img src={p.imageUrl} alt={p.name} />
            : <motion.span className="emoji" animate={{ y: [0, -12, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>{m.emoji}</motion.span>}
          <img className="wm" src="/mascots/rooster-alfa.png" alt="" aria-hidden />
        </motion.div>

        <motion.div initial="hidden" animate="show" variants={stagger}>
          <motion.div variants={fadeUp}><Link href="/" className="back">← Volver al catálogo</Link></motion.div>
          <motion.div className="pcat" variants={fadeUp}>{flag(p.origin)} {p.categoryName} · {p.audience}</motion.div>
          <motion.h1 variants={fadeUp}>{p.name}</motion.h1>
          <motion.p className="tl" variants={fadeUp}>{p.tagline || p.shortDesc}</motion.p>

          <motion.div className="pbar" variants={fadeUp}>
            <span className="big">{cop(p.priceCOP)}</span>
            <span className="cod">💵 Contraentrega · pagas al recibir</span>
          </motion.div>

          {p.badges.length ? (
            <motion.div className="badges" variants={fadeUp}>{p.badges.map((b) => <b key={b}>{b}</b>)}</motion.div>
          ) : null}

          {p.presentations.length ? (
            <motion.div className="pres" variants={fadeUp}>
              {p.presentations.map((pr) => (
                <motion.b key={pr.label} whileHover={{ y: -3, borderColor: m.color }}>
                  {cop(pr.priceCOP)}<small>{pr.label}</small>
                </motion.b>
              ))}
            </motion.div>
          ) : null}

          {p.benefits.length ? (
            <motion.ul className="benf" variants={stagger}>
              {p.benefits.map((b) => (
                <motion.li key={b} variants={fadeUp}><i>✓</i>{b}</motion.li>
              ))}
            </motion.ul>
          ) : null}

          {p.shortDesc ? <motion.div className="blk" variants={fadeUp}>{p.shortDesc}</motion.div> : null}
          {p.usage ? <motion.div className="blk" variants={fadeUp}><h4>Modo de uso</h4>{p.usage}</motion.div> : null}
          {p.pitch ? <motion.div className="blk" variants={fadeUp}><h4>Por qué funciona</h4>{p.pitch}</motion.div> : null}

          {waLink ? (
            <motion.a className="wabtn" href={waLink} target="_blank" rel="noreferrer" variants={fadeUp} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
              💬 Pedir por WhatsApp
            </motion.a>
          ) : (
            <motion.div className="blk" variants={fadeUp}>Configura el WhatsApp de la tienda para habilitar el pedido.</motion.div>
          )}
          <motion.p className="disc" variants={fadeUp}>{p.disclaimer || "Producto de bienestar y rendimiento. No cura enfermedades."}</motion.p>
        </motion.div>
      </div>

      <footer className="sfoot"><div className="wrap"><p className="muted" style={{ textAlign: "center", margin: "0 auto" }}>Animals Deluxe · Contraentrega en Colombia 🇨🇴</p></div></footer>
    </div>
  );
}
