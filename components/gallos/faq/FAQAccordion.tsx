"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Section } from "@/components/gallos/shared/Section";
import { Reveal } from "@/components/gallos/shared/Reveal";
import { Icon } from "@/components/gallos/shared/Icon";
import { FAQS } from "@/components/gallos/_lib/data";
import { track } from "@/components/gallos/_lib/tracking";

export function FAQAccordion() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <Section
      id="faq"
      title={
        <>
          Preguntas <span className="text-gold">frecuentes</span>
        </>
      }
      containerClassName="max-w-3xl"
    >
      <div className="space-y-3">
        {FAQS.map((f, i) => {
          const open = openIdx === i;
          return (
            <Reveal key={f.q} delay={i * 0.04}>
              <div className="overflow-hidden rounded-[20px] border border-border bg-surface">
                <button
                  onClick={() => {
                    setOpenIdx(open ? null : i);
                    if (!open) track("faq_open", { question: f.q });
                  }}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left"
                >
                  <span className="font-semibold text-white">{f.q}</span>
                  <motion.span
                    animate={{ rotate: open ? 180 : 0 }}
                    transition={{ duration: 0.25 }}
                    className="shrink-0 text-gold"
                  >
                    <Icon name="chevron-down" size={20} />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="px-5 pb-5 text-sm leading-relaxed text-white/65">
                        {f.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
