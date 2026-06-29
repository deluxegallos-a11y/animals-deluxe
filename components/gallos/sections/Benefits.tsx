"use client";

import { Section } from "@/components/gallos/shared/Section";
import { BenefitCard } from "@/components/gallos/shared/BenefitCard";
import { Reveal } from "@/components/gallos/shared/Reveal";
import { BENEFITS } from "@/components/gallos/_lib/data";
import type { IconName } from "@/components/gallos/shared/Icon";

export function Benefits() {
  return (
    <Section
      id="beneficios"
      title={
        <>
          ¿Por qué nuestro doping{" "}
          <span className="text-gold">es el mejor?</span>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6 md:gap-4">
        {BENEFITS.map((b, i) => (
          <Reveal key={b.title} delay={i * 0.08}>
            <BenefitCard icon={b.icon as IconName} title={b.title} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
