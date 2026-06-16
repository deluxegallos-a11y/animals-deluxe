/* ===========================================================
   Lookups del catálogo + tienda para los endpoints /api/ai/* y la web.
   Usa Drizzle (server-side). En MODO DEMO (sin DB) cae al catálogo JSON.
   =========================================================== */
import { and, eq, asc, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  products, categories, promotions, coupons, advisors, storeConfig,
  type CiudadCobertura, type CuentaBancaria,
} from "@/lib/db/schema";
import type { ProductView, CategoryView } from "@/lib/ai/types";
import { demoProducts, demoCategories, demoStore } from "@/lib/demo-data";
import { normalize } from "@/lib/ai/format";

type ProdRow = typeof products.$inferSelect;
type CatRow = typeof categories.$inferSelect;

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://animalsdeluxe.com";

function imageUrl(p: ProdRow): string {
  if (p.imageUrl) return p.imageUrl;
  if (p.image && /^https?:\/\//.test(p.image)) return p.image;
  if (p.image) return `${SITE}/img/${p.image}`;
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
    disclaimer: p.disclaimer || "",
    stock: p.stock ?? 999,
    activo: p.activo ?? true,
  };
}

/* ---------- Categorías ---------- */
export async function getCategories(): Promise<CategoryView[]> {
  if (!db) return demoCategories;
  const rows = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
  return rows.map((c) => ({ id: c.id, slug: c.slug, name: c.name, color: c.color || "#FF4D2E" }));
}

/* ---------- Productos ---------- */
export async function getProducts(opts: { categorySlug?: string; limit?: number } = {}): Promise<ProductView[]> {
  if (!db) {
    let list = demoProducts.filter((p) => p.activo);
    if (opts.categorySlug) list = list.filter((p) => p.categorySlug === opts.categorySlug);
    return opts.limit ? list.slice(0, opts.limit) : list;
  }
  const rows = await db
    .select({ p: products, c: categories })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.activo, true))
    .orderBy(asc(products.name));
  let list = rows.map((r) => toView(r.p, r.c));
  if (opts.categorySlug) list = list.filter((p) => p.categorySlug === opts.categorySlug);
  return opts.limit ? list.slice(0, opts.limit) : list;
}

export async function getProductBySlug(slug: string): Promise<ProductView | null> {
  if (!slug) return null;
  if (!db) return demoProducts.find((p) => p.slug === slug) || null;
  const [row] = await db
    .select({ p: products, c: categories })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.slug, slug))
    .limit(1);
  return row ? toView(row.p, row.c) : null;
}

/* ---------- Tienda / cobertura ---------- */
export type StoreCfg = {
  nombre: string; whatsapp: string; ciudadBase: string;
  envioDefaultCop: number; ciudadesCobertura: CiudadCobertura[];
  mensajeBienvenida: string; cuentasBancarias: CuentaBancaria[];
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
  };
}

/** Resuelve cobertura/envío por ciudad. */
export async function resolveCobertura(ciudad: string) {
  const cfg = await getStoreConfig();
  const norm = normalize(ciudad);
  const match = cfg.ciudadesCobertura.find((c) => normalize(c.ciudad) && (normalize(c.ciudad).includes(norm) || norm.includes(normalize(c.ciudad))));
  if (match) {
    return { cobertura: true, contraentrega: match.contraentrega, costo_envio: match.costo_envio, ciudad: match.ciudad };
  }
  // sin lista configurada o ciudad no listada → cobertura nacional contraentrega por defecto
  const fallbackNacional = cfg.ciudadesCobertura.length === 0;
  return {
    cobertura: fallbackNacional,
    contraentrega: fallbackNacional,
    costo_envio: cfg.envioDefaultCop,
    ciudad: ciudad || cfg.ciudadBase,
  };
}

export async function envioParaCiudad(ciudad: string): Promise<number> {
  const c = await resolveCobertura(ciudad);
  return c.costo_envio || 0;
}

/* ---------- Promociones ---------- */
export type PromoView = {
  id: string; titulo: string; descripcion: string; precio_promo: number;
  precio_antes: number; imagen_url: string; slug: string;
};

export async function getActivePromotions(categorySlug?: string): Promise<PromoView[]> {
  if (!db) return [];
  const rows = await db
    .select({ pr: promotions, prod: products })
    .from(promotions)
    .leftJoin(products, eq(promotions.productId, products.id))
    .where(eq(promotions.activa, true))
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
  const [c] = await db.select().from(coupons).where(eq(coupons.codigo, codigo.toUpperCase().trim())).limit(1);
  if (!c || !c.activo) return null;
  if (c.vence && new Date(c.vence).getTime() < Date.now()) return null;
  if (c.usosMax != null && (c.usos ?? 0) >= c.usosMax) return null;
  return c;
}

/* ---------- Asesores (round-robin) ---------- */
export async function assignAdvisor() {
  if (!db) return { nombre: "Asesor Animals Deluxe", whatsapp: process.env.NEXT_PUBLIC_WHATSAPP || "" };
  const [a] = await db
    .select()
    .from(advisors)
    .where(eq(advisors.activo, true))
    .orderBy(asc(advisors.pedidosAsignados), asc(advisors.createdAt))
    .limit(1);
  if (!a) return { nombre: "Asesor Animals Deluxe", whatsapp: process.env.NEXT_PUBLIC_WHATSAPP || "" };
  await db.update(advisors).set({ pedidosAsignados: (a.pedidosAsignados ?? 0) + 1 }).where(eq(advisors.id, a.id));
  return { id: a.id, nombre: a.nombre, whatsapp: a.whatsapp || "" };
}
