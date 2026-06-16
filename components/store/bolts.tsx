"use client";

import * as React from "react";

/* ============================================================
   ANIMALS DELUXE · Motor de efectos
   Rayos volumétricos, relámpagos eléctricos y luz reactiva al
   movimiento del cursor. CSS vive en store-theme.css.
   ============================================================ */

/* ---- Spotlight: luz que sigue el cursor (cada movimiento = animación) ---- */
export function Spotlight() {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--sx", `${e.clientX}px`);
        el.style.setProperty("--sy", `${e.clientY}px`);
        el.style.opacity = "1";
      });
    };
    const leave = () => { el.style.opacity = "0"; };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerleave", leave);
    };
  }, []);
  return <div ref={ref} className="spotlight" aria-hidden />;
}

/* ---- God rays: haces de luz volumétrica que barren la escena ---- */
export function GodRays({ tint }: { tint?: string }) {
  return (
    <div className="godrays" aria-hidden style={tint ? ({ ["--gr" as string]: tint }) : undefined}>
      <span className="gr g1" /><span className="gr g2" /><span className="gr g3" /><span className="gr g4" />
    </div>
  );
}

/* ---- Lluvia de chispas que suben (ambiente de combate) ---- */
export function Embers({ count = 16 }: { count?: number }) {
  const seeds = React.useMemo(
    () => Array.from({ length: count }, (_, i) => ({
      left: (i * 61.7) % 100,
      delay: (i * 0.83) % 7,
      dur: 6 + ((i * 1.7) % 6),
      size: 2 + ((i * 1.3) % 4),
    })),
    [count],
  );
  return (
    <div className="embers" aria-hidden>
      {seeds.map((s, i) => (
        <span key={i} style={{ left: `${s.left}%`, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s`, width: s.size, height: s.size }} />
      ))}
    </div>
  );
}

/* ---- MEGA BOLTS: relámpagos eléctricos cian (hero/banners) ---- */
const PATHS = [
  "M40 0 L16 110 L34 122 L10 220 L28 232 L4 320",
  "M30 0 L48 90 L30 100 L52 200 L34 210 L56 320",
  "M34 0 L12 96 L30 108 L8 214 L26 226 L6 320",
  "M36 0 L20 100 L38 112 L14 224 L30 236 L10 320",
];

export function MegaBolts() {
  return (
    <div className="mbolts" aria-hidden>
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="boltgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eaf4ff" />
            <stop offset="0.5" stopColor="#6FB6FF" />
            <stop offset="1" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
      </svg>
      {["m1", "m2", "m3", "m4"].map((c, i) => (
        <svg key={c} className={`mbolt ${c} show`} viewBox="0 0 60 320" preserveAspectRatio="xMidYMin meet">
          <path d={PATHS[i]} />
        </svg>
      ))}
    </div>
  );
}

/* ---- Rayos pequeños del color de la categoría ---- */
export function Bolts() {
  return (
    <div className="bolts" aria-hidden>
      {(["b1", "b2", "b3"] as const).map((b) => (
        <svg key={b} className={`bolt ${b}`} viewBox="0 0 40 200" preserveAspectRatio="xMidYMin meet">
          <path d="M26 0 L10 72 L23 78 L7 138 L19 144 L3 200" />
        </svg>
      ))}
    </div>
  );
}
