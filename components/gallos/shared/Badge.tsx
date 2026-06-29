import type { BadgeKind } from "@/components/gallos/_lib/types";

const labels: Record<BadgeKind, string> = {
  nuevo: "Nuevo",
  "mas-vendido": "Más vendido",
  premium: "Premium",
  "envio-nacional": "Envío nacional",
  original: "Original",
};

const styles: Record<BadgeKind, string> = {
  nuevo: "bg-dragon/15 text-dragon border-dragon/40",
  "mas-vendido": "bg-gold/15 text-gold border-gold/50",
  premium: "bg-gold/15 text-gold border-gold/50",
  "envio-nacional": "bg-white/10 text-white border-white/20",
  original: "bg-white/10 text-white/90 border-white/20",
};

export function Badge({ kind }: { kind: BadgeKind }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${styles[kind]}`}
    >
      {labels[kind]}
    </span>
  );
}
