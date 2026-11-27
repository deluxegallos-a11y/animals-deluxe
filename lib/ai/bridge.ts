/* ===========================================================
   Bridge bot↔plataforma — núcleo de los endpoints /api/ai/*.
   Single-tenant (una sola tienda Animals Deluxe).
   - Auth por x-bridge-token (tiempo constante)
   - Resuelve/crea el cliente (lead) por sub_id
   - Validación Zod
   - Sanitizado anti-null (UChat se cuelga con null → "")
   - Rate limiting por IP+sub_id
   - Helpers audit_log + events
   =========================================================== */
import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { customers, auditLog, events, orderAttempts } from "@/lib/db/schema";
import { isRateLimited } from "@/lib/ratelimit";
import { resolveTenantByToken, getDefaultTenant, runWithTenant, type Tenant } from "@/lib/ai/tenant";

export const runtime = "nodejs";

type Customer = typeof customers.$inferSelect;

export interface Ctx<B> {
  /** Tenant resuelto por x-bridge-token. Todo el scoping cuelga de aquí. */
  tenant: Tenant;
  customer: Customer;
  body: B;
  req: NextRequest;
}

/* ---- base body: sub_id OPCIONAL (100% permisivo). Nunca rechazamos por formato:
   si falta el sub_id, se usa un cliente sintético y el endpoint responde igual. ---- */
export const baseSchema = z.object({
  sub_id: z.union([z.string(), z.number()]).transform((v) => String(v)).optional().default(""),
});

/* ---- sanitizador: null/undefined → "" en profundidad ---- */
export function noNulls<T>(value: T): T {
  if (value === null || value === undefined) return "" as unknown as T;
  if (Array.isArray(value)) return value.map((v) => noNulls(v)) as unknown as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = noNulls(v);
    return out as T;
  }
  return value;
}

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  const first = xff.split(",")[0]?.trim() || "";
  return first || req.headers.get("x-real-ip") || "0.0.0.0";
}

/* ---- helpers de dominio ---- */
export async function audit(accion: string, entidad: string, despues: unknown, antes: unknown = null) {
  if (!db) return;
  try {
    await db.insert(auditLog).values({ accion, entidad, antes: antes as object, despues: despues as object });
  } catch {
    /* no romper la respuesta por un fallo de auditoría */
  }
}

export async function logEvent(tipo: string, payload: unknown) {
  if (!db) return;
  try {
    await db.insert(events).values({ tipo, payload: payload as object });
  } catch {
    /* idem */
  }
}

/** Registra un intento de crear-pedido en order_attempts (para NO perder ventas).
 *  Devuelve el id de la fila para actualizarla luego con el resultado. */
export async function logOrderAttempt(
  data: { subId?: string; rawBody?: unknown; rawText?: string; resultado?: string; motivo?: string; ref?: string; tenantId?: string | null },
): Promise<string | null> {
  if (!db) return null;
  try {
    const [row] = await db
      .insert(orderAttempts)
      .values({
        tenantId: data.tenantId || null,
        subId: data.subId || "",
        rawBody: (data.rawBody as object) ?? null,
        rawText: (data.rawText || "").slice(0, 4000),
        resultado: data.resultado || "",
        motivo: (data.motivo || "").slice(0, 500),
        ref: data.ref || "",
      })
      .returning({ id: orderAttempts.id });
    return row?.id || null;
  } catch {
    return null;
  }
}

/** Actualiza el resultado de un intento ya guardado. */
export async function updateOrderAttempt(id: string | null, patch: { resultado?: string; motivo?: string; ref?: string }): Promise<void> {
  if (!db || !id) return;
  try {
    await db.update(orderAttempts).set({
      resultado: patch.resultado, motivo: (patch.motivo || "").slice(0, 500), ref: patch.ref,
    }).where(eq(orderAttempts.id, id));
  } catch { /* noop */ }
}

/** CRM: registra que un cliente vio uno o varios productos (para la etapa "interesado"
 *  y la segmentación por producto de interés). Fail-soft. */
export async function recordInterest(customerId: string, slugs: string[]): Promise<void> {
  if (!db || !customerId || customerId.startsWith("demo-") || !slugs.length) return;
  try {
    const [c] = await db.select({ prev: customers.productosInteres, estado: customers.estado }).from(customers).where(eq(customers.id, customerId)).limit(1);
    const prev = Array.isArray(c?.prev) ? (c!.prev as string[]) : [];
    const merged = Array.from(new Set([...slugs.filter(Boolean), ...prev])).slice(0, 25);
    await db.update(customers).set({
      productosInteres: merged,
      ultimoProductoVisto: slugs[0] || "",
      // si era solo "nuevo", ahora mostró interés
      estado: c?.estado === "cliente" ? "cliente" : "interesado",
    }).where(eq(customers.id, customerId));
  } catch { /* noop */ }
}

/** Extrae pares "clave":valor de un texto que NO es JSON válido (comillas faltantes en
 *  el valor, etc.). Rescata payloads rotos del bot: "items":Combo x 4 tapas, "nombre":Germán… */
export function looseExtract(text: string): Record<string, string> | null {
  const obj: Record<string, string> = {};
  const re = /"([a-zA-Z0-9_]+)"\s*:\s*("(?:[^"\\]|\\.)*"|[^,}\n\r]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let v = m[2].trim();
    if (v.startsWith('"')) { try { v = JSON.parse(v) as string; } catch { v = v.slice(1).replace(/"$/, ""); } }
    else v = v.replace(/[,}\s]+$/, "");
    obj[m[1]] = v;
  }
  return Object.keys(obj).length ? obj : null;
}

/* ---- respuestas ---- */
function ok(data: Record<string, unknown>) {
  return NextResponse.json(noNulls({ ok: true, ...data }));
}
/* Los errores de SISTEMA van SIEMPRE en `error` y NUNCA en `mensaje` (el bot no
   muestra `mensaje` en errores). `mensaje` se deja "" salvo un error de dominio
   (mensaje amable intencional para el cliente, vía domainError). */
function fail(status: number, error: string, mensaje = "") {
  return NextResponse.json({ ok: false, error, mensaje }, { status });
}

/* ---- cliente demo (sin DB) ---- */
function demoCustomer(subId: string): Customer {
  return {
    id: "demo-" + subId,
    tenantId: null,
    uchatSubId: subId,
    nombre: "",
    telefono: "",
    ciudad: "",
    direccion: "",
    canalOrigen: "whatsapp",
    estado: "nuevo",
    notas: "",
    ultimoContacto: new Date(),
    createdAt: new Date(),
  } as Customer;
}

/* ===========================================================
   withBridge — envuelve un handler con toda la cañería.
   handler recibe Ctx y devuelve el objeto de respuesta (sin ok).
   =========================================================== */
export function withBridge<S extends z.ZodTypeAny>(
  schema: S,
  handler: (ctx: Ctx<z.infer<S>>) => Promise<Record<string, unknown>>,
) {
  return async function POST(req: NextRequest) {
    const ruta = (() => { try { return new URL(req.url).pathname; } catch { return ""; } })();
    const esCrearPedido = ruta.endsWith("/crear-pedido");
    // 1) token → tenant (multitenant). El x-bridge-token identifica al tenant.
    //    Sin token válido → 401. En MODO DEMO (sin DB) se usa el tenant por defecto.
    const token = req.headers.get("x-bridge-token") || "";
    let tenant: Tenant;
    if (!db) {
      tenant = await getDefaultTenant(); // demo: tenant sintético Animals Deluxe
    } else {
      const resolved = await resolveTenantByToken(token);
      if (!resolved) {
        await logEvent("bridge_auth_fail", { ruta, tokenPresente: !!token, tokenLen: token.length });
        if (esCrearPedido) await logOrderAttempt({ resultado: "error", motivo: "token_invalido" });
        return fail(401, "invalid_bridge_token", "");
      }
      tenant = resolved;
    }

    // 2) body: leemos el TEXTO CRUDO primero (así un JSON roto queda recuperable).
    const rawText = await req.text().catch(() => "");
    let raw: unknown;
    try {
      raw = JSON.parse(rawText);
    } catch {
      // Reparación tolerante: UChat a veces mete saltos de línea/control sin escapar.
      try {
        raw = JSON.parse(rawText.replace(/[\u0000-\u001F]+/g, " "));
      } catch {
        // Reparación 2: extracción por regex — rescata JSON con COMILLAS FALTANTES
        // (p.ej. "items":Combo x 4 tapas ← bug típico de UChat que perdía la venta).
        const loose = looseExtract(rawText);
        if (loose && loose.sub_id) {
          raw = loose;
        } else {
          await logEvent("bridge_invalid_json", { ruta, rawText: rawText.slice(0, 2000) });
          if (esCrearPedido) await logOrderAttempt({ rawText, resultado: "error", motivo: "json_invalido", tenantId: tenant.id });
          return fail(400, "invalid_json", "");
        }
      }
    }

    // 3) validación (base + propia del endpoint)
    const merged = baseSchema.and(schema);
    const parsed = merged.safeParse(raw);
    if (!parsed.success) {
      const keys = raw && typeof raw === "object" ? Object.keys(raw as object) : [];
      const errores = parsed.error.issues.slice(0, 6).map((i) => `${i.path.join(".")}: ${i.message}`);
      await logEvent("bridge_invalid_body", { ruta, keys, errores });
      if (esCrearPedido) {
        const sid = raw && typeof raw === "object" ? String((raw as Record<string, unknown>).sub_id || "") : "";
        await logOrderAttempt({ subId: sid, rawBody: raw, rawText, resultado: "rejected", motivo: "body_invalido: " + errores.join("; "), tenantId: tenant.id });
      }
      return fail(400, "invalid_body"); // mensaje "" — el error va en `error`, nunca en `mensaje`
    }
    const body = parsed.data as z.infer<S> & { sub_id: string };

    // 4) rate limit
    const ip = clientIp(req);
    if (body.sub_id && await isRateLimited(`${ip}:${body.sub_id}`, Date.now())) {
      return fail(429, "rate_limited");
    }

    // Datos de contacto que el bot PUEDE mandar en CUALQUIER request (nombre/teléfono
    // del contacto de WhatsApp). Si vienen, poblamos el lead automáticamente → así los
    // clientes dejan de aparecer vacíos aunque no se llame registrar_cliente.
    const contacto = (() => {
      const r = (raw ?? {}) as Record<string, unknown>;
      const s = (x: unknown) => (x == null ? "" : String(x)).trim();
      // Normaliza a 57XXXXXXXXXX (quita +, espacios; antepone 57 a un celular colombiano de 10 díg).
      const normTel = (x: unknown) => { let d = s(x).replace(/\D/g, ""); if (d.length === 10 && d.startsWith("3")) d = "57" + d; return d; };
      return {
        // "real": lo que el cliente escribe (sobrescribe). "wa": del perfil de WhatsApp (solo si falta).
        nombreReal: s(r.nombre ?? r.cliente ?? r.nombre_cliente ?? r.user_name ?? r.full_name),
        nombreWa: s(r.nombre_wa ?? r.first_name ?? r.wa_name ?? r.profile_name),
        telReal: normTel(r.telefono ?? r.celular ?? r.whatsapp ?? r.tel),
        telWa: normTel(r.telefono_wa ?? r.phone ?? r.wa_phone),
        ciudad: s(r.ciudad ?? r.municipio),
        direccion: s(r.direccion ?? r.direccion_entrega),
      };
    })();

    // 5) resolver/crear cliente (lead). Sin DB o sin sub_id → cliente sintético
    //    (no persiste, pero el endpoint responde igual: 100% permisivo).
    let customer: Customer;
    if (!db || !body.sub_id) {
      customer = demoCustomer(body.sub_id || "anon");
    } else {
      // Cliente resuelto POR TENANT: el mismo sub_id de WhatsApp puede existir en
      // dos tenants distintos y son leads diferentes.
      const [found] = await db.select().from(customers)
        .where(and(eq(customers.tenantId, tenant.id), eq(customers.uchatSubId, body.sub_id)))
        .limit(1);
      if (found) {
        customer = found;
        const set: Record<string, unknown> = { ultimoContacto: new Date(), interacciones: sql`coalesce(${customers.interacciones},0) + 1` };
        // nombre/teléfono reales sobrescriben; los de WhatsApp solo rellenan si el lead está vacío.
        if (contacto.nombreReal) set.nombre = contacto.nombreReal;
        else if (contacto.nombreWa && !found.nombre) set.nombre = contacto.nombreWa;
        if (contacto.telReal) set.telefono = contacto.telReal;
        else if (contacto.telWa && !found.telefono) set.telefono = contacto.telWa;
        if (contacto.ciudad) set.ciudad = contacto.ciudad;
        if (contacto.direccion) set.direccion = contacto.direccion;
        await db.update(customers).set(set).where(eq(customers.id, found.id));
        customer = { ...found, ...set } as Customer;
      } else {
        const [created] = await db
          .insert(customers)
          .values({ tenantId: tenant.id, uchatSubId: body.sub_id, canalOrigen: "whatsapp", estado: "nuevo", nombre: contacto.nombreReal || contacto.nombreWa, telefono: contacto.telReal || contacto.telWa, ciudad: contacto.ciudad, direccion: contacto.direccion })
          .returning();
        customer = created;
      }
      if (!customer) return fail(500, "customer_error");
    }

    // 6) handler de dominio — corre DENTRO del contexto del tenant (AsyncLocalStorage),
    //    así todas las queries de data.ts/orders.ts filtran por este tenant.
    try {
      const data = await runWithTenant(tenant, () => handler({ tenant, customer, body, req }));
      return ok(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "error";
      if (msg.startsWith("DOMAIN:")) {
        return fail(409, "domain_error", msg.slice(7));
      }
      console.error("withBridge handler error:", err);
      return fail(500, "internal_error");
    }
  };
}

/** Lanza un error de dominio que se devuelve como mensaje amable al cliente. */
export function domainError(mensaje: string): never {
  throw new Error("DOMAIN:" + mensaje);
}
