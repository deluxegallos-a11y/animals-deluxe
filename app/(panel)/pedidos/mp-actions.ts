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
import { orders, orderItems, mpShipments, mpAddresses, configEmpresa } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { mpBuscarDane, mpCotizar, mpCrearGuia, MP_COMPANIES } from "@/lib/mipaquete";

export interface GuiaResult { ok: boolean; ref?: string; guideNumber?: string; status?: string; pending?: boolean; pdfUrl?: string; error?: string }

async function bodegaOrigen() {
  if (!db) return null;
  const [b] = await db.select().from(mpAddresses).where(eq(mpAddresses.isDefault, true)).limit(1);
  return b || (await db.select().from(mpAddresses).limit(1))[0] || null;
}

export interface Transportadora { company: string; id: string; flete: number; comision: number; total: number }
/** Cotiza un pedido con MiPaquete → lista de transportadoras para que el asesor elija. */
export async function cotizarPedido(orderId: string): Promise<{ ok: boolean; source?: string; ciudad?: string; sinDane?: boolean; transportadoras?: Transportadora[]; error?: string }> {
  await requireUser();
  if (!db || !orderId) return { ok: false, error: "Sin datos" };
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!o) return { ok: false, error: "Pedido no encontrado" };
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const qty = items.reduce((s, it) => s + (it.cantidad ?? 1), 0) || 1;
  const bod = await bodegaOrigen();
  const dane = await mpBuscarDane(o.ciudad || "");
  const paymentType = o.metodoPago === "anticipado" ? 101 : 102;
  const declaredValue = o.subtotalCop ?? o.totalCop ?? 0;
  const cot = await mpCotizar({ originDane: bod?.locationCode || "05001000", destinyDane: dane?.code || "", weight: qty, declaredValue, paymentType });
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

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const qty = items.reduce((s, it) => s + (it.cantidad ?? 1), 0) || 1;
  const bod = await bodegaOrigen();
  const dane = await mpBuscarDane(o.ciudad || "");

  const paymentType = (o.metodoPago === "anticipado") ? 101 : 102;
  const declaredValue = o.subtotalCop ?? o.totalCop ?? 0; // cobertura = valor del producto
  const collectionValue = paymentType === 102 ? (o.totalCop ?? 0) : 0;

  const cot = await mpCotizar({
    originDane: bod?.locationCode || "05001000", destinyDane: dane?.code || "",
    weight: qty, declaredValue, paymentType,
  });
  // transportadora elegida por el asesor, o la más barata por defecto
  const c = (deliveryCompanyId ? cot.cotizaciones.find((x) => x.deliveryCompanyId === deliveryCompanyId) : null) || cot.cotizaciones[0];
  const amountToTransfer = paymentType === 102 ? Math.max(0, collectionValue - c.totalCost) : 0;

  // Crear guía real (o pending sin token)
  const idem = `${o.ref}`;
  const guia = await mpCrearGuia({
    origin: { name: bod?.name || "Animals Deluxe", phone: "573026333595", idNumber: "", address: bod?.address || "", locationCode: bod?.locationCode || "05001000" },
    destiny: { name: o.nombre || "", phone: o.telefono || "", idNumber: o.cedula || "", address: o.direccion || "", locationCode: dane?.code || "" },
    pkg: { weight: qty, width: 20, height: 20, length: 20, declaredValue, description: items.map((i) => i.productName).join(", ").slice(0, 120), reference: o.ref, quantity: qty },
    paymentType, collectionValue, deliveryCompanyId: c.deliveryCompanyId || MP_COMPANIES.COORDINADORA, idempotencyKey: idem,
  });

  const status = guia.ok ? "guia_generada" : "pendiente";
  const values = {
    orderId, orderRef: o.ref, status,
    mpCode: guia.mpCode || "", guideNumber: guia.guideNumber || "", pickupNumber: guia.pickupNumber || "",
    deliveryCompany: guia.deliveryCompanyName || c.deliveryCompany, deliveryCompanyId: c.deliveryCompanyId,
    senderName: bod?.name || "Animals Deluxe", senderPhone: "573026333595", senderAddress: bod?.address || "",
    originDane: bod?.locationCode || "05001000", originCity: bod?.locationName || "Medellín",
    receiverName: o.nombre || "", receiverPhone: o.telefono || "", receiverIdNumber: o.cedula || "",
    receiverAddress: o.direccion || "", destinyDane: dane?.code || "", destinyCity: dane?.name || o.ciudad || "",
    description: items.map((i) => i.productName).join(", ").slice(0, 200), productReference: o.ref, quantity: qty,
    weight: qty, declaredValue, paymentType, collectionValue, saleValue: o.totalCop ?? 0,
    shippingCost: c.shippingCost, collectionCommission: c.collectionCommission, totalCost: c.totalCost, amountToTransfer,
    pdfGuideUrl: guia.pdfGuideUrl || "", channel: "Animals Deluxe Plataforma",
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
  // Si MiPaquete falló (no fue solo "sin token"), propaga el error real para mostrarlo.
  if (!guia.ok && !guia.pending) return { ok: false, ref: o.ref, status, error: traducirErrorMp(guia.error || "") };
  return { ok: true, ref: o.ref, guideNumber: guia.guideNumber || "", status, pending: !guia.ok, pdfUrl: guia.pdfGuideUrl || "" };
}

/** Traduce errores comunes de MiPaquete a algo entendible para el asesor. */
function traducirErrorMp(err: string): string {
  const e = err.toLowerCase();
  if (e.includes("shipping cannot be paid") || e.includes("537")) return "MiPaquete no puede cobrar el flete: te falta saldo en tu cuenta MiPaquete. Recarga saldo (el flete supera tu saldo actual) y vuelve a intentar.";
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
