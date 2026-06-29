import type { ReactNode } from "react";
import { Reveal } from "./Reveal";

interface SectionProps {
  id?: string;
  eyebrow?: string;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  containerClassName?: string;
}

/** Wrapper de sección: padding 24/64, separación ≥96px, título en mayúsculas. */
export function Section({
  id,
  title,
  children,
  className = "",
  containerClassName = "",
}: SectionProps) {
  return (
    <section
      id={id}
      className={`scroll-mt-24 px-6 py-16 md:px-16 md:py-24 ${className}`}
    >
      <div className={`mx-auto max-w-7xl ${containerClassName}`}>
        {title && (
          <Reveal>
            <h2 className="mb-10 text-center font-heading text-3xl text-white md:mb-14 md:text-5xl">
              {title}
            </h2>
          </Reveal>
        )}
        {children}
      </div>
    </section>
  );
}
