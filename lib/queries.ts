/* ===========================================================
   Lecturas para el PANEL admin. Drizzle server-side.
   En MODO DEMO (sin DB) devuelve mocks razonables a partir del catálogo.
   =========================================================== */
import { desc, eq, gte, sql, asc, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  products, categories, orders, orderItems, customers, advisors,
  promotions, conversations, storeConfig, integrations, adMap, orderAttempts, mpShipments, configEmpresa, mpAddresses, visits,
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
    .where(sql`estado in ('aprobado','guia','despachado','entregado','confirmado','pagado')`);
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

/* ---------- Analítica: tráfico (visitas) vs ventas por fuente ---------- */
export type FuenteRow = { fuente: string; label: string; visitas: number; pedidos: number; conversion: number };
export type Analytics = {
  visitas30d: number; visitasHoy: number; visitas7d: number;
  pedidosWeb: number; pedidosWhatsapp: number; pedidosTotal: number;
  porFuente: FuenteRow[];
  ventasPorCanal: { canal: string; n: number; total: number }[];
};
const FUENTES: { key: string; label: string }[] = [
  { key: "tienda", label: "Tienda web (/)" }, { key: "gallos", label: "Landing Gallos" },
  { key: "perros", label: "Landing Perros" }, { key: "caballos", label: "Landing Caballos" },
];
export async function getAnalytics(): Promise<Analytics> {
  const empty: Analytics = { visitas30d: 0, visitasHoy: 0, visitas7d: 0, pedidosWeb: 0, pedidosWhatsapp: 0, pedidosTotal: 0, porFuente: FUENTES.map((f) => ({ fuente: f.key, label: f.label, visitas: 0, pedidos: 0, conversion: 0 })), ventasPorCanal: [] };
  if (!db) return empty;
  const d30 = new Date(Date.now() - 30 * 86400_000);
  const d7 = new Date(Date.now() - 7 * 86400_000);
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);

  const [visF, [vHoy], [v7], pedCanal, pedWebF] = await Promise.all([
    db.select({ f: visits.fuente, n: sql<number>`count(*)::int` }).from(visits).where(gte(visits.createdAt, d30)).groupBy(visits.fuente),
    db.select({ n: sql<number>`count(*)::int` }).from(visits).where(gte(visits.createdAt, d0)),
    db.select({ n: sql<number>`count(*)::int` }).from(visits).where(gte(visits.createdAt, d7)),
    db.select({ canal: orders.canal, n: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(total_cop),0)::int` }).from(orders).where(gte(orders.createdAt, d30)).groupBy(orders.canal),
    db.select({ f: orders.fuente, n: sql<number>`count(*)::int` }).from(orders).where(sql`canal = 'web' and created_at > ${d30}`).groupBy(orders.fuente),
  ]);
  const visMap = new Map(visF.map((r) => [r.f || "otro", r.n]));
  const pedWebMap = new Map(pedWebF.map((r) => [(r.f || "tienda"), r.n])); // web sin fuente → tienda
  const porFuente: FuenteRow[] = FUENTES.map((f) => {
    const visitas = visMap.get(f.key) || 0;
    const pedidos = pedWebMap.get(f.key) || 0;
    return { fuente: f.key, label: f.label, visitas, pedidos, conversion: visitas ? Math.round((pedidos / visitas) * 1000) / 10 : 0 };
  });
  const visitas30d = visF.reduce((s, r) => s + r.n, 0);
  const pedidosWeb = pedCanal.filter((r) => r.canal === "web").reduce((s, r) => s + r.n, 0);
  const pedidosWhatsapp = pedCanal.filter((r) => r.canal === "whatsapp").reduce((s, r) => s + r.n, 0);
  const pedidosTotal = pedCanal.reduce((s, r) => s + r.n, 0);
  return {
    visitas30d, visitasHoy: vHoy?.n ?? 0, visitas7d: v7?.n ?? 0,
    pedidosWeb, pedidosWhatsapp, pedidosTotal,
    porFuente,
    ventasPorCanal: pedCanal.map((r) => ({ canal: r.canal || "otro", n: r.n, total: r.total })),
  };
}

/* ---------- Productos (incluye inactivos) ---------- */
export type ProductAdminRow = ProductView & {
  categoryColor: string;
  shopifyProductId: string;
  shopifySync: "synced" | "pending" | "error";
  shopifySyncError: string;
};

export async function listProducts(): Promise<ProductAdminRow[]> {
  if (!db) return demoProducts.map((p) => ({
    ...p, categoryColor: demoCategories.find((c) => c.slug === p.categorySlug)?.color || "#FF4D2E",
    shopifyProductId: "", shopifySync: "pending" as const, shopifySyncError: "",
  }));
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
    image: r.p.image || "", imageUrl: r.p.imageUrl || (r.p.image ? `${SITE}/products/${r.p.image}` : ""),
    badges: (r.p.badges as string[]) || [], tagline: r.p.tagline || "", shortDesc: r.p.shortDesc || "",
    benefits: (r.p.benefits as string[]) || [], ingredients: (r.p.ingredients as ProductView["ingredients"]) || [],
    usage: r.p.usage || "", pitch: r.p.pitch || "", faq: (r.p.faq as ProductView["faq"]) || [],
    keywords: (r.p.keywords as string[]) || [],
    objeciones: (r.p.objeciones as Record<string, string>) || {}, adIds: (r.p.adIds as string[]) || [],
    disclaimer: r.p.disclaimer || "", stock: r.p.stock ?? 999, activo: r.p.activo ?? true,
    envioGratis: r.p.envioGratis ?? false,
    descripcion: r.p.descripcion || "", edadMinima: r.p.edadMinima || "",
    dosificacion: r.p.dosificacion || "", presentacion: r.p.presentacion || "", paraQue: r.p.paraQue || "",
    shopifyProductId: r.p.shopifyProductId || "",
    shopifySync: (r.p.shopifySync as "synced" | "pending" | "error") || "pending",
    shopifySyncError: r.p.shopifySyncError || "",
  }));
}

export async function listCategoriesAdmin() {
  if (!db) return demoCategories;
  return db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
}

/* ---------- Pedidos ---------- */
export type OrderRow = {
  id: string; ref: string; nombre: string; telefono: string; cedula: string; ciudad: string; direccion: string;
  estado: string; canal: string; metodoPago: string; total: number; subtotal: number; envio: number; descuento: number;
  createdAt: Date | null; advisor: string; items: { name: string; presentacion: string; cantidad: number; precio: number }[];
  guia: string; transportadora: string; despachadoAt: Date | null; clienteNotificadoAt: Date | null;
  shopifyOrderId: string; shopifyOrderName: string;
  facturaNumero: number | null;
  // Despacho / MiPaquete
  envioGuia: string; envioStatus: string; envioPdf: string; envioImpreso: boolean; envioFlete: number;
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
    ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids))
    : [];
  const shipments = ids.length ? await db.select().from(mpShipments).where(inArray(mpShipments.orderId, ids)) : [];
  const shipByOrder = new Map(shipments.map((s) => [s.orderId as string, s]));
  return rows.map((r) => ({
    id: r.o.id, ref: r.o.ref, nombre: r.o.nombre || "", telefono: r.o.telefono || "", cedula: r.o.cedula || "",
    ciudad: r.o.ciudad || "", direccion: r.o.direccion || "",
    estado: r.o.estado || "remision", canal: r.o.canal || "whatsapp", metodoPago: r.o.metodoPago || "contraentrega",
    total: r.o.totalCop ?? 0, subtotal: r.o.subtotalCop ?? 0, envio: r.o.envioCop ?? 0, descuento: r.o.descuentoCop ?? 0,
    createdAt: r.o.createdAt, advisor: r.a?.nombre || "",
    items: items.filter((it) => it.orderId === r.o.id).map((it) => ({
      name: it.productName || "", presentacion: it.presentacionLabel || "",
      cantidad: it.cantidad ?? 1, precio: it.precioCop ?? 0,
    })),
    guia: r.o.guia || "", transportadora: r.o.transportadora || "",
    despachadoAt: r.o.despachadoAt ?? null, clienteNotificadoAt: r.o.clienteNotificadoAt ?? null,
    shopifyOrderId: r.o.shopifyOrderId || "", shopifyOrderName: r.o.shopifyOrderName || "",
    facturaNumero: r.o.facturaNumero ?? null,
    envioGuia: shipByOrder.get(r.o.id)?.guideNumber || "",
    envioStatus: shipByOrder.get(r.o.id)?.status || "",
    envioPdf: shipByOrder.get(r.o.id)?.pdfGuideUrl || "",
    envioImpreso: !!shipByOrder.get(r.o.id)?.impreso,
    envioFlete: shipByOrder.get(r.o.id)?.totalCost ?? 0,
  }));
}

/* ---------- Despacho: config de empresa (factura) + bodega ---------- */
export async function getConfigEmpresa() {
  if (!db) return null;
  const [c] = await db.select().from(configEmpresa).limit(1);
  return c || null;
}
export async function getBodegaDefault() {
  if (!db) return null;
  const [b] = await db.select().from(mpAddresses).where(eq(mpAddresses.isDefault, true)).limit(1);
  return b || (await db.select().from(mpAddresses).limit(1))[0] || null;
}

/* ---------- Clientes (leads) ---------- */
export async function listCustomers() {
  if (!db) return [];
  return db.select().from(customers).orderBy(desc(customers.createdAt)).limit(300);
}

/* ---------- CRM: clientes con etapa calculada + productos ---------- */
export type CrmStage = "nuevo" | "pidio_info" | "interesado" | "comprador" | "recompra" | "perdido";
export type CrmRow = {
  id: string; nombre: string; telefono: string; ciudad: string; canal: string;
  etapa: CrmStage; etapaManual: string; notas: string; tags: string[];
  numPedidos: number; totalGastado: number; ultimaCompra: Date | null;
  productosComprados: { slug: string; name: string }[]; // unión (pedidos + manual)
  productosInteres: { slug: string; name: string }[];
  compradosPedidos: { slug: string; name: string }[]; // solo de pedidos (no editable)
  compradosManualSlugs: string[]; // editable a mano
  interesSlugs: string[]; // editable a mano
  interacciones: number; createdAt: Date | null; ultimoContacto: Date | null;
};

export function deriveStage(numPedidos: number, interes: number, interacciones: number, diasSinContacto: number, manual: string): CrmStage {
  if (manual) return manual as CrmStage;
  if (numPedidos >= 2) return "recompra";
  if (numPedidos === 1) return "comprador";
  if (diasSinContacto > 30) return "perdido";
  if (interes > 0) return "interesado";
  if (interacciones > 0) return "pidio_info";
  return "nuevo";
}

export async function listCRM(): Promise<CrmRow[]> {
  if (!db) return [];
  const [custs, prods] = await Promise.all([
    db.select().from(customers).orderBy(desc(customers.ultimoContacto)).limit(2000),
    db.select({ slug: products.slug, name: products.name }).from(products),
  ]);
  const nameOf = new Map(prods.map((p) => [p.slug, p.name]));

  // Agregados de pedidos (no cancelados) por cliente
  const aggs = await db
    .select({ cid: orders.customerId, n: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(total_cop),0)::int`, last: sql<Date>`max(created_at)` })
    .from(orders)
    .where(sql`customer_id is not null and coalesce(estado,'') <> 'cancelado'`)
    .groupBy(orders.customerId);
  const aggMap = new Map(aggs.map((a) => [a.cid as string, a]));

  // Productos comprados por cliente — agregado en Postgres (una fila por cliente).
  const boughtAgg = await db
    .select({ cid: orders.customerId, slugs: sql<string[]>`array_agg(distinct ${orderItems.productSlug})` })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(sql`${orders.customerId} is not null and coalesce(${orders.estado},'') <> 'cancelado'`)
    .groupBy(orders.customerId);
  const boughtMap = new Map<string, string[]>();
  for (const b of boughtAgg) if (b.cid) boughtMap.set(b.cid, (b.slugs || []).filter(Boolean));

  const now = Date.now();
  const resolve = (slugs: string[]) => slugs.filter(Boolean).map((s) => ({ slug: s, name: nameOf.get(s) || s }));
  return custs.map((c) => {
    const a = aggMap.get(c.id);
    const numPedidos = a?.n || 0;
    const compradosOrders = [...(boughtMap.get(c.id) || [])];
    const compradosManual = Array.isArray(c.productosCompradosManual) ? (c.productosCompradosManual as string[]) : [];
    const comprados = Array.from(new Set([...compradosOrders, ...compradosManual]));
    const interes = Array.isArray(c.productosInteres) ? (c.productosInteres as string[]) : [];
    const dias = c.ultimoContacto ? (now - new Date(c.ultimoContacto).getTime()) / 86400_000 : 999;
    // compras manuales también cuentan para la etapa "comprador"
    const pedidosEfect = numPedidos || (compradosManual.length ? 1 : 0);
    const etapa = deriveStage(pedidosEfect, interes.length, c.interacciones || 0, dias, c.etapaManual || "");
    return {
      id: c.id, nombre: c.nombre || "", telefono: c.telefono || "", ciudad: c.ciudad || "",
      canal: c.canalOrigen || "whatsapp", etapa, etapaManual: c.etapaManual || "",
      notas: c.notas || "", tags: Array.isArray(c.tags) ? (c.tags as string[]) : [],
      numPedidos, totalGastado: a?.total || 0, ultimaCompra: a?.last ? new Date(a.last) : null,
      productosComprados: resolve(comprados), productosInteres: resolve(interes),
      compradosPedidos: resolve(compradosOrders), compradosManualSlugs: compradosManual, interesSlugs: interes,
      interacciones: c.interacciones || 0, createdAt: c.createdAt, ultimoContacto: c.ultimoContacto,
    };
  });
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

/* ---------- Intentos de pedido fallidos (rescate de ventas) ---------- */
export type AttemptRow = { id: string; createdAt: Date | null; subId: string; resultado: string; motivo: string; body: Record<string, unknown>; rawText: string };
export async function listFailedAttempts(): Promise<AttemptRow[]> {
  if (!db) return [];
  const rows = await db
    .select()
    .from(orderAttempts)
    .where(sql`coalesce(resultado,'') <> 'created'`)
    .orderBy(desc(orderAttempts.createdAt))
    .limit(100);
  return rows.map((r) => ({
    id: r.id, createdAt: r.createdAt, subId: r.subId || "",
    resultado: r.resultado || "", motivo: r.motivo || "",
    body: (r.rawBody as Record<string, unknown>) || {}, rawText: r.rawText || "",
  }));
}

/* ---------- Anuncios (ad_map: ad_id → producto(s)) — agrupado por ad_id ---------- */
export type AdMapGroup = {
  adId: string;
  nombreAnuncio: string;
  activo: boolean;
  productos: { slug: string; name: string }[];
};
export async function listAdMap(): Promise<AdMapGroup[]> {
  if (!db) return [];
  const rows = await db
    .select({ a: adMap, pName: products.name })
    .from(adMap)
    .leftJoin(products, eq(adMap.productSlug, products.slug))
    .orderBy(asc(adMap.adId), asc(adMap.orden));
  const byAd = new Map<string, AdMapGroup>();
  for (const r of rows) {
    let g = byAd.get(r.a.adId);
    if (!g) {
      g = { adId: r.a.adId, nombreAnuncio: r.a.nombreAnuncio || "", activo: r.a.activo ?? true, productos: [] };
      byAd.set(r.a.adId, g);
    }
    g.productos.push({ slug: r.a.productSlug, name: r.pName || `${r.a.productSlug} (no está en el catálogo)` });
  }
  return [...byAd.values()];
}
