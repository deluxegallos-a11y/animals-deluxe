import type { Metadata } from "next";
import { getProductBySlug } from "@/lib/ai/data";
import { CaballosProviders } from "@/components/caballos/CaballosProviders";
import { HorseLanding } from "@/components/caballos/HorseLanding";
import { HorseStickyCTA } from "@/components/caballos/HorseStickyCTA";
import { Footer } from "@/components/gallos/layout/Footer";
import { WhatsAppFloat } from "@/components/gallos/layout/WhatsAppFloat";
import { CartDrawer } from "@/components/gallos/commerce/CartDrawer";

// Precio en tiempo real desde NUESTRO catálogo (Shopify/Supabase) cada hora.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Horse Deluxe — El secreto de los campeones | Animals Deluxe",
  description:
    "Suplemento premium para caballos de competencia: energía, fuerza, resistencia, masa muscular y vitalidad. Proteína original americana. Envío contraentrega a todo Colombia.",
  alternates: { canonical: "/caballos" },
};

export default async function CaballosPage() {
  // CONEXIÓN 1 — precio real por slug (única fuente de precio de la landing).
  const product = await getProductBySlug("horse-deluxe");

  return (
    <CaballosProviders price={product?.priceCOP}>
      <main>
        <HorseLanding />
      </main>
      <Footer />
      <CartDrawer />
      <HorseStickyCTA />
      <WhatsAppFloat />
    </CaballosProviders>
  );
}
