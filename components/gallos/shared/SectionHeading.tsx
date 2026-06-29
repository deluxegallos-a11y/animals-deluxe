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
      <h2 className="font-heading mx-auto max-w-[12ch] text-[clamp(30px,9.5vw,52px)] leading-[0.95] text-white">
        {title}
      </h2>
      {subtitle && (
        <p className="font-ui mx-auto mt-3.5 max-w-md text-[15px] leading-relaxed text-white/50">
          {subtitle}
        </p>
      )}
    </div>
  );
}
