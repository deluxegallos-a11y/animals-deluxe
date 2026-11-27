import type { ReactNode } from "react";

/**
 * Encabezado de sección UNIFICADO para las secciones nativas.
 * Iguala el lenguaje de las secciones de imagen (condensada, mayúsculas,
 * blanco + acento dorado) para que todo se vea coordinado. Siempre centrado.
 */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={`text-center ${className}`}>
      {eyebrow && (
        <div className="mb-3.5 flex items-center justify-center gap-3">
          <span className="h-px w-7 bg-gradient-to-r from-transparent to-[#ffc928]/60" />
          <p className="eyebrow text-[#ffd76a]">{eyebrow}</p>
          <span className="h-px w-7 bg-gradient-to-l from-transparent to-[#ffc928]/60" />
        </div>
      )}
      <h2 className="font-heading mx-auto max-w-[15ch] text-[clamp(28px,8vw,44px)] leading-[1.02] text-white">
        {title}
      </h2>
      {subtitle && (
        <p className="font-ui mx-auto mt-4 max-w-md px-2 text-[15px] leading-relaxed text-white/50">
          {subtitle}
        </p>
      )}
    </div>
  );
}
