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
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { customers, auditLog, events, orderAttempts } from "@/lib/db/schema";
import { safeEqual } from "@/lib/crypto";
import { isRateLimited } from "@/lib/ratelimit";

export const runtime = "nodejs";

type Customer = typeof customers.$inferSelect;

export interface Ctx<B> {
  customer: Customer;
  body: B;
  req: NextRequest;
}

/* ---- base body: todo endpoint recibe sub_id (single-tenant: sin uchat_ws) ---- */
export const baseSchema = z.object({
  sub_id: z.union([z.string(), z.number()]).transform((v) => String(v)),
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
  data: { subId?: string; rawBody?: unknown; rawText?: string; resultado?: string; motivo?: string; ref?: string },
): Promise<string | null> {
  if (!db) return null;
  try {
    const [row] = await db
      .insert(orderAttempts)
      .values({
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

/* ---- respuestas ---- */
function ok(data: Record<string, unknown>) {
  return NextResponse.json(noNulls({ ok: true, ...data }));
}
function fail(status: number, error: string, mensaje = "") {
  return NextResponse.json({ ok: false, error, mensaje }, { status });
}

/* ---- cliente demo (sin DB) ---- */
function demoCustomer(subId: string): Customer {
  return {
    id: "demo-" + subId,
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
    // 1) token (tiempo constante)
    const token = req.headers.get("x-bridge-token") || "";
    const expected = process.env.BRIDGE_TOKEN || "";
    // En modo demo (sin BRIDGE_TOKEN configurado) se permite para poder probar local.
    if (expected && !safeEqual(token, expected)) {
      await logEvent("bridge_auth_fail", { ruta, tokenPresente: !!token, tokenLen: token.length });
      if (esCrearPedido) await logOrderAttempt({ resultado: "error", motivo: "token_invalido" });
      return fail(401, "invalid_bridge_token", "");
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
        // No se pudo parsear ni reparar: guardamos el crudo para recuperar la venta.
        await logEvent("bridge_invalid_json", { ruta, rawText: rawText.slice(0, 2000) });
        if (esCrearPedido) await logOrderAttempt({ rawText, resultado: "error", motivo: "json_invalido" });
        return fail(400, "invalid_json", "");
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
        await logOrderAttempt({ subId: sid, rawBody: raw, rawText, resultado: "rejected", motivo: "body_invalido: " + errores.join("; ") });
      }
      return fail(400, "invalid_body", "Faltan datos en la solicitud.");
    }
    const body = parsed.data as z.infer<S> & { sub_id: string };

    // 4) rate limit
    const ip = clientIp(req);
    if (await isRateLimited(`${ip}:${body.sub_id}`, Date.now())) {
      return fail(429, "rate_limited", "Estamos recibiendo muchas solicitudes, intenta en un momento.");
    }

    // Datos de contacto que el bot PUEDE mandar en CUALQUIER request (nombre/teléfono
    // del contacto de WhatsApp). Si vienen, poblamos el lead automáticamente → así los
    // clientes dejan de aparecer vacíos aunque no se llame registrar_cliente.
    const contacto = (() => {
      const r = (raw ?? {}) as Record<string, unknown>;
      const s = (x: unknown) => (x == null ? "" : String(x)).trim();
      // nombre real primero; si no hay, el del perfil de WhatsApp (nombre_wa) como provisional.
      const nombre = s(r.nombre ?? r.cliente ?? r.nombre_cliente ?? r.user_name ?? r.full_name ?? r.first_name) || s(r.nombre_wa ?? r.wa_name ?? r.profile_name);
      return {
        nombre,
        telefono: s(r.telefono ?? r.celular ?? r.whatsapp ?? r.phone ?? r.tel),
        ciudad: s(r.ciudad ?? r.municipio),
        direccion: s(r.direccion ?? r.direccion_entrega),
      };
    })();

    // 5) resolver/crear cliente (lead). En modo demo, cliente sintético.
    let customer: Customer;
    if (!db) {
      customer = demoCustomer(body.sub_id);
    } else {
      const [found] = await db.select().from(customers).where(eq(customers.uchatSubId, body.sub_id)).limit(1);
      if (found) {
        customer = found;
        const set: Record<string, unknown> = { ultimoContacto: new Date() };
        if (contacto.nombre) set.nombre = contacto.nombre;
        if (contacto.telefono) set.telefono = contacto.telefono;
        if (contacto.ciudad) set.ciudad = contacto.ciudad;
        if (contacto.direccion) set.direccion = contacto.direccion;
        await db.update(customers).set(set).where(eq(customers.id, found.id));
        customer = { ...found, ...set } as Customer;
      } else {
        const [created] = await db
          .insert(customers)
          .values({ uchatSubId: body.sub_id, canalOrigen: "whatsapp", estado: "nuevo", nombre: contacto.nombre, telefono: contacto.telefono, ciudad: contacto.ciudad, direccion: contacto.direccion })
          .returning();
        customer = created;
      }
      if (!customer) return fail(500, "customer_error", "Tuvimos un inconveniente, intenta de nuevo.");
    }

    // 6) handler de dominio
    try {
      const data = await handler({ customer, body, req });
      return ok(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "error";
      if (msg.startsWith("DOMAIN:")) {
        return fail(409, "domain_error", msg.slice(7));
      }
      console.error("withBridge handler error:", err);
      return fail(500, "internal_error", "Tuvimos un inconveniente. Intenta de nuevo en un momento.");
    }
  };
}

/** Lanza un error de dominio que se devuelve como mensaje amable al cliente. */
export function domainError(mensaje: string): never {
  throw new Error("DOMAIN:" + mensaje);
}
