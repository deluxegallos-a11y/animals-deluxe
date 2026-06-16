import type { Metadata } from "next";
import "./globals.css";
import "./store-theme.css";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
