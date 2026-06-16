/* Carga del catálogo semilla para MODO DEMO (sin Supabase).
   Da la misma forma (ProductView / CategoryView) que las queries Drizzle,
   para que el bot, la web y el panel funcionen sin base de datos. */
import catalogo from "@/data/catalogo-productos.json";
import type { ProductView, CategoryView } from "@/lib/ai/types";
import type { Presentacion } from "@/lib/db/schema";

type RawCat = { id: string; name: string; color: string };
type RawProd = {
  slug: string; name: string; category: string; audience: string; origin: string;
  priceCOP: number; presentations?: Presentacion[]; image?: string; badges?: string[];
  tagline?: string; shortDesc?: string; benefits?: string[]; usage?: string; pitch?: string;
};

const cats = (catalogo.categories || []) as RawCat[];
const prods = (catalogo.products || []) as RawProd[];

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://animalsdeluxe.com";

export const demoCategories: CategoryView[] = cats.map((c, i) => ({
  id: "cat-" + c.id,
  slug: c.id,
  name: c.name,
  color: c.color || "#FF4D2E",
}));

export const demoProducts: ProductView[] = prods.map((p) => {
  const cat = cats.find((c) => c.id === p.category);
  return {
    id: "prod-" + p.slug,
    slug: p.slug,
    name: p.name,
    categoryId: "cat-" + p.category,
    categorySlug: p.category,
    categoryName: cat?.name || p.category,
    audience: p.audience || "",
    origin: p.origin || "co",
    priceCOP: p.priceCOP || 0,
    presentations: p.presentations?.length ? p.presentations : [{ label: "Unidad", priceCOP: p.priceCOP || 0 }],
    image: p.image || "",
    imageUrl: p.image ? `${SITE}/img/${p.image}` : "",
    badges: p.badges || [],
    tagline: p.tagline || "",
    shortDesc: p.shortDesc || "",
    benefits: p.benefits || [],
    ingredients: [],
    usage: p.usage || "",
    pitch: p.pitch || "",
    faq: [],
    disclaimer: "Producto de bienestar y rendimiento. No cura enfermedades.",
    stock: 999,
    activo: true,
  };
});

export const demoStore = catalogo.store as {
  name: string; country: string; currency: string; whatsapp: string;
};
