"use client";

import { Section } from "@/components/gallos/shared/Section";
import { Reveal } from "@/components/gallos/shared/Reveal";
import { Icon } from "@/components/gallos/shared/Icon";
import { COMPARISON_TABLE } from "@/components/gallos/_lib/data";

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5 text-gold">
      {Array.from({ length: 5 }).map((_, i) => (
        <Icon key={i} name="star" size={14} className={i < n ? "" : "opacity-25"} />
      ))}
    </span>
  );
}

export function ComparisonTable() {
  return (
    <Section title="Comparativa">
      <Reveal>
        <div className="overflow-x-auto rounded-[20px] border border-border bg-surface">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-white/50">
                  Características
                </th>
                <th className="border-l border-border bg-american/10 p-4 text-center font-heading text-base text-american">
                  American Rooster Fury
                </th>
                <th className="border-l border-border bg-dragon/10 p-4 text-center font-heading text-base text-dragon">
                  Dragon Mamba
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_TABLE.rows.map((r, i) => (
                <tr
                  key={r.label}
                  className={`border-b border-border/60 ${i % 2 ? "bg-white/[0.015]" : ""}`}
                >
                  <td className="p-4 font-semibold uppercase tracking-wide text-white/80">
                    {r.label}
                  </td>
                  <td className="border-l border-border p-4 text-center text-white/85">
                    {r.type === "stars" ? (
                      <Stars n={r.american as number} />
                    ) : (
                      r.american
                    )}
                  </td>
                  <td className="border-l border-border p-4 text-center text-white/85">
                    {r.type === "stars" ? <Stars n={r.dragon as number} /> : r.dragon}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
    </Section>
  );
}
