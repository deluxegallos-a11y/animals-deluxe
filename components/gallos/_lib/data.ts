import type { Product, Benefit, Review, Faq } from "@/components/gallos/_lib/types";

export const SITE = {
  name: "Animals Deluxe",
  domain: "https://animalsdeluxe.com",
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP || "573000000000",
  description:
    "El mejor doping para tu gallo. Máximo rendimiento, fuerza y energía para campeones dentro y fuera del ring. Envío a todo Colombia.",
};

export const PRODUCTS: Product[] = [
  {
    id: "american-rooster-fury",
    name: "American Rooster Fury",
    subtitle: "Fórmula Original",
    theme: "american",
    description:
      "La fórmula americana que ha revolucionado el mundo de los gallos de combate.",
    benefits: [
      "Energía explosiva",
      "Resistencia prolongada",
      "Mejora la agilidad",
      "Recuperación acelerada",
      "Vitaminas y minerales",
    ],
    price: 120000,
    currency: "COP",
    volume: "10ml",
    dose: "0.2 ml por ejemplar",
    image: "/assets/products/american_front.png",
    badges: ["mas-vendido", "original"],
  },
  {
    id: "dragon-mamba",
    name: "Dragon Mamba",
    subtitle: "Fórmula Élite",
    theme: "dragon",
    description:
      "Potencia extrema para gallos de combate que no conocen límites.",
    benefits: [
      "Fuerza inigualable",
      "Resistencia extrema",
      "Agilidad superior",
      "Recuperación instantánea",
      "Extractos premium",
    ],
    price: 140000,
    currency: "COP",
    volume: "10ml",
    dose: "0.2 ml por ejemplar",
    image: "/assets/products/dragon_front.png",
    badges: ["premium", "original"],
  },
];

/** Opciones del paso "¿cuál quieres?" del asistente (botón genérico):
 *  American, Dragon o "los dos". Usa los precios ya inyectados en PRODUCTS. */
export function gallosChoices() {
  const fmt = (n: number) => "$" + n.toLocaleString("es-CO");
  const [a, d] = PRODUCTS;
  return [
    { label: a.name, sub: fmt(a.price), products: [a] },
    { label: d.name, sub: fmt(d.price), products: [d] },
    {
      label: "Quiero los dos",
      sub: `${fmt(a.price + d.price)} · pack completo`,
      products: [a, d],
    },
  ];
}

export const BENEFITS: Benefit[] = [
  { icon: "energia", title: "Aumenta la energía" },
  { icon: "resistencia", title: "Mejora la resistencia" },
  { icon: "escudo", title: "Fortalece el sistema inmune" },
  { icon: "musculo", title: "Desarrolla músculo" },
  { icon: "recuperacion", title: "Acelera la recuperación" },
  { icon: "seguro", title: "100% seguro y natural" },
];

export const COMPARISON = {
  sin: {
    title: "Sin doping",
    items: [
      "Poca energía",
      "Baja resistencia",
      "Recuperación lenta",
      "Plumaje opaco",
      "Bajo rendimiento",
    ],
  },
  con: {
    title: "Con nuestro doping",
    items: [
      "Máxima energía",
      "Alta resistencia",
      "Recuperación rápida",
      "Plumaje brillante",
      "Rendimiento élite",
    ],
  },
};

export const COMPARISON_TABLE = {
  rows: [
    { label: "Energía", american: 5, dragon: 5, type: "stars" as const },
    { label: "Resistencia", american: 5, dragon: 5, type: "stars" as const },
    { label: "Agilidad", american: 5, dragon: 5, type: "stars" as const },
    { label: "Recuperación", american: 5, dragon: 5, type: "stars" as const },
    { label: "Vitalidad", american: 4, dragon: 5, type: "stars" as const },
    {
      label: "Fórmula",
      american: "Americana Premium",
      dragon: "Élite Premium",
      type: "text" as const,
    },
    {
      label: "Extractos",
      american: "Naturales",
      dragon: "Premium",
      type: "text" as const,
    },
    {
      label: "Ideal para",
      american: "Todos los gallos",
      dragon: "Competencia élite",
      type: "text" as const,
    },
  ],
};

export const REVIEWS: Review[] = [
  {
    name: "Carlos M.",
    role: "Campeón Nacional",
    city: "Cali",
    rating: 5,
    comment:
      "Desde que uso American Rooster Fury, mis gallos tienen otra energía. La diferencia se nota desde el primer día.",
  },
  {
    name: "Juan P.",
    role: "Criador Profesional",
    city: "Medellín",
    rating: 5,
    comment:
      "Dragon Mamba es otro nivel. Mis gallos están más fuertes que nunca y la resistencia es impresionante.",
  },
  {
    name: "Luis R.",
    role: "Entrenador",
    city: "Barranquilla",
    rating: 5,
    comment:
      "He probado muchos productos, pero estos son los únicos que realmente funcionan. 100% recomendados.",
  },
  {
    name: "Andrés G.",
    role: "Criador",
    city: "Bogotá",
    rating: 5,
    comment:
      "El envío llegó rápido y el producto es original. Mis gallos se recuperan mucho más rápido entre entrenamientos.",
  },
];

export const GUARANTEES = [
  { icon: "entrega", title: "Envío seguro", desc: "A todo el país" },
  { icon: "pago", title: "Pago contra entrega", desc: "Paga al recibir" },
  { icon: "original", title: "Producto original", desc: "100% garantizado" },
  { icon: "atencion", title: "Atención personalizada", desc: "Soporte por WhatsApp" },
];

export const FAQS: Faq[] = [
  {
    q: "¿Qué es Animals Deluxe Doping?",
    a: "Es un suplemento formulado específicamente para gallos de combate, diseñado para mejorar su rendimiento, fuerza, resistencia y recuperación dentro y fuera del ring.",
  },
  {
    q: "¿Cómo funciona?",
    a: "Nuestra fórmula combina ingredientes naturales y nutrientes esenciales que potencian la energía, fortalecen el sistema inmune y favorecen la recuperación muscular.",
  },
  {
    q: "¿Es seguro para mi gallo?",
    a: "Sí, nuestros productos están elaborados con ingredientes 100% naturales y son seguros cuando se siguen las dosis recomendadas.",
  },
  {
    q: "¿Cuánto debo administrar?",
    a: "La dosis recomendada es de 0.2 ml por ejemplar al día. Agítese bien antes de usar.",
  },
  {
    q: "¿En cuánto tiempo veré resultados?",
    a: "Los resultados pueden variar según el estado del gallo, pero generalmente se notan mejoras en energía y desempeño desde los primeros días.",
  },
  {
    q: "¿Puedo usarlo antes de una pelea?",
    a: "Sí, de hecho está diseñado para uso continuo. Recomendamos iniciar su uso con mínimo 7 días de anticipación para mejores resultados.",
  },
  {
    q: "¿Hacen envíos a todo Colombia?",
    a: "Sí, realizamos envíos seguros a todo el país. Tu pedido llegará en el menor tiempo posible.",
  },
];
