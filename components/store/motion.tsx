"use client";

/* ===========================================================
   Conectores de Motion — envoltorios reutilizables (Framer Motion)
   para animar toda la web/plataforma de forma consistente.
   Uso: <Reveal>, <Pop>, <Stagger><StaggerItem/>…</Stagger>,
        <Float>, <Magnetic>, <Shine/>
   =========================================================== */
import * as React from "react";
import { motion, useMotionValue, useSpring, type Variants } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

/* Aparece desde abajo al entrar en pantalla */
export function Reveal({ children, delay = 0, y = 26, className, as = "div" }: {
  children: React.ReactNode; delay?: number; y?: number; className?: string; as?: any;
}) {
  const M = (motion as any)[as] || motion.div;
  return (
    <M className={className}
      initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.55, ease: EASE, delay }}>
      {children}
    </M>
  );
}

/* Escala + aparece (para tarjetas/íconos) */
export function Pop({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className}
      initial={{ opacity: 0, scale: 0.86 }} whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.3 }} transition={{ type: "spring", stiffness: 200, damping: 18, delay }}>
      {children}
    </motion.div>
  );
}

const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item: Variants = { hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } };

/* Contenedor que escalona la entrada de sus hijos <StaggerItem> */
export function Stagger({ children, className, amount = 0.2 }: { children: React.ReactNode; className?: string; amount?: number }) {
  return (
    <motion.div className={className} variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount }}>
      {children}
    </motion.div>
  );
}
export function StaggerItem({ children, className, hover = true }: { children: React.ReactNode; className?: string; hover?: boolean }) {
  return (
    <motion.div className={className} variants={item} whileHover={hover ? { y: -5 } : undefined}>
      {children}
    </motion.div>
  );
}

/* Flota suave en loop (idle) */
export function Float({ children, className, range = 8, dur = 4 }: { children: React.ReactNode; className?: string; range?: number; dur?: number }) {
  return (
    <motion.div className={className} animate={{ y: [0, -range, 0] }} transition={{ duration: dur, repeat: Infinity, ease: "easeInOut" }}>
      {children}
    </motion.div>
  );
}

/* Magnético: se inclina/mueve hacia el cursor (dinamismo) */
export function Magnetic({ children, className, strength = 14 }: { children: React.ReactNode; className?: string; strength?: number }) {
  const x = useSpring(useMotionValue(0), { stiffness: 200, damping: 15 });
  const y = useSpring(useMotionValue(0), { stiffness: 200, damping: 15 });
  function onMove(e: React.MouseEvent) {
    const r = e.currentTarget.getBoundingClientRect();
    x.set(((e.clientX - r.left) / r.width - 0.5) * strength);
    y.set(((e.clientY - r.top) / r.height - 0.5) * strength);
  }
  return (
    <motion.div className={className} style={{ x, y }} onMouseMove={onMove} onMouseLeave={() => { x.set(0); y.set(0); }}>
      {children}
    </motion.div>
  );
}
