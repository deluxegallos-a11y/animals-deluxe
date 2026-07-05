"use server";

/* ============================================================
   Despacho / MiPaquete — acciones del panel.
   Crea guías (individual + masivo), marca impreso, pasa remisión
   a orden de venta y asigna número de factura. Robusto y gated:
   sin token de MiPaquete, la guía queda "pendiente" con costos
   estimados (flete + comisión COD) y se completa al integrar el token.
   ============================================================ */
import { revalidatePath } from "next/cache";
import { eq, inArray, and, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { orders, orderItems, mpShipments, mpAddresses, configEmpresa, products } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { mpBuscarDane, mpCotizar, mpCrearGuia, mpGetSendingInfo, MP_COMPANIES } from "@/lib/mipaquete";

export interface GuiaResult { ok: boolean; ref?: string; guideNumber?: string; status?: string; pending?: boolean; pdfUrl?: string; error?: string }

async function bodegaOrigen() {
  if (!db) return null;
  const [b] = await db.select().from(mpAddresses).where(eq(mpAddresses.isDefault, true)).limit(1);
  return b || (await db.select().from(mpAddresses).limit(1))[0] || null;
}
const soloDig = (s: string) => { const d = (s || "").replace(/\D/g, ""); return d.length > 10 ? d.slice(-10) : d; };

/** Calcula el paquete (peso + dimensiones) del pedido a partir de las dimensiones de cada producto. */
async function paqueteDeOrden(orderId: string): Promise<{ qty: number; pesoKg: number; alto: number; ancho: number; largo: number; items: { name: string; cantidad: number; slug: string }[] }> {
  const its = await db!.select({ slug: orderItems.productSlug, name: orderItems.productName, cantidad: orderItems.cantidad }).from(orderItems).where(eq(orderItems.orderId, orderId));
  const slugs = its.map((i) => i.slug || "").filter(Boolean);
  const dims = slugs.length ? await db!.select({ slug: products.slug, pesoGr: products.pesoGr, altoCm: products.altoCm, anchoCm: products.anchoCm, largoCm: products.largoCm }).from(products).where(inArray(products.slug, slugs)) : [];
  const dmap = new Map(dims.map((d) => [d.slug, d]));
  let pesoGr = 0, alto = 0, ancho = 0, largo = 0, qty = 0;
  for (const it of its) {
    const d = dmap.get(it.slug || "");
    const c = it.cantidad ?? 1; qty += c;
    pesoGr += (d?.pesoGr ?? 1000) * c;
    alto = Math.max(alto, d?.altoCm ?? 15);
    ancho = Math.max(ancho, d?.anchoCm ?? 12);
    largo += (d?.largoCm ?? 8) * c; // se apilan a lo largo
  }
  return {
    qty: qty || 1,
    pesoKg: Math.max(1, Math.ceil(pesoGr / 1000)),
    alto: Math.max(1, alto), ancho: Math.max(1, ancho), largo: Math.max(1, largo),
    items: its.map((i) => ({ name: i.name || "", cantidad: i.cantidad ?? 1, slug: i.slug || "" })),
  };
}

export interface Transportadora { company: string; id: string; flete: number; comision: number; total: number }
/** Cotiza un pedido con MiPaquete → lista de transportadoras para que el asesor elija. */
export async function cotizarPedido(orderId: string): Promise<{ ok: boolean; source?: string; ciudad?: string; sinDane?: boolean; transportadoras?: Transportadora[]; error?: string }> {
  await requireUser();
  if (!db || !orderId) return { ok: false, error: "Sin datos" };
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!o) return { ok: false, error: "Pedido no encontrado" };
  const pkg = await paqueteDeOrden(orderId);
  const bod = await bodegaOrigen();
  const dane = await mpBuscarDane(o.ciudad || "");
  const paymentType = o.metodoPago === "anticipado" ? 101 : 102;
  const declaredValue = o.subtotalCop ?? o.totalCop ?? 0;
  const cot = await mpCotizar({ originDane: bod?.locationCode || "05001000", destinyDane: dane?.code || "", weight: pkg.pesoKg, width: pkg.ancho, height: pkg.alto, length: pkg.largo, declaredValue, paymentType });
  return {
    ok: true, source: cot.source, ciudad: o.ciudad || "", sinDane: !dane,
    transportadoras: cot.cotizaciones.map((c) => ({ company: c.deliveryCompany, id: c.deliveryCompanyId, flete: c.shippingCost, comision: c.collectionCommission, total: c.totalCost })),
  };
}

/** Asigna número de factura estable a un pedido (si no tiene). */
export async function asignarFactura(orderId: string): Promise<{ ok: boolean; numero?: number }> {
  await requireUser();
  if (!db || !orderId) return { ok: false };
  const [o] = await db.select({ n: orders.facturaNumero }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (o?.n) return { ok: true, numero: o.n };
  const [cfg] = await db.select().from(configEmpresa).limit(1);
  const numero = (cfg?.siguienteFactura ?? 1);
  await db.update(orders).set({ facturaNumero: numero }).where(eq(orders.id, orderId));
  await db.update(configEmpresa).set({ siguienteFactura: numero + 1 }).where(eq(configEmpresa.id, cfg?.id || "default"));
  revalidatePath("/pedidos");
  return { ok: true, numero };
}

/** Remisión de venta → Orden de venta (avanza estado). */
export async function pasarAOrdenDeVenta(orderId: string): Promise<{ ok: boolean }> {
  await requireUser();
  if (!db || !orderId) return { ok: false };
  await db.update(orders).set({ estado: "aprobado", updatedAt: new Date() }).where(and(eq(orders.id, orderId), eq(orders.estado, "remision")));
  await asignarFactura(orderId);
  revalidatePath("/pedidos");
  return { ok: true };
}

/** Editar datos del cliente/pedido desde la página de detalle. */
export async function editarPedido(orderId: string, campos: { nombre?: string; telefono?: string; cedula?: string; ciudad?: string; direccion?: string; notas?: string; metodoPago?: string }): Promise<{ ok: boolean }> {
  await requireUser();
  if (!db || !orderId) return { ok: false };
  const set: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of ["nombre", "telefono", "cedula", "ciudad", "direccion", "notas", "metodoPago"] as const) {
    if (campos[k] !== undefined) set[k] = String(campos[k]).trim();
  }
  await db.update(orders).set(set).where(eq(orders.id, orderId));
  revalidatePath("/pedidos"); revalidatePath(`/pedidos/${orderId}`);
  return { ok: true };
}

/** Editar dimensiones de un producto (afectan el flete) desde el detalle del pedido. */
export async function editarDimensionesProducto(slug: string, dims: { pesoGr: number; altoCm: number; anchoCm: number; largoCm: number }): Promise<{ ok: boolean }> {
  await requireUser();
  if (!db || !slug) return { ok: false };
  await db.update(products).set({
    pesoGr: Math.max(1, Math.round(dims.pesoGr) || 1000),
    altoCm: Math.max(1, Math.round(dims.altoCm) || 15),
    anchoCm: Math.max(1, Math.round(dims.anchoCm) || 12),
    largoCm: Math.max(1, Math.round(dims.largoCm) || 8),
  }).where(eq(products.slug, slug));
  revalidatePath("/pedidos");
  return { ok: true };
}

/** Crea la guía de un pedido (MiPaquete si hay token, si no queda pendiente con costos estimados). */
export async function crearGuia(orderId: string, force?: boolean, deliveryCompanyId?: string): Promise<GuiaResult> {
  await requireUser();
  if (!db || !orderId) return { ok: false, error: "Sin datos" };

  const [o] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!o) return { ok: false, error: "Pedido no encontrado" };
  if (o.estado === "cancelado") return { ok: false, error: "El pedido está cancelado" };

  // ¿Ya tiene guía?
  const [exist] = await db.select().from(mpShipments).where(eq(mpShipments.orderId, orderId)).limit(1);
  if (exist && !force) return { ok: true, ref: o.ref, guideNumber: exist.guideNumber || "", status: exist.status || "", pending: exist.status === "pendiente", pdfUrl: exist.pdfGuideUrl || "" };

  const pkg = await paqueteDeOrden(orderId);
  const qty = pkg.qty;
  const bod = await bodegaOrigen();
  const [cfg] = await db.select().from(configEmpresa).limit(1);
  const dane = await mpBuscarDane(o.ciudad || "");

  const paymentType = (o.metodoPago === "anticipado") ? 101 : 102;
  const declaredValue = o.subtotalCop ?? o.totalCop ?? 0; // cobertura = valor del producto
  const collectionValue = paymentType === 102 ? (o.totalCop ?? 0) : 0;

  const cot = await mpCotizar({
    originDane: bod?.locationCode || "05001000", destinyDane: dane?.code || "",
    weight: pkg.pesoKg, width: pkg.ancho, height: pkg.alto, length: pkg.largo, declaredValue, paymentType,
  });
  // transportadora elegida por el asesor, o la más barata por defecto
  const c = (deliveryCompanyId ? cot.cotizaciones.find((x) => x.deliveryCompanyId === deliveryCompanyId) : null) || cot.cotizaciones[0];
  const amountToTransfer = paymentType === 102 ? Math.max(0, collectionValue - c.totalCost) : 0;

  // Crear guía real. Remitente: bodega + NIT/teléfono de la empresa. Destinatario: cliente.
  const idem = `${o.ref}`;
  const guia = await mpCrearGuia({
    origin: { name: cfg?.nombreMarca || bod?.name || "Animals Deluxe", phone: soloDig(cfg?.whatsapp || "3026333595"), idNumber: cfg?.nit || "1037633158", address: bod?.address || "Medellín", locationCode: bod?.locationCode || "05001000", email: cfg?.email || "deluxegallos@gmail.com" },
    destiny: { name: o.nombre || "Cliente", phone: soloDig(o.telefono || "3000000000"), idNumber: soloDig(o.cedula || "") || "1000000000", address: o.direccion || "Centro", locationCode: dane?.code || "" },
    pkg: { weight: pkg.pesoKg, width: pkg.ancho, height: pkg.alto, length: pkg.largo, declaredValue, description: pkg.items.map((i) => i.name).join(", ").slice(0, 120) || "Suplementos", reference: o.ref, quantity: qty },
    paymentType, collectionValue, deliveryCompanyId: c.deliveryCompanyId || MP_COMPANIES.COORDINADORA, idempotencyKey: idem,
  });

  // Si MiPaquete RECHAZÓ la guía (no fue solo "sin token"): NO tocar el pedido, devolver el error.
  if (!guia.ok && !guia.pending) {
    return { ok: false, ref: o.ref, error: traducirErrorMp(guia.error || "") };
  }

  // Guía creada → consultar número de guía + PDF (vienen tras el mpCode).
  let guideNumber = guia.guideNumber || "";
  let pdfGuideUrl = guia.pdfGuideUrl || "";
  let deliveryCompanyName = guia.deliveryCompanyName || c.deliveryCompany;
  if (guia.ok && guia.mpCode) {
    const info = await mpGetSendingInfo(guia.mpCode);
    if (info.guideNumber) guideNumber = info.guideNumber;
    if (info.pdfGuideUrl) pdfGuideUrl = info.pdfGuideUrl;
    if (info.deliveryCompanyName) deliveryCompanyName = info.deliveryCompanyName;
  }

  const status = guia.ok ? "guia_generada" : "pendiente";
  const values = {
    orderId, orderRef: o.ref, status,
    mpCode: guia.mpCode || "", guideNumber, pickupNumber: guia.pickupNumber || "",
    deliveryCompany: deliveryCompanyName, deliveryCompanyId: c.deliveryCompanyId,
    senderName: bod?.name || "Animals Deluxe", senderPhone: "573026333595", senderAddress: bod?.address || "",
    originDane: bod?.locationCode || "05001000", originCity: bod?.locationName || "Medellín",
    receiverName: o.nombre || "", receiverPhone: o.telefono || "", receiverIdNumber: o.cedula || "",
    receiverAddress: o.direccion || "", destinyDane: dane?.code || "", destinyCity: dane?.name || o.ciudad || "",
    description: pkg.items.map((i) => i.name).join(", ").slice(0, 200), productReference: o.ref, quantity: qty,
    weight: qty, declaredValue, paymentType, collectionValue, saleValue: o.totalCop ?? 0,
    shippingCost: c.shippingCost, collectionCommission: c.collectionCommission, totalCost: c.totalCost, amountToTransfer,
    pdfGuideUrl, channel: "Animals Deluxe Plataforma",
    idempotencyKey: idem, cotizacionSeleccionada: c as unknown as object, rawResponse: (guia.raw as object) ?? null,
    updatedAt: new Date(),
  };

  if (exist) {
    await db.update(mpShipments).set(values).where(eq(mpShipments.id, exist.id));
  } else {
    await db.insert(mpShipments).values(values);
  }
  // avanzar el pedido a "guia" + asegurar factura
  await db.update(orders).set({ estado: o.estado === "despachado" || o.estado === "entregado" ? o.estado : "guia", updatedAt: new Date() }).where(eq(orders.id, orderId));
  await asignarFactura(orderId);
  revalidatePath("/pedidos");
  return { ok: true, ref: o.ref, guideNumber, status, pending: !guia.ok, pdfUrl: pdfGuideUrl };
}

/** Traduce errores comunes de MiPaquete a algo entendible para el asesor. */
function traducirErrorMp(err: string): string {
  const e = err.toLowerCase();
  if (e.includes("shipping cannot be paid") || e.includes("537")) return "Tu APIKEY de MiPaquete no tiene permiso de CONTRA ENTREGA (recaudo). Comprobado: por la web de MiPaquete el contra entrega SÍ funciona con los mismos datos, pero por la API (que usa la plataforma) lo rechaza siempre con código 537, aun con saldo. Escríbele a soporte de MiPaquete y pídeles: “Activen el pago CONTRA ENTREGA (recaudo) para mi integración por API / apikey (cuenta deluxegallos@gmail.com)”. El envío anticipado por API sí funciona.";
  if (e.includes("nit")) return "Datos del remitente/destinatario incompletos (NIT/cédula).";
  if (e.includes("declaredvalue") || e.includes("declared")) return "El valor declarado no es válido.";
  if (e.includes("location") || e.includes("dane")) return "No se pudo resolver la ciudad de destino.";
  return err || "MiPaquete rechazó la guía.";
}

/** Genera guías de VARIOS pedidos (masivo). */
export async function crearGuiasBulk(orderIds: string[]): Promise<{ ok: boolean; creadas: number; pendientes: number; errores: number }> {
  await requireUser();
  const ids = (orderIds || []).filter(Boolean);
  let creadas = 0, pendientes = 0, errores = 0;
  for (const id of ids) {
    const r = await crearGuia(id, false);
    if (!r.ok) errores++;
    else if (r.pending) pendientes++;
    else creadas++;
  }
  revalidatePath("/pedidos");
  return { ok: true, creadas, pendientes, errores };
}

/** Marca guías como impresas. */
export async function marcarGuiaImpresa(orderIds: string[]): Promise<{ ok: boolean; count: number }> {
  await requireUser();
  const ids = (orderIds || []).filter(Boolean);
  if (!db || !ids.length) return { ok: false, count: 0 };
  await db.update(mpShipments).set({ impreso: true, impresoEn: new Date() }).where(inArray(mpShipments.orderId, ids));
  revalidatePath("/pedidos");
  return { ok: true, count: ids.length };
}
