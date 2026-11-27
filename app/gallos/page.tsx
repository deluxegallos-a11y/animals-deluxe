import { getProductBySlug } from "@/lib/ai/data";
import { CartProvider } from "@/components/gallos/_lib/useCart";
import { SmoothScroll } from "@/components/gallos/layout/SmoothScroll";
import { PremiumLoader } from "@/components/gallos/layout/PremiumLoader";
import { Analytics } from "@/components/gallos/layout/Analytics";
import { Navbar } from "@/components/gallos/layout/Navbar";
import { Footer } from "@/components/gallos/layout/Footer";
import { JsonLd } from "@/components/gallos/layout/JsonLd";
import { WhatsAppFloat } from "@/components/gallos/layout/WhatsAppFloat";
import { FlatLanding } from "@/components/gallos/landing/FlatLanding";
import { CartDrawer } from "@/components/gallos/commerce/CartDrawer";
import { StickyCTA } from "@/components/gallos/commerce/StickyCTA";

// Precio en tiempo real desde NUESTRO catálogo (Shopify/Supabase) cada hora.
export const revalidate = 3600;

export default async function GallosPage() {
  // CONEXIÓN 1 — precios reales por slug (única fuente de precio de la landing).
  const [american, dragon] = await Promise.all([
    getProductBySlug("american-rooster-fury"),
    getProductBySlug("dragon-mamba"),
  ]);

  const priceOverrides: Record<string, number | undefined> = {
    "american-rooster-fury": american?.priceCOP,
    "dragon-mamba": dragon?.priceCOP,
  };

  return (
    <CartProvider priceOverrides={priceOverrides}>
      <PremiumLoader />
      <Analytics />
      <SmoothScroll>
        <JsonLd />
        <Navbar />
        <main>
          <FlatLanding />
        </main>
        <Footer />
        <CartDrawer />
        <StickyCTA />
        <WhatsAppFloat />
      </SmoothScroll>
    </CartProvider>
  );
}
