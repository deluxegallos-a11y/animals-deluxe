import type { Metadata } from "next";
import { getProductBySlug } from "@/lib/ai/data";
import { PerrosProviders } from "@/components/perros/PerrosProviders";
import { AnnouncementBar } from "@/components/gallos/shared/AnnouncementBar";
import { DogLanding } from "@/components/perros/DogLanding";
import { DogStickyCTA } from "@/components/perros/DogStickyCTA";
import { Footer } from "@/components/gallos/layout/Footer";
import { WhatsAppFloat } from "@/components/gallos/layout/WhatsAppFloat";
import { CartDrawer } from "@/components/gallos/commerce/CartDrawer";
import { CheckoutFlow } from "@/components/gallos/commerce/CheckoutFlow";

// Precio en tiempo real desde NUESTRO catálogo (Shopify/Supabase) cada hora.
export const revalidate = 3600;

export const metadata: Metadata = {
  title:
    "More Muscle Dogs Premium — Más músculo, más energía, más vida | Animals Deluxe",
  description:
    "Suplemento premium para perros de cualquier raza: desarrollo muscular, más energía, mejor pelaje, huesos fuertes y sistema inmune. Envío gratis y contraentrega a todo Colombia.",
  alternates: { canonical: "/perros" },
};

export default async function PerrosPage() {
  // CONEXIÓN 1 — precios reales por slug (única fuente de precio de la landing).
  //  - Plan 3 meses -> SKU "more-muscle-dogs-3m" (100.000)
  //  - Plan 6 meses -> SKU "more-muscle-dogs"    (180.000)
  const [dog3m, dog6m] = await Promise.all([
    getProductBySlug("more-muscle-dogs-3m"),
    getProductBySlug("more-muscle-dogs"),
  ]);

  return (
    <PerrosProviders
      prices={{ threeM: dog3m?.priceCOP, sixM: dog6m?.priceCOP }}
    >
      <AnnouncementBar />
      <main>
        <DogLanding />
      </main>
      <Footer />
      <CartDrawer />
      <DogStickyCTA />
      <WhatsAppFloat />
      <CheckoutFlow />
    </PerrosProviders>
  );
}
