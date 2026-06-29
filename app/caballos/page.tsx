import type { Metadata } from "next";
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

export default function CaballosPage() {
  // CONEXIÓN 1 — precio: la IMAGEN (h1/h4b) tiene "160.000" quemado, así que la
  // landing usa 160.000 (HORSE_PRODUCT.price) para que carrito y CTA coincidan
  // con la imagen. Si en el futuro se cambia la imagen, conectar getProductBySlug.
  return (
    <CaballosProviders>
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
