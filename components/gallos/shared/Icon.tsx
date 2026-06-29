import type { SVGProps } from "react";

export type IconName =
  | "energia"
  | "resistencia"
  | "vitalidad"
  | "recuperacion"
  | "musculo"
  | "escudo"
  | "seguro"
  | "entrega"
  | "pago"
  | "original"
  | "atencion"
  | "whatsapp"
  | "cart"
  | "menu"
  | "close"
  | "check"
  | "x"
  | "star"
  | "arrow-right"
  | "chevron-down"
  | "plus"
  | "minus";

const paths: Record<IconName, React.ReactNode> = {
  energia: <path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l0-8Z" />,
  resistencia: (
    <path d="M6.5 6.5 4 9l2.5 2.5M17.5 6.5 20 9l-2.5 2.5M8 18h8M9 9h6M7 13h10" />
  ),
  vitalidad: (
    <path d="M12 21s-7-4.35-9.5-9C1 9 2.5 5 6 5c2 0 3.2 1.2 4 2.5C10.8 6.2 12 5 14 5c3.5 0 5 4 3.5 7-2.5 4.65-5.5 9-5.5 9Z" />
  ),
  recuperacion: (
    <path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 7v5l3 2" />
  ),
  musculo: (
    <path d="M5 13c0-3 2-5 5-5 1.5 0 2.5.5 3.5 1.5C15 11 17 11 19 12c1.5.8 2 2.5 1 4-1 1.5-3 2-5 1.5-2-.5-3-2-5-2-2.5 0-5-.5-5-2.5Z" />
  ),
  escudo: <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" />,
  seguro: (
    <>
      <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" />
      <path d="m8.5 12 2.5 2.5L16 9" />
    </>
  ),
  entrega: (
    <path d="M3 7h11v8H3zM14 10h4l3 3v2h-7M6.5 18.5a1.5 1.5 0 1 0 0-.01M17.5 18.5a1.5 1.5 0 1 0 0-.01" />
  ),
  pago: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M2.5 10h19" />
    </>
  ),
  original: (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="m8.5 14-1.5 7 5-2.5 5 2.5-1.5-7" />
    </>
  ),
  atencion: (
    <path d="M4 5h16v11H8l-4 4V5ZM8 9h8M8 12h5" />
  ),
  whatsapp: (
    <path d="M3 21l1.8-5A8 8 0 1 1 8 19.2L3 21Zm6-12c0 4 3 6 5.5 6.5.8.1 1.3-.4 1.7-1 .2-.3.1-.6-.2-.8l-1.6-1c-.3-.2-.6-.1-.8.1l-.4.5c-1-.4-1.8-1.2-2.2-2.2l.5-.4c.2-.2.3-.5.1-.8l-1-1.6c-.2-.3-.5-.4-.8-.2-.6.4-1.1.9-1.1 1.7Z" />
  ),
  cart: (
    <path d="M3 4h2l2 12h11l2-8H6.5M9 20a1 1 0 1 0 0-.01M18 20a1 1 0 1 0 0-.01" />
  ),
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  close: <path d="M5 5l14 14M19 5 5 19" />,
  check: <path d="m4 12 5 5L20 6" />,
  x: <path d="M5 5l14 14M19 5 5 19" />,
  star: (
    <path d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9 6.7 19.1l1-5.8L3.5 9.2l5.9-.9L12 3Z" />
  ),
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
};

const filled: Partial<Record<IconName, boolean>> = { star: true };

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 24, ...props }: IconProps) {
  const isFilled = filled[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={isFilled ? "currentColor" : "none"}
      stroke={isFilled ? "none" : "currentColor"}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
