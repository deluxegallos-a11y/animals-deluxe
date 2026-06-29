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

/* ---- Rayos por TODA la página (capa global) ---- */
export function GlobalRays() {
  const bolts = [
    { l: "7%", h: "42%", d: "0.4s", dur: "6.5s" },
    { l: "22%", h: "30%", d: "2.1s", dur: "9s" },
    { l: "38%", h: "48%", d: "4.4s", dur: "8s" },
    { l: "54%", h: "26%", d: "1.2s", dur: "10s" },
    { l: "69%", h: "44%", d: "3.3s", dur: "7.5s" },
    { l: "84%", h: "32%", d: "5.2s", dur: "9.5s" },
    { l: "95%", h: "38%", d: "2.7s", dur: "8.5s" },
  ];
  return (
    <div className="grays" aria-hidden>
      {bolts.map((b, i) => (
        <svg key={i} className="gray" style={{ left: b.l, height: b.h, animationDelay: b.d, animationDuration: b.dur }} viewBox="0 0 40 200" preserveAspectRatio="xMidYMin meet">
          <path d="M26 0 L10 72 L23 78 L7 138 L19 144 L3 200" />
        </svg>
      ))}
    </div>
  );
}

/* ---- Ring de boxeo metálico detrás del gallo ---- */
export function BoxingRing() {
  return (
    <div className="ring-stage" aria-hidden>
      <div className="ringfloor" />
      <div className="ringpost l" /><div className="ringpost r" />
      <div className="rope r1" /><div className="rope r2" /><div className="rope r3" />
    </div>
  );
}

/* ---- Tarros de producto metálicos flotando en el fondo del hero ---- */
export function BgTubs() {
  const tubs = [
    { l: "4%", t: "20%", w: 132, d: 0, r: -13 },
    { l: "80%", t: "12%", w: 168, d: 1.3, r: 11 },
    { l: "16%", t: "60%", w: 104, d: 2.2, r: 9 },
    { l: "68%", t: "64%", w: 142, d: 0.7, r: -9 },
    { l: "44%", t: "70%", w: 90, d: 1.8, r: 5 },
  ];
  return (
    <div className="bgtubs" aria-hidden>
      {tubs.map((t, i) => (
        <div key={i} className="tubw" style={{ left: t.l, top: t.t, width: t.w, transform: `rotate(${t.r}deg)` }}>
          <svg className="tub" style={{ animationDelay: `${t.d}s` }} viewBox="0 0 80 120">
            <defs>
              <linearGradient id={`tg${i}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#dCEBFF" /><stop offset="0.45" stopColor="#5E8FD6" /><stop offset="1" stopColor="#101a2e" />
              </linearGradient>
              <linearGradient id={`tl${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#cfe0ff" /><stop offset="1" stopColor="#7ea2d8" />
              </linearGradient>
            </defs>
            <rect x="12" y="28" width="56" height="82" rx="15" fill={`url(#tg${i})`} />
            <rect x="9" y="13" width="62" height="20" rx="9" fill={`url(#tl${i})`} />
            <rect x="12" y="54" width="56" height="32" fill="rgba(255,255,255,.16)" />
            <rect x="12" y="54" width="56" height="3" fill="rgba(255,255,255,.4)" />
          </svg>
        </div>
      ))}
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
            <stop offset="0" stopColor="#ffe4dd" />
            <stop offset="0.5" stopColor="#FF5A3D" />
            <stop offset="1" stopColor="#C01414" />
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
