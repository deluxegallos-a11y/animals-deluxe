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
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { mpCredenciales, mpLocationsCache } from "@/lib/db/schema";
import { calcularFlete } from "@/lib/ai/shipping";
import { decrypt } from "@/lib/crypto";

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
  const baseDefault = "https://api.mipaquete.com";
  if (!db) return { apikey: process.env.MIPAQUETE_APIKEY || "", baseUrl: baseDefault };
  try {
    const [c] = await db.select().from(mpCredenciales).where(eq(mpCredenciales.id, "active")).limit(1);
    return { apikey: process.env.MIPAQUETE_APIKEY || c?.apikey || "", baseUrl: c?.baseUrl || baseDefault };
  } catch {
    return { apikey: process.env.MIPAQUETE_APIKEY || "", baseUrl: baseDefault };
  }
}
export async function mpConfigured(): Promise<boolean> {
  if (!db) return !!process.env.MIPAQUETE_APIKEY;
  const [c] = await db.select().from(mpCredenciales).where(eq(mpCredenciales.id, "active")).limit(1);
  return !!(process.env.MIPAQUETE_APIKEY || c?.apikey || c?.loginEmail);
}

/** Login contra MiPaquete con las credenciales guardadas → actualiza el Session-Tracker. */
export async function mpLogin(): Promise<{ ok: boolean; apikey?: string; error?: string }> {
  if (!db) return { ok: false, error: "sin db" };
  const [c] = await db.select().from(mpCredenciales).where(eq(mpCredenciales.id, "active")).limit(1);
  const email = c?.loginEmail || process.env.MIPAQUETE_EMAIL || "";
  let password = process.env.MIPAQUETE_PASSWORD || "";
  if (!password && c?.loginPassEnc) { try { password = decrypt(c.loginPassEnc); } catch { /* noop */ } }
  if (!email || !password) return { ok: false, error: "faltan credenciales de login" };
  const base = c?.baseUrl || "https://api.mipaquete.com";
  // Candidatos de endpoint de login (se prueba en orden; el que devuelva token gana).
  const candidates = [
    `${base}/login`, "https://api-v2.mipaquete.com/login", `${base}/users/login`, `${base}/auth/login`,
  ];
  let lastErr = "";
  for (const url of candidates) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await r.json().catch(() => ({} as Record<string, unknown>));
      const d = data as Record<string, unknown>;
      const nested = (d.data || {}) as Record<string, unknown>;
      const tok = String(d.token || d["session-tracking"] || d.sessionTracker || d.sessionTracking || d.apiKey || nested.token || nested["session-tracking"] || "");
      if (r.ok && tok) {
        await db.update(mpCredenciales).set({ apikey: tok, generatedAt: new Date(), refreshedCount: sql`coalesce(refreshed_count,0)+1`, lastError: "", updatedAt: new Date() }).where(eq(mpCredenciales.id, "active"));
        return { ok: true, apikey: tok };
      }
      lastErr = `${url} → ${r.status} ${JSON.stringify(data).slice(0, 100)}`;
    } catch (e) { lastErr = `${url} ${String(e).slice(0, 60)}`; }
  }
  await db.update(mpCredenciales).set({ lastError: ("login fallido: " + lastErr).slice(0, 400), updatedAt: new Date() }).where(eq(mpCredenciales.id, "active"));
  return { ok: false, error: "login fallido — revisar endpoint/credenciales" };
}

/** Devuelve un Session-Tracker válido: reusa el guardado si es reciente (<50 min);
 *  si no, hace login. `force` obliga a re-login (para reintentos tras un 401). */
export async function ensureMpAuth(force = false): Promise<string> {
  if (process.env.MIPAQUETE_APIKEY) return process.env.MIPAQUETE_APIKEY;
  if (!db) return "";
  const [c] = await db.select().from(mpCredenciales).where(eq(mpCredenciales.id, "active")).limit(1);
  const age = c?.generatedAt ? Date.now() - new Date(c.generatedAt).getTime() : Infinity;
  if (!force && c?.apikey && age < 50 * 60 * 1000) return c.apikey;
  const login = await mpLogin();
  return login.apikey || c?.apikey || "";
}

/** Resuelve una ciudad a su código DANE. Primero el caché mp_locations_cache;
 *  si no está y hay token, consulta /getLocations de MiPaquete (cubre todos los municipios). */
export async function mpBuscarDane(ciudad: string): Promise<{ code: string; name: string; dep: string } | null> {
  if (!db || !ciudad?.trim()) return null;
  const n = norm(ciudad);
  const rows = await db.select().from(mpLocationsCache);
  const exact = rows.find((r) => norm(r.locationName || "") === n);
  const partial = exact || rows.find((r) => n.includes(norm(r.locationName || "")) && (r.locationName || "").length > 3);
  if (partial) return { code: partial.locationCode, name: partial.locationName || "", dep: partial.departmentName || "" };

  // Fallback remoto (cubre municipios que no están en el caché).
  const { apikey, baseUrl } = await getMpCreds();
  if (!apikey) return null;
  try {
    const r = await fetch(`${baseUrl}/getLocations`, {
      method: "POST", headers: { "content-type": "application/json", "Session-Tracker": apikey },
      body: JSON.stringify({ location: ciudad.trim() }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const arr = Array.isArray(data) ? data : (data?.locations || data?.data || []);
    const hit = arr.find((x: Record<string, unknown>) => norm(String(x.locationName || x.name || "")) === n) || arr[0];
    if (!hit) return null;
    const code = String(hit.locationCode || hit.code || "");
    const name = String(hit.locationName || hit.name || ciudad);
    const dep = String(hit.departmentOrStateName || hit.departmentName || hit.department || "");
    if (code) { try { await db.insert(mpLocationsCache).values({ locationCode: code, locationName: name, departmentName: dep, raw: hit as object }).onConflictDoNothing(); } catch { /* noop */ } }
    return code ? { code, name, dep } : null;
  } catch {
    return null;
  }
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
  const { baseUrl } = await getMpCreds();
  const local = () => ({ ok: true as const, cotizaciones: [cotizarLocal(p.declaredValue, p.paymentType)], source: "local" as const });
  if (!p.destinyDane) return local();
  const pedir = async (apikey: string) => fetch(`${baseUrl}/getQuotation`, {
    method: "POST", headers: { "content-type": "application/json", "Session-Tracker": apikey },
    body: JSON.stringify({
      locationCodeFrom: p.originDane, locationCodeTo: p.destinyDane,
      height: 20, width: 20, length: 20, weight: p.weight, declaredValue: p.declaredValue,
      deliveryType: p.paymentType === 102 ? 2 : 1, paymentType: p.paymentType,
    }),
  });
  try {
    let apikey = await ensureMpAuth();
    if (!apikey) return local();
    let r = await pedir(apikey);
    if (r.status === 400 || r.status === 401) { apikey = await ensureMpAuth(true); if (apikey) r = await pedir(apikey); } // re-login y reintenta
    if (!r.ok) return { ...local(), source: "local", error: `mp ${r.status}` };
    const data = await r.json();
    const arr = Array.isArray(data) ? data : (data?.quotations || data?.rates || data?.data || []);
    const cot: CotizacionMp[] = arr.map((x: Record<string, unknown>) => ({
      deliveryCompany: String(x.deliveryCompanyName || x.deliveryCompany || ""),
      deliveryCompanyId: String(x.idDeliveryCompany || x.deliveryCompany || x.deliveryCompanyId || ""),
      shippingCost: Math.round(Number(x.shippingCost ?? x.collectionServiceValue ?? x.value ?? 0)),
      collectionCommission: Math.round(Number(x.collectionCommission ?? x.collectionCommissionWithRate ?? 0)),
      totalCost: Math.round(Number(x.total ?? x.totalValue ?? x.shippingCost ?? 0)),
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
  const { baseUrl } = await getMpCreds();
  let apikey = await ensureMpAuth();
  if (!apikey) return { ok: false, pending: true, error: "MiPaquete sin token — guía en pendiente" };
  const cuerpo: Record<string, unknown> = {
    nameSender: p.origin.name, surnameSender: ".", phoneSender: p.origin.phone,
    cellPhoneSender: p.origin.phone, addressSender: p.origin.address, locationCodeSender: p.origin.locationCode,
    nameReceiver: p.destiny.name, surnameReceiver: ".", phoneReceiver: p.destiny.phone,
    cellPhoneReceiver: p.destiny.phone, addressReceiver: p.destiny.address, locationCodeReceiver: p.destiny.locationCode,
    idNumberReceiver: p.destiny.idNumber,
    weight: p.pkg.weight, width: p.pkg.width, height: p.pkg.height, large: p.pkg.length,
    declaredValue: p.pkg.declaredValue, comments: p.pkg.description,
    productName: p.pkg.reference, quantity: p.pkg.quantity,
    deliveryType: p.paymentType === 102 ? 2 : 1, collectionValue: p.collectionValue,
    deliveryCompany: p.deliveryCompanyId, idOrderReference: p.idempotencyKey,
  };
  const enviar = (key: string) => fetch(`${baseUrl}/createShipping`, {
    method: "POST", headers: { "content-type": "application/json", "Session-Tracker": key },
    body: JSON.stringify(cuerpo),
  });
  try {
    let r = await enviar(apikey);
    if (r.status === 400 || r.status === 401) { apikey = await ensureMpAuth(true); if (apikey) r = await enviar(apikey); }
    const data = await r.json().catch(() => ({}) as Record<string, unknown>);
    const d = data as Record<string, unknown>;
    if (!r.ok) return { ok: false, error: `mp ${r.status}: ${JSON.stringify(data).slice(0, 160)}`, raw: data };
    return {
      ok: true,
      mpCode: String(d.code ?? d.mpCode ?? ""),
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
