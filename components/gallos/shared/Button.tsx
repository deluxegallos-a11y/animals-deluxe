"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "ghost" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: IconName;
  pulse?: boolean;
  fullWidth?: boolean;
}

const base =
  "btn-shine inline-flex items-center justify-center gap-2.5 rounded-[20px] font-body font-semibold " +
  "transition-transform duration-150 ease-out active:scale-[0.98] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none select-none";

const variants: Record<Variant, string> = {
  primary:
    "h-14 px-7 bg-gold text-[#050505] glow-gold uppercase tracking-wide text-sm hover:brightness-105",
  secondary:
    "h-14 px-7 bg-surface text-white border border-border uppercase tracking-wide text-sm hover:border-gold/60",
  ghost:
    "h-12 px-5 bg-transparent text-white border border-border hover:bg-surface uppercase tracking-wide text-sm",
  icon: "h-12 w-12 bg-surface text-white border border-border hover:border-gold/60 p-0",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      icon,
      pulse,
      fullWidth,
      className = "",
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={[
          base,
          variants[variant],
          pulse ? "cta-pulse" : "",
          fullWidth ? "w-full" : "",
          className,
        ].join(" ")}
        {...props}
      >
        {children}
        {icon && variant !== "icon" && <Icon name={icon} size={18} />}
        {icon && variant === "icon" && <Icon name={icon} size={20} />}
      </button>
    );
  },
);
Button.displayName = "Button";
