/* Fechas del panel SIEMPRE en hora de Colombia y con espacios normales.
   Motivo: el servidor (Vercel, UTC) y el navegador (Bogotá) formateaban distinto,
   y el ICU de Node usa espacio fino (U+202F) en «p. m.» → error de hidratación. */
const TZ = "America/Bogota";

function limpio(s: string): string {
  return s.replace(/[  ]/g, " ");
}

/** Formatea una fecha (ISO, Date o null) en es-CO, hora de Bogotá. "" si no hay fecha. */
export function fechaCO(v: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return limpio(d.toLocaleString("es-CO", { ...opts, timeZone: TZ }));
}

export const soloFechaCO = (v: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "numeric", year: "numeric" }) => fechaCO(v, opts);
export const horaCO = (v: string | Date | null | undefined) => fechaCO(v, { hour: "2-digit", minute: "2-digit" });
