/* ===========================================================
   Lecturas para el PANEL admin. Drizzle server-side.
   En MODO DEMO (sin DB) devuelve mocks razonables a partir del catálogo.
   =========================================================== */
import { desc, eq, gte, lt, sql, asc, inArray, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  products, categories, orders, orderItems, customers, advisors,
  promotions, conversations, storeConfig, integrations, adMap, orderAttempts, mpShipments, configEmpresa, mpAddresses, visits,
} from "@/lib/db/schema";
import { demoProducts, demoCategories } from "@/lib/demo-data";
import { getPanelTenantId } from "@/lib/tenant-panel";
import type { ProductView } from "@/lib/ai/types";

/* ---------- Dashboard ---------- */
export type DashboardKpis = {
  rangoLabel: string;         // etiqueta del rango elegido (Hoy, Ayer, …)
  pedidosHoy: number;         // pedidos DEL RANGO (sin cancelados)
  pedidosSemana: number;      // comparativo: últimos 7 días (sin cancelados)
  ventasHoyCop: number;       // $ de los pedidos DEL RANGO (sin cancelados)
  ingresosCop: number;        // $ entregados/pagados DEL RANGO
  aRecaudarCop: number;       // $ de contra entrega en camino (aún no entregado, vivo)
  leadsNuevos: number;        // leads nuevos DEL RANGO
  conversionPct: number;      // pedidos DEL RANGO / leads DEL RANGO * 100 (1 decimal)
  pedidosWhatsapp: number;    // pedidos DEL RANGO con canal = whatsapp
  ventasWhatsappCop: number;  // $ DEL RANGO por whatsapp
  whatsappPct: number;        // % de las VENTAS ($) que entró por whatsapp (1 decimal)
  porCanal: { canal: string; label: string; n: number; monto: number }[]; // reparto del rango
  porEstado: { estado: string; label: string; n: number; monto: number }[]; // pipeline
  topProductos: { name: string; cantidad: number }[];
  ultimosPedidos: { ref: string; nombre: string; total: number; estado: string; createdAt: string | null; canal: string }[];
};

/** Rango [from, to) para el dashboard, calculado en hora de Colombia (UTC-5). */
export function rangoFechas(range: string, fromISO?: string, toISO?: string): { from: Date; to: Date; label: string } {
  const OFF = 5 * 3600_000; // Colombia = UTC-5
  const col = (d: Date) => new Date(d.getTime() - OFF); // instante real → "hora Colombia como UTC"
  const utc = (d: Date) => new Date(d.getTime() + OFF); // vuelta a instante real
  const colMidnight = (daysAgo: number) => { const c = col(new Date()); c.setUTCHours(0, 0, 0, 0); c.setUTCDate(c.getUTCDate() - daysAgo); return utc(c); };
  const now = new Date();
  switch (range) {
    case "ayer": return { from: colMidnight(1), to: colMidnight(0), label: "Ayer" };
    case "semana": return { from: colMidnight(6), to: now, label: "Últimos 7 días" };
    case "mes": { const c = col(new Date()); c.setUTCDate(1); c.setUTCHours(0, 0, 0, 0); return { from: utc(c), to: now, label: "Este mes" }; }
    case "30d": return { from: colMidnight(29), to: now, label: "Últimos 30 días" };
    case "custom": {
      const f = fromISO ? new Date(fromISO + "T00:00:00-05:00") : colMidnight(0);
      const t = toISO ? new Date(toISO + "T23:59:59-05:00") : now;
      return { from: f, to: t, label: fromISO ? `${fromISO}${toISO && toISO !== fromISO ? " → " + toISO : ""}` : "Personalizado" };
    }
    default: return { from: colMidnight(0), to: now, label: "Hoy" };
  }
}

export async function getDashboard(range: string = "hoy", fromISO?: string, toISO?: string): Promise<DashboardKpis> {
  const EST_LABEL: Record<string, string> = { remision: "Remisión", aprobado: "Orden de venta", guia: "Con guía", despachado: "Despachado", entregado: "Entregado", cancelado: "Cancelado" };
  const EST_ORDER = ["remision", "aprobado", "guia", "despachado", "entregado"];
  const { from, to, label } = rangoFechas(range, fromISO, toISO);
  if (!db) {
    return {
      rangoLabel: label, pedidosHoy: 0, pedidosSemana: 0, ventasHoyCop: 0, ingresosCop: 0, aRecaudarCop: 0,
      leadsNuevos: 0, conversionPct: 0,
      pedidosWhatsapp: 0, ventasWhatsappCop: 0, whatsappPct: 0, porCanal: [],
      porEstado: EST_ORDER.map((e) => ({ estado: e, label: EST_LABEL[e], n: 0, monto: 0 })),
      topProductos: demoProducts.slice(0, 5).map((p) => ({ name: p.name, cantidad: 0 })),
      ultimosPedidos: [],
    };
  }
  const tid = (await getPanelTenantId())!;
  const startWeek = new Date(Date.now() - 7 * 86400_000);
  const noCancel = sql`coalesce(estado,'') <> 'cancelado'`;
  const enRango = and(gte(orders.createdAt, from), lt(orders.createdAt, to), noCancel);

  // Todas en PARALELO.
  const [[hoy], [sem], [ing], [rec], [leads], canales, estados, top, ult] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int`, s: sql<number>`coalesce(sum(total_cop),0)::int` }).from(orders).where(and(eq(orders.tenantId, tid), enRango)),
    db.select({ n: sql<number>`count(*)::int` }).from(orders).where(and(eq(orders.tenantId, tid), gte(orders.createdAt, startWeek), noCancel)),
    db.select({ s: sql<number>`coalesce(sum(total_cop),0)::int` }).from(orders).where(and(eq(orders.tenantId, tid), gte(orders.createdAt, from), lt(orders.createdAt, to), sql`estado in ('entregado','pagado','confirmado')`)),
    db.select({ s: sql<number>`coalesce(sum(total_cop),0)::int` }).from(orders).where(and(eq(orders.tenantId, tid), sql`estado in ('aprobado','guia','despachado') and coalesce(metodo_pago,'contraentrega') <> 'anticipado'`)),
    db.select({ n: sql<number>`count(*)::int` }).from(customers).where(and(eq(customers.tenantId, tid), gte(customers.createdAt, from), lt(customers.createdAt, to))),
    // Reparto por CANAL del rango. `canal` es confiable: la web escribe "web",
    // el panel "asesor" y el bot "whatsapp" (default sólo si el bot no lo manda).
    db.select({
      canal: sql<string>`coalesce(nullif(${orders.canal},''),'whatsapp')`,
      n: sql<number>`count(*)::int`,
      monto: sql<number>`coalesce(sum(total_cop),0)::int`,
    }).from(orders).where(and(eq(orders.tenantId, tid), enRango)).groupBy(sql`1`),
    db.select({ estado: orders.estado, n: sql<number>`count(*)::int`, monto: sql<number>`coalesce(sum(total_cop),0)::int` }).from(orders).where(and(eq(orders.tenantId, tid), noCancel)).groupBy(orders.estado),
    db.select({ name: orderItems.productName, cantidad: sql<number>`sum(cantidad)::int` }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).where(and(eq(orderItems.tenantId, tid), enRango)).groupBy(orderItems.productName).orderBy(sql`sum(cantidad) desc`).limit(7),
    db.select({ ref: orders.ref, nombre: orders.nombre, total: orders.totalCop, estado: orders.estado, createdAt: orders.createdAt, canal: orders.canal }).from(orders).where(eq(orders.tenantId, tid)).orderBy(desc(orders.createdAt)).limit(8),
  ]);

  const estMap = new Map(estados.map((e) => [e.estado || "", e]));
  const nLeads = leads?.n ?? 0;
  const nPedidos = hoy?.n ?? 0;
  const totalVentas = hoy?.s ?? 0;

  const CANAL_LABEL: Record<string, string> = { whatsapp: "WhatsApp", messenger: "Messenger", web: "Página web", asesor: "Asesor" };
  const wpp = canales.find((c) => c.canal === "whatsapp");
  const nWpp = wpp?.n ?? 0;
  const sWpp = wpp?.monto ?? 0;

  return {
    rangoLabel: label,
    pedidosHoy: hoy?.n ?? 0,
    pedidosSemana: sem?.n ?? 0,
    ventasHoyCop: hoy?.s ?? 0,
    ingresosCop: ing?.s ?? 0,
    aRecaudarCop: rec?.s ?? 0,
    leadsNuevos: nLeads,
    // Conversión OPERATIVA del rango: TODOS los pedidos del rango sobre los leads
    // del rango. Cuenta la venta de hoy aunque el cliente haya escrito ayer — que
    // es como el dueño lee el número ("hoy van 19 ventas"). Puede pasar del 100%
    // si compran más clientes viejos que leads nuevos entraron.
    conversionPct: nLeads ? Math.round((nPedidos / nLeads) * 1000) / 10 : 0,
    pedidosWhatsapp: nWpp,
    ventasWhatsappCop: sWpp,
    // % sobre el DINERO, no sobre el conteo (es "porcentaje de las ventas").
    whatsappPct: totalVentas ? Math.round((sWpp / totalVentas) * 1000) / 10 : 0,
    porCanal: canales
      .map((c) => ({ canal: c.canal, label: CANAL_LABEL[c.canal] || c.canal, n: c.n, monto: c.monto }))
      .sort((a, b) => b.monto - a.monto),
    porEstado: EST_ORDER.map((e) => ({ estado: e, label: EST_LABEL[e], n: estMap.get(e)?.n ?? 0, monto: estMap.get(e)?.monto ?? 0 })),
    topProductos: top.map((t) => ({ name: t.name || "—", cantidad: t.cantidad ?? 0 })),
    ultimosPedidos: ult.map((o) => ({ ref: o.ref, nombre: o.nombre || "—", total: o.total ?? 0, estado: o.estado || "", createdAt: o.createdAt ? o.createdAt.toISOString() : null, canal: o.canal || "whatsapp" })),
  };
}

/* ---------- Analítica: tráfico (visitas) vs ventas por fuente ---------- */
export type FuenteRow = { fuente: string; label: string; visitas: number; pedidos: number; conversion: number };
export type Analytics = {
  visitas30d: number; visitasHoy: number; visitas7d: number;
  visitantes30d: number; visitantesHoy: number;
  pedidosWeb: number; pedidosWhatsapp: number; pedidosTotal: number;
  porFuente: FuenteRow[];
  ventasPorCanal: { canal: string; n: number; total: number }[];
  origenes: { origen: string; visitas: number }[];
};
function clasificarOrigen(ref: string, utm: string): string {
  const s = (ref + " " + utm).toLowerCase();
  if (/facebook|fb\.|m\.face|fbclid/.test(s)) return "Facebook";
  if (/instagram|ig\b|insta/.test(s)) return "Instagram";
  if (/tiktok/.test(s)) return "TikTok";
  if (/google|goog/.test(s)) return "Google";
  if (/whatsapp|wa\.me|whats/.test(s)) return "WhatsApp";
  if (/t\.co|twitter|x\.com/.test(s)) return "X/Twitter";
  if (!ref.trim() && !utm.trim()) return "Directo";
  return "Otro";
}
const FUENTES: { key: string; label: string }[] = [
  { key: "tienda", label: "Tienda web (/)" }, { key: "gallos", label: "Landing Gallos" },
  { key: "perros", label: "Landing Perros" }, { key: "caballos", label: "Landing Caballos" },
];
export async function getAnalytics(): Promise<Analytics> {
  const empty: Analytics = { visitas30d: 0, visitasHoy: 0, visitas7d: 0, visitantes30d: 0, visitantesHoy: 0, pedidosWeb: 0, pedidosWhatsapp: 0, pedidosTotal: 0, porFuente: FUENTES.map((f) => ({ fuente: f.key, label: f.label, visitas: 0, pedidos: 0, conversion: 0 })), ventasPorCanal: [], origenes: [] };
  if (!db) return empty;
  const tid = (await getPanelTenantId())!;
  const d30 = new Date(Date.now() - 30 * 86400_000);
  const d7 = new Date(Date.now() - 7 * 86400_000);
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);

  const [visF, [vHoy], [v7], [uniq], [uniqHoy], pedCanal, pedWebF, origRows] = await Promise.all([
    db.select({ f: visits.fuente, n: sql<number>`count(*)::int` }).from(visits).where(gte(visits.createdAt, d30)).groupBy(visits.fuente),
    db.select({ n: sql<number>`count(*)::int` }).from(visits).where(gte(visits.createdAt, d0)),
    db.select({ n: sql<number>`count(*)::int` }).from(visits).where(gte(visits.createdAt, d7)),
    db.select({ n: sql<number>`count(distinct session_id)::int` }).from(visits).where(gte(visits.createdAt, d30)),
    db.select({ n: sql<number>`count(distinct session_id)::int` }).from(visits).where(gte(visits.createdAt, d0)),
    db.select({ canal: orders.canal, n: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(total_cop),0)::int` }).from(orders).where(and(eq(orders.tenantId, tid), gte(orders.createdAt, d30))).groupBy(orders.canal),
    db.select({ f: orders.fuente, n: sql<number>`count(*)::int` }).from(orders).where(and(eq(orders.tenantId, tid), eq(orders.canal, "web"), gte(orders.createdAt, d30))).groupBy(orders.fuente),
    db.select({ ref: visits.referrer, utm: visits.utmSource, n: sql<number>`count(*)::int` }).from(visits).where(gte(visits.createdAt, d30)).groupBy(visits.referrer, visits.utmSource),
  ]);
  const origMap = new Map<string, number>();
  for (const r of origRows) { const o = clasificarOrigen(r.ref || "", r.utm || ""); origMap.set(o, (origMap.get(o) || 0) + r.n); }
  const origenes = [...origMap.entries()].map(([origen, visitas]) => ({ origen, visitas })).sort((a, b) => b.visitas - a.visitas);
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
    visitantes30d: uniq?.n ?? 0, visitantesHoy: uniqHoy?.n ?? 0,
    pedidosWeb, pedidosWhatsapp, pedidosTotal,
    porFuente,
    ventasPorCanal: pedCanal.map((r) => ({ canal: r.canal || "otro", n: r.n, total: r.total })),
    origenes,
  };
}

/* ---------- Productos (incluye inactivos) ---------- */
export type ProductAdminRow = ProductView & {
  categoryColor: string;
  shopifyProductId: string;
  shopifySync: "synced" | "pending" | "error";
  shopifySyncError: string;
  pesoGr: number; altoCm: number; anchoCm: number; largoCm: number;
};

export async function listProducts(): Promise<ProductAdminRow[]> {
  if (!db) return demoProducts.map((p) => ({
    ...p, categoryColor: demoCategories.find((c) => c.slug === p.categorySlug)?.color || "#FF4D2E",
    shopifyProductId: "", shopifySync: "pending" as const, shopifySyncError: "",
    pesoGr: 1000, altoCm: 15, anchoCm: 12, largoCm: 8,
  }));
  const tid = (await getPanelTenantId())!;
  const rows = await db
    .select({ p: products, c: categories })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.tenantId, tid))
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
    pesoGr: r.p.pesoGr ?? 1000, altoCm: r.p.altoCm ?? 15, anchoCm: r.p.anchoCm ?? 12, largoCm: r.p.largoCm ?? 8,
  }));
}

export async function listCategoriesAdmin() {
  if (!db) return demoCategories;
  const tid = (await getPanelTenantId())!;
  return db.select().from(categories).where(eq(categories.tenantId, tid)).orderBy(asc(categories.sortOrder), asc(categories.name));
}

/* ---------- Pedidos ---------- */
export type OrderRow = {
  id: string; ref: string; nombre: string; telefono: string; cedula: string; ciudad: string; direccion: string;
  estado: string; canal: string; metodoPago: string; total: number; subtotal: number; envio: number; descuento: number;
  createdAt: Date | null; advisor: string; items: { name: string; presentacion: string; cantidad: number; precio: number }[];
  guia: string; transportadora: string; despachadoAt: Date | null; clienteNotificadoAt: Date | null; copiadoAt: Date | null;
  shopifyOrderId: string; shopifyOrderName: string;
  facturaNumero: number | null;
  // Despacho / MiPaquete
  envioGuia: string; envioStatus: string; envioPdf: string; envioImpreso: boolean; envioFlete: number;
};

/** Ventana por defecto del panel. El board filtra en el cliente (hoy/ayer/todos +
 *  buscador), así que la ventana tiene que ser MUY superior al volumen del mes:
 *  con el tope viejo de 200 los pedidos más antiguos no aparecían ni buscando por
 *  cédula o referencia, y los totales de "Todos" salían cortados. */
export const ORDERS_PAGE = 500;

/** Total de pedidos del tenant (para saber si la ventana se quedó corta). */
export async function countOrders(): Promise<number> {
  if (!db) return 0;
  const tid = (await getPanelTenantId())!;
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(orders).where(eq(orders.tenantId, tid));
  return r?.n ?? 0;
}

export async function listOrders(opts: { limit?: number; refs?: string[] } = {}): Promise<OrderRow[]> {
  if (!db) return [];
  const tid = (await getPanelTenantId())!;
  // Clamp: nunca 0/negativo, y techo duro para no reventar la página por un ?limit= absurdo.
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? ORDERS_PAGE), 1), 20_000);
  // `refs`: trae EXACTAMENTE esas referencias sin depender de la ventana (lo usa
  // la impresión de facturas/guías, que antes no encontraba un pedido viejo
  // porque quedaba fuera del tope y salía en blanco).
  const refs = (opts.refs || []).map((r) => r.trim().toUpperCase()).filter(Boolean);
  if (opts.refs && !refs.length) return [];
  const where = refs.length
    ? and(eq(orders.tenantId, tid), inArray(orders.ref, refs))
    : eq(orders.tenantId, tid);
  const rows = await db
    .select({ o: orders, a: advisors })
    .from(orders)
    .leftJoin(advisors, eq(orders.advisorId, advisors.id))
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(refs.length ? Math.max(refs.length, 1) : limit);
  const ids = rows.map((r) => r.o.id);
  const [items, shipments] = ids.length
    ? await Promise.all([
        db.select().from(orderItems).where(and(eq(orderItems.tenantId, tid), inArray(orderItems.orderId, ids))),
        db.select().from(mpShipments).where(inArray(mpShipments.orderId, ids)),
      ])
    : [[], []];
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
    despachadoAt: r.o.despachadoAt ?? null, clienteNotificadoAt: r.o.clienteNotificadoAt ?? null, copiadoAt: r.o.copiadoWppAt ?? null,
    shopifyOrderId: r.o.shopifyOrderId || "", shopifyOrderName: r.o.shopifyOrderName || "",
    facturaNumero: r.o.facturaNumero ?? null,
    envioGuia: shipByOrder.get(r.o.id)?.guideNumber || "",
    envioStatus: shipByOrder.get(r.o.id)?.status || "",
    envioPdf: shipByOrder.get(r.o.id)?.pdfGuideUrl || "",
    envioImpreso: !!shipByOrder.get(r.o.id)?.impreso,
    envioFlete: shipByOrder.get(r.o.id)?.totalCost ?? 0,
  }));
}

export type OrderDetail = {
  id: string; ref: string; nombre: string; telefono: string; cedula: string; ciudad: string; direccion: string;
  estado: string; canal: string; metodoPago: string; notas: string;
  subtotal: number; envio: number; descuento: number; total: number;
  createdAt: string | null; facturaNumero: number | null;
  items: { id: string; slug: string; name: string; presentacion: string; cantidad: number; precio: number; pesoGr: number; altoCm: number; anchoCm: number; largoCm: number }[];
  envioGuia: string; envioStatus: string; envioPdf: string; envioTransportadora: string; envioFlete: number; envioImpreso: boolean;
};

export async function getOrderDetail(id: string): Promise<OrderDetail | null> {
  if (!db || !id) return null;
  const tid = (await getPanelTenantId())!;
  const [o] = await db.select().from(orders).where(and(eq(orders.tenantId, tid), eq(orders.id, id))).limit(1);
  if (!o) return null;
  const [items, ship] = await Promise.all([
    db.select({ it: orderItems, p: products }).from(orderItems).leftJoin(products, eq(orderItems.productSlug, products.slug)).where(and(eq(orderItems.tenantId, tid), eq(orderItems.orderId, id))),
    db.select().from(mpShipments).where(eq(mpShipments.orderId, id)).limit(1),
  ]);
  const s = ship[0];
  return {
    id: o.id, ref: o.ref, nombre: o.nombre || "", telefono: o.telefono || "", cedula: o.cedula || "",
    ciudad: o.ciudad || "", direccion: o.direccion || "", estado: o.estado || "remision",
    canal: o.canal || "whatsapp", metodoPago: o.metodoPago || "contraentrega", notas: o.notas || "",
    subtotal: o.subtotalCop ?? 0, envio: o.envioCop ?? 0, descuento: o.descuentoCop ?? 0, total: o.totalCop ?? 0,
    createdAt: o.createdAt ? o.createdAt.toISOString() : null, facturaNumero: o.facturaNumero,
    items: items.map((r) => ({
      id: r.it.id, slug: r.it.productSlug || "", name: r.it.productName || "", presentacion: r.it.presentacionLabel || "",
      cantidad: r.it.cantidad ?? 1, precio: r.it.precioCop ?? 0,
      pesoGr: r.p?.pesoGr ?? 1000, altoCm: r.p?.altoCm ?? 15, anchoCm: r.p?.anchoCm ?? 12, largoCm: r.p?.largoCm ?? 8,
    })),
    envioGuia: s?.guideNumber || "", envioStatus: s?.status || "", envioPdf: s?.pdfGuideUrl || "",
    envioTransportadora: s?.deliveryCompany || "", envioFlete: s?.totalCost ?? 0, envioImpreso: !!s?.impreso,
  };
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
  const tid = (await getPanelTenantId())!;
  return db.select().from(customers).where(eq(customers.tenantId, tid)).orderBy(desc(customers.createdAt)).limit(300);
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
  const tid = (await getPanelTenantId())!;
  // 4 consultas en PARALELO (antes en fila).
  const [custs, prods, aggs, boughtAgg] = await Promise.all([
    db.select().from(customers).where(eq(customers.tenantId, tid)).orderBy(desc(customers.ultimoContacto)).limit(2000),
    db.select({ slug: products.slug, name: products.name }).from(products).where(eq(products.tenantId, tid)),
    db.select({ cid: orders.customerId, n: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(total_cop),0)::int`, last: sql<Date>`max(created_at)` })
      .from(orders).where(and(eq(orders.tenantId, tid), sql`customer_id is not null and coalesce(estado,'') <> 'cancelado'`)).groupBy(orders.customerId),
    db.select({ cid: orders.customerId, slugs: sql<string[]>`array_agg(distinct ${orderItems.productSlug})` })
      .from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(eq(orderItems.tenantId, tid), sql`${orders.customerId} is not null and coalesce(${orders.estado},'') <> 'cancelado'`)).groupBy(orders.customerId),
  ]);
  const nameOf = new Map(prods.map((p) => [p.slug, p.name]));
  const aggMap = new Map(aggs.map((a) => [a.cid as string, a]));
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
  const tid = (await getPanelTenantId())!;
  return db.select().from(promotions).where(eq(promotions.tenantId, tid)).orderBy(asc(promotions.orden), desc(promotions.createdAt));
}

/* ---------- Asesores ---------- */
export async function listAdvisors() {
  if (!db) return [];
  const tid = (await getPanelTenantId())!;
  return db.select().from(advisors).where(eq(advisors.tenantId, tid)).orderBy(asc(advisors.createdAt));
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
  const tid = (await getPanelTenantId())!;
  const rows = await db
    .select()
    .from(orderAttempts)
    .where(and(eq(orderAttempts.tenantId, tid), sql`coalesce(resultado,'') <> 'created'`))
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
  const tid = (await getPanelTenantId())!;
  const rows = await db
    .select({ a: adMap, pName: products.name })
    .from(adMap)
    .leftJoin(products, eq(adMap.productSlug, products.slug))
    .where(eq(adMap.tenantId, tid))
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
