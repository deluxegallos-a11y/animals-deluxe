import { Icon, type IconName } from "./Icon";

interface BenefitCardProps {
  icon: IconName;
  title: string;
}

export function BenefitCard({ icon, title }: BenefitCardProps) {
  return (
    <div className="group flex flex-col items-center gap-3 rounded-[20px] border border-border bg-surface p-5 text-center shadow-[var(--shadow-card)] transition-transform duration-300 hover:-translate-y-1 hover:border-gold/40">
      <span className="grid h-14 w-14 place-items-center rounded-full border border-gold/30 bg-gold/10 text-gold transition-colors group-hover:bg-gold/20">
        <Icon name={icon} size={26} />
      </span>
      <p className="text-xs font-semibold uppercase leading-tight tracking-wide text-white/85 md:text-sm">
        {title}
      </p>
    </div>
  );
}
