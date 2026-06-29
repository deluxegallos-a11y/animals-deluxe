"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

/**
 * Envoltura de revelado con un sutil efecto 3D: cada sección entra desde abajo
 * con una leve inclinación en perspectiva (rotateX) que se endereza al aparecer.
 * `once` evita que se repita y `amount` dispara cuando ~18% ya está en pantalla.
 * Se usa para que las secciones de imagen de las landings "salgan" al hacer scroll.
 */
export function Reveal3D({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <div className={className} style={{ perspective: "1200px" }}>
      <motion.div
        initial={{ opacity: 0, y: 64, rotateX: 13, scale: 0.96 }}
        whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.18 }}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay }}
        style={{ transformOrigin: "center top", willChange: "transform, opacity" }}
      >
        {children}
      </motion.div>
    </div>
  );
}
