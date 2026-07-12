/* ===========================================================
   Multitenant · resolución y contexto de tenant.
   - resolveTenantByToken: x-bridge-token → fila de `tenants` (activo=true)
   - AsyncLocalStorage: guarda el tenant actual por request. Las funciones de
     `data.ts`/`orders.ts` lo leen con currentTenant()/currentTenantId() y filtran
     por tenant_id. Sin contexto (web pública de Animals Deluxe) cae al tenant por
     defecto (DEFAULT_TENANT_SLUG), así el storefront queda EXACTAMENTE igual.
   =========================================================== */
import { AsyncLocalStorage } from "node:async_hooks";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { tenants } from "@/lib/db/schema";
import { safeEqual } from "@/lib/crypto";

export type Tenant = typeof tenants.$inferSelect;

/** Slug del tenant "dueño" de la plataforma (web pública + modo demo). */
export const DEFAULT_TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG || "animals-deluxe";

const store = new AsyncLocalStorage<Tenant>();

/** Ejecuta `fn` con `tenant` como tenant actual (para todo lo que corra dentro). */
export function runWithTenant<T>(tenant: Tenant, fn: () => T): T {
  return store.run(tenant, fn);
}

/** Lectura SÍNCRONA del tenant del request (para código no-async como present.ts).
 *  undefined fuera de un runWithTenant (web pública) → el caller asume contra entrega. */
export function peekTenant(): Tenant | undefined {
  return store.getStore();
}

/* --- caché en memoria del tenant por defecto (evita un SELECT por request en la web) --- */
let defaultCache: { at: number; tenant: Tenant | null } = { at: 0, tenant: null };

/** Tenant por defecto (Animals Deluxe). En modo demo (sin DB) devuelve un tenant sintético. */
export async function getDefaultTenant(): Promise<Tenant> {
  if (!db) return demoTenant();
  const fresh = Date.now() - defaultCache.at < 60_000;
  if (fresh && defaultCache.tenant) return defaultCache.tenant;
  const [row] = await db.select().from(tenants).where(eq(tenants.slug, DEFAULT_TENANT_SLUG)).limit(1);
  const tenant = row || demoTenant();
  defaultCache = { at: Date.now(), tenant: row ? tenant : null };
  return tenant;
}

/** Tenant actual del request (ALS) o el por defecto. Úsalo en las queries. */
export async function currentTenant(): Promise<Tenant> {
  return store.getStore() ?? (await getDefaultTenant());
}

/** id del tenant actual (o null en modo demo/sintético). */
export async function currentTenantId(): Promise<string | null> {
  const t = await currentTenant();
  return t.id?.startsWith("demo-") ? null : t.id;
}

/** Resuelve el tenant por su bridge_token (comparación en tiempo constante).
 *  Devuelve null si el token no corresponde a ningún tenant activo. */
export async function resolveTenantByToken(token: string): Promise<Tenant | null> {
  if (!token || !db) return null;
  // Traemos solo tenants activos y comparamos con safeEqual (evita timing attacks y
  // el problema de igualdad exacta en SQL no es constante — igual filtramos por activo).
  const rows = await db.select().from(tenants).where(eq(tenants.activo, true));
  for (const t of rows) {
    if (t.bridgeToken && safeEqual(token, t.bridgeToken)) return t;
  }
  return null;
}

/** Tenant sintético para MODO DEMO (sin DB). */
function demoTenant(): Tenant {
  return {
    id: "demo-tenant",
    slug: DEFAULT_TENANT_SLUG,
    nombre: "Animals Deluxe",
    bridgeToken: "",
    paymentMode: "contra_entrega",
    cuentasPago: "",
    asesorWa: process.env.NEXT_PUBLIC_WHATSAPP || "",
    fleteModo: "fijo",
    fleteValor: 0,
    activo: true,
    createdAt: new Date(),
  } as Tenant;
}
