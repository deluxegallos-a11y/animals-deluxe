import type { Product, Review, Faq } from "@/components/gallos/_lib/types";

// Producto principal de la landing de perros: More Muscle Dogs Premium (Plan 3 meses).
// El precio (100000) es fallback y coincide con el quemado en la imagen d3; el real
// entra por applyDogPrices() desde NUESTRO catálogo en el server component de la página.
export const DOG_PRODUCT: Product = {
  id: "more-muscle-dogs-3m",
  name: "More Muscle Dogs Premium",
  subtitle: "Plan 3 meses",
  theme: "american",
  description:
    "Suplemento premium para perros: más músculo, más energía, mejor pelaje y un sistema inmune fuerte. Para tu mejor amigo.",
  benefits: [
    "Desarrollo muscular",
    "Más energía",
    "Mejor pelaje",
    "Sistema inmune fuerte",
    "Vitaminas y minerales",
  ],
  price: 100000,
  currency: "COP",
  volume: "1 kg",
  dose: "Según peso del perro",
  image: "/assets/dog/d1.png",
  badges: ["premium", "original"],
};

// Plan extendido (Mejor opción) — máximos resultados a largo plazo.
// id = "more-muscle-dogs": reutiliza el SKU real del catálogo (180000), así su
// checkout resuelve directo a la variante de Shopify (no solo WhatsApp).
export const DOG_PRODUCT_6M: Product = {
  id: "more-muscle-dogs",
  name: "More Muscle Dogs Premium",
  subtitle: "Plan 6 meses · Mejor opción",
  theme: "american",
  description:
    "Plan de 6 meses para máximos resultados a largo plazo: músculo, energía, pelaje y salud para tu perro.",
  benefits: [
    "Desarrollo muscular",
    "Más energía",
    "Mejor pelaje",
    "Sistema inmune fuerte",
    "Vitaminas y minerales",
  ],
  price: 180000,
  currency: "COP",
  volume: "2 kg",
  dose: "Según peso del perro",
  image: "/assets/dog/d1.png",
  badges: ["premium", "mas-vendido"],
};

/**
 * Inyecta los precios reales de NUESTRO catálogo (mismo patrón que priceOverrides
 * de gallos y applyHorsePrice de caballos). Se ejecuta en el provider para que SSR
 * y cliente coincidan (sin desajuste de hidratación).
 *  - sixM  -> Plan 6 meses, corresponde al SKU real "more-muscle-dogs".
 *  - threeM -> Plan 3 meses (cuando exista su SKU propio en la tienda).
 */
export function applyDogPrices(prices?: { threeM?: number; sixM?: number }) {
  if (!prices) return;
  if (typeof prices.threeM === "number" && prices.threeM > 0)
    DOG_PRODUCT.price = prices.threeM;
  if (typeof prices.sixM === "number" && prices.sixM > 0)
    DOG_PRODUCT_6M.price = prices.sixM;
}

export const DOG_REVIEWS: Review[] = [
  {
    name: "Laura V.",
    role: "Dueña de un American Bully",
    city: "Medellín",
    rating: 5,
    comment:
      "En tres semanas mi perro se ve más fuerte, con más masa muscular y muchísima más energía. El pelaje le quedó brillante. ¡Increíble!",
  },
  {
    name: "Santiago R.",
    role: "Criador",
    city: "Cali",
    rating: 5,
    comment:
      "Lo uso con mis cachorros y el desarrollo es notable. Más músculo, huesos fuertes y casi no se enferman. El mejor suplemento que he probado.",
  },
  {
    name: "Daniela M.",
    role: "Dueña de un Golden Retriever",
    city: "Bogotá",
    rating: 5,
    comment:
      "Mi Golden estaba decaído y opaco. Con More Muscle volvió a tener vitalidad, juega como antes y el pelaje le cambió por completo.",
  },
  {
    name: "Andrés P.",
    role: "Dueño de un Pitbull",
    city: "Barranquilla",
    rating: 5,
    comment:
      "Llegó rápido y contraentrega, pagué al recibir. A las pocas semanas mi perro está más musculoso y activo. 100% recomendado.",
  },
];

export const DOG_FAQS: Faq[] = [
  {
    q: "¿Para qué perros sirve?",
    a: "Para perros de cualquier raza, tamaño y edad: American Bully, Pitbull, Pastor Alemán, Golden, Labrador, Bulldog Francés, Rottweiler, criollos y más. Funciona en cachorros y adultos.",
  },
  {
    q: "¿En cuánto tiempo se ven resultados?",
    a: "Muchos dueños notan más energía y vitalidad desde las primeras semanas. El desarrollo muscular y el cambio en el pelaje se hacen evidentes con el uso constante.",
  },
  {
    q: "¿Cómo se administra?",
    a: "Se mezcla con el alimento diario de tu perro según su peso. Es un suplemento alimenticio fácil de dar todos los días.",
  },
  {
    q: "¿Qué contiene la fórmula?",
    a: "Vitaminas (A, D, E, K y C), complejo B, aminoácidos esenciales, minerales quelatados, proteína de alta calidad, lisina, extractos naturales y Omega 3 y 6.",
  },
  {
    q: "¿Hacen envíos a todo Colombia?",
    a: "Sí. El envío es gratis y contraentrega: pagas cuando recibes el producto en la puerta de tu casa.",
  },
  {
    q: "¿Tiene garantía?",
    a: "Sí. Cuentas con 30 días de garantía total. Si no estás satisfecho con los resultados, te ayudamos. Producto 100% original.",
  },
];
