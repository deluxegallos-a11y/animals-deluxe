export type BadgeKind =
  | "nuevo"
  | "mas-vendido"
  | "premium"
  | "envio-nacional"
  | "original";

export type ProductTheme = "american" | "dragon";

export interface Product {
  id: string;
  /** Shopify variant GID (gid://shopify/ProductVariant/...) — se rellena con datos reales */
  shopifyVariantId?: string;
  name: string;
  subtitle: string;
  theme: ProductTheme;
  description: string;
  benefits: string[];
  price: number;
  currency: string;
  volume: string;
  dose: string;
  image: string;
  badges: BadgeKind[];
}

export interface Benefit {
  icon: string;
  title: string;
}

export interface Review {
  name: string;
  role: string;
  city: string;
  rating: number;
  comment: string;
}

export interface Faq {
  q: string;
  a: string;
}

export interface CartLine {
  product: Product;
  qty: number;
}
