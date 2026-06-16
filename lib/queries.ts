/* ===========================================================
   Lecturas para el PANEL admin. Drizzle server-side.
   En MODO DEMO (sin DB) devuelve mocks razonables a partir del catálogo.
   =========================================================== */
import { desc, eq, gte, sql, asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  products, categories, orders, orderItems, customers, advisors,
  promotions, conversations, storeConfig, integrations,
} from "@/lib/db/schema";
import { demoProducts, demoCategories } from "@/lib/demo-data";
import type { ProductView } from "@/lib/ai/types";

/* ---------- Dashboard ---------- */
export type DashboardKpis = {
  pedidosHoy: number;
  pedidosSemana: number;
  ingresosCop: number;
  leadsNuevos: number;
  topProductos: { name: string; cantidad: number }[];
  ultimosPedidos: { ref: string; nombre: string; total: number; estado: string }[];
};

export async function getDashboard(): Promise<DashboardKpis> {
  if (!db) {
    return {
      pedidosHoy: 0,
      pedidosSemana: 0,
      ingresosCop: 0,
      leadsNuevos: 0,
      topProductos: demoProducts.slice(0, 5).map((p) => ({ name: p.name, cantidad: 0 })),
      ultimosPedidos: [],
    };
  }
  const startDay = new Date(); startDay.setHours(0, 0, 0, 0);
  const startWeek = new Date(Date.now() - 7 * 86400_000);

  const [hoy] = await db.select({ n: sql<number>`count(*)::int` }).from(orders).where(gte(orders.createdAt, startDay));
  const [sem] = await db.select({ n: sql<number>`count(*)::int` }).from(orders).where(gte(orders.createdAt, startWeek));
  const [ing] = await db
    .select({ s: sql<number>`coalesce(sum(total_cop),0)::int` })
    .from(orders)
    .where(sql`estado in ('confirmado','despachado','entregado','pagado')`);
  const [leads] = await db.select({ n: sql<number>`count(*)::int` }).from(customers).where(gte(customers.createdAt, startWeek));

  const top = await db
    .select({ name: orderItems.productName, cantidad: sql<number>`sum(cantidad)::int` })
    .from(orderItems)
    .groupBy(orderItems.productName)
    .orderBy(sql`sum(cantidad) desc`)
    .limit(5);

  const ult = await db
    .select({ ref: orders.ref, nombre: orders.nombre, total: orders.totalCop, estado: orders.estado })
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(6);

  return {
    pedidosHoy: hoy?.n ?? 0,
    pedidosSemana: sem?.n ?? 0,
    ingresosCop: ing?.s ?? 0,
    leadsNuevos: leads?.n ?? 0,
    topProductos: top.map((t) => ({ name: t.name || "—", cantidad: t.cantidad ?? 0 })),
    ultimosPedidos: ult.map((o) => ({ ref: o.ref, nombre: o.nombre || "—", total: o.total ?? 0, estado: o.estado || "" })),
  };
}

/* ---------- Productos (incluye inactivos) ---------- */
export async function listProducts(): Promise<(ProductView & { categoryColor: string })[]> {
  if (!db) return demoProducts.map((p) => ({ ...p, categoryColor: demoCategories.find((c) => c.slug === p.categorySlug)?.color || "#FF4D2E" }));
  const rows = await db
    .select({ p: products, c: categories })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .orderBy(asc(products.name));
  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://animalsdeluxe.com";
  return rows.map((r) => ({
    id: r.p.id, slug: r.p.slug, name: r.p.name,
    categoryId: r.p.categoryId || "", categorySlug: r.c?.slug || "", categoryName: r.c?.name || "",
    categoryColor: r.c?.color || "#FF4D2E",
    audience: r.p.audience || "", origin: r.p.origin || "co", priceCOP: r.p.priceCop || 0,
    presentations: (r.p.presentations as ProductView["presentations"]) || [],
    image: r.p.image || "", imageUrl: r.p.imageUrl || (r.p.image ? `${SITE}/img/${r.p.image}` : ""),
    badges: (r.p.badges as string[]) || [], tagline: r.p.tagline || "", shortDesc: r.p.shortDesc || "",
    benefits: (r.p.benefits as string[]) || [], ingredients: (r.p.ingredients as ProductView["ingredients"]) || [],
    usage: r.p.usage || "", pitch: r.p.pitch || "", faq: (r.p.faq as ProductView["faq"]) || [],
    disclaimer: r.p.disclaimer || "", stock: r.p.stock ?? 999, activo: r.p.activo ?? true,
  }));
}

export async function listCategoriesAdmin() {
  if (!db) return demoCategories;
  return db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
}

/* ---------- Pedidos ---------- */
export type OrderRow = {
  id: string; ref: string; nombre: string; telefono: string; ciudad: string; direccion: string;
  estado: string; metodoPago: string; total: number; subtotal: number; envio: number; descuento: number;
  createdAt: Date | null; advisor: string; items: { name: string; presentacion: string; cantidad: number; precio: number }[];
};

export async function listOrders(): Promise<OrderRow[]> {
  if (!db) return [];
  const rows = await db
    .select({ o: orders, a: advisors })
    .from(orders)
    .leftJoin(advisors, eq(orders.advisorId, advisors.id))
    .orderBy(desc(orders.createdAt))
    .limit(200);
  const ids = rows.map((r) => r.o.id);
  const items = ids.length
    ? await db.select().from(orderItems).where(sql`order_id = any(${ids})`)
    : [];
  return rows.map((r) => ({
    id: r.o.id, ref: r.o.ref, nombre: r.o.nombre || "", telefono: r.o.telefono || "",
    ciudad: r.o.ciudad || "", direccion: r.o.direccion || "",
    estado: r.o.estado || "", metodoPago: r.o.metodoPago || "contraentrega",
    total: r.o.totalCop ?? 0, subtotal: r.o.subtotalCop ?? 0, envio: r.o.envioCop ?? 0, descuento: r.o.descuentoCop ?? 0,
    createdAt: r.o.createdAt, advisor: r.a?.nombre || "",
    items: items.filter((it) => it.orderId === r.o.id).map((it) => ({
      name: it.productName || "", presentacion: it.presentacionLabel || "",
      cantidad: it.cantidad ?? 1, precio: it.precioCop ?? 0,
    })),
  }));
}

/* ---------- Clientes (leads) ---------- */
export async function listCustomers() {
  if (!db) return [];
  return db.select().from(customers).orderBy(desc(customers.createdAt)).limit(300);
}

/* ---------- Conversaciones ---------- */
export async function listConversations() {
  if (!db) return [];
  return db
    .select({ c: conversations, cust: customers, adv: advisors })
    .from(conversations)
    .leftJoin(customers, eq(conversations.customerId, customers.id))
    .leftJoin(advisors, eq(conversations.asignadaA, advisors.id))
    .orderBy(desc(conversations.ultimoMensajeAt))
    .limit(100);
}

/* ---------- Promociones ---------- */
export async function listPromotions() {
  if (!db) return [];
  return db.select().from(promotions).orderBy(asc(promotions.orden), desc(promotions.createdAt));
}

/* ---------- Asesores ---------- */
export async function listAdvisors() {
  if (!db) return [];
  return db.select().from(advisors).orderBy(asc(advisors.createdAt));
}

/* ---------- Config / integraciones ---------- */
export async function getStoreConfigRow() {
  if (!db) return null;
  const [row] = await db.select().from(storeConfig).limit(1);
  return row ?? null;
}

export async function listIntegrations() {
  if (!db) return [];
  return db.select().from(integrations);
}
