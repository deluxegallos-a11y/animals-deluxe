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
import { pedidoEnvioGratis } from "@/lib/ai/shipping";

export type ItemInput = { slug: string; presentacion?: string; cantidad?: number };
export type ResolvedItem = {
  productId: string; slug: string; name: string; presentacionLabel: string;
  precioCop: number; cantidad: number; subtotalCop: number;
  shopifyVariantId?: string;
};

/** Resuelve items contra el catálogo. Lanza domainError si falta producto/stock. */
export function resolveItems(items: ItemInput[], catalog: ProductView[]): ResolvedItem[] {
  if (!items?.length) domainError("No veo productos en el pedido. ¿Cuál te empaco? 🐓");
  const out: ResolvedItem[] = [];
  for (const it of items) {
    const cantidad = Math.max(1, Math.floor(it.cantidad || 1));
    const p = catalog.find((x) => x.slug === it.slug);
    if (!p) domainError(`No encontré "${it.slug}" en el catálogo. ¿Lo buscamos de nuevo?`);
    const prod = p!;
    if ((prod.stock ?? 999) < cantidad) domainError(`Por ahora no tengo stock suficiente de ${prod.name}. 😕`);
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
  const total = Math.max(0, subtotal - descuento) + Math.max(0, envioCop);
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
  cupon?: string;
  metodo?: "contraentrega" | "anticipado";
  catalog: ProductView[];
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
  // Flete con la tabla de zonas desde Medellín (valor real → sobreflete + recargo + gratis).
  const subtotalProductos = resolved.reduce((s, r) => s + r.subtotalCop, 0);
  const unidades = resolved.reduce((s, r) => s + r.cantidad, 0);
  const envioGratis = pedidoEnvioGratis(
    resolved.map((r) => ({
      slug: r.slug,
      envioGratis: input.catalog.find((p) => p.slug === r.slug)?.envioGratis,
    })),
  );
  const cobertura = await cotizarEnvio(input.ciudad, {
    subtotalCop: subtotalProductos,
    unidades,
    metodo,
    envioGratis,
  });
  const envio = cobertura.costo_envio;
  const coupon = input.cupon ? await validateCoupon(input.cupon) : null;
  const totals = computeTotals(resolved, envio, coupon ? { tipo: coupon.tipo || "porcentaje", valor: coupon.valor } : null);
  const idem = idempotencyKey(input.subId, metodo, resolved);

  if (!db) {
    // Modo demo: no persiste, devuelve un pedido calculado.
    return {
      pedido_id: "demo-order", ref: shortCode("AD"),
      subtotal_cop: totals.subtotal, descuento_cop: totals.descuento,
      envio_cop: totals.envio, total_cop: totals.total, estado: "pendiente_confirmacion",
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
      estado: existing.estado || "pendiente_confirmacion",
      asesor: { nombre: "", whatsapp: "" }, reused: true,
      items: resolved,
    };
  }

  const asesor = await assignAdvisor();
  const [created] = await db
    .insert(orders)
    .values({
      ref: shortCode("AD"),
      customerId: input.customerId.startsWith("demo-") ? null : input.customerId,
      estado: "pendiente_confirmacion",
      metodoPago: metodo,
      subtotalCop: totals.subtotal, descuentoCop: totals.descuento,
      envioCop: totals.envio, totalCop: totals.total,
      ciudad: input.ciudad, direccion: input.direccion, telefono: input.telefono, nombre: input.nombre,
      couponId: coupon?.id ?? null,
      advisorId: "id" in asesor ? (asesor as { id: string }).id : null,
      idempotencyKey: idem,
    })
    .returning();

  await db.insert(orderItems).values(
    resolved.map((r) => ({
      orderId: created.id, productId: r.productId.startsWith("prod-") ? null : r.productId,
      productSlug: r.slug, productName: r.name, presentacionLabel: r.presentacionLabel,
      precioCop: r.precioCop, cantidad: r.cantidad, subtotalCop: r.subtotalCop,
    })),
  );

  return {
    pedido_id: created.id, ref: created.ref,
    subtotal_cop: totals.subtotal, descuento_cop: totals.descuento,
    envio_cop: totals.envio, total_cop: totals.total, estado: created.estado || "pendiente_confirmacion",
    asesor: { nombre: asesor.nombre, whatsapp: asesor.whatsapp || "" }, reused: false,
    items: resolved,
  };
}
