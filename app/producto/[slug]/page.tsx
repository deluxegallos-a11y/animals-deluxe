import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductBySlug, getStoreConfig, getProducts } from "@/lib/ai/data";
import { getReviews } from "@/lib/reviews";
import { ProductDetail, type PDProduct, type RelatedProduct } from "@/components/store/product-detail";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Producto no encontrado · Animals Deluxe" };
  return {
    title: `${p.name} · Animals Deluxe`,
    description: p.shortDesc || p.tagline,
    openGraph: { title: p.name, description: p.tagline || p.shortDesc, images: p.imageUrl ? [p.imageUrl] : [] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [p, store] = await Promise.all([getProductBySlug(slug), getStoreConfig()]);
  if (!p) notFound();

  const prod: PDProduct = {
    slug: p.slug, name: p.name, categoryName: p.categoryName, categorySlug: p.categorySlug, audience: p.audience,
    origin: p.origin, priceCOP: p.priceCOP, presentations: p.presentations, imageUrl: p.imageUrl, badges: p.badges,
    tagline: p.tagline, shortDesc: p.shortDesc, benefits: p.benefits, usage: p.usage, pitch: p.pitch,
    faq: p.faq, ingredients: p.ingredients, disclaimer: p.disclaimer, envioGratis: p.envioGratis,
  };
  const [relatedAll, reviews] = await Promise.all([
    getProducts({ categorySlug: p.categorySlug }),
    getReviews(p.slug),
  ]);
  const related: RelatedProduct[] = relatedAll
    .filter((r) => r.slug !== p.slug)
    .slice(0, 6)
    .map((r) => ({ slug: r.slug, name: r.name, priceCOP: r.priceCOP, imageUrl: r.imageUrl, categoryName: r.categoryName }));

  const digits = (store.whatsapp || "").replace(/\D/g, "");
  const wa = digits.length >= 10 ? digits : "";
  return <ProductDetail p={prod} wa={wa} related={related} reviews={reviews} codForm={store.codForm} />;
}
