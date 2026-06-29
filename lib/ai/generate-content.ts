/* ===========================================================
   Generador de contenido rico por producto — VOZ VICTOR (paisa).
   Determinístico, por categoría + datos del producto. Escala a
   cualquier nº de productos sin LLM. Produce: keywords, benefits,
   usage, pitch, faq (≥5), objeciones (5 claves).
   =========================================================== */
import { deriveKeywords } from "@/lib/ai/keywords";
import { cop } from "@/lib/ai/format";

export type GenInput = {
  name: string; categorySlug: string; categoryName?: string; audience?: string;
  origin?: string; priceCOP: number; presentations?: { label: string; priceCOP: number }[];
  benefits?: string[]; tagline?: string; shortDesc?: string; usage?: string;
};

const ANIMAL: Record<string, string> = {
  energia: "gallo", vitaminas: "gallo", desparasitantes: "gallo", respiratorio: "gallo",
  cuidado: "gallo", suplementos: "gallo", entrenamiento: "gallo",
  pollos: "pollo", perros: "perro", caballos: "caballo",
};

const NEEDS: Record<string, string[]> = {
  energia: ["pa la pelea", "antes del juego", "gallo sin fondo", "mas aguante", "doping gallo"],
  vitaminas: ["gallo debil", "sin apetito", "pa engordar gallo", "mas defensas", "vitamina gallo"],
  desparasitantes: ["lombrices", "parasitos gallo", "purgar gallo", "gusanos", "desparasitar"],
  respiratorio: ["mocos", "gripa gallo", "ronquera", "problemas para respirar", "pecho tupido"],
  cuidado: ["pluma opaca", "hongos", "piojos", "brillo de pluma", "cuidado pluma"],
  suplementos: ["masa muscular", "desarrollo gallo", "vitalidad", "suplemento gallo"],
  entrenamiento: ["recuperacion", "pre entreno", "musculo gallo", "post entreno"],
  pollos: ["levante", "engorde pollos", "pollitos", "cria"],
  perros: ["musculo perro", "perro flaco", "masa perro", "suplemento perro"],
  caballos: ["potencia caballo", "resistencia equino", "musculo caballo"],
};

const BENEFITS: Record<string, string[]> = {
  energia: [
    "Energía instantánea pa que entre encendido al careo",
    "Más oxigenación = más fondo, no se ahoga",
    "Reflejos y estado de alerta arriba",
    "Más resistencia en el pico de la pelea",
    "No genera adicción: solo cuando lo necesitás",
  ],
  vitaminas: [
    "Aporte completo de vitaminas y minerales",
    "Mejor desarrollo muscular y emplume",
    "Más defensas y vitalidad todos los días",
    "Mejora el apetito y la absorción de la comida",
    "Pluma brillante y mejor color",
  ],
  desparasitantes: [
    "Elimina lombrices y parásitos internos",
    "Limpia el intestino y mejora la digestión",
    "Mejor absorción de la comida = más peso",
    "Previene parches y huecos estomacales",
    "Gallo más activo y con mejor apetito",
  ],
  respiratorio: [
    "Apoya el bienestar respiratorio del gallo",
    "Ayuda a despejar el pecho pa que respire mejor",
    "Mejor oxigenación = más fondo en el juego",
    "Menos ronquera y mejor estado general",
    "Ideal pa épocas de frío y cambios de clima",
  ],
  cuidado: [
    "Pluma brillante, sana y bien emplumada",
    "Piel limpia y protegida",
    "Ayuda a prevenir hongos y ácaros",
    "Mejor presentación pa la exhibición",
    "Cuida y desinfecta de forma efectiva",
  ],
  suplementos: [
    "Aporte nutricional completo de competencia",
    "Más masa muscular y desarrollo",
    "Más energía y vitalidad diaria",
    "Mejor recuperación y rendimiento",
    "Todas las vitaminas y minerales en uno",
  ],
  entrenamiento: [
    "Prepara el músculo pa el entreno fuerte",
    "Mejor recuperación después de la topa",
    "Más fuerza y aguante",
    "Mejora la oxigenación y el rendimiento",
    "Construye el campeón, no solo lo mantiene",
  ],
  pollos: [
    "Levante fuerte y crecimiento parejo",
    "Más peso y mejor desarrollo óseo",
    "Más defensas pa pollitos sanos",
    "Mejor apetito y absorción",
    "Arranque fuerte desde temprano",
  ],
  perros: [
    "Más masa muscular y fuerza",
    "Más energía y vitalidad",
    "Pelaje sano y brillante",
    "Mejor recuperación y desarrollo",
    "Apoyo nutricional completo",
  ],
  caballos: [
    "Más potencia y resistencia",
    "Mejor desarrollo muscular",
    "Más energía y vitalidad",
    "Mejor recuperación tras el esfuerzo",
    "Aporte de proteína y aminoácidos",
  ],
};

const USAGE: Record<string, string> = {
  energia: "6 a 8 gotas directo en el pico 1 hora antes del juego. La primera vez arrancá con 4 goticas y subí de a poco pa que el gallo se acostumbre. No lo combines con otro energizante el mismo día.",
  vitaminas: "Según la presentación: en gotas, las dosis recomendadas en el bebedero o el pico a diario; en tabletas, 1 al día por ejemplar. Uso constante pa ver el cambio en pocas semanas.",
  desparasitantes: "Desparasitá cada 2-3 meses. Da la dosis según el peso del ejemplar, preferible en ayunas. Si hay mucha carga, repetí a los 10-15 días.",
  respiratorio: "Da las gotas o la dosis indicada 1-2 veces al día por unos días, según el estado del gallo. Mantenelo en lugar seco y sin corrientes de aire.",
  cuidado: "Aplicá según la presentación: el shampoo en baño desinfectante, o el producto tópico/roll sobre la zona. Repetí según necesidad.",
  suplementos: "1 a 2 dosis diarias por ejemplar según la presentación, mezclado con la comida o directo. Uso constante pa buenos resultados.",
  entrenamiento: "Pre-entreno: la dosis indicada antes de la topa. Post-recovery: 1 dosis/tableta después de entrenar pa recuperar el músculo.",
  pollos: "Las gotas indicadas en el agua del bebedero a diario, o la dosis según presentación. Ideal desde los primeros días de levante.",
  perros: "La dosis según el peso del perro, mezclada con la comida, a diario por el tiempo recomendado.",
  caballos: "La dosis indicada según el peso del caballo, a diario o según la preparación.",
};

const PITCH: Record<string, string> = {
  energia: "El energizante que enciende la fiera y le da fondo justo antes del juego.",
  vitaminas: "El multivitamínico que mantiene a tu campeón fuerte, sano y con energía todos los días.",
  desparasitantes: "La purga que limpia por dentro pa que tu gallo aproveche toda la comida.",
  respiratorio: "El apoyo respiratorio pa que tu gallo tenga el pecho libre y más fondo.",
  cuidado: "El cuidado que deja tu gallo con pluma brillante y piel sana pa la exhibición.",
  suplementos: "El suplemento completo que construye masa, fuerza y vitalidad de campeón.",
  entrenamiento: "Lo que tu campeón necesita pa entrenar duro y recuperarse rápido.",
  pollos: "El arranque fuerte pa que tus pollos crezcan parejos y sanos.",
  perros: "El suplemento que le da masa, fuerza y energía a tu perro.",
  caballos: "Potencia, resistencia y desarrollo pa tu caballo.",
};

const FAQ: Record<string, { q: string; a: string }[]> = {
  energia: [
    { q: "¿Crea adicción?", a: "No, mi rey. No genera dependencia; lo usás solo cuando lo necesitás pa el careo." },
    { q: "¿En cuánto hace efecto?", a: "Se lo das 1 hora antes y entra al juego encendido, con oxígeno y reflejos arriba." },
    { q: "¿Cuánto rinde?", a: "Rinde un montón, te dura varios careos. Una inversión baratica por lo que da." },
    { q: "¿Sirve pa un gallo nuevo?", a: "Sí, pero arrancá con menos dosis la primera vez y lo vas acostumbrando." },
    { q: "¿Es original?", a: "Original, parcero. Acá no manejamos copias." },
  ],
  vitaminas: [
    { q: "¿Cada cuánto se lo doy?", a: "A diario, mi rey. Es de uso constante pa que veás el cambio en pocas semanas." },
    { q: "¿Pa qué sirve?", a: "Pa mantener el gallo fuerte: más defensas, mejor emplume, apetito y vitalidad." },
    { q: "¿En cuánto se ve el cambio?", a: "Con uso constante, en pocas semanas notás más brillo de pluma y más energía." },
    { q: "¿Se da con comida?", a: "Sí, podés darlo con la comida o en el bebedero según la presentación." },
    { q: "¿Sirve pa todas las etapas?", a: "Sí, sirve pa mantenimiento y preparación. Ajustás la dosis según el ejemplar." },
  ],
  desparasitantes: [
    { q: "¿Cada cuánto desparasito?", a: "Cada 2-3 meses, parcero. Un gallo con parásitos no aprovecha la comida." },
    { q: "¿Elimina lombrices?", a: "Sí, elimina lombrices y parásitos internos, y limpia el intestino." },
    { q: "¿Se da en ayunas?", a: "Preferible en ayunas pa que actúe mejor. Da la dosis según el peso." },
    { q: "¿Desde qué edad?", a: "Según la presentación; en general aves ya desarrolladas. Te asesoro según el caso." },
    { q: "¿Tiene efectos fuertes?", a: "Es de uso para gallos, tranquilo. Seguí la dosis recomendada y listo." },
  ],
  respiratorio: [
    { q: "¿Sirve pa los mocos?", a: "Apoya el bienestar respiratorio y ayuda a despejar el pecho pa que respire mejor, mi rey." },
    { q: "¿Cómo se da?", a: "Las gotas o dosis indicada 1-2 veces al día por unos días, según el estado del gallo." },
    { q: "¿Cuánto dura el tratamiento?", a: "Unos días según cómo esté el gallo. Mantenelo en lugar seco y sin corrientes." },
    { q: "¿Sirve de prevención?", a: "Sí, ideal en épocas de frío y cambios de clima pa mantener el pecho libre." },
    { q: "¿Es seguro?", a: "Es producto de bienestar y rendimiento pa gallos. Si ves algo grave, consultá al veterinario." },
  ],
  cuidado: [
    { q: "¿Pa qué sirve?", a: "Pa dejar la pluma brillante y la piel sana, y ayudar a prevenir hongos y ácaros." },
    { q: "¿Cómo se aplica?", a: "Según la presentación: el shampoo en baño, o el producto sobre la zona. Te indico el modo." },
    { q: "¿Cada cuánto?", a: "Según necesidad, mi rey. Pa exhibición, dejalo brillante unos días antes." },
    { q: "¿Sirve pa exhibición?", a: "Claro, deja el ejemplar bien presentado, con pluma sana y brillante." },
    { q: "¿Es fuerte pa la piel?", a: "No, está hecho pa el cuidado del gallo. Seguí el modo de uso y listo." },
  ],
  suplementos: [
    { q: "¿Cada cuánto se lo doy?", a: "A diario según la dosis, parcero. Es de uso constante pa ver resultados." },
    { q: "¿Pa qué sirve?", a: "Aporta vitaminas, minerales y proteína pa más masa, energía y vitalidad." },
    { q: "¿En cuánto se ve el cambio?", a: "Con uso constante, en pocas semanas notás más cuerpo y más energía." },
    { q: "¿Se mezcla con la comida?", a: "Sí, podés darlo mezclado con la comida o directo según la presentación." },
    { q: "¿Sirve pa todas las etapas?", a: "Sí, pa desarrollo y mantenimiento. Ajustás la dosis según el ejemplar." },
  ],
  entrenamiento: [
    { q: "¿Cuándo se lo doy?", a: "El pre-entreno antes de la topa; el de recuperación después de entrenar." },
    { q: "¿Pa qué sirve?", a: "Pa preparar el músculo, recuperar más rápido y aguantar el entreno fuerte." },
    { q: "¿Se nota en el músculo?", a: "Con entreno y uso constante, sí: más masa, fuerza y recuperación." },
    { q: "¿Cómo se da?", a: "La dosis indicada según la presentación, mezclado con la comida o directo." },
    { q: "¿Sirve pa cualquier gallo?", a: "Sí, pa gallos en preparación. Ajustás la dosis al ejemplar." },
  ],
  pollos: [
    { q: "¿Desde qué edad?", a: "Desde los primeros días de levante, mi rey. Arranque fuerte desde temprano." },
    { q: "¿Pa qué sirve?", a: "Pa que los pollos crezcan parejos, con más peso, defensas y mejor desarrollo." },
    { q: "¿Cómo se da?", a: "Las gotas en el agua del bebedero a diario, o la dosis según presentación." },
    { q: "¿Se ve el cambio?", a: "Sí, pollos más parejos, con mejor apetito y crecimiento." },
    { q: "¿Es seguro pa pollitos?", a: "Sí, está hecho pa el levante. Seguí la dosis y listo." },
  ],
  perros: [
    { q: "¿Pa qué sirve?", a: "Pa darle masa muscular, fuerza, energía y un pelaje sano a tu perro." },
    { q: "¿Cómo se da?", a: "La dosis según el peso del perro, mezclada con la comida, a diario." },
    { q: "¿En cuánto se ve?", a: "Con uso constante, en unas semanas notás más cuerpo y energía." },
    { q: "¿Sirve pa cualquier raza?", a: "Sí, ajustás la dosis según el tamaño y peso del perro." },
    { q: "¿Es seguro?", a: "Sí, es suplemento de bienestar. Seguí la dosis recomendada." },
  ],
  caballos: [
    { q: "¿Pa qué sirve?", a: "Pa más potencia, resistencia, desarrollo muscular y recuperación del caballo." },
    { q: "¿Cómo se da?", a: "La dosis indicada según el peso del caballo, a diario o según preparación." },
    { q: "¿En cuánto se ve?", a: "Con uso constante, en unas semanas notás más cuerpo y aguante." },
    { q: "¿Sirve de mantenimiento?", a: "Sí, pa preparación y mantenimiento. Ajustás la dosis al ejemplar." },
    { q: "¿Es seguro?", a: "Sí, es suplemento de bienestar y rendimiento equino." },
  ],
};

function origenTxt(origin?: string) {
  return origin === "us" ? "americano original" : origin === "br" ? "importado original (Brasil)"
    : origin === "mx" ? "importado original (México)" : "original";
}

function norm(s: string) { return s.toLowerCase().replace(/[^a-z0-9ñ ]/gi, "").trim(); }

function buildKeywords(p: GenInput): string[] {
  const out = new Set<string>(deriveKeywords(p));
  (NEEDS[p.categorySlug] || []).forEach((k) => out.add(k));
  const nm = norm(p.name);
  if (nm) { out.add(nm); const w = nm.split(" ")[0]; if (w.length >= 3) out.add(w); }
  return Array.from(out).filter(Boolean).slice(0, 15);
}

function mergeBenefits(existing: string[], bank: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (b: string) => { const k = norm(b).slice(0, 18); if (b && b.length > 8 && !seen.has(k)) { seen.add(k); out.push(b); } };
  existing.filter((b) => b && b.length > 14).forEach(push);
  bank.forEach(push);
  return out.slice(0, 6);
}

export function generateContent(p: GenInput) {
  const cat = p.categorySlug;
  const animal = ANIMAL[cat] || "gallo";
  const precio = cop(p.priceCOP || 0);
  const pres = p.presentations?.[0]?.label || "presentación única";
  const og = origenTxt(p.origin);

  const benefits = mergeBenefits(p.benefits || [], BENEFITS[cat] || BENEFITS.suplementos);
  while (benefits.length < 4) benefits.push((BENEFITS[cat] || BENEFITS.suplementos)[benefits.length] || "Producto premium pa tu campeón");

  const usage = p.usage && p.usage.length > 45 ? p.usage : (USAGE[cat] || USAGE.suplementos);
  const pitch = p.tagline && p.tagline.length > 22 ? p.tagline : (PITCH[cat] || PITCH.suplementos);

  const objeciones: Record<string, string> = {
    muy_caro: `Mirá, son ${precio} pero rinde un montón (${pres}) y es inversión pa tu ${animal}. Un ${animal} sin el apoyo correcto te cuesta más a la larga. Sale baratico por lo que da.`,
    lo_pienso: `Tranquilo parcero, te lo aparto sin compromiso y arrancás cuando querás. Eso sí, es de los que más sale, no te quedés sin él.`,
    no_confio: `Es ${og} y es contraentrega: pagás cuando lo tenés en la mano. Cero riesgo, mi rey. Miles de galleros ya lo usan.`,
    no_tengo_plata: `De una te entiendo. Mirá que es contraentrega, no pagás nada ahora; cuando te llegue lo pagás. ¿Te lo aparto pa guardarte el cupo?`,
    ya_lo_uso: `¡Bacano! Entonces ya sabés cómo rinde. ¿Te mando otro pa que no te quedés sin él en el momento clave? 🐓`,
  };

  return {
    keywords: buildKeywords(p),
    benefits,
    usage,
    pitch,
    faq: (FAQ[cat] || FAQ.suplementos).map((f) => ({ ...f })),
    objeciones,
  };
}
