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
  keywords: string[];
  objeciones: Record<string, string>;
  adIds: string[];
  disclaimer: string;
  stock: number;
  activo: boolean;
  envioGratis?: boolean;
  // --- Reglas de negocio por producto (M4 · M6.2 · M6.3) ---
  /** Solo si es true se respeta `stock`. Default false: el stock nunca tumba una venta. */
  controlStock?: boolean;
  /** true = no se vende contra entrega en este bot (se remite al canal anticipado). */
  soloAnticipado?: boolean;
  /** Mínimo de unidades por envío (goteros de a 2+). 1 = sin mínimo. */
  minUnidades?: number;
  // Ficha enriquecida (§4.6) — contenido de venta editable en el panel.
  descripcion?: string;
  edadMinima?: string;
  dosificacion?: string;
  presentacion?: string;
  paraQue?: string;
  /** Forma de administración derivada (M7): inyectable | gotas | pastillas | polvo… */
  forma?: string;
};

export type CategoryView = {
  id: string;
  slug: string;
  name: string;
  color: string;
};
