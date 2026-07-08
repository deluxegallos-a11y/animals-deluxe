import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "./store-theme.css";

const pjs = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-pjs", display: "swap" });

export const metadata: Metadata = {
  title: "Animals Deluxe · Suplementos premium para campeones",
  description:
    "Energizantes, vitaminas, respiratorio y más para gallos, pollos, perros y caballos. Contraentrega en toda Colombia.",
  openGraph: {
    title: "Animals Deluxe",
    description: "Suplementos premium contraentrega para tus campeones 🐓",
    type: "website",
  },
};

import { VisitTracker } from "@/components/visit-tracker";
import { Suspense } from "react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={pjs.variable}>
      <body>
        {children}
        <Suspense fallback={null}><VisitTracker /></Suspense>
      </body>
    </html>
  );
}
