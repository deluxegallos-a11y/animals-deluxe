/* ===========================================================
   Lookups del catálogo + tienda para los endpoints /api/ai/* y la web.
   Usa Drizzle (server-side). En MODO DEMO (sin DB) cae al catálogo JSON.
   =========================================================== */
import { and, eq, asc, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  products, categories, promotions, coupons, advisors, storeConfig,
  type CiudadCobertura, type CuentaBancaria, type CodFormConfig,
} from "@/lib/db/schema";
import type { ProductView, CategoryView } from "@/lib/ai/types";
import { demoProducts, demoCategories, demoStore } from "@/lib/demo-data";
import { normalize } from "@/lib/ai/format";
import { computeShipping, resolveZonaInfo, tiempoZona, ZONES, ZONE_RATE } from "@/lib/ai/shipping";
import { currentTenantId, currentTenant, DEFAULT_TENANT_SLUG } from "@/lib/ai/tenant";
import { filtrarCatalogo, esBloqueado } from "@/lib/ai/catalog-rules";

type ProdRow = typeof products.$inferSelect;
type CatRow = typeof categories.$inferSelect;

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://animalsdeluxe.com";

function imageUrl(p: ProdRow): string {
  if (p.imageUrl) return p.imageUrl;
  if (p.image && /^https?:\/\//.test(p.image)) return p.image;
  if (p.image) return `${SITE}/products/${p.image}`;
  return "";
}

function toView(p: ProdRow, cat?: CatRow | null): ProductView {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    categoryId: p.categoryId || "",
    categorySlug: cat?.slug || "",
    categoryName: cat?.name || "",
    audience: p.audience || "",
    origin: p.origin || "co",
    priceCOP: p.priceCop || 0,
    presentations: (p.presentations as ProductView["presentations"]) || [],
    image: p.image || "",
    imageUrl: imageUrl(p),
    badges: (p.badges as string[]) || [],
    tagline: p.tagline || "",
    shortDesc: p.shortDesc || "",
    benefits: (p.benefits as string[]) || [],
    ingredients: (p.ingredients as ProductView["ingredients"]) || [],
    usage: p.usage || "",
    pitch: p.pitch || "",
    faq: (p.faq as ProductView["faq"]) || [],
    keywords: (p.keywords as string[]) || [],
    objeciones: (p.objeciones as Record<string, string>) || {}, adIds: (p.adIds as string[]) || [],
    disclaimer: p.disclaimer || "",
    stock: p.stock ?? 999,
    activo: p.activo ?? true,
    envioGratis: p.envioGratis ?? false,
    descripcion: p.descripcion || "",
    edadMinima: p.edadMinima || "",
    dosificacion: p.dosificacion || "",
    presentacion: p.presentacion || "",
    paraQue: p.paraQue || "",
  };
}

/* ---------- Categorías ---------- */
export async function getCategories(): Promise<CategoryView[]> {
  if (!db) return demoCategories;
  const tid = await currentTenantId();
  const rows = await db.select().from(categories)
    .where(eq(categories.tenantId, tid!))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  return rows.map((c) => ({ id: c.id, slug: c.slug, name: c.name, color: c.color || "#FF4D2E" }));
}

/* ---------- Productos ----------
   ÚNICO punto de entrada del catálogo (bot + web). Aquí se aplican las reglas de
   `catalog-rules.ts`: los productos que son SOLO de Rooster Deluxe (anticipado)
   nunca salen del tenant de contra entrega. Filtrar aquí cubre /buscar-producto,
   /catalogo, /recomendar, /producto y /crear-pedido de una sola vez. */
export async function getProducts(opts: { categorySlug?: string; limit?: number } = {}): Promise<ProductView[]> {
  if (!db) {
    let list = filtrarCatalogo(DEFAULT_TENANT_SLUG, demoProducts.filter((p) => p.activo));
    if (opts.categorySlug) list = list.filter((p) => p.categorySlug === opts.categorySlug);
    return opts.limit ? list.slice(0, opts.limit) : list;
  }
  const tenant = await currentTenant();
  const tid = await currentTenantId();
  const rows = await db
    .select({ p: products, c: categories })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.tenantId, tid!), eq(products.activo, true)))
    .orderBy(asc(products.name));
  let list = filtrarCatalogo(tenant.slug, rows.map((r) => toView(r.p, r.c)));
  if (opts.categorySlug) list = list.filter((p) => p.categorySlug === opts.categorySlug);
  return opts.limit ? list.slice(0, opts.limit) : list;
}

export async function getProductBySlug(slug: string): Promise<ProductView | null> {
  if (!slug) return null;
  if (!db) {
    if (esBloqueado(DEFAULT_TENANT_SLUG, slug)) return null;
    return demoProducts.find((p) => p.slug === slug) || null;
  }
  const tenant = await currentTenant();
  // Bloqueado para este tenant → se comporta como si no existiera (ni ficha, ni pedido).
  if (esBloqueado(tenant.slug, slug)) return null;
  const tid = await currentTenantId();
  const [row] = await db
    .select({ p: products, c: categories })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.tenantId, tid!), eq(products.slug, slug)))
    .limit(1);
  return row ? toView(row.p, row.c) : null;
}

/* ---------- Tienda / cobertura ---------- */
export type StoreCfg = {
  nombre: string; whatsapp: string; ciudadBase: string;
  envioDefaultCop: number; ciudadesCobertura: CiudadCobertura[];
  mensajeBienvenida: string; cuentasBancarias: CuentaBancaria[];
  codForm: CodFormConfig;
};

export async function getStoreConfig(): Promise<StoreCfg> {
  if (!db) {
    return {
      nombre: demoStore?.name || "Animals Deluxe",
      whatsapp: process.env.NEXT_PUBLIC_WHATSAPP || demoStore?.whatsapp || "",
      ciudadBase: "Medellín",
      envioDefaultCop: 12000,
      ciudadesCobertura: [],
      mensajeBienvenida: "¡Bienvenido a Animals Deluxe! 🐓 Suplementos premium para tus campeones, contraentrega en toda Colombia.",
      cuentasBancarias: [],
      codForm: {},
    };
  }
  const [row] = await db.select().from(storeConfig).limit(1);
  return {
    nombre: row?.nombre || "Animals Deluxe",
    whatsapp: row?.whatsapp || process.env.NEXT_PUBLIC_WHATSAPP || "",
    ciudadBase: row?.ciudadBase || "",
    envioDefaultCop: row?.envioDefaultCop ?? 12000,
    ciudadesCobertura: (row?.ciudadesCobertura as CiudadCobertura[]) || [],
    mensajeBienvenida: row?.mensajeBienvenida || "",
    cuentasBancarias: (row?.cuentasBancarias as CuentaBancaria[]) || [],
    codForm: (row?.codForm as CodFormConfig) || {},
  };
}

export interface CotizarOpts {
  /** Subtotal de los productos en COP (para sobreflete + recargo contraentrega). */
  subtotalCop?: number;
  /** Total de unidades del pedido (≈1 kg c/u). */
  unidades?: number;
  metodo?: "contraentrega" | "anticipado";
  /** El pedido completo califica a envío gratis. */
  envioGratis?: boolean;
}

export interface CoberturaResult {
  cobertura: boolean; // legacy (alias de cubre)
  cubre: boolean;
  contraentrega: boolean;
  costo_envio: number;
  envio_gratis: boolean;
  zona: string;
  zona_label: string;
  tiempo: string;
  dias_min: number;
  dias_max: number;
  requiere_confirmar: boolean;
  ciudad_encontrada: boolean;
  ciudad: string;
}

/** Cotiza el envío por ciudad usando la tabla de zonas desde Medellín.
    Respeta overrides explícitos del admin (store_config.ciudadesCobertura). */
export async function cotizarEnvio(ciudad: string, opts: CotizarOpts = {}): Promise<CoberturaResult> {
  const cfg = await getStoreConfig();
  const tenant = await currentTenant();
  const metodo = opts.metodo ?? "contraentrega";

  // FLETE según flete_modo del TENANT:
  //   incluido → $0 (envío gratis)
  //   fijo     → flete_valor fijo
  //   por_ciudad → fórmula por zona desde la ciudad base (comportamiento Animals Deluxe)
  const zi = resolveZonaInfo(ciudad || cfg.ciudadBase);
  if (tenant.fleteModo === "incluido" || opts.envioGratis) {
    return {
      cobertura: true, cubre: true, contraentrega: metodo === "contraentrega",
      costo_envio: 0, envio_gratis: true,
      zona: zi.zona, zona_label: ZONES[zi.zona].label, tiempo: tiempoZona(zi.zona),
      dias_min: ZONE_RATE[zi.zona].diasMin, dias_max: ZONE_RATE[zi.zona].diasMax,
      requiere_confirmar: ZONE_RATE[zi.zona].confirmar || !zi.encontrada,
      ciudad_encontrada: zi.encontrada,
      ciudad: ciudad || cfg.ciudadBase,
    };
  }
  if (tenant.fleteModo === "fijo") {
    return {
      cobertura: true, cubre: true, contraentrega: metodo === "contraentrega",
      costo_envio: tenant.fleteValor || 0, envio_gratis: (tenant.fleteValor || 0) === 0,
      zona: zi.zona, zona_label: ZONES[zi.zona].label, tiempo: tiempoZona(zi.zona),
      dias_min: ZONE_RATE[zi.zona].diasMin, dias_max: ZONE_RATE[zi.zona].diasMax,
      requiere_confirmar: ZONE_RATE[zi.zona].confirmar || !zi.encontrada,
      ciudad_encontrada: zi.encontrada,
      ciudad: ciudad || cfg.ciudadBase,
    };
  }
  // por_ciudad (default): flete + días por ZONA (Interrapidísimo) desde la ciudad base.
  const s = computeShipping({
    ciudad: ciudad || cfg.ciudadBase,
    subtotalCop: opts.subtotalCop ?? 0,
    unidades: opts.unidades,
    metodo,
    envioGratis: opts.envioGratis,
  });
  return {
    cobertura: true, cubre: true,
    contraentrega: metodo === "contraentrega",
    costo_envio: s.costo_envio,
    envio_gratis: s.envio_gratis,
    zona: s.zona, zona_label: s.zona_label,
    tiempo: s.tiempo,
    dias_min: s.dias_min, dias_max: s.dias_max, requiere_confirmar: s.requiere_confirmar,
    ciudad_encontrada: s.ciudad_encontrada,
    ciudad: ciudad || cfg.ciudadBase,
  };
}

/** Compat: resuelve cobertura por ciudad (sin contexto de pedido). */
export async function resolveCobertura(ciudad: string) {
  return cotizarEnvio(ciudad);
}

export async function envioParaCiudad(ciudad: string): Promise<number> {
  const c = await cotizarEnvio(ciudad);
  return c.costo_envio || 0;
}

/* ---------- Promociones ---------- */
export type PromoView = {
  id: string; titulo: string; descripcion: string; precio_promo: number;
  precio_antes: number; imagen_url: string; slug: string;
};

export async function getActivePromotions(categorySlug?: string): Promise<PromoView[]> {
  if (!db) return [];
  const tid = await currentTenantId();
  const rows = await db
    .select({ pr: promotions, prod: products })
    .from(promotions)
    .leftJoin(products, eq(promotions.productId, products.id))
    .where(and(eq(promotions.tenantId, tid!), eq(promotions.activa, true)))
    .orderBy(asc(promotions.orden));
  return rows
    .map((r) => ({
      id: r.pr.id,
      titulo: r.pr.titulo,
      descripcion: r.pr.descripcion || "",
      precio_promo: r.pr.precioPromoCop ?? 0,
      precio_antes: r.pr.precioAntesCop ?? 0,
      imagen_url: r.pr.imagenUrl || r.prod?.imageUrl || "",
      slug: r.prod?.slug || "",
    }));
}

/* ---------- Cupones ---------- */
export async function validateCoupon(codigo: string) {
  if (!codigo) return null;
  if (!db) return null;
  const tid = await currentTenantId();
  const [c] = await db.select().from(coupons)
    .where(and(eq(coupons.tenantId, tid!), eq(coupons.codigo, codigo.toUpperCase().trim())))
    .limit(1);
  if (!c || !c.activo) return null;
  if (c.vence && new Date(c.vence).getTime() < Date.now()) return null;
  if (c.usosMax != null && (c.usos ?? 0) >= c.usosMax) return null;
  return c;
}

/* ---------- Asesores (round-robin) ---------- */
export async function assignAdvisor() {
  if (!db) return { nombre: "Asesor Animals Deluxe", whatsapp: process.env.NEXT_PUBLIC_WHATSAPP || "" };
  const tid = await currentTenantId();
  const [a] = await db
    .select()
    .from(advisors)
    .where(and(eq(advisors.tenantId, tid!), eq(advisors.activo, true)))
    .orderBy(asc(advisors.pedidosAsignados), asc(advisors.createdAt))
    .limit(1);
  if (!a) return { nombre: "Asesor", whatsapp: process.env.NEXT_PUBLIC_WHATSAPP || "" };
  await db.update(advisors).set({ pedidosAsignados: (a.pedidosAsignados ?? 0) + 1 }).where(eq(advisors.id, a.id));
  return { id: a.id, nombre: a.nombre, whatsapp: a.whatsapp || "" };
}

/* ---------- Cerebro de búsqueda: alias extra (panel/logs) ---------- */
import { productAliases, searchMisses } from "@/lib/db/schema";
import type { AliasEntry } from "@/lib/ai/aliases";

/** Alias adicionales del tenant (los del panel). El catálogo base vive en
 *  lib/ai/aliases.ts; esto permite ampliarlo sin deploy. Fail-soft: si la
 *  tabla no existe todavía, el cerebro sigue con el catálogo en código. */
export async function getExtraAliases(): Promise<AliasEntry[]> {
  if (!db) return [];
  try {
    const tid = await currentTenantId();
    const rows = await db.select().from(productAliases).where(eq(productAliases.tenantId, tid!));
    // Agrupa por (alias, nota) para respetar alias que apuntan a varios productos.
    const byAlias = new Map<string, { slugs: string[]; nota: string }>();
    for (const r of rows) {
      const k = normalize(r.alias);
      if (!k) continue;
      const cur = byAlias.get(k) || { slugs: [], nota: r.nota || "" };
      cur.slugs.push(r.productSlug);
      if (r.nota) cur.nota = r.nota;
      byAlias.set(k, cur);
    }
    return [...byAlias.entries()].map(([alias, v]) => ({
      aliases: [alias], slugs: v.slugs, nota: v.nota || undefined,
    }));
  } catch {
    return [];
  }
}

/** Registra una búsqueda que no resolvió bien (para sacar alias nuevos). */
export async function logSearchMiss(data: {
  query: string; queryNormalizado: string; mejorCandidato?: string; score?: number; status?: string;
}) {
  if (!db) return;
  try {
    const tid = await currentTenantId();
    await db.insert(searchMisses).values({
      tenantId: tid || null,
      query: (data.query || "").slice(0, 500),
      queryNormalizado: (data.queryNormalizado || "").slice(0, 500),
      mejorCandidato: (data.mejorCandidato || "").slice(0, 200),
      score: data.score ?? 0,
      status: data.status || "",
    });
  } catch {
    /* fail-soft: nunca romper una búsqueda por no poder loguear */
  }
}
