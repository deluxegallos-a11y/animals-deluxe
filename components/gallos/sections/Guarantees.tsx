"use client";

import { Reveal } from "@/components/gallos/shared/Reveal";
import { Icon, type IconName } from "@/components/gallos/shared/Icon";
import { GUARANTEES } from "@/components/gallos/_lib/data";

export function Guarantees() {
  return (
    <section className="px-6 py-14 md:px-16">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
        {GUARANTEES.map((g, i) => (
          <Reveal key={g.title} delay={i * 0.08}>
            <div className="flex flex-col items-center gap-2 rounded-[20px] border border-border bg-surface p-5 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full border border-gold/30 bg-gold/10 text-gold">
                <Icon name={g.icon as IconName} size={24} />
              </span>
              <p className="text-sm font-semibold uppercase tracking-wide text-white">
                {g.title}
              </p>
              <p className="text-xs text-white/50">{g.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
