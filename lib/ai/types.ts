import type { Presentacion, Ingrediente, FaqItem } from "@/lib/db/schema";

/** Vista canónica de producto que consumen el bot, la web y el panel. */
export type ProductView = {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  audience: string;
  origin: string;
  priceCOP: number;
  presentations: Presentacion[];
  image: string;
  imageUrl: string;
  badges: string[];
  tagline: string;
  shortDesc: string;
  benefits: string[];
  ingredients: Ingrediente[];
  usage: string;
  pitch: string;
  faq: FaqItem[];
  disclaimer: string;
  stock: number;
  activo: boolean;
};

export type CategoryView = {
  id: string;
  slug: string;
  name: string;
  color: string;
};
