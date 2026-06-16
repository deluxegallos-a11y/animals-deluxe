/* Mapea ProductView → la forma pública que consume el bot / la web.
   Contrato estable: si renombras estos campos, el bot deja de mapear. */
import type { ProductView } from "@/lib/ai/types";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://animalsdeluxe.com";

export function publicProduct(p: ProductView) {
  return {
    slug: p.slug,
    name: p.name,
    category: p.categorySlug,
    categoria: p.categoryName,
    audience: p.audience,
    origin: p.origin,
    priceCOP: p.priceCOP,
    presentations: p.presentations,
    image: p.image,
    imageUrl: p.imageUrl,
    badges: p.badges,
    tagline: p.tagline,
    shortDesc: p.shortDesc,
    benefits: p.benefits,
    ingredients: p.ingredients,
    usage: p.usage,
    pitch: p.pitch,
    faq: p.faq,
    disclaimer: p.disclaimer || "Producto de bienestar y rendimiento. No cura enfermedades.",
    url: `${SITE}/producto/${p.slug}`,
  };
}

export function suggestion(p: ProductView) {
  return { name: p.name, slug: p.slug, priceCOP: p.priceCOP };
}

/** Producto "vacío" pero nunca null (regla de oro UChat). */
export function emptyProduct() {
  return {
    slug: "", name: "", category: "", categoria: "", audience: "", origin: "", priceCOP: 0,
    presentations: [], image: "", imageUrl: "", badges: [], tagline: "", shortDesc: "",
    benefits: [], ingredients: [], usage: "", pitch: "", faq: [], disclaimer: "", url: "",
  };
}
