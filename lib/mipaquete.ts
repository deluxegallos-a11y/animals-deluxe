/* ============================================================
   Integración MiPaquete v2 — contrato REAL (doc Postman oficial).
   Auth: DOS headers en cada llamada de negocio →
     · session-tracker: UUID fijo (identificador de sesión, reutilizable)
     · apikey: JWT generado con POST /generateapikey (email+password), permanente.
   Sin apikey → estimación LOCAL (flete $20k+7% + comisión COD ~4.3%) y guía "pendiente".
   ============================================================ */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { mpCredenciales, mpLocationsCache } from "@/lib/db/schema";
import { calcularFlete } from "@/lib/ai/shipping";
import { decrypt } from "@/lib/crypto";

export const MP_COMPANIES: Record<string, string> = {
  COORDINADORA: "5cb0f5fd244fe2796e65f9fc", TCC: "5ca22d9587981510092322f6",
  SERVIENTREGA: "5fceb46c8229797cb139a7aa", ENVIA: "6080a75ef08a770ddd9724fd",
  INTER_RAPIDISIMO: "64baafead968aa4f73ce67c5",
};

// session-tracker: UUID fijo (reutilizable). Configurable por env.
const SESSION_TRACKER = process.env.MIPAQUETE_SESSION_TRACKER || "a0c96ea6-b22d-4fb7-a278-850678d5429c";
// Base confirmada en vivo: api.mipaquete.com (SIN /api). Endpoints: /generateapikey,
// /quoteShipping, /createSending, /getDeliveryCompanies, /getLocations.
const MP_BASE = "https://api.mipaquete.com";
const CO = "170"; // código de país Colombia en MiPaquete (¡NO 484, que es México!)
const BASE_CANDIDATES = [process.env.MIPAQUETE_BASE_URL, MP_BASE].filter(Boolean) as string[];

const norm = (s: string) => (s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const mpHeaders = (apikey: string) => ({ "content-type": "application/json", "session-tracker": SESSION_TRACKER, apikey });

export async function getMpCreds(): Promise<{ apikey: string; baseUrl: string; email: string; password: string }> {
  const base = process.env.MIPAQUETE_BASE_URL || MP_BASE;
  if (!db) return { apikey: process.env.MIPAQUETE_APIKEY || "", baseUrl: base, email: process.env.MIPAQUETE_EMAIL || "", password: process.env.MIPAQUETE_PASSWORD || "" };
  const [c] = await db.select().from(mpCredenciales).where(eq(mpCredenciales.id, "active")).limit(1);
  let password = process.env.MIPAQUETE_PASSWORD || "";
  if (!password && c?.loginPassEnc) { try { password = decrypt(c.loginPassEnc); } catch { /* */ } }
  return {
    apikey: process.env.MIPAQUETE_APIKEY || c?.apikey || "",
    baseUrl: c?.baseUrl || base,
    email: c?.loginEmail || process.env.MIPAQUETE_EMAIL || "",
    password,
  };
}
export async function mpConfigured(): Promise<boolean> {
  const c = await getMpCreds();
  return !!(c.apikey || (c.email && c.password));
}

/** Genera el apikey vía /generateapikey (email+password). Descubre la base que responde y la guarda. */
export async function mpGenerateApiKey(): Promise<{ ok: boolean; apikey?: string; baseUrl?: string; error?: string }> {
  const { email, password, baseUrl } = await getMpCreds();
  if (!email || !password) return { ok: false, error: "faltan email/password de MiPaquete" };
  const bases = Array.from(new Set([baseUrl, ...BASE_CANDIDATES]));
  let lastErr = "";
  for (const base of bases) {
    try {
      const r = await fetch(`${base}/generateapikey`, {
        method: "POST",
        headers: { "content-type": "application/json", "session-tracker": SESSION_TRACKER },
        body: JSON.stringify({ email, password }),
      });
      const t = await r.text();
      let apikey = "";
      try { const j = JSON.parse(t) as Record<string, unknown>; const d = (j.data || {}) as Record<string, unknown>; apikey = String(j.APIKey || j.apikey || j.apiKey || j.token || d.APIKey || d.apikey || d.token || ""); } catch { /* */ }
      if (r.ok && apikey) {
        if (db) await db.update(mpCredenciales).set({ apikey, baseUrl: base, generatedAt: new Date(), lastError: "", updatedAt: new Date() }).where(eq(mpCredenciales.id, "active"));
        return { ok: true, apikey, baseUrl: base };
      }
      lastErr = `${base} → ${r.status} ${t.slice(0, 90)}`;
    } catch (e) { lastErr = `${base} ${String(e).slice(0, 50)}`; }
  }
  if (db) await db.update(mpCredenciales).set({ lastError: ("generateapikey: " + lastErr).slice(0, 400), updatedAt: new Date() }).where(eq(mpCredenciales.id, "active"));
  return { ok: false, error: lastErr || "no se pudo generar apikey" };
}

/** Devuelve un apikey válido; lo genera si no existe. force = regenerar (tras 401). */
export async function ensureMpAuth(force = false): Promise<{ apikey: string; baseUrl: string }> {
  const { apikey, baseUrl } = await getMpCreds();
  if (apikey && !force) return { apikey, baseUrl };
  const gen = await mpGenerateApiKey();
  return { apikey: gen.apikey || apikey, baseUrl: gen.baseUrl || baseUrl };
}

/** Resuelve ciudad → DANE (caché; opcionalmente valida vía /getLocations). */
export async function mpBuscarDane(ciudad: string): Promise<{ code: string; name: string; dep: string } | null> {
  if (!db || !ciudad?.trim()) return null;
  const n = norm(ciudad).replace(/,.*$/, "").trim(); // "bogota, cundinamarca" → "bogota"
  const rows = await db.select().from(mpLocationsCache);
  const exact = rows.find((r) => norm(r.locationName || "") === n);
  // "bogota" ↔ "bogota d.c." · "medellin" ↔ nombre que empieza igual
  const hit = exact
    || rows.find((r) => { const c = norm(r.locationName || ""); return c === n || c.startsWith(n + " ") || n.startsWith(c + " "); })
    || rows.find((r) => { const c = norm(r.locationName || ""); return c.length > 3 && (n.includes(c) || c.includes(n)); });
  return hit ? { code: hit.locationCode, name: hit.locationName || "", dep: hit.departmentName || "" } : null;
}

export interface CotizacionMp {
  deliveryCompany: string; deliveryCompanyId: string;
  shippingCost: number; collectionCommission: number; totalCost: number;
  source: "mipaquete" | "local";
}
export function cotizarLocal(declaredValue: number, paymentType: number): CotizacionMp {
  const shippingCost = calcularFlete(declaredValue);
  const collectionCommission = paymentType === 102 ? Math.round(declaredValue * 0.043) : 0;
  return { deliveryCompany: "COORDINADORA", deliveryCompanyId: MP_COMPANIES.COORDINADORA, shippingCost, collectionCommission, totalCost: shippingCost + collectionCommission, source: "local" };
}

/** Cotiza flete (POST /quoteShipping). Sin apikey o error → estimación local. */
export async function mpCotizar(p: { originDane: string; destinyDane: string; weight: number; declaredValue: number; paymentType: number; width?: number; height?: number; length?: number }): Promise<{ ok: boolean; cotizaciones: CotizacionMp[]; source: "mipaquete" | "local"; error?: string }> {
  const local = () => ({ ok: true as const, cotizaciones: [cotizarLocal(p.declaredValue, p.paymentType)], source: "local" as const });
  if (!p.destinyDane) return local();
  const body = JSON.stringify({
    originCountryCode: CO, originLocationCode: p.originDane,
    destinyCountryCode: CO, destinyLocationCode: p.destinyDane,
    quantity: 1, width: p.width || 20, length: p.length || 20, height: p.height || 20, weight: p.weight, declaredValue: p.declaredValue,
  });
  try {
    let { apikey, baseUrl } = await ensureMpAuth();
    if (!apikey) return local();
    let r = await fetch(`${baseUrl}/quoteShipping`, { method: "POST", headers: mpHeaders(apikey), body });
    if (r.status === 401) { ({ apikey, baseUrl } = await ensureMpAuth(true)); if (apikey) r = await fetch(`${baseUrl}/quoteShipping`, { method: "POST", headers: mpHeaders(apikey), body }); }
    if (!r.ok) return { ...local(), source: "local", error: `mp ${r.status}` };
    const data = await r.json();
    const arr = Array.isArray(data) ? data : (data?.data || data?.quotations || []);
    const cot: CotizacionMp[] = (arr as Record<string, unknown>[]).map((x) => {
      const shippingCost = Math.round(Number(x.shippingCost ?? 0));
      const collectionCommission = Math.round(Number(x.collectionCommissionWithRate ?? x.collectionCommissionWithOutRate ?? x.collectionCommission ?? 0));
      return {
        deliveryCompany: String(x.deliveryCompanyName || ""),
        deliveryCompanyId: String(x.deliveryCompanyId || x.idDeliveryCompany || ""), // campo REAL: deliveryCompanyId
        shippingCost, collectionCommission, totalCost: shippingCost + collectionCommission,
        source: "mipaquete" as const,
      };
    }).filter((x) => x.shippingCost > 0 && x.deliveryCompanyId);
    return cot.length ? { ok: true, cotizaciones: cot.sort((a, b) => a.totalCost - b.totalCost), source: "mipaquete" } : local();
  } catch (e) {
    return { ...local(), source: "local", error: String(e).slice(0, 120) };
  }
}

/** Tras crear el envío (mpCode), obtiene el número de guía (getSendingTracking) y arma el PDF. */
export async function mpGetSendingInfo(mpCode: string): Promise<{ guideNumber: string; pdfGuideUrl: string; deliveryCompanyName: string; state: string }> {
  const empty = { guideNumber: "", pdfGuideUrl: "", deliveryCompanyName: "", state: "" };
  if (!mpCode) return empty;
  const { apikey, baseUrl } = await ensureMpAuth();
  if (!apikey) return empty;
  try {
    const r = await fetch(`${baseUrl}/getSendingTracking?mpCode=${encodeURIComponent(mpCode)}`, { headers: { "session-tracker": SESSION_TRACKER, apikey } });
    if (!r.ok) return empty;
    const d = (await r.json()) as Record<string, unknown>;
    const guideNumber = String(d.guideNumber || "");
    const company = String(d.deliveryCompanyName || "");
    const tr = (d.tracking as { updateState?: string }[]) || [];
    const state = tr.length ? String(tr[tr.length - 1]?.updateState || "") : "";
    const compSlug = norm(company).replace(/\s+/g, ""); // "COORDINADORA" → "coordinadora"
    const pdfGuideUrl = guideNumber && compSlug ? `https://s3.amazonaws.com/docs.mipaquete.com/sendings/guide/${compSlug}-guide-${guideNumber}.pdf` : "";
    return { guideNumber, pdfGuideUrl, deliveryCompanyName: company, state };
  } catch {
    return empty;
  }
}

export interface MpCrearGuiaPayload {
  origin: { name: string; phone: string; idNumber: string; address: string; locationCode: string; email?: string };
  destiny: { name: string; phone: string; idNumber: string; address: string; locationCode: string; email?: string };
  pkg: { weight: number; width: number; height: number; length: number; declaredValue: number; description: string; reference: string; quantity: number };
  paymentType: number; collectionValue: number; deliveryCompanyId: string; idempotencyKey: string;
}

/** Crea la guía (POST /createSending). Sin apikey → pending. */
export async function mpCrearGuia(p: MpCrearGuiaPayload): Promise<{ ok: boolean; pending?: boolean; mpCode?: string; guideNumber?: string; pickupNumber?: string; pdfGuideUrl?: string; deliveryCompanyName?: string; raw?: unknown; error?: string }> {
  let { apikey, baseUrl } = await ensureMpAuth();
  if (!apikey) return { ok: false, pending: true, error: "MiPaquete sin apikey — guía en pendiente" };
  const body = JSON.stringify({
    adminTransactionData: { saleValue: p.paymentType === 102 ? p.collectionValue : 0 },
    channel: "Animals Deluxe Plataforma",
    comments: p.pkg.description, description: p.pkg.description, criteria: "price",
    deliveryCompany: p.deliveryCompanyId,
    locate: { originDaneCode: p.origin.locationCode, destinyDaneCode: p.destiny.locationCode, originCountryCode: CO, destinyCountryCode: CO },
    paymentType: p.paymentType,
    // COD (102): valueCollection = lo que recauda el mensajero. Es el campo que MiPaquete exige
    // para el contra entrega (sin él daba 537 "shipping cannot be paid").
    valueCollection: p.paymentType === 102 ? p.collectionValue : 0,
    productInformation: { declaredValue: p.pkg.declaredValue, forbiddenProduct: false, height: p.pkg.height, large: p.pkg.length, width: p.pkg.width, weight: p.pkg.weight, productReference: p.pkg.reference, quantity: p.pkg.quantity },
    receiver: { name: p.destiny.name, surname: ".", cellPhone: p.destiny.phone, prefix: "+57", destinationAddress: p.destiny.address, email: p.destiny.email || "cliente@animalsdeluxe.com", nit: p.destiny.idNumber || ".", nitType: "CC" },
    requestPickup: "false",
    sender: { name: p.origin.name, surname: ".", cellPhone: p.origin.phone, prefix: "+57", pickupAddress: p.origin.address, email: p.origin.email || "deluxegallos@gmail.com", nit: p.origin.idNumber || ".", nitType: "CC" },
  });
  try {
    let r = await fetch(`${baseUrl}/createSending`, { method: "POST", headers: mpHeaders(apikey), body });
    if (r.status === 401) { ({ apikey, baseUrl } = await ensureMpAuth(true)); if (apikey) r = await fetch(`${baseUrl}/createSending`, { method: "POST", headers: mpHeaders(apikey), body }); }
    const data = await r.json().catch(() => ({} as Record<string, unknown>));
    const d = (((data as Record<string, unknown>).data) || data) as Record<string, unknown>;
    if (!r.ok) return { ok: false, error: `mp ${r.status}: ${JSON.stringify(data).slice(0, 160)}`, raw: data };
    return {
      ok: true,
      mpCode: String(d.mpCode ?? d.code ?? ""),
      guideNumber: String(d.guideNumber ?? ""),
      pickupNumber: String(d.pickupCode ?? d.pickupNumber ?? ""),
      pdfGuideUrl: String((Array.isArray(d.pdfGuide) ? d.pdfGuide[0] : d.pdfGuide) || d.pdfGuideUrl || ""),
      deliveryCompanyName: String(d.deliveryCompanyName || ""),
      raw: data,
    };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 160) };
  }
}
