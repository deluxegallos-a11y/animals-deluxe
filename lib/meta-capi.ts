/* ===========================================================
   Meta Conversions API (CAPI) — evento Purchase server-side.
   Fail-soft: si no hay META_PIXEL_ID / META_CAPI_TOKEN, no hace nada.
   Se usa en pedidos del bot y en pedidos manuales del asesor, con el
   mismo order_id (ref AD-XXXX) para deduplicar contra el pixel del navegador.
   =========================================================== */
import crypto from "node:crypto";

const sha256 = (s: string) => crypto.createHash("sha256").update(s.trim().toLowerCase()).digest("hex");

/** Normaliza a solo dígitos con indicativo país (Colombia 57 si viene sin él). */
function normPhone(p: string): string {
  let d = (p || "").replace(/\D/g, "");
  if (d.length === 10) d = "57" + d; // celular CO sin indicativo
  return d;
}

export interface MetaPurchaseInput {
  ref: string;
  valueCop: number;
  phone?: string;
  nombre?: string;
  ciudad?: string;
  contentIds?: string[];
  /** website | business_messaging | phone_call | system_generated | chat ... */
  actionSource?: string;
}

export async function sendMetaPurchase(o: MetaPurchaseInput): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const PIXEL = process.env.META_PIXEL_ID;
  const TOKEN = process.env.META_CAPI_TOKEN;
  if (!PIXEL || !TOKEN) return { ok: false, skipped: true };
  try {
    const user_data: Record<string, unknown> = { country: [sha256("co")] };
    if (o.phone) user_data.ph = [sha256(normPhone(o.phone))];
    if (o.ciudad) user_data.ct = [sha256(o.ciudad.replace(/\s+/g, "").toLowerCase())];
    if (o.nombre) {
      const parts = o.nombre.trim().split(/\s+/);
      if (parts[0]) user_data.fn = [sha256(parts[0].toLowerCase())];
      if (parts.length > 1) user_data.ln = [sha256(parts.slice(1).join("").toLowerCase())];
    }
    const body = {
      data: [{
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        action_source: o.actionSource || "system_generated",
        event_id: o.ref, // dedup con el pixel del navegador si aplica
        user_data,
        custom_data: {
          currency: "COP",
          value: Math.round(o.valueCop || 0),
          order_id: o.ref,
          content_type: "product",
          ...(o.contentIds?.length ? { content_ids: o.contentIds } : {}),
        },
      }],
    };
    const r = await fetch(`https://graph.facebook.com/v19.0/${PIXEL}/events?access_token=${encodeURIComponent(TOKEN)}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    if (!r.ok) return { ok: false, error: `meta ${r.status}: ${(await r.text()).slice(0, 160)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 160) };
  }
}
