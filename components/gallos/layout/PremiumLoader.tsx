"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";

// Posiciones deterministas (evita mismatch de hidratación)
const PARTICLES = [
  { left: "42%", delay: "0s", dur: "1.1s" },
  { left: "47%", delay: "0.15s", dur: "1.3s" },
  { left: "52%", delay: "0.05s", dur: "1.0s" },
  { left: "57%", delay: "0.25s", dur: "1.2s" },
  { left: "45%", delay: "0.35s", dur: "1.15s" },
  { left: "55%", delay: "0.45s", dur: "1.25s" },
  { left: "49%", delay: "0.2s", dur: "0.95s" },
  { left: "60%", delay: "0.1s", dur: "1.35s" },
  { left: "40%", delay: "0.4s", dur: "1.05s" },
  { left: "53%", delay: "0.55s", dur: "1.2s" },
];

export function PremiumLoader() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    const t = setTimeout(() => {
      setDone(true);
      document.documentElement.style.overflow = "";
    }, 1150);
    return () => {
      clearTimeout(t);
      document.documentElement.style.overflow = "";
    };
  }, []);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5, ease: "easeInOut" } }}
          className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-background"
        >
          {/* Humo + glow */}
          <div className="loader-smoke pointer-events-none absolute left-1/2 top-1/2 h-[60vmin] w-[60vmin] -translate-x-1/2 -translate-y-1/2 rounded-full" />

          {/* Partículas */}
          <div className="pointer-events-none absolute inset-0">
            {PARTICLES.map((p, i) => (
              <span
                key={i}
                className="loader-particle"
                style={{
                  left: p.left,
                  animationDelay: p.delay,
                  animationDuration: p.dur,
                }}
              />
            ))}
          </div>

          {/* Logo completo (alta calidad, fondo transparente) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.82, filter: "blur(12px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-[min(66vw,300px)]"
          >
            <Image
              src="/assets/brand/logo-full.png"
              alt="Animals Deluxe"
              width={1024}
              height={1024}
              priority
              sizes="300px"
              className="h-auto w-full drop-shadow-[0_0_50px_rgba(255,201,40,0.45)]"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
