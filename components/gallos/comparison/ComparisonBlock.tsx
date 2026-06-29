"use client";

import Image from "next/image";
import { Section } from "@/components/gallos/shared/Section";
import { Reveal } from "@/components/gallos/shared/Reveal";
import { Icon } from "@/components/gallos/shared/Icon";
import { COMPARISON } from "@/components/gallos/_lib/data";

export function ComparisonBlock() {
  return (
    <Section
      title={
        <>
          La diferencia <span className="text-gold">es real</span>
        </>
      }
    >
      <div className="relative grid gap-5 md:grid-cols-2 md:gap-8">
        {/* Sin doping */}
        <Reveal>
          <div className="overflow-hidden rounded-[20px] border border-border bg-surface">
            <div className="relative h-44 w-full bg-[#0c0c0c] md:h-52">
              <Image
                src="/assets/roosters/rooster_weak.png"
                alt="Gallo sin doping"
                fill
                className="object-contain p-3 opacity-70 grayscale"
              />
            </div>
            <div className="p-6">
              <h3 className="mb-4 font-heading text-xl text-white/70">
                Sin doping
              </h3>
              <ul className="space-y-2.5">
                {COMPARISON.sin.items.map((it) => (
                  <li
                    key={it}
                    className="flex items-center gap-2.5 text-sm text-white/55"
                  >
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-danger/15 text-danger">
                      <Icon name="x" size={12} />
                    </span>
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>

        {/* Con doping */}
        <Reveal delay={0.12}>
          <div className="glow-gold/30 overflow-hidden rounded-[20px] border border-gold/40 bg-gradient-to-b from-surface to-[#161106]">
            <div className="relative h-44 w-full bg-[#0c0c0c] md:h-52">
              <Image
                src="/assets/roosters/rooster_strong.png"
                alt="Gallo con doping"
                fill
                className="object-contain p-3"
              />
            </div>
            <div className="p-6">
              <h3 className="mb-4 font-heading text-xl text-gold">
                Con nuestro doping
              </h3>
              <ul className="space-y-2.5">
                {COMPARISON.con.items.map((it) => (
                  <li
                    key={it}
                    className="flex items-center gap-2.5 text-sm font-medium text-white"
                  >
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-dragon/20 text-dragon">
                      <Icon name="check" size={12} />
                    </span>
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>

        {/* VS metálico */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 md:block">
          <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-gold bg-background font-display text-2xl text-gold glow-gold">
            VS
          </span>
        </div>
      </div>
    </Section>
  );
}
