import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Anton, Montserrat } from "next/font/google";
// CSS (Tailwind v4 + design system) con ALCANCE solo en esta ruta:
// se carga únicamente aquí, así no afecta al resto del sitio ni al panel.
import "./gallos.css";

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

export const metadata: Metadata = {
  title: "Animals Deluxe — El mejor doping para tu gallo",
  description:
    "American Rooster Fury y Dragon Mamba: máxima energía, fuerza y resistencia para tus gallos. Pago contraentrega y envío a todo Colombia.",
  alternates: { canonical: "/gallos" },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
};

export default function GallosLayout({
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
