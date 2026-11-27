"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon, type IconName } from "@/components/gallos/shared/Icon";
import { FAQS } from "@/components/gallos/_lib/data";
import { track } from "@/components/gallos/_lib/tracking";

// Icono dorado por pregunta (mismo orden que el diseño)
const ICONS: IconName[] = [
  "energia",
  "escudo",
  "seguro",
  "vitalidad",
  "recuperacion",
  "original",
  "entrega",
];

export function FaqNative() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-16 bg-background px-5 py-16">
      <div className="text-center">
        <p className="eyebrow mb-3 text-[#ffd76a]/80">Soporte</p>
        <h2 className="h-apple text-frost text-[clamp(28px,8.5vw,46px)]">
          Preguntas frecuentes
        </h2>
        <p className="font-ui mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-white/45">
          Todo lo que necesitas saber sobre nuestro doping
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-2xl space-y-2.5">
        {FAQS.map((f, i) => {
          const isOpen = open === i;
          return (
            <div
              key={f.q}
              className={`glass overflow-hidden rounded-[20px] transition-colors ${
                isOpen ? "border-[#ffd76a]/30" : ""
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
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#ffd76a] transition-colors ${
                    isOpen
                      ? "bg-[#ffd76a]/12 ring-1 ring-[#ffd76a]/30"
                      : "bg-white/[0.04] ring-1 ring-white/10"
                  }`}
                >
                  <Icon name={ICONS[i] ?? "energia"} size={18} />
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
