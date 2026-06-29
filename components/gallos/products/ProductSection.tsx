"use client";

import { Section } from "@/components/gallos/shared/Section";
import { Reveal } from "@/components/gallos/shared/Reveal";
import { ProductCard } from "./ProductCard";
import { PRODUCTS } from "@/components/gallos/_lib/data";

export function ProductSection() {
  return (
    <Section
      id="productos"
      title={
        <>
          Nuestros <span className="text-gold">productos</span>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-2 md:gap-8">
        {PRODUCTS.map((p, i) => (
          <Reveal key={p.id} delay={i * 0.1}>
            <ProductCard product={p} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
