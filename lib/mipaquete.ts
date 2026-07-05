/* ============================================================
   Integración MiPaquete (agregador de envíos Colombia).
   - Credencial (apikey) en tabla mp_credenciales o env MIPAQUETE_APIKEY.
   - Gated: si NO hay apikey, todo funciona con ESTIMACIÓN LOCAL (modelo de
     costos real: flete $20.000+7% + comisión de recaudo COD ~4.3%), y las
     guías quedan en estado "pendiente" listas para generarse cuando entre
     el token. Cuando exista apikey, se llama la API real.
   - Endpoints/campos marcados TODO: confirmar contra la doc de MiPaquete al
     integrar el token (doc 06 §9: el contrato HTTP exacto no era extraíble).
   ============================================================ */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { mpCredenciales, mpLocationsCache } from "@/lib/db/schema";
import { calcularFlete } from "@/lib/ai/shipping";

/** delivery company ids de MiPaquete (doc 07). */
export const MP_COMPANIES: Record<string, string> = {
  COORDINADORA: "5cb0f5fd244fe2796e65f9fc",
  TCC: "5ca22d9587981510092322f6",
  SERVIENTREGA: "5fceb46c8229797cb139a7aa",
  ENVIA: "6080a75ef08a770ddd9724fd",
  INTER_RAPIDISIMO: "64baafead968aa4f73ce67c5",
};

const norm = (s: string) => (s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export async function getMpCreds(): Promise<{ apikey: string; baseUrl: string }> {
  const baseDefault = "https://api-v2.mipaquete.com";
  if (!db) return { apikey: process.env.MIPAQUETE_APIKEY || "", baseUrl: baseDefault };
  try {
    const [c] = await db.select().from(mpCredenciales).where(eq(mpCredenciales.id, "active")).limit(1);
    return { apikey: process.env.MIPAQUETE_APIKEY || c?.apikey || "", baseUrl: c?.baseUrl || baseDefault };
  } catch {
    return { apikey: process.env.MIPAQUETE_APIKEY || "", baseUrl: baseDefault };
  }
}
export async function mpConfigured(): Promise<boolean> {
  return !!(await getMpCreds()).apikey;
}

/** Resuelve una ciudad a su código DANE usando el caché mp_locations_cache. */
export async function mpBuscarDane(ciudad: string): Promise<{ code: string; name: string; dep: string } | null> {
  if (!db || !ciudad?.trim()) return null;
  const n = norm(ciudad);
  const rows = await db.select().from(mpLocationsCache);
  const exact = rows.find((r) => norm(r.locationName || "") === n);
  const partial = exact || rows.find((r) => n.includes(norm(r.locationName || "")) && (r.locationName || "").length > 3);
  return partial ? { code: partial.locationCode, name: partial.locationName || "", dep: partial.departmentName || "" } : null;
}

export interface CotizacionMp {
  deliveryCompany: string;
  deliveryCompanyId: string;
  shippingCost: number;
  collectionCommission: number;
  totalCost: number;
  source: "mipaquete" | "local";
}

/** Estimación LOCAL (sin MiPaquete). Modelo real: flete $20k+7% + comisión COD ~4.3%. */
export function cotizarLocal(declaredValue: number, paymentType: number): CotizacionMp {
  const shippingCost = calcularFlete(declaredValue);
  const collectionCommission = paymentType === 102 ? Math.round(declaredValue * 0.043) : 0;
  return {
    deliveryCompany: "COORDINADORA", deliveryCompanyId: MP_COMPANIES.COORDINADORA,
    shippingCost, collectionCommission, totalCost: shippingCost + collectionCommission, source: "local",
  };
}

/** Cotiza el flete. Con apikey llama MiPaquete; sin apikey usa la estimación local. */
export async function mpCotizar(p: {
  originDane: string; destinyDane: string; weight: number; declaredValue: number; paymentType: number;
}): Promise<{ ok: boolean; cotizaciones: CotizacionMp[]; source: "mipaquete" | "local"; error?: string }> {
  const { apikey, baseUrl } = await getMpCreds();
  const local = () => ({ ok: true as const, cotizaciones: [cotizarLocal(p.declaredValue, p.paymentType)], source: "local" as const });
  if (!apikey) return local();
  try {
    const r = await fetch(`${baseUrl}/getRates`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey, "session-tracking": apikey },
      body: JSON.stringify({
        originLocationCode: p.originDane, destinationLocationCode: p.destinyDane,
        height: 20, width: 20, length: 20, weightUnit: "kg", weight: p.weight,
        declaredValue: p.declaredValue, deliveryType: p.paymentType === 102 ? "delivery" : "prepaid",
        paymentType: p.paymentType, // 101 anticipado / 102 COD
      }),
    });
    if (!r.ok) return { ...local(), source: "local", error: `mp ${r.status}` };
    const data = await r.json();
    // TODO(token): mapear la forma REAL de la respuesta de MiPaquete.
    const arr = Array.isArray(data) ? data : (data?.rates || data?.data || []);
    const cot: CotizacionMp[] = arr.map((x: Record<string, unknown>) => ({
      deliveryCompany: String(x.deliveryCompanyName || x.company || ""),
      deliveryCompanyId: String(x.deliveryCompany || x.deliveryCompanyId || ""),
      shippingCost: Math.round(Number(x.shippingCost ?? x.value ?? 0)),
      collectionCommission: Math.round(Number(x.collectionCommission ?? 0)),
      totalCost: Math.round(Number(x.totalCost ?? x.total ?? 0)),
      source: "mipaquete",
    }));
    return cot.length ? { ok: true, cotizaciones: cot, source: "mipaquete" } : local();
  } catch (e) {
    return { ...local(), source: "local", error: String(e).slice(0, 120) };
  }
}

export interface MpCrearGuiaPayload {
  origin: { name: string; phone: string; idNumber: string; address: string; locationCode: string };
  destiny: { name: string; phone: string; idNumber: string; address: string; locationCode: string };
  pkg: { weight: number; width: number; height: number; length: number; declaredValue: number; description: string; reference: string; quantity: number };
  paymentType: number; // 101 | 102
  collectionValue: number;
  deliveryCompanyId: string;
  idempotencyKey: string;
}

/** Crea la guía REAL contra MiPaquete. Sin apikey → pending (se genera luego). */
export async function mpCrearGuia(p: MpCrearGuiaPayload): Promise<{
  ok: boolean; pending?: boolean; mpCode?: string; guideNumber?: string; pickupNumber?: string;
  pdfGuideUrl?: string; deliveryCompanyName?: string; raw?: unknown; error?: string;
}> {
  const { apikey, baseUrl } = await getMpCreds();
  if (!apikey) return { ok: false, pending: true, error: "MiPaquete sin token — guía en pendiente" };
  try {
    // TODO(token): confirmar endpoint y forma del body con la doc de MiPaquete.
    const r = await fetch(`${baseUrl}/createShipping`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey, "session-tracking": apikey },
      body: JSON.stringify({
        senderName: p.origin.name, senderPhone: p.origin.phone, senderIdNumber: p.origin.idNumber,
        senderAddress: p.origin.address, originLocationCode: p.origin.locationCode,
        receiverName: p.destiny.name, receiverPhone: p.destiny.phone, receiverIdNumber: p.destiny.idNumber,
        receiverAddress: p.destiny.address, destinationLocationCode: p.destiny.locationCode,
        weight: p.pkg.weight, width: p.pkg.width, height: p.pkg.height, length: p.pkg.length,
        declaredValue: p.pkg.declaredValue, productDescription: p.pkg.description,
        productReference: p.pkg.reference, quantity: p.pkg.quantity,
        paymentType: p.paymentType, collectionValue: p.collectionValue,
        deliveryCompany: p.deliveryCompanyId, idempotencyKey: p.idempotencyKey,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: `mp ${r.status}: ${JSON.stringify(data).slice(0, 160)}`, raw: data };
    return {
      ok: true,
      mpCode: String(data.code ?? data.mpCode ?? ""),
      guideNumber: String(data.guideNumber ?? ""),
      pickupNumber: String(data.pickupCode ?? data.pickupNumber ?? ""),
      pdfGuideUrl: (Array.isArray(data.pdfGuide) ? data.pdfGuide[0] : data.pdfGuide) || data.pdfGuideUrl || "",
      deliveryCompanyName: data.deliveryCompanyName || "",
      raw: data,
    };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 160) };
  }
}
