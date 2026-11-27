import type { Viewport } from "next";
import { Bebas_Neue, Anton, Montserrat } from "next/font/google";
// Reutiliza el MISMO sistema de diseño scoped de la landing (Tailwind v4 +
// @theme + utilidades .glass/.btn-shine/.font-ui/.eyebrow/.h-apple/etc.). Se
// carga solo en estas rutas, no afecta al resto del sitio ni al panel.
import "../gallos/gallos.css";

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});
const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});
const montserrat = Montserrat({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
};

export default function PerrosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${bebas.variable} ${anton.variable} ${montserrat.variable} min-h-dvh bg-background`}
    >
      {children}
    </div>
  );
}
