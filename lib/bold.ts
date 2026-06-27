/* ===========================================================
   Bold — pasarela de pago (link de pago + verificación de webhook).
   Docs: https://developers.bold.co/pagos-en-linea/api-link-de-pagos
         https://developers.bold.co/webhook
   Credenciales en env (nunca en código):
     BOLD_API_KEY        → llave de identidad (header Authorization)
     BOLD_WEBHOOK_SECRET → llave secreta para verificar firma del webhook
   =========================================================== */
import crypto from "node:crypto";

const BOLD_LINK_API = "https://integrations.api.bold.co/online/link/v1";

export interface BoldLinkInput {
  amountCop: number;
  reference: string;
  description?: string;
  callbackUrl?: string;
  payerEmail?: string;
  /** Vencimiento en epoch ms (opcional). */
  expirationMs?: number;
}

export interface BoldLinkResult {
  ok: boolean;
  link: string; // URL completa de checkout
  paymentLink: string; // identificador LNK_...
  error?: string;
}

export function boldConfigured(): boolean {
  return !!process.env.BOLD_API_KEY;
}

/** Crea un link de pago Bold (monto cerrado en COP). */
export async function createBoldPaymentLink(input: BoldLinkInput): Promise<BoldLinkResult> {
  const apiKey = process.env.BOLD_API_KEY || "";
  if (!apiKey) return { ok: false, link: "", paymentLink: "", error: "bold_not_configured" };

  const body: Record<string, unknown> = {
    amount_type: "CLOSE",
    amount: { currency: "COP", total_amount: Math.max(0, Math.round(input.amountCop)), tip_amount: 0 },
    reference: input.reference,
    description: input.description || `Pedido ${input.reference} · Animals Deluxe`,
  };
  if (input.callbackUrl) body.callback_url = input.callbackUrl;
  if (input.payerEmail) body.payer_email = input.payerEmail;
  if (input.expirationMs) body.expiration_date = input.expirationMs;

  try {
    const res = await fetch(BOLD_LINK_API, {
      method: "POST",
      headers: {
        // Formato exacto requerido por Bold: "x-api-key <llave>"
        Authorization: `x-api-key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as {
      payload?: { url?: string; payment_link?: string };
      errors?: unknown[];
    };
    const url = json.payload?.url || "";
    const paymentLink = json.payload?.payment_link || "";
    if (!res.ok || !url) {
      return { ok: false, link: "", paymentLink: "", error: `bold_error_${res.status}` };
    }
    return { ok: true, link: url, paymentLink };
  } catch (err) {
    return { ok: false, link: "", paymentLink: "", error: err instanceof Error ? err.message : "fetch_error" };
  }
}

/** Verifica la firma del webhook de Bold (header x-bold-signature).
    Pasos Bold: hex( HMAC-SHA256( secret, base64(rawBody) ) ).
    En modo pruebas la llave secreta es "" (string vacío). */
export function verifyBoldSignature(rawBody: string, signature: string): boolean {
  if (!signature) return false;
  const secret = process.env.BOLD_WEBHOOK_SECRET ?? "";
  const encoded = Buffer.from(rawBody, "utf8").toString("base64");
  const computed = crypto.createHmac("sha256", secret).update(encoded).digest("hex");
  const a = Buffer.from(computed);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
