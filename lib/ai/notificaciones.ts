/* ===========================================================
   Notificaciones salientes al CLIENTE por WhatsApp (vía UChat).
   Hoy se disparan MANUALMENTE desde el panel (botón "Despachar y avisar").
   Más adelante, una integración con la transportadora podrá llamar a
   estas mismas funciones de forma automática.

   Diseño:
   - El armado del mensaje es una función PURA y testeable (mensajeDespacho).
   - El envío (notificarDespacho) es FAIL-SOFT: si no hay sub_id o UChat no
     está configurado, NO lanza — devuelve {ok:false, skipped} y el panel lo
     muestra. Lo crítico (estado + guía) ya quedó en la DB.
   =========================================================== */
import { uchatSendText, uchatConfigured, type UchatSendResult } from "@/lib/uchat";

export interface DespachoData {
  ref: string;
  nombre?: string;
  guia: string;
  transportadora?: string;
  items?: { name: string; cantidad: number }[];
}

/** Arma el texto de "tu pedido fue despachado" (WhatsApp). Función pura. */
export function mensajeDespacho(d: DespachoData): string {
  const saludo = d.nombre ? `¡Hola ${d.nombre.split(" ")[0]}! ` : "";
  const lineas: string[] = [
    `${saludo}🚚 Tu pedido *${d.ref}* ya fue *despachado*.`,
  ];
  if (d.transportadora) lineas.push(`📦 Transportadora: *${d.transportadora}*`);
  if (d.guia) lineas.push(`🔖 Número de guía: *${d.guia}*`);
  const resumen = (d.items || [])
    .filter((i) => i.name)
    .map((i) => `${i.cantidad}× ${i.name}`)
    .join(", ");
  if (resumen) lineas.push(`🧾 Incluye: ${resumen}`);
  lineas.push("Ya viene en camino. Con tu número de guía puedes rastrearlo. ¡Gracias por comprar en Animals Deluxe! 🐓");
  return lineas.join("\n");
}

export interface NotifyResult extends UchatSendResult {
  /** true si no había sub_id de UChat del cliente (no se pudo enviar). */
  sinSubId?: boolean;
  /** true si UChat no está configurado en el entorno (falta UCHAT_API_TOKEN). */
  sinConfig?: boolean;
}

/**
 * Notifica al cliente por WhatsApp que su pedido fue despachado.
 * FAIL-SOFT: nunca lanza. `uchatSubId` es el user_id del cliente en UChat.
 */
export async function notificarDespacho(uchatSubId: string | null | undefined, d: DespachoData): Promise<NotifyResult> {
  if (!uchatConfigured()) return { ok: false, skipped: true, sinConfig: true, error: "uchat_not_configured" };
  if (!uchatSubId) return { ok: false, skipped: true, sinSubId: true, error: "cliente_sin_sub_id" };
  const res = await uchatSendText(uchatSubId, mensajeDespacho(d));
  return res;
}
