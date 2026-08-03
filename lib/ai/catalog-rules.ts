/* ===========================================================
   REGLAS DE FILTRO DE CATÁLOGO POR TENANT
   ------------------------------------------------------------
   Los dos tenants comparten mucha marca, pero NO el mismo negocio:
     · animals-deluxe → CONTRA ENTREGA (paga al recibir)
     · rooster-deluxe → ANTICIPADO (paga por adelantado)

   Al sembrar animals-deluxe se colaron productos que son EXCLUSIVOS de
   Rooster Deluxe (mismo precio, misma foto). El bot de Animals los ofrecía
   "contra entrega, pagás al recibir" y eso NO se puede despachar.

   Este módulo es la única fuente de verdad de esos bloqueos. Se aplica en
   `lib/ai/data.ts` (getProducts / getProductBySlug), o sea en el ÚNICO punto por
   donde pasan todos los endpoints del bot (/buscar-producto, /catalogo,
   /recomendar, /producto, /crear-pedido) y la web pública. Bloquear aquí es
   suficiente: no hay que tocar cada ruta.

   Para desbloquear un producto: quítalo de la lista y corre `npm test`.
   =========================================================== */

/** Slugs que un tenant NUNCA debe ofrecer, aunque estén activos en su tabla. */
const BLOQUEADOS_POR_TENANT: Record<string, string[]> = {
  /* Productos SOLO de Rooster Deluxe (anticipado). Se confirmaron uno por uno
     contra las conversaciones de WhatsApp donde el bot los ofreció contra entrega,
     y contra el catálogo de rooster-deluxe (mismo producto, mismo precio):
       red-rooster        $35.000  = rooster-deluxe/red-rooster
       vitapower          $25.000  = rooster-deluxe/vita-power
       plume-king-shampoo $40.000  = rooster-deluxe/shampoo-plume-king
       gallo-purga-plus   $120.000 = rooster-deluxe/gallo-purga
       rooster-xt-impulsor $70.000 (reportado por el dueño, no es de contra entrega)
     NO están aquí Rooster Deluxe Max, Weight Muscle Protein ni Gallo Post
     Recovery: esos SÍ son de contra entrega (confirmado por el dueño). */
  "animals-deluxe": [
    "red-rooster",
    "vitapower",
    "plume-king-shampoo",
    "gallo-purga-plus",
    "rooster-xt-impulsor",
  ],
};

const setCache = new Map<string, Set<string>>();

/** Slugs bloqueados para ese tenant (Set vacío si no hay reglas). */
export function bloqueadosDe(tenantSlug?: string): Set<string> {
  const k = tenantSlug || "";
  let s = setCache.get(k);
  if (!s) {
    s = new Set(BLOQUEADOS_POR_TENANT[k] || []);
    setCache.set(k, s);
  }
  return s;
}

/** ¿Este tenant tiene prohibido ofrecer este producto? */
export function esBloqueado(tenantSlug: string | undefined, slug: string): boolean {
  return bloqueadosDe(tenantSlug).has(slug);
}

/** Quita del catálogo lo que el tenant no puede vender. */
export function filtrarCatalogo<T extends { slug: string }>(tenantSlug: string | undefined, list: T[]): T[] {
  const bloq = bloqueadosDe(tenantSlug);
  return bloq.size ? list.filter((p) => !bloq.has(p.slug)) : list;
}
