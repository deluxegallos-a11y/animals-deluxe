import { listProducts, listCategoriesAdmin } from "@/lib/queries";
import { shopifyConfigured } from "@/lib/shopify";
import { ProductsUI } from "./products-ui";

export const dynamic = "force-dynamic";

export default async function ProductosPage() {
  const [productos, categorias, shopifyOn] = await Promise.all([
    listProducts(),
    listCategoriesAdmin(),
    shopifyConfigured(),
  ]);
  return (
    <ProductsUI
      shopifyOn={shopifyOn}
      productos={productos.map((p) => ({
        id: p.id, slug: p.slug, name: p.name, categorySlug: p.categorySlug, categoryName: p.categoryName,
        categoryColor: p.categoryColor, audience: p.audience, origin: p.origin, priceCOP: p.priceCOP,
        presentations: p.presentations, imageUrl: p.imageUrl, badges: p.badges, tagline: p.tagline,
        shortDesc: p.shortDesc, benefits: p.benefits, ingredients: p.ingredients, usage: p.usage,
        pitch: p.pitch, faq: p.faq, keywords: p.keywords, objeciones: p.objeciones, adIds: p.adIds, disclaimer: p.disclaimer, stock: p.stock, activo: p.activo,
        shopifyProductId: p.shopifyProductId, shopifySync: p.shopifySync, shopifySyncError: p.shopifySyncError,
      }))}
      categorias={categorias.map((c) => ({ slug: c.slug, name: c.name }))}
    />
  );
}
