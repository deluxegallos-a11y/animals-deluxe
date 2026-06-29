"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon, type IconName } from "@/components/gallos/shared/Icon";
import type { Faq } from "@/components/gallos/_lib/types";
import { track } from "@/components/gallos/_lib/tracking";
import { DOG_FAQS } from "@/components/perros/_lib/dog";

// Icono violeta por pregunta (mismo orden que las FAQs de More Muscle Dogs)
const ICONS: IconName[] = [
  "musculo",
  "recuperacion",
  "vitalidad",
  "seguro",
  "entrega",
  "original",
];

export function FaqNative({
  faqs = DOG_FAQS,
  eyebrow = "Soporte",
  title = "Preguntas frecuentes",
  subtitle = "Todo lo que necesitas saber sobre More Muscle Dogs Premium",
}: {
  faqs?: Faq[];
  eyebrow?: string;
  title?: string;
  subtitle?: string;
} = {}) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-16 bg-background px-5 py-16">
      <div className="text-center">
        <p className="eyebrow mb-3 text-[#a78bfa]/90">{eyebrow}</p>
        <h2 className="h-apple text-frost text-[clamp(28px,8.5vw,46px)]">
          {title}
        </h2>
        <p className="font-ui mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-white/45">
          {subtitle}
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-2xl space-y-2.5">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <div
              key={f.q}
              className={`glass overflow-hidden rounded-[20px] transition-colors ${
                isOpen ? "border-[#a78bfa]/30" : ""
              }`}
            >
              <button
                onClick={() => {
                  setOpen(isOpen ? null : i);
                  if (!isOpen) track("faq_open", { question: f.q });
                }}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3.5 p-4 text-left sm:p-5"
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#a78bfa] transition-colors ${
                    isOpen
                      ? "bg-[#a78bfa]/12 ring-1 ring-[#a78bfa]/30"
                      : "bg-white/[0.04] ring-1 ring-white/10"
                  }`}
                >
                  <Icon name={ICONS[i] ?? "musculo"} size={18} />
                </span>
                <span className="font-ui flex-1 text-[15px] font-semibold tracking-tight text-white sm:text-base">
                  {f.q}
                </span>
                <motion.span
                  animate={{ rotate: isOpen ? 45 : 0 }}
                  transition={{ duration: 0.25 }}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.05] text-white/70"
                >
                  <Icon name="plus" size={15} />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p className="font-ui px-4 pb-5 pl-[68px] text-[15px] leading-relaxed text-white/60 sm:px-5 sm:pl-[74px]">
                      {f.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
