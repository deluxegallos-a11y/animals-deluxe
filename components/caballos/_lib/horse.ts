import type { Product, Review, Faq } from "@/components/gallos/_lib/types";

// Producto único de la landing de caballos: Horse Deluxe (Essential Amino Acid).
// El precio (160000) es solo fallback; el real entra por applyHorsePrice() desde
// NUESTRO catálogo (slug "horse-deluxe") en el server component de la página.
export const HORSE_PRODUCT: Product = {
  id: "horse-deluxe",
  name: "Horse Deluxe",
  subtitle: "Essential Amino Acid",
  theme: "american",
  description:
    "Suplemento premium para caballos de competencia: energía, fuerza, resistencia, masa muscular y vitalidad.",
  benefits: [
    "Más energía",
    "Mayor resistencia",
    "Más fuerza",
    "Mejor recuperación",
    "Sistema inmune fuerte",
  ],
  price: 160000,
  currency: "COP",
  volume: "3kg aprox.",
  dose: "Según ración diaria",
  image: "/assets/horse/h1.png",
  badges: ["premium", "original"],
};

/** Inyecta el precio real de NUESTRO catálogo (mismo patrón que priceOverrides
 *  de gallos). Se ejecuta en el provider para que SSR y cliente coincidan. */
export function applyHorsePrice(price?: number) {
  if (typeof price === "number" && price > 0) HORSE_PRODUCT.price = price;
}

export const HORSE_REVIEWS: Review[] = [
  {
    name: "Carlos M.",
    role: "Entrenador de salto",
    city: "",
    rating: 5,
    comment:
      "Desde que uso Horse Deluxe, mi caballo tiene más energía, mejores tiempos y su recuperación es increíble. ¡Lo recomiendo 100%!",
  },
  {
    name: "Juan P.",
    role: "Criador y propietario",
    city: "",
    rating: 5,
    comment:
      "Noté cambios en su masa muscular y en su resistencia desde la primera semana. El mejor suplemento que he probado.",
  },
  {
    name: "Luis R.",
    role: "Jinete profesional",
    city: "",
    rating: 5,
    comment:
      "Mis caballos están en su mejor forma gracias a Horse Deluxe. Fuerza, energía y salud en un solo producto.",
  },
  {
    name: "Andrés G.",
    role: "Propietario",
    city: "Bogotá",
    rating: 5,
    comment:
      "El envío llegó rápido y contraentrega. Mi caballo se ve más fuerte y con mejor pelaje. Excelente producto.",
  },
];

export const HORSE_FAQS: Faq[] = [
  {
    q: "¿Para qué caballos sirve?",
    a: "Para caballos de competencia, trabajo, coleo, entrenamiento y potros en crecimiento. Está formulado para potenciar el rendimiento, la salud y la vitalidad.",
  },
  {
    q: "¿En cuánto tiempo se ven resultados?",
    a: "Muchos clientes notan más energía y mejor resistencia desde la primera semana. Los resultados varían según el estado de cada caballo.",
  },
  {
    q: "¿Cómo se administra?",
    a: "Se mezcla con la ración diaria de tu caballo. Cada presentación rinde aproximadamente 3 kg.",
  },
  {
    q: "¿Hacen envíos a todo Colombia?",
    a: "Sí. El envío va incluido y es contraentrega: pagas cuando recibes el producto.",
  },
  {
    q: "¿El producto es original?",
    a: "Sí. Es proteína original americana, con calidad premium garantizada y máxima absorción.",
  },
  {
    q: "¿Tiene garantía?",
    a: "Sí. Si no estás satisfecho con los resultados, te devolvemos tu dinero. Sin preguntas.",
  },
];
