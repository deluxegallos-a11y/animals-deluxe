"use client";

const PAYMENTS = ["Visa", "Mastercard", "PSE", "Nequi", "Daviplata"];
const COURIERS = ["Servientrega", "Interrapidísimo"];

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="glass glass-hover font-ui inline-flex items-center rounded-2xl px-4 py-2.5 text-[13px] font-semibold tracking-tight text-white/80">
      {children}
    </span>
  );
}

function Group({
  label,
  items,
}: {
  label: string;
  items: string[];
}) {
  return (
    <div className="text-center">
      <p className="eyebrow mb-4 text-white/35">{label}</p>
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {items.map((i) => (
          <Pill key={i}>{i}</Pill>
        ))}
      </div>
    </div>
  );
}

export function TrustBadges() {
  return (
    <section className="bg-background px-5 py-12">
      <div className="mx-auto max-w-2xl space-y-9">
        <Group label="Pago 100% seguro" items={PAYMENTS} />
        <Group label="Envíos a todo Colombia" items={COURIERS} />
      </div>
    </section>
  );
}
