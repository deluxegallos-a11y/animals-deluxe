/* ===========================================================
   Motor de pedidos (contraentrega). Lógica pura testeable +
   creación en DB con idempotencia y asignación round-robin.
   =========================================================== */
import crypto from "node:crypto";
import { and, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { orders, orderItems } from "@/lib/db/schema";
import type { ProductView } from "@/lib/ai/types";
import { domainError } from "@/lib/ai/bridge";
import { shortCode } from "@/lib/ai/format";
import { assignAdvisor, cotizarEnvio, validateCoupon } from "@/lib/ai/data";
import { FREE_SHIPPING_SLUGS } from "@/lib/ai/shipping";
import { currentTenantId } from "@/lib/ai/tenant";

export type ItemInput = { slug: string; presentacion?: string; cantidad?: number };
export type ResolvedItem = {
  productId: string; slug: string; name: string; presentacionLabel: string;
  precioCop: number; cantidad: number; subtotalCop: number;
  shopifyVariantId?: string;
};

/**
 * Parsea items en TEXTO PLANO ("American Rooster Fury x2", "2 Energy Cobra", varios
 * separados por salto de línea / ; / +).
 *
 * REGLA DE ORO (bug $385M · pedido AD-H3GW): la cantidad NUNCA sale de un número que
 * viva DENTRO del nombre del producto. Muchos productos llevan cifras en el nombre
 * ("CyanoMax B12 5500", "Super Energy 77", "Hunk 160", "Energy 500"): esos dígitos son
 * parte del NOMBRE, jamás la cantidad. Solo se toma como cantidad:
 *   1) un multiplicador EXPLÍCITO — "x2", "2 unidades/tarros/frascos/productos"; o
 *   2) un número al INICIO cuyo resto resuelve a un producto real — "2 Energy Cobra".
 * `resolves(name)` decide (2): debe devolver true si `name` es un producto del catálogo.
 */
export function parsePlainItems(
  text: string,
  resolves: (name: string) => boolean,
): { name: string; cantidad: number }[] {
  const out: { name: string; cantidad: number }[] = [];
  for (const part of String(text).split(/[\n;]+|\s\+\s/).map((s) => s.trim()).filter(Boolean)) {
    // 1) Multiplicador EXPLÍCITO. "x2" o "2 und/unidades/tarros/frascos/productos".
    const mX = part.match(/\bx\s*(\d+)\b/i) || part.match(/\b(\d+)\s*(?:und|unid|unidades|productos?|tarros?|frascos?)\b/i);
    if (mX) {
      const name = part.replace(mX[0], " ").replace(/[,x·\-\s]+$/i, "").replace(/^[,x·\-\s]+/i, "").trim();
      if (name) out.push({ name, cantidad: Math.max(1, parseInt(mX[1], 10)) });
      continue;
    }
    // 2) Número al INICIO ("2 Energy Cobra") SOLO si el resto es un producto real.
    const mIni = part.match(/^\s*(\d+)\s+(.+)/);
    if (mIni && resolves(mIni[2].trim())) {
      out.push({ name: mIni[2].trim(), cantidad: Math.max(1, parseInt(mIni[1], 10)) });
      continue;
    }
    // 3) Por defecto: TODO el texto es el NOMBRE y la cantidad es 1. Los números del
    //    nombre se conservan para resolver el producto correcto (nunca son cantidad).
    const name = part.replace(/^[,x·\-\s]+/i, "").trim();
    if (name) out.push({ name, cantidad: 1 });
  }
  return out;
}

/** Resuelve items contra el catálogo. Lanza domainError si falta producto/stock. */
export function resolveItems(items: ItemInput[], catalog: ProductView[]): ResolvedItem[] {
  if (!items?.length) domainError("No veo productos en el pedido. ¿Cuál te empaco? 🐓");
  const out: ResolvedItem[] = [];
  for (const it of items) {
    let cantidad = Math.max(1, Math.floor(it.cantidad || 1));
    const p = catalog.find((x) => x.slug === it.slug);
    if (!p) domainError(`No encontré "${it.slug}" en el catálogo. ¿Lo buscamos de nuevo?`);
    const prod = p!;
    // Animals Deluxe vende bajo demanda (contra entrega), NO lleva inventario unitario.
    // El catálogo ya solo incluye productos activos → si está aquí, está disponible.
    // El stock SOLO bloquea si el dueño activó `controlStock` en ese producto (M4).
    // Sin esa bandera, un stock 0/null jamás tumba una venta cerrada.
    if (prod.controlStock && (prod.stock ?? 0) <= 0) {
      domainError(`Justo se me agotó el ${prod.name} 😕 ¿Te muestro una alternativa parecida?`);
    }
    // Mínimo de unidades por envío (M6.3): ciertos goteros solo se despachan de a 2+.
    // Se SUBE la cantidad al mínimo (no se rechaza el pedido) y el total se recalcula solo.
    const minU = Math.max(1, prod.minUnidades ?? 1);
    if (cantidad < minU) cantidad = minU;
    // precio por presentación (si se indicó y existe)
    let label = prod.presentations[0]?.label || "Unidad";
    let precio = prod.presentations[0]?.priceCOP ?? prod.priceCOP;
    let shopifyVariantId = prod.presentations[0]?.shopifyVariantId;
    if (it.presentacion) {
      const pres = prod.presentations.find((pr) => pr.label.toLowerCase().includes(it.presentacion!.toLowerCase()));
      if (pres) { label = pres.label; precio = pres.priceCOP; shopifyVariantId = pres.shopifyVariantId; }
    }
    out.push({
      productId: prod.id, slug: prod.slug, name: prod.name,
      presentacionLabel: label, precioCop: precio, cantidad, subtotalCop: precio * cantidad,
      shopifyVariantId,
    });
  }
  return out;
}

export type CouponView = { tipo: string; valor: number } | null;

export function computeTotals(resolved: ResolvedItem[], envioCop: number, coupon: CouponView) {
  const subtotal = resolved.reduce((s, r) => s + r.subtotalCop, 0);
  let descuento = 0;
  if (coupon) {
    descuento = coupon.tipo === "porcentaje"
      ? Math.round((subtotal * coupon.valor) / 100)
      : coupon.valor;
    descuento = Math.min(descuento, subtotal);
  }
  // El total a RECAUDAR = solo el producto (menos descuento). El flete NO se suma: es un estimado
  // referencial para el cliente; la transportadora (MiPaquete) le cobra el flete real aparte.
  const total = Math.max(0, subtotal - descuento);
  return { subtotal, descuento, envio: Math.max(0, envioCop), total };
}

/** Clave de idempotencia: incluye método (lección checkout-idempotency-por-método). */
export function idempotencyKey(subId: string, metodo: string, resolved: ResolvedItem[]): string {
  const sig = resolved
    .map((r) => `${r.slug}|${r.presentacionLabel}|${r.cantidad}`)
    .sort()
    .join(",");
  return crypto.createHash("sha256").update(`${subId}:${metodo}:${sig}`).digest("hex").slice(0, 40);
}

export interface CreateOrderInput {
  subId: string;
  customerId: string;
  items: ItemInput[];
  nombre: string;
  telefono: string;
  ciudad: string;
  direccion: string;
  cedula?: string;
  cupon?: string;
  metodo?: "contraentrega" | "anticipado";
  canal?: string; // whatsapp | messenger | web
  catalog: ProductView[];
  /** Estado inicial. Default "remision". La salvaguarda de sensatez lo pone en
   *  "por_revisar" cuando la cantidad o el total son sospechosos (bug $385M). */
  estado?: string;
  notas?: string;
}

export interface CreatedOrder {
  pedido_id: string; ref: string; subtotal_cop: number; descuento_cop: number;
  envio_cop: number; total_cop: number; estado: string;
  asesor: { nombre: string; whatsapp: string };
  reused: boolean;
  items: ResolvedItem[];
}

/** Crea (o devuelve, si es idempotente) un pedido COD. */
export async function createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  const metodo = input.metodo || "contraentrega";
  const resolved = resolveItems(input.items, input.catalog);
  const unidades = resolved.reduce((s, r) => s + r.cantidad, 0);
  // Flete = $20.000 + 7% del valor de los productos que SÍ pagan envío (los de
  // envío-incluido no suman a la base; si TODOS son gratis → flete 0).
  const esGratis = (slug: string) => !!input.catalog.find((p) => p.slug === slug)?.envioGratis
    || FREE_SHIPPING_SLUGS.has(slug);
  const subtotalNoGratis = resolved.reduce((s, r) => s + (esGratis(r.slug) ? 0 : r.subtotalCop), 0);
  const envioGratis = subtotalNoGratis <= 0;
  const cobertura = await cotizarEnvio(input.ciudad, {
    subtotalCop: subtotalNoGratis,
    unidades,
    metodo,
    envioGratis,
  });
  const envio = cobertura.costo_envio;
  const coupon = input.cupon ? await validateCoupon(input.cupon) : null;
  const totals = computeTotals(resolved, envio, coupon ? { tipo: coupon.tipo || "porcentaje", valor: coupon.valor } : null);
  const tid = await currentTenantId(); // tenant actual (multitenant)
  const idem = idempotencyKey(`${tid || "default"}:${input.subId}`, metodo, resolved);
  const paymentType: "contra_entrega" | "anticipado" = metodo === "anticipado" ? "anticipado" : "contra_entrega";

  if (!db) {
    // Modo demo: no persiste, devuelve un pedido calculado.
    return {
      pedido_id: "demo-order", ref: shortCode("AD"),
      subtotal_cop: totals.subtotal, descuento_cop: totals.descuento,
      envio_cop: totals.envio, total_cop: totals.total, estado: input.estado || "remision",
      asesor: { nombre: "Asesor Animals Deluxe", whatsapp: process.env.NEXT_PUBLIC_WHATSAPP || "" },
      reused: false,
      items: resolved,
    };
  }

  // idempotencia: mismo cliente+items+método en la última hora → devuelve el existente
  const since = new Date(Date.now() - 3600_000);
  const [existing] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.idempotencyKey, idem), gte(orders.createdAt, since)))
    .limit(1);
  if (existing) {
    return {
      pedido_id: existing.id, ref: existing.ref,
      subtotal_cop: existing.subtotalCop ?? 0, descuento_cop: existing.descuentoCop ?? 0,
      envio_cop: existing.envioCop ?? 0, total_cop: existing.totalCop ?? 0,
      estado: existing.estado || "remision",
      asesor: { nombre: "", whatsapp: "" }, reused: true,
      items: resolved,
    };
  }

  const asesor = await assignAdvisor();
  const [created] = await db
    .insert(orders)
    .values({
      tenantId: tid,
      ref: shortCode("AD"),
      customerId: input.customerId.startsWith("demo-") ? null : input.customerId,
      estado: input.estado || "remision",
      notas: input.notas || "",
      canal: input.canal || "whatsapp",
      metodoPago: metodo,
      paymentType,
      subtotalCop: totals.subtotal, descuentoCop: totals.descuento,
      envioCop: totals.envio, totalCop: totals.total,
      ciudad: input.ciudad, direccion: input.direccion, telefono: input.telefono, nombre: input.nombre,
      cedula: input.cedula || "",
      couponId: coupon?.id ?? null,
      advisorId: "id" in asesor ? (asesor as { id: string }).id : null,
      idempotencyKey: idem,
    })
    .returning();

  await db.insert(orderItems).values(
    resolved.map((r) => ({
      tenantId: tid, orderId: created.id, productId: r.productId.startsWith("prod-") ? null : r.productId,
      productSlug: r.slug, productName: r.name, presentacionLabel: r.presentacionLabel,
      precioCop: r.precioCop, cantidad: r.cantidad, subtotalCop: r.subtotalCop,
    })),
  );

  return {
    pedido_id: created.id, ref: created.ref,
    subtotal_cop: totals.subtotal, descuento_cop: totals.descuento,
    envio_cop: totals.envio, total_cop: totals.total, estado: created.estado || "remision",
    asesor: { nombre: asesor.nombre, whatsapp: asesor.whatsapp || "" }, reused: false,
    items: resolved,
  };
}
