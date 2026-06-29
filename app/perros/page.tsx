import type { Metadata } from "next";
import { getProductBySlug } from "@/lib/ai/data";
import { PerrosProviders } from "@/components/perros/PerrosProviders";
import { DogLanding } from "@/components/perros/DogLanding";
import { DogStickyCTA } from "@/components/perros/DogStickyCTA";
import { Footer } from "@/components/gallos/layout/Footer";
import { WhatsAppFloat } from "@/components/gallos/layout/WhatsAppFloat";
import { CartDrawer } from "@/components/gallos/commerce/CartDrawer";

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
  // CONEXIÓN 1 — precio real por slug. El catálogo tiene un único SKU
  // "more-muscle-dogs" (Plan 6 meses); se inyecta su precio real. El Plan 3
  // meses no tiene SKU propio aún, así que mantiene su precio de la imagen
  // (100.000) como fallback hasta que se cree "more-muscle-dogs-3m".
  const dog = await getProductBySlug("more-muscle-dogs");

  return (
    <PerrosProviders prices={{ sixM: dog?.priceCOP }}>
      <main>
        <DogLanding />
      </main>
      <Footer />
      <CartDrawer />
      <DogStickyCTA />
      <WhatsAppFloat />
    </PerrosProviders>
  );
}
