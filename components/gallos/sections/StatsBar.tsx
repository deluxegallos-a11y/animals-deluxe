"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

const STATS: { value: number; prefix: string; suffix: string; label: string }[] =
  [
    { value: 5200, prefix: "+", suffix: "", label: "Pedidos entregados" },
    { value: 97, prefix: "+", suffix: "%", label: "Clientes satisfechos" },
    { value: 48, prefix: "+", suffix: "", label: "Ciudades" },
  ];

function useCountUp(target: number, run: boolean, duration = 1600) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, duration]);
  return val;
}

function Stat({
  value,
  prefix,
  suffix,
  label,
  run,
}: {
  value: number;
  prefix: string;
  suffix: string;
  label: string;
  run: boolean;
}) {
  const n = useCountUp(value, run);
  return (
    <div className="flex flex-col items-center px-1.5 text-center">
      <span className="font-heading text-champagne text-[clamp(32px,9vw,52px)] leading-none">
        {prefix}
        {n.toLocaleString("es-CO")}
        {suffix}
      </span>
      <span className="font-ui mt-3 text-[clamp(10px,2.5vw,12px)] font-medium uppercase leading-tight tracking-[0.14em] text-white/45">
        {label}
      </span>
    </div>
  );
}

export function StatsBar() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="bg-background px-5 py-16">
      <div
        ref={ref}
        className="glass mx-auto max-w-2xl rounded-[28px] px-6 py-11 sm:px-10"
      >
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <span className="flex gap-0.5 text-[#ffd76a]">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg key={i} width="15" height="15" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9 4.7 17.6l1-5.8L1.5 7.7l5.9-.9z" />
              </svg>
            ))}
          </span>
          <span className="font-ui text-xs font-medium tracking-wide text-white/55">
            Calificación 4.9/5
          </span>
        </div>
        <div className="divide-hairline grid grid-cols-3 divide-x">
          {STATS.map((s) => (
            <Stat key={s.label} {...s} run={inView} />
          ))}
        </div>
      </div>
    </section>
  );
}
