/* Iconografía, acento, tinte y MASCOTA (gallo distinto) por categoría. */
export const CAT_META: Record<string, { emoji: string; color: string; hue: number; mascot: string; tagline: string }> = {
  energia:         { emoji: "⚡", color: "#FF4D2E", hue: 0,   mascot: "/mascots/rooster-boxer.png",    tagline: "Doping de combate" },
  vitaminas:       { emoji: "💊", color: "#22B8FF", hue: 175, mascot: "/mascots/rooster-champion.png", tagline: "Salud de campeón" },
  desparasitantes: { emoji: "🪱", color: "#2BE36B", hue: 95,  mascot: "/mascots/rooster-alfa.png",     tagline: "Limpieza interna" },
  respiratorio:    { emoji: "🌬️", color: "#1FE0D0", hue: 140, mascot: "/mascots/rooster-champion.png", tagline: "Pecho libre" },
  cuidado:         { emoji: "🪶", color: "#B061FF", hue: 250, mascot: "/mascots/rooster-king.png",     tagline: "Pluma y piel" },
  suplementos:     { emoji: "🥤", color: "#FFB02E", hue: 28,  mascot: "/mascots/rooster-king.png",     tagline: "Masa y fuerza" },
  entrenamiento:   { emoji: "💪", color: "#FF7A1A", hue: 12,  mascot: "/mascots/rooster-boxer.png",    tagline: "Recuperación total" },
  pollos:          { emoji: "🐤", color: "#FFD23D", hue: 42,  mascot: "/mascots/rooster-alfa.png",     tagline: "Levante fuerte" },
  perros:          { emoji: "🐕", color: "#8A6BFF", hue: 235, mascot: "/mascots/rooster-champion.png", tagline: "Tu mejor amigo" },
  caballos:        { emoji: "🐴", color: "#D8A24A", hue: 35,  mascot: "/mascots/rooster-king.png",     tagline: "Potencia equina" },
};

export function catMeta(slug: string) {
  return CAT_META[slug] || { emoji: "🐓", color: "#FFC83D", hue: 20, mascot: "/mascots/rooster-alfa.png", tagline: "Animals Deluxe" };
}

export function alpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
