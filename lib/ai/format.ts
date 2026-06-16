/** Formatea pesos colombianos: 70000 → "$70.000". */
export function cop(n: number | null | undefined): string {
  const v = typeof n === "number" && isFinite(n) ? n : 0;
  return "$" + new Intl.NumberFormat("es-CO").format(v);
}

/** Código corto aleatorio tipo AD-7F3A. */
export function shortCode(prefix: string): string {
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += alpha[Math.floor(Math.random() * alpha.length)];
  return `${prefix}-${s}`;
}

/** Quita tildes y baja a minúsculas (para comparar/buscar). */
export function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Bandera por origen. */
export function flag(origin: string): string {
  return { us: "🇺🇸", co: "🇨🇴", br: "🇧🇷", mx: "🇲🇽" }[origin] || "🏳️";
}
