/* ===========================================================
   UChat — envío de mensajes salientes al suscriptor (push desde backend).
   Lo usa el webhook de Bold para avisar "pago recibido".
   Credenciales en env:
     UCHAT_API_TOKEN → Bearer token de la API de UChat
     UCHAT_API_BASE  → base de la API (default https://www.uchat.com.au/api)
     UCHAT_SEND_PATH → path del endpoint de envío de texto (configurable;
                       confirma el exacto en el Swagger de tu cuenta UChat)
   Es FAIL-SOFT: si no está configurado o falla, NO lanza — solo devuelve
   {ok:false} para no romper el flujo de pago (lo crítico ya quedó en DB).

   Nota WhatsApp: fuera de la ventana de 24h solo se pueden enviar plantillas.
   El pago suele ocurrir minutos después de recibir el link, así que en la
   práctica el cliente está dentro de la ventana.
   =========================================================== */

export interface UchatSendResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

export function uchatConfigured(): boolean {
  return !!process.env.UCHAT_API_TOKEN;
}

/** Envía un texto libre a un suscriptor por su user_id (sub_id de UChat). */
export async function uchatSendText(userId: string, text: string): Promise<UchatSendResult> {
  const token = process.env.UCHAT_API_TOKEN || "";
  if (!token || !userId) return { ok: false, skipped: true, error: "uchat_not_configured" };

  const base = (process.env.UCHAT_API_BASE || "https://www.uchat.com.au/api").replace(/\/$/, "");
  const path = process.env.UCHAT_SEND_PATH || "/subscriber/send-content";
  const url = `${base}${path.startsWith("/") ? path : "/" + path}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        // forma común en UChat; si tu cuenta usa otra, ajusta UCHAT_SEND_PATH/payload
        content: { type: "text", text },
      }),
    });
    if (!res.ok) return { ok: false, error: `uchat_error_${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "fetch_error" };
  }
}

/** Envía una IMAGEN (con caption opcional) a un suscriptor por su user_id. Fail-soft.
 *  Para campañas de promoción con imagen del producto/combo. */
export async function uchatSendImage(userId: string, imageUrl: string, caption = ""): Promise<UchatSendResult> {
  const token = process.env.UCHAT_API_TOKEN || "";
  if (!token || !userId || !imageUrl) return { ok: false, skipped: true, error: "uchat_not_configured" };
  const base = (process.env.UCHAT_API_BASE || "https://www.uchat.com.au/api").replace(/\/$/, "");
  const path = process.env.UCHAT_SEND_PATH || "/subscriber/send-content";
  const url = `${base}${path.startsWith("/") ? path : "/" + path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ user_id: userId, content: { type: "image", url: imageUrl, caption } }),
    });
    if (!res.ok) return { ok: false, error: `uchat_error_${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "fetch_error" };
  }
}

/** Trae datos del suscriptor (teléfono/nombre de WhatsApp) por su user_id (sub_id).
 *  Fail-soft. Normaliza el teléfono a 57XXXXXXXXXX. Usado para recuperar leads viejos sin número. */
export async function uchatGetSubscriber(userId: string): Promise<{ ok: boolean; telefono?: string; nombre?: string; error?: string }> {
  const token = process.env.UCHAT_API_TOKEN || "";
  if (!token || !userId) return { ok: false, error: "uchat_not_configured" };
  const base = (process.env.UCHAT_API_BASE || "https://www.uchat.com.au/api").replace(/\/$/, "");
  const path = process.env.UCHAT_GET_PATH || "/subscriber/get-info";
  // UChat identifica al suscriptor por user_ns (= nuestro sub_id, p.ej. f280503u823082027).
  const url = `${base}${path.startsWith("/") ? path : "/" + path}?user_ns=${encodeURIComponent(userId)}`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (!res.ok) return { ok: false, error: `uchat_error_${res.status}` };
    const j = (await res.json()) as Record<string, unknown>;
    const d = ((j.data as Record<string, unknown>) || j) as Record<string, unknown>;
    const s = (x: unknown) => (x == null ? "" : String(x)).trim();
    const rawTel = s(d.whatsapp_phone ?? d.phone ?? d.whatsapp ?? d.wa_id ?? d.telefono);
    let tel = rawTel.replace(/\D/g, "");
    if (tel.length === 10 && tel.startsWith("3")) tel = "57" + tel;
    const nombre = s(d.name ?? d.first_name ?? d.full_name);
    return { ok: true, telefono: tel, nombre };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "fetch_error" };
  }
}
