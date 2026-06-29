"use client";

import { useEffect, useRef, useState } from "react";
import { Section } from "@/components/gallos/shared/Section";
import { Icon } from "@/components/gallos/shared/Icon";
import { REVIEWS } from "@/components/gallos/_lib/data";

export function ReviewCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  // Autoavance 6s (handoff §3)
  useEffect(() => {
    if (paused) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = setInterval(() => {
      const el = trackRef.current;
      if (!el) return;
      const card = el.querySelector("article");
      const step = card ? card.clientWidth + 16 : 320;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 8) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ left: step, behavior: "smooth" });
      }
    }, 6000);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <Section
      id="testimonios"
      title={
        <>
          Lo que dicen <span className="text-gold">nuestros campeones</span>
        </>
      }
    >
      <div
        ref={trackRef}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {REVIEWS.map((r) => (
          <article
            key={r.name}
            className="w-[85%] shrink-0 snap-center rounded-[20px] border border-border bg-surface p-6 sm:w-[360px]"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-gold/30 to-american/30 font-heading text-lg text-white">
                {r.name.charAt(0)}
              </span>
              <div>
                <p className="font-semibold text-white">{r.name}</p>
                <p className="text-xs text-white/50">
                  {r.role} · {r.city}
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-0.5 text-gold">
              {Array.from({ length: r.rating }).map((_, i) => (
                <Icon key={i} name="star" size={16} />
              ))}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/75">
              “{r.comment}”
            </p>
          </article>
        ))}
      </div>
    </Section>
  );
}
