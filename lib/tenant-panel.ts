/* ===========================================================
   Panel · resolución del tenant del usuario logueado.
   El panel usa Drizzle con el rol app_runtime (bypassa RLS), así que el
   aislamiento por tenant se hace en la capa de queries: cada consulta filtra
   por getPanelTenantId(). El usuario → tenant se resuelve por email en
   tenant_users; email NO mapeado → tenant por defecto (Animals Deluxe), así el
   admin actual de AD sigue viendo SOLO su data sin cambios.
   =========================================================== */
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { tenants, tenantUsers } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_TENANT_SLUG } from "@/lib/ai/tenant";

/** id del tenant del usuario del panel (memoizado por request). null en modo demo. */
export const getPanelTenantId = cache(async (): Promise<string | null> => {
  if (!db) return null; // demo: sin filtro (mock data)
  const user = await getCurrentUser();
  const email = (user?.email || "").toLowerCase().trim();
  if (email) {
    const [tu] = await db.select({ tid: tenantUsers.tenantId }).from(tenantUsers).where(eq(tenantUsers.email, email)).limit(1);
    if (tu?.tid) return tu.tid;
  }
  // email no mapeado → tenant por defecto (Animals Deluxe).
  const [def] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, DEFAULT_TENANT_SLUG)).limit(1);
  return def?.id ?? null;
});

/** Tenant completo del usuario del panel (para nombre/payment_mode/branding). */
export const getPanelTenant = cache(async () => {
  if (!db) return null;
  const tid = await getPanelTenantId();
  if (!tid) return null;
  const [t] = await db.select().from(tenants).where(eq(tenants.id, tid)).limit(1);
  return t ?? null;
});
