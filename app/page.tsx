import { getProducts, getCategories, getStoreConfig } from "@/lib/ai/data";
import { Storefront, type SProduct, type SCat } from "@/components/store/storefront";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  const [cats, productos, store] = await Promise.all([
    getCategories(),
    getProducts({ categorySlug: cat }),
    getStoreConfig(),
  ]);

  const products: SProduct[] = productos.map((p) => ({
    slug: p.slug, name: p.name, categoryName: p.categoryName, categorySlug: p.categorySlug,
    priceCOP: p.priceCOP, tagline: p.tagline, shortDesc: p.shortDesc, imageUrl: p.imageUrl,
    origin: p.origin, badges: p.badges, benefits: p.benefits,
  }));
  const scats: SCat[] = cats.map((c) => ({ slug: c.slug, name: c.name, color: c.color }));
  const digits = (store.whatsapp || "").replace(/\D/g, "");
  const wa = digits.length >= 10 ? digits : ""; // oculta CTA si aún es placeholder

  return <Storefront products={products} cats={scats} wa={wa} />;
}
